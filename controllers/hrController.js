import mongoose from "mongoose";
import bcrypt from "bcrypt";
import HrUser, { hrOrgUsername } from "../models/hr/HrUser.js";
import HrEmployee, { CRM_ROLES } from "../models/hr/HrEmployee.js";
import HrAttendance from "../models/hr/HrAttendance.js";
import HrLeave, { LEAVE_TYPES, QUOTA_TYPES } from "../models/hr/HrLeave.js";
import HrSettings from "../models/hr/HrSettings.js";
import HrSalary from "../models/hr/HrSalary.js";
import { HrPayslip, HrRevision, HrAdjustment, HrLoan, HrTaxDeclaration, HrSettlement } from "../models/hr/HrPayroll.js";
import { HrRequest, HrPost } from "../models/hr/HrPortal.js";
import { monthLocked, rangeLocked } from "./hrPayrollController.js";
import { cleanStructure, shiftWindow, structureTotal } from "../utils/hrPayroll.js";
import makeHrSample from "../utils/hrSample.js";
import { deleteEmployeeDocuments } from "./hrDocumentController.js";

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

// Settings as the app sees them: designations from the old flat list join the map as "all departments"
const withDesignations = (doc) => {
  const s = doc.toJSON ? doc.toJSON() : doc;
  const map = [...(s.designationMap || [])];
  for (const name of s.designations || []) {
    if (!map.some((d) => d.name.toLowerCase() === name.toLowerCase())) map.push({ name, dept: "" });
  }
  return { ...s, departments: s.departments || [], designationMap: map };
};

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
    // before HR first saves settings, send the defaults (incl. department / designation lists)
    const settings = (await HrSettings.findOne({ key: "company" })) || new HrSettings();
    res.json({ settings: withDesignations(settings) });
  } catch (err) { serverError(res, err); }
};

export const updateHrSettings = async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};
    if (b.company !== undefined) update.company = String(b.company).trim() || "IndiaDeals";
    if (Array.isArray(b.sites)) update.sites = b.sites.map((s) => String(s).trim()).filter(Boolean);
    if (Array.isArray(b.departments)) update.departments = [...new Set(b.departments.map((s) => String(s).trim().slice(0, 80)).filter(Boolean))];
    if (Array.isArray(b.designationMap)) {
      const seen = new Set();
      update.designationMap = b.designationMap
        .map((d) => ({ name: String(d?.name || "").trim().slice(0, 80), dept: String(d?.dept || "").trim().slice(0, 80) }))
        .filter((d) => d.name && !seen.has(`${d.dept}\u0000${d.name.toLowerCase()}`) && seen.add(`${d.dept}\u0000${d.name.toLowerCase()}`));
      // the old flat list is now part of the map
      update.designations = [];
    }
    if (Array.isArray(b.shifts)) {
      const seen = new Set();
      update.shifts = b.shifts
        .map((s) => ({ name: String(s?.name || "").trim().slice(0, 60), start: String(s?.start || ""), end: String(s?.end || "") }))
        .filter((s) => s.name && TIME_RE.test(s.start) && TIME_RE.test(s.end) && s.start !== s.end
          && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()));
    }
    if (Array.isArray(b.weeklyOff)) update.weeklyOff = b.weeklyOff.map(Number).filter((n) => n >= 0 && n <= 6);
    if (Array.isArray(b.holidays)) {
      update.holidays = b.holidays
        .filter((h) => h && DATE_RE.test(h.date) && String(h.name || "").trim())
        .map((h) => ({ date: h.date, name: String(h.name).trim() }));
    }
    for (const k of ["graceMins", "lateLimit", "halfDayHours", "pt"]) {
      if (b[k] !== undefined) update[k] = Math.max(0, Number(b[k]) || 0);
    }
    for (const k of ["address", "companyPan", "tan", "pfCode", "esiCode"]) {
      if (b[k] !== undefined) update[k] = String(b[k]).trim();
    }
    // payroll rules: only known keys, numbers stay numbers and switches stay switches
    if (b.payroll && typeof b.payroll === "object") {
      const defaults = new HrSettings().toObject().payroll;
      const walk = (shape, input, path) => {
        for (const [k, def] of Object.entries(shape)) {
          if (input?.[k] === undefined) continue;
          if (def && typeof def === "object") walk(def, input[k], `${path}.${k}`);
          else if (typeof def === "boolean") update[`${path}.${k}`] = !!input[k];
          else update[`${path}.${k}`] = Math.max(0, Number(input[k]) || 0);
        }
      };
      walk(defaults, b.payroll, "payroll");
      for (const k of ["payroll.shiftHours", "payroll.otDivisorDays", "payroll.encashDivisor"]) {
        if (update[k] !== undefined) update[k] = Math.max(1, update[k]);
      }
    }
    if (b.quota) {
      for (const t of QUOTA_TYPES) {
        if (b.quota[t] !== undefined) update["quota." + t] = Math.max(0, Number(b.quota[t]) || 0);
      }
    }
    // A work location edited in place (same line, new text) is a rename: move employees' base
    // and past punches to the new name, e.g. "Head office, Gurugram" -> "Head office, Greater Noida"
    const renames = [];
    // A shift edited in place (same position) is renamed / re-timed for everyone on it
    const shiftMoves = [];
    if (update.shifts) {
      const before = (await getSettings()).shifts || [];
      if (before.length === update.shifts.length) {
        before.forEach((from, i) => {
          const to = update.shifts[i];
          if (from.name !== to.name && !update.shifts.some((s) => s.name === from.name)) shiftMoves.push({ from: from.name, to });
        });
      }
    }
    if (update.sites) {
      const before = (await getSettings()).sites || [];
      if (before.length === update.sites.length) {
        before.forEach((from, i) => {
          const to = update.sites[i];
          if (from !== to && !update.sites.includes(from) && !before.includes(to)) renames.push({ from, to });
        });
      }
    }
    const settings = await HrSettings.findOneAndUpdate(
      { key: "company" }, { $set: update }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    for (const { from, to } of renames) {
      await HrEmployee.updateMany({ base: from }, { $set: { base: to } });
      await HrAttendance.updateMany({ loc: from }, { $set: { loc: to } });
    }
    // employees on a shift take its current timings (and its new name after a rename)
    let shiftUpdated = 0;
    for (const { from, to } of shiftMoves) {
      shiftUpdated += (await HrEmployee.updateMany({ shiftName: from }, { $set: { shiftName: to.name, shift: to.start, shiftEnd: to.end } })).modifiedCount;
    }
    if (update.shifts) {
      for (const s of update.shifts) {
        shiftUpdated += (await HrEmployee.updateMany(
          { shiftName: s.name, $or: [{ shift: { $ne: s.start } }, { shiftEnd: { $ne: s.end } }] },
          { $set: { shift: s.start, shiftEnd: s.end } }
        )).modifiedCount;
      }
    }
    res.json({ settings: withDesignations(settings), renamed: renames, shiftUpdated });
  } catch (err) { serverError(res, err); }
};

// ---------- employees ----------

const BANK_MODES = ["NEFT", "RTGS", "IMPS", "Cheque", "Cash"];

// A department / designation typed on the employee form joins the Settings dropdown lists;
// the designation is filed under the employee's department
const rememberChoices = async ({ dept, designation }) => {
  if (!dept && !designation) return;
  // make sure the settings document exists with its default lists before adding to them
  if (!(await HrSettings.exists({ key: "company" }))) await new HrSettings().save();
  const s = withDesignations(await HrSettings.findOne({ key: "company" }));
  const update = {};
  if (dept && !s.departments.includes(dept)) update.departments = [...s.departments, dept];
  if (designation && !s.designationMap.some((d) => d.name.toLowerCase() === designation.toLowerCase() && (d.dept === dept || d.dept === ""))) {
    update.designationMap = [...s.designationMap, { name: designation, dept: dept || "" }];
    update.designations = [];
  }
  if (Object.keys(update).length) await HrSettings.updateOne({ key: "company" }, { $set: update });
};

const employeeFields = (b) => {
  const out = {};
  for (const k of ["code", "name", "fatherName", "dept", "designation", "base", "email", "phone", "pan", "uan", "esiNo"]) {
    if (b[k] !== undefined) out[k] = String(b[k]).trim();
  }
  for (const k of ["gross", "tds", "basic", "target"]) if (b[k] !== undefined) out[k] = Math.max(0, Number(b[k]) || 0);
  if (b.crmRole !== undefined && CRM_ROLES.includes(b.crmRole)) out.crmRole = b.crmRole;
  for (const k of ["pfOn", "esiOn", "ptOn", "active", "crmAccess"]) if (b[k] !== undefined) out[k] = !!b[k];
  if (b.taxRegime !== undefined) out.taxRegime = b.taxRegime === "old" ? "old" : "new";
  if (b.shift !== undefined) out.shift = TIME_RE.test(b.shift) ? b.shift : "09:30";
  if (b.shiftEnd !== undefined) out.shiftEnd = TIME_RE.test(b.shiftEnd) && b.shiftEnd !== out.shift ? b.shiftEnd : "";
  if (b.shiftName !== undefined) out.shiftName = String(b.shiftName).trim().slice(0, 60);
  if (b.joined !== undefined) out.joined = DATE_RE.test(b.joined) ? b.joined : "";
  if (b.dob !== undefined) out.dob = DATE_RE.test(b.dob) ? b.dob : "";
  if (b.bank && typeof b.bank === "object") {
    for (const k of ["holder", "accountNo", "ifsc", "bankName"]) if (b.bank[k] !== undefined) out[`bank.${k}`] = String(b.bank[k]).trim();
    if (BANK_MODES.includes(b.bank.mode)) out["bank.mode"] = b.bank.mode;
  }
  // the structure sets gross and basic too
  if (b.structure && typeof b.structure === "object") {
    const s = cleanStructure(b.structure);
    out.structure = s;
    out.gross = structureTotal(s);
    out.basic = s.basic;
  }
  return out;
};

// After the first salary revision, salary changes go through revisions so history and arrears stay right
const STRUCTURE_LOCKED = "This employee's salary has revisions. Use \"Revise salary\" to change it.";

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
    await rememberChoices(employee);
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
    const fields = employeeFields(b);
    if (fields.structure && await HrRevision.exists({ emp: req.params.id })) {
      const current = await HrEmployee.findById(req.params.id).select("structure");
      if (current && JSON.stringify(cleanStructure(current.structure)) !== JSON.stringify(fields.structure)) {
        return res.status(409).json({ message: STRUCTURE_LOCKED });
      }
      delete fields.structure;
      delete fields.gross;
      delete fields.basic;
    }

    const employee = await HrEmployee.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    await rememberChoices(employee);
    await syncEmployeeLogin(employee, password);
    res.json({ employee: (await withLoginFlag([employee]))[0] });
  } catch (err) { if (!duplicateCode(res, err)) serverError(res, err); }
};

export const deleteHrEmployee = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Employee not found" });
    // salary that has been approved or paid is a financial record and must stay
    if (await HrPayslip.exists({ emp: req.params.id, status: { $in: ["approved", "paid"] } }) || await HrSettlement.exists({ emp: req.params.id, status: { $ne: "draft" } })) {
      return res.status(409).json({ message: "This employee has processed payroll, so they can't be deleted. Mark them inactive instead." });
    }
    const employee = await HrEmployee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    // an employee's punches, leave, salary and payroll drafts go with them
    const emp = { emp: employee._id };
    await Promise.all([
      HrAttendance.deleteMany(emp),
      HrLeave.deleteMany(emp),
      HrSalary.deleteMany(emp),
      HrPayslip.deleteMany(emp),
      HrRevision.deleteMany(emp),
      HrAdjustment.deleteMany(emp),
      HrLoan.deleteMany(emp),
      HrTaxDeclaration.deleteMany(emp),
      HrSettlement.deleteMany(emp),
      HrRequest.deleteMany(emp),
      HrPost.deleteMany({ to: employee._id }),
      HrUser.deleteMany({ employee: employee._id }),
      deleteEmployeeDocuments(employee._id)
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
// Browser GPS sent with a punch: { lat, lng, acc }
const readGeo = (g) => {
  const lat = Number(g?.lat), lng = Number(g?.lng), acc = Number(g?.acc);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6), ...(Number.isFinite(acc) && acc >= 0 ? { acc: Math.round(acc) } : {}) };
};

// Street address for a GPS point (OpenStreetMap). Best effort: gives up after a few seconds, never throws.
const lookupAddress = async ({ lat, lng }) => {
  if (process.env.HR_PUNCH_ADDRESS === "off") return "";
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`;
    const r = await fetch(url, { headers: { "User-Agent": "IndiaDealsHR/1.0", "Accept-Language": "en" }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return "";
    return String((await r.json()).display_name || "").slice(0, 300);
  } catch {
    return "";
  }
};

// Employees punch for themselves and must share their location (HR_PUNCH_GEO=optional lets them punch without it).
// The HR admin can punch on someone's behalf from the dashboard; that punch has no location.
export const punchHr = async (req, res) => {
  try {
    const { loc } = req.body || {};
    const self = isEmployee(req);
    const emp = self ? String(ownId(req)) : req.body?.emp;
    if (!isId(emp)) return res.status(400).json({ message: "Pick an employee" });
    const employee = await HrEmployee.findById(emp);
    if (!employee || !employee.active) return res.status(404).json({ message: "Employee not found" });

    const geo = readGeo(req.body?.geo);
    if (self && !geo && process.env.HR_PUNCH_GEO !== "optional") {
      return res.status(400).json({ message: "Turn on location and allow it for this site to punch in or out" });
    }

    const { date, time } = istNow();
    const rec = (await HrAttendance.findOne({ emp, date })) || new HrAttendance({ emp, date });
    let field;
    if (!rec.in) {
      const settings = await getSettings();
      rec.in = time;
      rec.loc = settings.sites.includes(loc) ? loc : employee.base || settings.sites[0] || "";
      field = "inGeo";
    } else if (!rec.out) {
      // punching out before the shift is over (same rule as payroll's "early leaving") needs a reason
      const settings = await getSettings();
      const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const toM = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
      const { start: shiftStart, end: shiftEnd } = shiftWindow(employee, settings);
      // a shift that runs past midnight: after midnight counts as the next day's clock
      const nowM = toM(time) + (shiftEnd > 1440 && toM(time) < shiftStart ? 1440 : 0);
      const early = nowM < shiftEnd - (settings.graceMins || 0);
      const reason = String(req.body?.reason || "").trim().slice(0, 500);
      if (early && self && reason.length < 5) {
        return res.status(400).json({ code: "EARLY_REASON", shiftEnd: hm(shiftEnd), message: `Your shift ends at ${hm(shiftEnd)}. Give a reason to punch out early.` });
      }
      rec.out = time;
      if (early && reason) rec.earlyReason = reason;
      field = "outGeo";
    } else {
      return res.status(409).json({ message: `${employee.name} has already punched out today` });
    }
    if (geo) rec[field] = { ...geo, at: time, address: await lookupAddress(geo) };
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
    if (await monthLocked(date.slice(0, 7))) return res.status(409).json({ message: PAYROLL_LOCKED });
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

const PAYROLL_LOCKED = "Payroll for that month is approved and locked. Unlock it from the Payroll page first.";

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
    if (await rangeLocked(from, to)) return res.status(409).json({ message: PAYROLL_LOCKED });

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
    const found = await HrLeave.findById(req.params.id);
    if (!found) return res.status(404).json({ message: "Leave not found" });
    if (await rangeLocked(found.from, found.to)) return res.status(409).json({ message: PAYROLL_LOCKED });
    found.status = status;
    const leave = await found.save();
    res.json({ leave });
  } catch (err) { serverError(res, err); }
};

export const deleteHrLeave = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Leave not found" });
    const leave = await HrLeave.findById(req.params.id);
    // employees can withdraw only their own pending requests
    if (!leave || (isEmployee(req) && String(leave.emp) !== String(ownId(req)))) return res.status(404).json({ message: "Leave not found" });
    if (isEmployee(req) && leave.status !== "pending") return res.status(409).json({ message: "Only a pending leave can be withdrawn. Ask HR to cancel it." });
    if (leave.status === "approved" && await rangeLocked(leave.from, leave.to)) return res.status(409).json({ message: PAYROLL_LOCKED });
    await leave.deleteOne();
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
    // an unsaved month starts from the target set at joining
    revenueTarget: rec ? rec.revenueTarget : employee.target || 0,
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
    const emp = { emp: { $in: ids } };
    await Promise.all([
      HrAttendance.deleteMany({ $or: [{ sample: true }, emp] }),
      HrLeave.deleteMany({ $or: [{ sample: true }, emp] }),
      HrSalary.deleteMany(emp),
      HrPayslip.deleteMany(emp),
      HrRevision.deleteMany(emp),
      HrAdjustment.deleteMany(emp),
      HrLoan.deleteMany(emp),
      HrTaxDeclaration.deleteMany(emp),
      HrSettlement.deleteMany(emp),
      HrRequest.deleteMany(emp),
      HrPost.deleteMany({ to: { $in: ids } }),
      HrEmployee.deleteMany({ _id: { $in: ids } }),
      HrUser.deleteMany({ employee: { $in: ids } })
    ]);
    // rules and holidays stay, only the sample company name goes
    await HrSettings.updateOne({ key: "company", sample: true }, { $set: { sample: false, company: "IndiaDeals" } });
    res.json({ message: "Sample data cleared", removed: ids.length });
  } catch (err) { serverError(res, err); }
};
