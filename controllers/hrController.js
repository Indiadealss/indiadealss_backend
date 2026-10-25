import mongoose from "mongoose";
import bcrypt from "bcrypt";
import HrUser, { hrOrgUsername } from "../models/hr/HrUser.js";
import HrEmployee from "../models/hr/HrEmployee.js";
import HrAttendance from "../models/hr/HrAttendance.js";
import HrLeave, { LEAVE_TYPES } from "../models/hr/HrLeave.js";
import HrSettings from "../models/hr/HrSettings.js";
import HrSalary from "../models/hr/HrSalary.js";
import makeHrSample from "../utils/hrSample.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const isId = (v) => mongoose.isValidObjectId(v);

// Punches are stamped with India time, whatever timezone the server runs in.
const istNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
};

// Employee logins only see and act on their own records
const isEmployee = (req) => req.hrUser?.role === "employee";
const ownId = (req) => req.hrEmployee?._id;

const getSettings = async () => (await HrSettings.findOne({ key: "company" })) || new HrSettings();

// Working days between two dates, skipping weekly offs and holidays
const countLeaveDays = (from, to, settings) => {
  const hol = new Set(settings.holidays.map((h) => h.date));
  let days = 0;
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    if (!hol.has(ds) && !settings.weeklyOff.includes(d.getUTCDay())) days++;
  }
  return days;
};

// ---------- settings ----------

export const getHrSettings = async (req, res) => {
  try {
    const settings = await HrSettings.findOne({ key: "company" });
    res.json({ settings });
  } catch (err) { serverError(res, err); }
};

export const updateHrSettings = async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};
    if (b.company !== undefined) update.company = String(b.company).trim() || "IndiaDeals";
    if (Array.isArray(b.sites)) update.sites = b.sites.map((s) => String(s).trim()).filter(Boolean);
    if (Array.isArray(b.weeklyOff)) update.weeklyOff = b.weeklyOff.map(Number).filter((n) => n >= 0 && n <= 6);
    if (Array.isArray(b.holidays)) {
      update.holidays = b.holidays
        .filter((h) => h && DATE_RE.test(h.date) && String(h.name || "").trim())
        .map((h) => ({ date: h.date, name: String(h.name).trim() }));
    }
    for (const k of ["graceMins", "lateLimit", "halfDayHours", "pt"]) {
      if (b[k] !== undefined) update[k] = Math.max(0, Number(b[k]) || 0);
    }
    if (b.quota) {
      for (const t of ["CL", "SL", "EL"]) {
        if (b.quota[t] !== undefined) update["quota." + t] = Math.max(0, Number(b.quota[t]) || 0);
      }
    }
    const settings = await HrSettings.findOneAndUpdate(
      { key: "company" }, { $set: update }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ settings });
  } catch (err) { serverError(res, err); }
};

// ---------- employees ----------

const employeeFields = (b) => {
  const out = {};
  for (const k of ["code", "name", "fatherName", "dept", "designation", "base"]) if (b[k] !== undefined) out[k] = String(b[k]).trim();
  for (const k of ["gross", "tds", "basic"]) if (b[k] !== undefined) out[k] = Math.max(0, Number(b[k]) || 0);
  if (b.shift !== undefined) out.shift = TIME_RE.test(b.shift) ? b.shift : "09:30";
  if (b.joined !== undefined) out.joined = DATE_RE.test(b.joined) ? b.joined : "";
  if (b.active !== undefined) out.active = !!b.active;
  return out;
};

const duplicateCode = (res, err) => {
  if (err?.code === 11000) {
    res.status(409).json({ message: "That employee code is already in use. Pick another code." });
    return true;
  }
  if (err?.name === "ValidationError") {
    res.status(400).json({ message: Object.values(err.errors)[0]?.message || "Invalid employee details" });
    return true;
  }
  return false;
};

// ---------- employee logins ----------
// The admin sets an employee's password from the employee form. The employee then signs in with
// the organisation username + their employee code + that password.

const loginCode = (code) => String(code || "").toUpperCase().trim();

// Password from the employee form: undefined when not being changed, or an error message
const readPassword = (b) => {
  if (b.password === undefined || b.password === null || b.password === "") return { password: undefined };
  const password = String(b.password);
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  return { password };
};

// Another login (the admin, or another employee) already uses this code?
const codeTakenByLogin = (code, employeeId) =>
  HrUser.exists({ employeeCode: loginCode(code), $or: [{ employee: { $exists: false } }, { employee: { $ne: employeeId } }] });

// Keeps the employee's login in step with the record: code and name follow the employee,
// and the login is created the first time a password is set.
const syncEmployeeLogin = async (employee, password) => {
  const login = await HrUser.findOne({ employee: employee._id });
  if (!login && !password) return;
  const update = { name: employee.name, employeeCode: loginCode(employee.code) };
  if (password) update.password = await bcrypt.hash(password, 10);
  if (login) {
    Object.assign(login, update);
    await login.save();
  } else {
    await HrUser.create({ ...update, username: hrOrgUsername(), role: "employee", employee: employee._id });
  }
};

const withLoginFlag = async (employees) => {
  const ids = new Set((await HrUser.find({ role: "employee" }).select("employee")).map((u) => String(u.employee)));
  return employees.map((e) => ({ ...e.toJSON(), hasLogin: ids.has(String(e._id)) }));
};

const CODE_TAKEN = "That employee code is already used for a login. Pick another code.";

export const getHrEmployees = async (req, res) => {
  try {
    if (isEmployee(req)) return res.json({ employees: await withLoginFlag([req.hrEmployee]) });
    const employees = await HrEmployee.find().sort({ code: 1 });
    res.json({ employees: await withLoginFlag(employees) });
  } catch (err) { serverError(res, err); }
};

export const createHrEmployee = async (req, res) => {
  try {
    const b = req.body || {};
    const { password, error } = readPassword(b);
    if (error) return res.status(400).json({ message: error });
    if (b.code && await codeTakenByLogin(b.code)) return res.status(409).json({ message: CODE_TAKEN });

    const employee = await HrEmployee.create(employeeFields(b));
    await syncEmployeeLogin(employee, password);
    res.status(201).json({ employee: (await withLoginFlag([employee]))[0] });
  } catch (err) { if (!duplicateCode(res, err)) serverError(res, err); }
};

export const updateHrEmployee = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Employee not found" });
    const b = req.body || {};
    const { password, error } = readPassword(b);
    if (error) return res.status(400).json({ message: error });
    if (b.code && await codeTakenByLogin(b.code, req.params.id)) return res.status(409).json({ message: CODE_TAKEN });

    const employee = await HrEmployee.findByIdAndUpdate(req.params.id, { $set: employeeFields(b) }, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    await syncEmployeeLogin(employee, password);
    res.json({ employee: (await withLoginFlag([employee]))[0] });
  } catch (err) { if (!duplicateCode(res, err)) serverError(res, err); }
};

export const deleteHrEmployee = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Employee not found" });
    const employee = await HrEmployee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    // an employee's punches, leave and salary rows go with them
    await Promise.all([
      HrAttendance.deleteMany({ emp: employee._id }),
      HrLeave.deleteMany({ emp: employee._id }),
      HrSalary.deleteMany({ emp: employee._id }),
      HrUser.deleteMany({ employee: employee._id })
    ]);
    res.json({ message: "Employee deleted" });
  } catch (err) { serverError(res, err); }
};

// ---------- attendance ----------

export const getHrAttendance = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) {
      return res.status(400).json({ message: "from and to must be dates (YYYY-MM-DD)" });
    }
    const filter = { date: { $gte: from, $lte: to } };
    if (isEmployee(req)) filter.emp = ownId(req);
    const attendance = await HrAttendance.find(filter);
    res.json({ attendance });
  } catch (err) { serverError(res, err); }
};

// Punch in, or punch out if already in. Time comes from the server clock.
export const punchHr = async (req, res) => {
  try {
    const { loc } = req.body || {};
    // employees can only punch for themselves
    const emp = isEmployee(req) ? String(ownId(req)) : req.body?.emp;
    if (!isId(emp)) return res.status(400).json({ message: "Pick an employee" });
    const employee = await HrEmployee.findById(emp);
    if (!employee || !employee.active) return res.status(404).json({ message: "Employee not found" });

    const { date, time } = istNow();
    const rec = (await HrAttendance.findOne({ emp, date })) || new HrAttendance({ emp, date });
    if (!rec.in) {
      const settings = await getSettings();
      rec.in = time;
      rec.loc = settings.sites.includes(loc) ? loc : employee.base || settings.sites[0] || "";
    } else if (!rec.out) {
      rec.out = time;
    } else {
      return res.status(409).json({ message: `${employee.name} has already punched out today` });
    }
    await rec.save();
    res.json({ attendance: rec });
  } catch (err) { serverError(res, err); }
};

// HR correction from the muster roll: ov = "P" | "HD" | "A", or null to go back to the punch record
export const overrideHrAttendance = async (req, res) => {
  try {
    const { emp, date, ov } = req.body || {};
    if (!isId(emp) || !DATE_RE.test(date || "")) return res.status(400).json({ message: "Employee and date are required" });
    if (ov != null && !["P", "HD", "A"].includes(ov)) return res.status(400).json({ message: "Invalid status" });
    if (date > istNow().date) return res.status(400).json({ message: "You can't mark a future day" });
    if (!(await HrEmployee.exists({ _id: emp }))) return res.status(404).json({ message: "Employee not found" });

    let rec = await HrAttendance.findOne({ emp, date });
    if (ov == null) {
      if (!rec) return res.json({ attendance: null, removed: { emp, date } });
      rec.ov = undefined;
      if (!rec.in && !rec.out) {
        await rec.deleteOne();
        return res.json({ attendance: null, removed: { emp, date } });
      }
    } else {
      rec = rec || new HrAttendance({ emp, date });
      rec.ov = ov;
    }
    await rec.save();
    res.json({ attendance: rec });
  } catch (err) { serverError(res, err); }
};

// ---------- leave ----------

export const getHrLeaves = async (req, res) => {
  try {
    const leaves = await HrLeave.find(isEmployee(req) ? { emp: ownId(req) } : {}).sort({ from: -1 });
    res.json({ leaves });
  } catch (err) { serverError(res, err); }
};

export const createHrLeave = async (req, res) => {
  try {
    const { type, from, to, reason } = req.body || {};
    // employees apply for themselves, and their leave always waits for approval
    const emp = isEmployee(req) ? String(ownId(req)) : req.body?.emp;
    const status = isEmployee(req) ? "pending" : req.body?.status;
    if (!isId(emp) || !(await HrEmployee.exists({ _id: emp }))) return res.status(400).json({ message: "Pick an employee" });
    if (!LEAVE_TYPES.includes(type)) return res.status(400).json({ message: "Pick a leave type" });
    if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) return res.status(400).json({ message: "From and to dates are required" });
    if (to < from) return res.status(400).json({ message: "The end date is before the start date." });

    const days = countLeaveDays(from, to, await getSettings());
    if (!days) return res.status(400).json({ message: "Those dates are all weekly offs or holidays." });

    const leave = await HrLeave.create({
      emp, type, from, to, days,
      reason: String(reason || "").trim(),
      status: status === "approved" ? "approved" : "pending",
      applied: istNow().date
    });
    res.status(201).json({ leave });
  } catch (err) { serverError(res, err); }
};

export const updateHrLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (!isId(req.params.id)) return res.status(404).json({ message: "Leave not found" });
    const leave = await HrLeave.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    res.json({ leave });
  } catch (err) { serverError(res, err); }
};

export const deleteHrLeave = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Leave not found" });
    const leave = await HrLeave.findByIdAndDelete(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    res.json({ message: "Leave deleted" });
  } catch (err) { serverError(res, err); }
};

// ---------- salary sheet ----------
// HRA is 40% and TA 5% of basic. Overtime is paid at basic / 30 days / 8 hours per hour.
// Net = basic + HRA + TA + overtime pay. Week off, revenue target and achievement are recorded only.

const MONTH_RE = /^\d{4}-\d{2}$/;
const HRA_RATE = 0.4;
const TA_RATE = 0.05;
const OT_DIVISOR = 30 * 8;
const SALARY_NUMBERS = ["basic", "overtimeHrs", "weekOff", "revenueTarget", "achievement"];

// Weekly-off days in the month, the starting week off count for an unsaved row
const weeklyOffsIn = (month, weeklyOff) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= last; d++) if (weeklyOff.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())) n++;
  return n;
};

const salaryRow = (employee, rec, defaultWeekOff) => {
  const basic = rec ? rec.basic : employee.basic || 0;
  const overtimeHrs = rec?.overtimeHrs || 0;
  const hra = Math.round(basic * HRA_RATE);
  const ta = Math.round(basic * TA_RATE);
  const otPay = Math.round((basic / OT_DIVISOR) * overtimeHrs);
  return {
    emp: String(employee._id),
    code: employee.code,
    name: employee.name,
    fatherName: employee.fatherName || "",
    dept: employee.dept,
    basic, hra, ta, overtimeHrs, otPay,
    weekOff: rec ? rec.weekOff : defaultWeekOff,
    revenueTarget: rec?.revenueTarget || 0,
    achievement: rec?.achievement || 0,
    net: basic + hra + ta + otPay,
    saved: !!rec
  };
};

// Active employees, plus anyone who already has a row for that month
const salarySheet = async (month) => {
  const [recs, settings] = await Promise.all([HrSalary.find({ month }), getSettings()]);
  const byEmp = new Map(recs.map((r) => [String(r.emp), r]));
  const employees = await HrEmployee.find({ $or: [{ active: true }, { _id: { $in: recs.map((r) => r.emp) } }] }).sort({ code: 1 });
  const defaultWeekOff = weeklyOffsIn(month, settings.weeklyOff);
  return employees.map((e) => salaryRow(e, byEmp.get(String(e._id)), defaultWeekOff));
};

export const getHrSalary = async (req, res) => {
  try {
    const { month } = req.query;
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ message: "month must be YYYY-MM" });
    res.json({ month, rows: await salarySheet(month) });
  } catch (err) { serverError(res, err); }
};

// Saves the whole month. Father name and basic are also kept on the employee,
// so next month's sheet starts from them.
export const saveHrSalary = async (req, res) => {
  try {
    const { month, rows } = req.body || {};
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ message: "month must be YYYY-MM" });
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be a list" });

    const valid = rows.filter((r) => r && isId(r.emp));
    const known = new Set((await HrEmployee.find({ _id: { $in: valid.map((r) => r.emp) } }).select("_id")).map((e) => String(e._id)));
    const clean = valid.filter((r) => known.has(String(r.emp))).map((r) => ({
      emp: r.emp,
      fatherName: r.fatherName === undefined ? undefined : String(r.fatherName).trim(),
      nums: Object.fromEntries(SALARY_NUMBERS.map((k) => [k, Math.max(0, Number(r[k]) || 0)]))
    }));

    if (clean.length) {
      await HrSalary.bulkWrite(clean.map((r) => ({
        updateOne: { filter: { emp: r.emp, month }, update: { $set: r.nums }, upsert: true }
      })));
      await HrEmployee.bulkWrite(clean.map((r) => ({
        updateOne: {
          filter: { _id: r.emp },
          update: { $set: { basic: r.nums.basic, ...(r.fatherName !== undefined && { fatherName: r.fatherName }) } }
        }
      })));
    }
    res.json({ month, rows: await salarySheet(month) });
  } catch (err) { serverError(res, err); }
};

// ---------- sample company ----------

export const loadHrSample = async (req, res) => {
  try {
    if (await HrEmployee.exists({})) {
      return res.status(409).json({ message: "The sample company can only be loaded into an empty register." });
    }
    const smp = makeHrSample(istNow().date);
    await HrSettings.findOneAndUpdate({ key: "company" }, { $set: smp.settings }, { upsert: true, setDefaultsOnInsert: true });
    const emps = await HrEmployee.insertMany(smp.employees);
    const idOf = Object.fromEntries(emps.map((e) => [e.code, e._id]));
    await HrAttendance.insertMany(smp.attendance.map((a) => ({ ...a, emp: idOf[a.emp] })));
    await HrLeave.insertMany(smp.leaves.map((l) => ({ ...l, emp: idOf[l.emp] })));
    res.status(201).json({ message: "Sample company loaded" });
  } catch (err) { serverError(res, err); }
};

export const clearHrSample = async (req, res) => {
  try {
    const sampleEmps = await HrEmployee.find({ sample: true }).select("_id");
    const ids = sampleEmps.map((e) => e._id);
    await Promise.all([
      HrAttendance.deleteMany({ $or: [{ sample: true }, { emp: { $in: ids } }] }),
      HrLeave.deleteMany({ $or: [{ sample: true }, { emp: { $in: ids } }] }),
      HrSalary.deleteMany({ emp: { $in: ids } }),
      HrEmployee.deleteMany({ _id: { $in: ids } }),
      HrUser.deleteMany({ employee: { $in: ids } })
    ]);
    // rules and holidays stay, only the sample company name goes
    await HrSettings.updateOne({ key: "company", sample: true }, { $set: { sample: false, company: "IndiaDeals" } });
    res.json({ message: "Sample data cleared", removed: ids.length });
  } catch (err) { serverError(res, err); }
};
