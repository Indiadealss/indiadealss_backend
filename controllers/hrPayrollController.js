import mongoose from "mongoose";
import HrEmployee from "../models/hr/HrEmployee.js";
import HrAttendance from "../models/hr/HrAttendance.js";
import HrLeave from "../models/hr/HrLeave.js";
import HrSettings from "../models/hr/HrSettings.js";
import HrBooking from "../models/hr/HrBooking.js";
import {
  HrPayroll, HrPayslip, HrRevision, HrAdjustment, ADJUSTMENT_TYPES, HrLoan,
  HrTaxDeclaration, HrStatutoryPayment, HrSettlement
} from "../models/hr/HrPayroll.js";
import {
  addMonths, addToYtd, calcPayslip, cleanStructure, computeTax, ctcOf, daysBetween, daysIn, effectiveStructure,
  emptyYtd, fyMonths, fyOf, fyQuarter, gratuityFor, monthAttendance, pfFor, structureTotal
} from "../utils/hrPayroll.js";
import { hrMailReady, sendPayslipMail } from "../utils/hrMail.js";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FY_RE = /^\d{4}-\d{2}$/;
const PAY_MODES = ["NEFT", "RTGS", "IMPS", "Cheque", "Cash", "UPI"];
const isId = (v) => mongoose.isValidObjectId(v);
const num = (v) => Math.max(0, Math.round(Number(v) || 0));
const sum = (list, f) => list.reduce((a, x) => a + (f(x) || 0), 0);
const lineSum = (lines, key) => sum((lines || []).filter((l) => l.key === key), (l) => l.amount);

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
};
const isEmployee = (req) => req.hrUser?.role === "employee";
const ownId = (req) => String(req.hrEmployee?._id || "");

const istToday = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

// Settings as a plain object, with the schema defaults for anything not saved yet
const loadSettings = async () => ((await HrSettings.findOne({ key: "company" })) || new HrSettings()).toObject();

// ---------- locks ----------
// An approved or paid payroll freezes its month.

export const monthLocked = async (month) => !!(await HrPayroll.exists({ month, status: { $ne: "pending" } }));

export const rangeLocked = async (from, to) => {
  const months = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) months.push(m);
  return !!(await HrPayroll.exists({ month: { $in: months }, status: { $ne: "pending" } }));
};

const LOCKED = (month) => `Payroll for ${month} is approved and locked. Unlock it from the Payroll page first.`;

// ---------- salary structure over time ----------

// Structure in force for a month, from the employee's revisions (sorted by effective month)
const structureFor = (employee, month, revisions, split) => {
  if (revisions.length) {
    const applied = revisions.filter((v) => v.effective <= month);
    if (applied.length) return cleanStructure(applied[applied.length - 1].structure);
    return effectiveStructure(revisions[0].prevStructure, employee.gross, split);
  }
  return effectiveStructure(employee.structure, employee.gross, split);
};

const revisionsByEmp = async (empIds) => {
  const list = await HrRevision.find({ emp: { $in: empIds } }).sort({ effective: 1, createdAt: 1 }).lean();
  const map = new Map();
  for (const v of list) {
    const k = String(v.emp);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  }
  return map;
};

// ---------- loans ----------

// Amount repaid per loan through approved/paid payroll, leaving out one month (the one being made)
const loanRepayments = async (loanIds, exceptMonth) => {
  if (!loanIds.length) return new Map();
  const ids = loanIds.map(String);
  const slips = await HrPayslip.find({
    status: { $in: ["approved", "paid"] }, month: { $ne: exceptMonth }, "deductions.ref": { $in: ids }
  }).select("deductions").lean();
  const paid = new Map();
  for (const s of slips) {
    for (const d of s.deductions) if (d.ref && ids.includes(d.ref)) paid.set(d.ref, (paid.get(d.ref) || 0) + d.amount);
  }
  return paid;
};

const withBalance = (loan, repaid) => {
  const recovered = (repaid.get(String(loan._id)) || 0) + (loan.recoveredOutside || 0);
  return { ...loan, repaid: recovered, outstanding: Math.max(0, loan.amount - recovered) };
};

// ---------- payroll generation ----------

const slipSnapshot = (e) => ({
  code: e.code, name: e.name, dept: e.dept, designation: e.designation, branch: e.base || "", joined: e.joined,
  pan: e.pan, uan: e.uan, esiNo: e.esiNo, email: e.email,
  bank: { holder: e.bank?.holder || e.name, accountNo: e.bank?.accountNo || "", ifsc: e.bank?.ifsc || "", bankName: e.bank?.bankName || "", mode: e.bank?.mode || "NEFT" }
});

const runTotals = (slips) => ({
  employees: slips.length,
  grossRate: sum(slips, (s) => s.grossRate),
  gross: sum(slips, (s) => s.earnedGross),
  deductions: sum(slips, (s) => s.totalDeductions),
  net: sum(slips, (s) => s.net),
  pfEE: sum(slips, (s) => lineSum(s.deductions, "pf")),
  pfER: sum(slips, (s) => s.employer?.pf),
  esiEE: sum(slips, (s) => lineSum(s.deductions, "esi")),
  esiER: sum(slips, (s) => s.employer?.esi),
  pt: sum(slips, (s) => lineSum(s.deductions, "pt")),
  tds: sum(slips, (s) => lineSum(s.deductions, "tds")),
  cost: sum(slips, (s) => s.earnedGross + (s.employer?.pf || 0) + (s.employer?.esi || 0)),
  paid: slips.filter((s) => s.status === "paid").length
});

// Everything needed to work out payslips for some employees in a month
async function payrollInputs(month, employees) {
  const ids = employees.map((e) => e._id);
  const first = `${month}-01`, last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  const fy = fyOf(month);
  const [settings, attendance, leaves, adjustments, loans, revisions, decls, prior] = await Promise.all([
    loadSettings(),
    HrAttendance.find({ emp: { $in: ids }, date: { $gte: first, $lte: last } }).lean(),
    HrLeave.find({ emp: { $in: ids }, status: "approved", from: { $lte: last }, to: { $gte: first } }).lean(),
    HrAdjustment.find({ emp: { $in: ids }, month }).lean(),
    HrLoan.find({ emp: { $in: ids }, status: "approved", startMonth: { $lte: month } }).lean(),
    revisionsByEmp(ids),
    HrTaxDeclaration.find({ emp: { $in: ids }, fy }).lean(),
    HrPayslip.find({ emp: { $in: ids }, month: { $gte: fyMonths(fy)[0], $lt: month } }).lean()
  ]);
  const repaid = await loanRepayments(loans.map((l) => l._id), month);
  const by = (list) => {
    const m = new Map();
    for (const x of list) {
      const k = String(x.emp);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  return {
    settings, revisions, repaid,
    attendance: by(attendance), leaves: by(leaves), adjustments: by(adjustments), loans: by(loans),
    decls: new Map(decls.map((d) => [String(d.emp), d])), prior: by(prior)
  };
}

function slipFor(employee, month, inputs, otOverride, today) {
  const k = String(employee._id);
  const { settings } = inputs;
  const records = new Map((inputs.attendance.get(k) || []).map((a) => [a.date, a]));
  const att = monthAttendance({ month, employee, records, leaves: inputs.leaves.get(k) || [], settings, today });
  const structure = structureFor(employee, month, inputs.revisions.get(k) || [], settings.payroll.split);
  const ytd = (inputs.prior.get(k) || []).reduce(addToYtd, emptyYtd());
  const loans = (inputs.loans.get(k) || []).map((l) => withBalance(l, inputs.repaid)).filter((l) => l.outstanding > 0)
    .map((l) => ({ id: l._id, kind: l.kind, emi: l.emi, outstanding: l.outstanding }));
  const adjustments = (inputs.adjustments.get(k) || []).map((a) => ({ id: a._id, type: a.type, amount: a.amount, note: a.note }));
  const calc = calcPayslip({ employee, structure, month, settings, att, adjustments, loans, decl: inputs.decls.get(k) || null, ytd, otOverride });
  delete calc.tax;
  return { ...slipSnapshot(employee), ...calc };
}

// Who is on a month's payroll: employees active that month (joined by its end, not left before it starts)
const payrollEmployees = async (month) => {
  const last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  const emps = await HrEmployee.find({ active: true }).sort({ code: 1 });
  return emps.filter((e) => (!e.joined || e.joined <= last) && (!e.lastWorkingDay || e.lastWorkingDay >= `${month}-01`));
};

async function generate(month, onlyEmp) {
  const today = istToday();
  let employees = await payrollEmployees(month);
  if (onlyEmp) employees = employees.filter((e) => String(e._id) === String(onlyEmp));
  const existing = new Map((await HrPayslip.find({ month }).lean()).map((s) => [String(s.emp), s]));
  const inputs = await payrollInputs(month, employees);

  const ops = employees.map((e) => {
    const slip = slipFor(e, month, inputs, existing.get(String(e._id))?.otOverride ?? null, today);
    return { updateOne: { filter: { emp: e._id, month }, update: { $set: { ...slip, status: "pending" } }, upsert: true } };
  });
  if (ops.length) await HrPayslip.bulkWrite(ops);
  if (!onlyEmp) {
    // people no longer on the payroll (made inactive, joining date moved) drop out
    await HrPayslip.deleteMany({ month, emp: { $nin: employees.map((e) => e._id) } });
  }
  const slips = await HrPayslip.find({ month }).lean();
  return HrPayroll.findOneAndUpdate(
    { month },
    { $set: { status: "pending", generatedAt: new Date(), count: slips.length, totals: runTotals(slips) } },
    { new: true, upsert: true }
  );
}

// Problems to look at before approving. "error" blocks approval.
async function validate(month, slips) {
  const issues = [];
  const add = (level, slip, text) => issues.push({ level, emp: slip ? String(slip.emp) : null, name: slip?.name || "", text });
  for (const s of slips) {
    if (!s.grossRate) add("error", s, "No salary structure: set the salary on the employee first");
    if (s.net < 0) add("error", s, `Net pay is negative (₹${s.net}). Reduce a deduction or EMI.`);
    if (s.bank?.mode !== "Cash" && s.bank?.mode !== "Cheque" && (!s.bank?.accountNo || !s.bank?.ifsc)) add("warn", s, "Bank account number or IFSC missing");
    if (lineSum(s.deductions, "tds") > 0 && !s.pan) add("warn", s, "TDS is deducted but PAN is missing");
    if (lineSum(s.deductions, "pf") > 0 && !s.uan) add("warn", s, "PF is deducted but UAN is missing");
    if (lineSum(s.deductions, "esi") > 0 && !s.esiNo) add("warn", s, "ESI is deducted but the ESI number is missing");
    if (s.att?.noPunchOut > 0) add("warn", s, `${s.att.noPunchOut} day(s) with no punch-out (counted as present)`);
  }
  const projected = slips.filter((s) => s.att?.projected > 0).length;
  if (projected) add("info", null, `The month isn't over: days still to come are counted as present for ${projected} employee(s). Recalculate after month end.`);
  const last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  const pendingLeaves = await HrLeave.countDocuments({ status: "pending", from: { $lte: last }, to: { $gte: `${month}-01` } });
  if (pendingLeaves) add("warn", null, `${pendingLeaves} leave request(s) in this month are still waiting for approval`);
  const onPayroll = new Set(slips.map((s) => String(s.emp)));
  const missing = (await payrollEmployees(month)).filter((e) => !onPayroll.has(String(e._id)));
  if (slips.length && missing.length) add("warn", null, `${missing.map((e) => e.name).join(", ")} not in this payroll. Recalculate to include.`);
  return issues;
}

// ---------- payroll endpoints ----------

export const listPayrollRuns = async (req, res) => {
  try {
    res.json({ runs: await HrPayroll.find().sort({ month: -1 }) });
  } catch (err) { serverError(res, err); }
};

export const getPayroll = async (req, res) => {
  try {
    const { month } = req.params;
    if (!MONTH_RE.test(month)) return res.status(400).json({ message: "month must be YYYY-MM" });
    const [run, slips] = await Promise.all([HrPayroll.findOne({ month }), HrPayslip.find({ month }).sort({ code: 1 })]);
    const issues = run ? await validate(month, slips) : [];
    res.json({ run, slips, issues });
  } catch (err) { serverError(res, err); }
};

export const generatePayroll = async (req, res) => {
  try {
    const { month } = req.params;
    if (!MONTH_RE.test(month)) return res.status(400).json({ message: "month must be YYYY-MM" });
    if (month > istToday().slice(0, 7)) return res.status(400).json({ message: "Payroll can't be made for a future month" });
    if (await monthLocked(month)) return res.status(409).json({ message: LOCKED(month) });
    await generate(month);
    return getPayroll(req, res);
  } catch (err) { serverError(res, err); }
};

// Manual overtime hours for one payslip, then recalculate it
export const updatePayslip = async (req, res) => {
  try {
    const { month, id } = req.params;
    if (!isId(id)) return res.status(404).json({ message: "Payslip not found" });
    if (await monthLocked(month)) return res.status(409).json({ message: LOCKED(month) });
    const slip = await HrPayslip.findOne({ _id: id, month });
    if (!slip) return res.status(404).json({ message: "Payslip not found" });
    const ot = req.body?.otOverride;
    slip.otOverride = ot === null || ot === "" || ot === undefined ? null : Math.max(0, Number(ot) || 0);
    await slip.save();
    await generate(month, slip.emp);
    // run totals cover everyone
    const slips = await HrPayslip.find({ month }).lean();
    await HrPayroll.updateOne({ month }, { $set: { count: slips.length, totals: runTotals(slips) } });
    return getPayroll(req, res);
  } catch (err) { serverError(res, err); }
};

export const approvePayroll = async (req, res) => {
  try {
    const { month } = req.params;
    const run = await HrPayroll.findOne({ month });
    if (!run) return res.status(404).json({ message: "Generate the payroll first" });
    if (run.status !== "pending") return res.status(409).json({ message: "This payroll is already approved" });
    const slips = await HrPayslip.find({ month });
    if (!slips.length) return res.status(400).json({ message: "There are no payslips to approve" });
    const errors = (await validate(month, slips)).filter((i) => i.level === "error");
    if (errors.length) return res.status(400).json({ message: `Fix ${errors.length} problem(s) before approving: ${errors[0].name} - ${errors[0].text}` });
    await HrPayslip.updateMany({ month }, { $set: { status: "approved" } });
    run.status = "approved";
    run.approvedAt = new Date();
    await run.save();
    return getPayroll(req, res);
  } catch (err) { serverError(res, err); }
};

export const unlockPayroll = async (req, res) => {
  try {
    const { month } = req.params;
    const run = await HrPayroll.findOne({ month });
    if (!run || run.status === "pending") return res.status(409).json({ message: "This payroll isn't locked" });
    if (await HrPayslip.exists({ month, status: "paid" })) {
      return res.status(409).json({ message: "Some salaries in this payroll are already paid, so it can't be unlocked" });
    }
    await HrPayslip.updateMany({ month }, { $set: { status: "pending" } });
    run.status = "pending";
    run.approvedAt = undefined;
    await run.save();
    return getPayroll(req, res);
  } catch (err) { serverError(res, err); }
};

// Marks salaries paid: body { ids?: [payslip ids] (all unpaid when left out), mode, ref, date }
export const payPayroll = async (req, res) => {
  try {
    const { month } = req.params;
    const { ids, mode, ref, date } = req.body || {};
    const run = await HrPayroll.findOne({ month });
    if (!run || run.status === "pending") return res.status(409).json({ message: "Approve the payroll before marking salaries paid" });
    if (!PAY_MODES.includes(mode)) return res.status(400).json({ message: "Pick a payment mode" });
    if (!DATE_RE.test(date || "")) return res.status(400).json({ message: "Payment date is required" });
    const filter = { month, status: "approved" };
    if (Array.isArray(ids) && ids.length) filter._id = { $in: ids.filter(isId) };
    const result = await HrPayslip.updateMany(filter, { $set: { status: "paid", payment: { mode, ref: String(ref || "").trim(), date } } });
    const slips = await HrPayslip.find({ month }).lean();
    const allPaid = slips.every((s) => s.status === "paid");
    await HrPayroll.updateOne({ month }, { $set: { totals: runTotals(slips), ...(allPaid && { status: "paid", paidAt: new Date() }) } });
    if (!result.modifiedCount) return res.status(400).json({ message: "No unpaid salaries were selected" });
    return getPayroll(req, res);
  } catch (err) { serverError(res, err); }
};

// ---------- payslips ----------

// Admin: ?month= or ?from=&to= or ?emp=&fy=. Employees always get their own approved/paid payslips.
export const listPayslips = async (req, res) => {
  try {
    const { month, from, to, emp, fy } = req.query;
    const filter = {};
    if (MONTH_RE.test(month || "")) filter.month = month;
    else if (FY_RE.test(fy || "")) filter.month = { $gte: fyMonths(fy)[0], $lte: fyMonths(fy)[11] };
    else if (MONTH_RE.test(from || "") && MONTH_RE.test(to || "")) filter.month = { $gte: from, $lte: to };
    if (isEmployee(req)) {
      filter.emp = ownId(req);
      filter.status = { $in: ["approved", "paid"] };
    } else if (isId(emp)) filter.emp = emp;
    res.json({ payslips: await HrPayslip.find(filter).sort({ month: -1, code: 1 }) });
  } catch (err) { serverError(res, err); }
};

// The PDF is made in the browser (same file as the download) and sent here to attach
export const emailPayslip = async (req, res) => {
  try {
    if (!hrMailReady()) return res.status(400).json({ message: "Email isn't set up on the server (HR_MAIL_USER / HR_MAIL_PASS)" });
    if (!isId(req.params.id)) return res.status(404).json({ message: "Payslip not found" });
    const slip = await HrPayslip.findById(req.params.id);
    if (!slip) return res.status(404).json({ message: "Payslip not found" });
    if (slip.status === "pending") return res.status(409).json({ message: "Approve the payroll before sending payslips" });
    const employee = await HrEmployee.findById(slip.emp);
    const to = employee?.email || slip.email;
    if (!to) return res.status(400).json({ message: `${slip.name} has no email address` });
    const { pdf, filename, monthLabel } = req.body || {};
    if (!pdf || typeof pdf !== "string") return res.status(400).json({ message: "Payslip file missing" });
    const settings = await loadSettings();
    await sendPayslipMail({ to, company: settings.company, employeeName: slip.name, monthLabel: monthLabel || slip.month, net: slip.net, pdfBase64: pdf, filename: filename || `payslip-${slip.month}.pdf` });
    slip.emailedAt = new Date();
    await slip.save();
    res.json({ message: `Payslip sent to ${to}`, payslip: slip });
  } catch (err) {
    console.error(err);
    res.status(502).json({ message: "Couldn't send the email: " + (err.message || "mail server error") });
  }
};

// ---------- salary revisions ----------

export const listRevisions = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Employee not found" });
    const employee = await HrEmployee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    const settings = await loadSettings();
    const revisions = await HrRevision.find({ emp: employee._id }).sort({ effective: -1, createdAt: -1 });
    const month = istToday().slice(0, 7);
    const current = structureFor(employee, month, [...revisions].reverse().map((v) => v.toObject()), settings.payroll.split);
    res.json({ revisions, current, ctc: ctcOf(current, employee, settings) });
  } catch (err) { serverError(res, err); }
};

// Increment / revision from an effective month. Back-dated revisions add arrears for
// months already paid at the old salary to the first open payroll month.
export const createRevision = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Employee not found" });
    const employee = await HrEmployee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    const { effective, structure, reason } = req.body || {};
    if (!MONTH_RE.test(effective || "")) return res.status(400).json({ message: "Pick the month the new salary starts" });
    const next = cleanStructure(structure);
    if (!structureTotal(next)) return res.status(400).json({ message: "Enter the new salary" });

    const settings = await loadSettings();
    const existing = (await HrRevision.find({ emp: employee._id }).sort({ effective: 1, createdAt: 1 }).lean());
    const prev = structureFor(employee, effective, existing, settings.payroll.split);

    // arrears: processed months from the effective month at the old salary
    const paidSlips = await HrPayslip.find({ emp: employee._id, month: { $gte: effective }, status: { $in: ["approved", "paid"] } }).lean();
    const newGross = structureTotal(next);
    const arrears = Math.max(0, Math.round(sum(paidSlips, (s) => ((newGross - s.grossRate) * (s.days - s.lopDays)) / s.days)));

    const revision = await HrRevision.create({ emp: employee._id, effective, structure: next, prevStructure: prev, reason: String(reason || "").trim(), arrears });

    if (arrears > 0) {
      let month = istToday().slice(0, 7);
      while (await monthLocked(month)) month = addMonths(month, 1);
      await HrAdjustment.create({ emp: employee._id, month, type: "arrears", amount: arrears, note: `salary revision from ${effective}` });
    }

    // the employee record keeps the structure in force now
    const all = await HrRevision.find({ emp: employee._id }).sort({ effective: 1, createdAt: 1 }).lean();
    const now = structureFor(employee, istToday().slice(0, 7), all, settings.payroll.split);
    employee.structure = now;
    employee.gross = structureTotal(now);
    employee.basic = now.basic;
    await employee.save();
    res.status(201).json({ revision, arrears, message: arrears ? `Salary revised. Arrears of ₹${arrears.toLocaleString("en-IN")} added to payroll.` : "Salary revised" });
  } catch (err) { serverError(res, err); }
};

// Only revisions that no processed payroll has used can be removed
export const deleteRevision = async (req, res) => {
  try {
    if (!isId(req.params.rid)) return res.status(404).json({ message: "Revision not found" });
    const revision = await HrRevision.findById(req.params.rid);
    if (!revision) return res.status(404).json({ message: "Revision not found" });
    if (await HrPayslip.exists({ emp: revision.emp, month: { $gte: revision.effective }, status: { $in: ["approved", "paid"] } })) {
      return res.status(409).json({ message: "Payroll has already been processed on this salary, so it can't be removed. Add a new revision instead." });
    }
    await revision.deleteOne();
    const employee = await HrEmployee.findById(revision.emp);
    if (employee) {
      const settings = await loadSettings();
      const all = await HrRevision.find({ emp: employee._id }).sort({ effective: 1, createdAt: 1 }).lean();
      const now = all.length ? structureFor(employee, istToday().slice(0, 7), all, settings.payroll.split) : cleanStructure(revision.prevStructure);
      employee.structure = now;
      employee.gross = structureTotal(now);
      employee.basic = now.basic;
      await employee.save();
    }
    res.json({ message: "Revision removed" });
  } catch (err) { serverError(res, err); }
};

// ---------- bonus & other one-time payments ----------

export const listAdjustments = async (req, res) => {
  try {
    const { month } = req.query;
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ message: "month must be YYYY-MM" });
    res.json({ adjustments: await HrAdjustment.find({ month }).sort({ createdAt: 1 }), locked: await monthLocked(month) });
  } catch (err) { serverError(res, err); }
};

export const createAdjustment = async (req, res) => {
  try {
    const { emp, month, type, amount, note } = req.body || {};
    if (!isId(emp) || !(await HrEmployee.exists({ _id: emp }))) return res.status(400).json({ message: "Pick an employee" });
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ message: "Pick a month" });
    if (!ADJUSTMENT_TYPES[type]) return res.status(400).json({ message: "Pick a type" });
    if (!(Number(amount) > 0)) return res.status(400).json({ message: "Enter an amount" });
    if (await monthLocked(month)) return res.status(409).json({ message: LOCKED(month) });
    const adjustment = await HrAdjustment.create({ emp, month, type, amount: num(amount), note: String(note || "").trim() });
    res.status(201).json({ adjustment });
  } catch (err) { serverError(res, err); }
};

export const deleteAdjustment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const adj = await HrAdjustment.findById(req.params.id);
    if (!adj) return res.status(404).json({ message: "Not found" });
    if (await monthLocked(adj.month)) return res.status(409).json({ message: LOCKED(adj.month) });
    await adj.deleteOne();
    // an incentive sent from a booking: the booking is no longer paid with salary
    await HrBooking.updateMany({ adjustment: adj._id }, { $set: { payMonth: "" }, $unset: { adjustment: "" } });
    res.json({ message: "Removed" });
  } catch (err) { serverError(res, err); }
};

// ---------- loans & advances ----------

export const listLoans = async (req, res) => {
  try {
    const loans = await HrLoan.find(isEmployee(req) ? { emp: ownId(req) } : {}).sort({ createdAt: -1 }).lean();
    const repaid = await loanRepayments(loans.map((l) => l._id), null);
    res.json({ loans: loans.map((l) => {
      const b = withBalance(l, repaid);
      const { _id, __v, ...rest } = b;
      return { ...rest, id: String(_id), emp: String(b.emp) };
    }) });
  } catch (err) { serverError(res, err); }
};

export const createLoan = async (req, res) => {
  try {
    const b = req.body || {};
    const emp = isEmployee(req) ? ownId(req) : b.emp;
    if (!isId(emp) || !(await HrEmployee.exists({ _id: emp }))) return res.status(400).json({ message: "Pick an employee" });
    const kind = b.kind === "advance" ? "advance" : "loan";
    const amount = num(b.amount);
    if (!amount) return res.status(400).json({ message: "Enter the amount" });
    const months = Math.max(1, Math.round(Number(b.months) || 1));
    const today = istToday();
    const loan = { emp, kind, amount, months, emi: Math.ceil(amount / months), reason: String(b.reason || "").trim(), requestedOn: today, status: "requested" };
    // the admin can record an already-approved loan in one step
    if (!isEmployee(req) && b.status === "approved") {
      loan.status = "approved";
      loan.approvedOn = today;
      loan.startMonth = MONTH_RE.test(b.startMonth || "") ? b.startMonth : today.slice(0, 7);
      if (Number(b.emi) > 0) loan.emi = num(b.emi);
    }
    res.status(201).json({ loan: await HrLoan.create(loan) });
  } catch (err) { serverError(res, err); }
};

// Approve / reject / close, or change the EMI plan
export const updateLoan = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Loan not found" });
    const loan = await HrLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: "Loan not found" });
    const b = req.body || {};
    if (b.months !== undefined) loan.months = Math.max(1, Math.round(Number(b.months) || 1));
    if (b.emi !== undefined && Number(b.emi) > 0) loan.emi = num(b.emi);
    else if (b.months !== undefined) loan.emi = Math.ceil(loan.amount / loan.months);
    if (b.startMonth !== undefined && MONTH_RE.test(b.startMonth)) loan.startMonth = b.startMonth;
    if (b.status) {
      if (!["approved", "rejected", "closed"].includes(b.status)) return res.status(400).json({ message: "Invalid status" });
      if (b.status === "approved" && loan.status !== "approved") {
        loan.approvedOn = istToday();
        if (!loan.startMonth) loan.startMonth = istToday().slice(0, 7);
      }
      loan.status = b.status;
    }
    await loan.save();
    res.json({ loan });
  } catch (err) { serverError(res, err); }
};

export const deleteLoan = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Loan not found" });
    const repaid = await loanRepayments([req.params.id], null);
    if (repaid.get(req.params.id)) return res.status(409).json({ message: "EMIs have already been deducted for this loan. Close it instead." });
    if (await HrPayslip.exists({ "deductions.ref": req.params.id })) {
      return res.status(409).json({ message: "This loan is on a payroll that isn't approved yet. Recalculate that payroll after closing the loan." });
    }
    await HrLoan.findByIdAndDelete(req.params.id);
    res.json({ message: "Loan deleted" });
  } catch (err) { serverError(res, err); }
};

// ---------- tax ----------

const DECL_NUMBERS = ["rentPaid", "sec80C", "sec80D", "sec80CCD1B", "homeLoanInterest", "otherDeductions", "otherIncome", "prevIncome", "prevTds"];

// Projected tax for the year: payslips so far, then the current structure for the months to come
async function taxRows(fy, employees) {
  const ids = employees.map((e) => e._id);
  const months = fyMonths(fy);
  const [settings, decls, slips, revisions] = await Promise.all([
    loadSettings(),
    HrTaxDeclaration.find({ emp: { $in: ids }, fy }).lean(),
    HrPayslip.find({ emp: { $in: ids }, month: { $gte: months[0], $lte: months[11] } }).lean(),
    revisionsByEmp(ids)
  ]);
  const thisMonth = istToday().slice(0, 7);
  return employees.map((e) => {
    const k = String(e._id);
    const decl = decls.find((d) => String(d.emp) === k) || null;
    const mine = slips.filter((s) => String(s.emp) === k);
    const ytd = mine.reduce(addToYtd, emptyYtd());
    const done = new Set(mine.map((s) => s.month));
    const ahead = months.filter((m) => m >= thisMonth && !done.has(m) && (!e.joined || e.joined.slice(0, 7) <= m) && (!e.lastWorkingDay || e.lastWorkingDay.slice(0, 7) >= m));
    let year = { salary: ytd.taxable + (decl?.prevIncome || 0), basicDa: ytd.basicDa, hra: ytd.hra, pf: ytd.pf, pt: ytd.pt };
    for (const m of ahead) {
      const s = structureFor(e, m, revisions.get(k) || [], settings.payroll.split);
      year.salary += structureTotal(s);
      year.basicDa += s.basic + s.da;
      year.hra += s.hra;
      year.pf += settings.payroll.pf.on && e.pfOn !== false ? pfFor(s.basic + s.da, settings.payroll.pf).ee : 0;
      year.pt += e.ptOn !== false ? settings.pt : 0;
    }
    const regime = decl?.regime || e.taxRegime || "new";
    const tax = computeTax(regime, year, decl || {});
    const other = computeTax(regime === "new" ? "old" : "new", year, decl || {});
    const deducted = ytd.tds + (decl?.prevTds || 0);
    return {
      emp: k, code: e.code, name: e.name, pan: e.pan, regime, fixedTds: e.tds || 0,
      decl, tax, otherRegimeTax: other.total, deducted, balance: Math.max(0, tax.total - deducted),
      monthsLeft: ahead.length
    };
  });
}

export const getTax = async (req, res) => {
  try {
    const fy = FY_RE.test(req.query.fy || "") ? req.query.fy : fyOf(istToday().slice(0, 7));
    const employees = isEmployee(req) ? [req.hrEmployee] : await HrEmployee.find({ active: true }).sort({ code: 1 });
    res.json({ fy, rows: await taxRows(fy, employees) });
  } catch (err) { serverError(res, err); }
};

export const saveTaxDeclaration = async (req, res) => {
  try {
    const emp = req.params.emp;
    if (!isId(emp)) return res.status(404).json({ message: "Employee not found" });
    if (isEmployee(req) && emp !== ownId(req)) return res.status(403).json({ message: "You can only change your own declaration" });
    const b = req.body || {};
    if (!FY_RE.test(b.fy || "")) return res.status(400).json({ message: "Pick a financial year" });
    const existing = await HrTaxDeclaration.findOne({ emp, fy: b.fy });
    if (isEmployee(req) && existing?.status === "verified") return res.status(409).json({ message: "HR has verified this declaration. Ask HR to change it." });
    const update = {
      regime: b.regime === "old" ? "old" : "new",
      metro: !!b.metro,
      ...Object.fromEntries(DECL_NUMBERS.map((k) => [k, num(b[k])])),
      status: !isEmployee(req) && b.status === "verified" ? "verified" : "submitted"
    };
    const decl = await HrTaxDeclaration.findOneAndUpdate({ emp, fy: b.fy }, { $set: update }, { new: true, upsert: true });
    // the regime choice also becomes the employee's default
    await HrEmployee.updateOne({ _id: emp }, { $set: { taxRegime: update.regime } });
    res.json({ declaration: decl });
  } catch (err) { serverError(res, err); }
};

// Form 16 Part B figures from the year's payslips
export const getForm16 = async (req, res) => {
  try {
    const emp = req.params.emp;
    if (!isId(emp)) return res.status(404).json({ message: "Employee not found" });
    if (isEmployee(req) && emp !== ownId(req)) return res.status(403).json({ message: "Not allowed" });
    const fy = FY_RE.test(req.query.fy || "") ? req.query.fy : fyOf(istToday().slice(0, 7));
    const months = fyMonths(fy);
    const [employee, settings, decl, slips] = await Promise.all([
      HrEmployee.findById(emp), loadSettings(),
      HrTaxDeclaration.findOne({ emp, fy }).lean(),
      HrPayslip.find({ emp, month: { $gte: months[0], $lte: months[11] }, status: { $in: ["approved", "paid"] } }).sort({ month: 1 }).lean()
    ]);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    const ytd = slips.reduce(addToYtd, emptyYtd());
    const regime = decl?.regime || employee.taxRegime || "new";
    const tax = computeTax(regime, { salary: ytd.taxable + (decl?.prevIncome || 0), basicDa: ytd.basicDa, hra: ytd.hra, pf: ytd.pf, pt: ytd.pt }, decl || {});
    const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
      const qs = slips.filter((s) => fyQuarter(s.month) === q);
      return { quarter: q, taxable: sum(qs, (s) => s.taxable), tds: sum(qs, (s) => lineSum(s.deductions, "tds")) };
    });
    res.json({
      fy, regime,
      employer: { name: settings.company, address: settings.address, pan: settings.companyPan, tan: settings.tan },
      employee: { code: employee.code, name: employee.name, pan: employee.pan, designation: employee.designation, joined: employee.joined, lastWorkingDay: employee.lastWorkingDay },
      decl, tax, ytd, quarters,
      months: slips.map((s) => ({ month: s.month, gross: s.grossEarnings, taxable: s.taxable, tds: lineSum(s.deductions, "tds") }))
    });
  } catch (err) { serverError(res, err); }
};

// ---------- statutory compliance ----------

// Due dates: PF and ESI by the 15th of next month, TDS by the 7th (30 April for March), PT by the 15th
const dueDate = (type, month) => {
  const next = addMonths(month, 1);
  if (type === "tds") return month.endsWith("-03") ? `${next}-30` : `${next}-07`;
  return `${next}-15`;
};

const statutoryForMonth = (slips) => {
  const pfRows = slips.filter((s) => lineSum(s.deductions, "pf") > 0).map((s) => ({
    emp: String(s.emp), code: s.code, name: s.name, uan: s.uan,
    gross: s.earnedGross, epfWage: s.pfWage, epsWage: s.epsWage, edliWage: s.edliWage,
    ee: lineSum(s.deductions, "pf"), eps: s.employer?.eps || 0, epf: s.employer?.epf || 0, ncp: s.lopDays
  }));
  const epfWages = sum(pfRows, (x) => x.epfWage);
  const edliWages = sum(pfRows, (x) => x.edliWage);
  const pf = {
    rows: pfRows,
    ee: sum(pfRows, (x) => x.ee), eps: sum(pfRows, (x) => x.eps), epf: sum(pfRows, (x) => x.epf),
    // EPF admin charges 0.5% (minimum ₹500) and EDLI 0.5%
    admin: pfRows.length ? Math.max(500, Math.round(epfWages * 0.005)) : 0,
    edli: Math.round(edliWages * 0.005)
  };
  pf.total = pf.ee + pf.eps + pf.epf + pf.admin + pf.edli;

  const esiRows = slips.filter((s) => lineSum(s.deductions, "esi") > 0).map((s) => ({
    emp: String(s.emp), code: s.code, name: s.name, esiNo: s.esiNo, days: s.payDays - s.lateDays, wage: s.esiWage,
    ee: lineSum(s.deductions, "esi"), er: s.employer?.esi || 0
  }));
  const esi = { rows: esiRows, ee: sum(esiRows, (x) => x.ee), er: sum(esiRows, (x) => x.er) };
  esi.total = esi.ee + esi.er;

  const ptRows = slips.filter((s) => lineSum(s.deductions, "pt") > 0).map((s) => ({ emp: String(s.emp), code: s.code, name: s.name, branch: s.branch, gross: s.earnedGross, pt: lineSum(s.deductions, "pt") }));
  const pt = { rows: ptRows, total: sum(ptRows, (x) => x.pt) };

  const tdsRows = slips.filter((s) => lineSum(s.deductions, "tds") > 0).map((s) => ({ emp: String(s.emp), code: s.code, name: s.name, pan: s.pan, taxable: s.taxable, tds: lineSum(s.deductions, "tds") }));
  const tds = { rows: tdsRows, total: sum(tdsRows, (x) => x.tds) };
  return { pf, esi, pt, tds };
};

export const getCompliance = async (req, res) => {
  try {
    const { month } = req.query;
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ message: "month must be YYYY-MM" });
    const [run, slips, payments, settings] = await Promise.all([
      HrPayroll.findOne({ month }), HrPayslip.find({ month }).sort({ code: 1 }).lean(),
      HrStatutoryPayment.find({ month }).lean(), loadSettings()
    ]);
    const data = statutoryForMonth(slips);
    const due = Object.fromEntries(["pf", "esi", "pt", "tds"].map((t) => [t, dueDate(t, month)]));
    res.json({
      month, run, ...data, due,
      payments: Object.fromEntries(payments.map((p) => [p.type, { ...p, id: String(p._id) }])),
      employer: { name: settings.company, pfCode: settings.pfCode, esiCode: settings.esiCode, tan: settings.tan }
    });
  } catch (err) { serverError(res, err); }
};

// Dues and payments for every month of a financial year
export const getComplianceTracker = async (req, res) => {
  try {
    const fy = FY_RE.test(req.query.fy || "") ? req.query.fy : fyOf(istToday().slice(0, 7));
    const months = fyMonths(fy);
    const [runs, slips, payments] = await Promise.all([
      HrPayroll.find({ month: { $in: months } }).lean(),
      HrPayslip.find({ month: { $in: months } }).lean(),
      HrStatutoryPayment.find({ month: { $in: months } }).lean()
    ]);
    const rows = months.filter((m) => runs.some((r) => r.month === m)).map((m) => {
      const data = statutoryForMonth(slips.filter((s) => s.month === m));
      const run = runs.find((r) => r.month === m);
      return {
        month: m, status: run.status,
        items: ["pf", "esi", "pt", "tds"].map((t) => {
          const p = payments.find((x) => x.month === m && x.type === t);
          return { type: t, due: data[t].total, dueDate: dueDate(t, m), paid: p?.amount || 0, paidOn: p?.paidOn || "", challan: p?.challan || "" };
        })
      };
    });
    res.json({ fy, rows });
  } catch (err) { serverError(res, err); }
};

export const saveStatutoryPayment = async (req, res) => {
  try {
    const { type, month, amount, paidOn, challan, note } = req.body || {};
    if (!["pf", "esi", "pt", "tds"].includes(type)) return res.status(400).json({ message: "Invalid type" });
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ message: "Pick a month" });
    if (paidOn && !DATE_RE.test(paidOn)) return res.status(400).json({ message: "Invalid payment date" });
    const payment = await HrStatutoryPayment.findOneAndUpdate(
      { type, month },
      { $set: { amount: num(amount), paidOn: paidOn || "", challan: String(challan || "").trim(), note: String(note || "").trim() } },
      { new: true, upsert: true }
    );
    res.json({ payment });
  } catch (err) { serverError(res, err); }
};

// ---------- full & final settlement ----------

const cleanLines = (lines) => (Array.isArray(lines) ? lines : [])
  .filter((l) => l && String(l.label || "").trim())
  .map((l) => ({ key: String(l.key || "other").slice(0, 40), label: String(l.label).trim().slice(0, 120), amount: num(l.amount) }));

// Works out the settlement from attendance, leave balance, service and loans. The admin can edit every line.
async function settlementPreview(employee, resignationDate, lastWorkingDay, noticeDays) {
  const settings = await loadSettings();
  const today = istToday();
  const lwdMonth = lastWorkingDay.slice(0, 7);
  const revisions = (await revisionsByEmp([employee._id])).get(String(employee._id)) || [];
  const structure = structureFor(employee, lwdMonth, revisions, settings.payroll.split);
  const grossRate = structureTotal(structure);
  const earnings = [], deductions = [];
  const info = {};

  // salary for months not yet processed, up to the last working day
  const processed = new Set((await HrPayslip.find({ emp: employee._id, status: { $in: ["approved", "paid"] } }).select("month").lean()).map((s) => s.month));
  const start = (employee.joined || lastWorkingDay).slice(0, 7);
  const leaver = { ...employee.toObject(), lastWorkingDay };
  const months = [];
  for (let m = lwdMonth; m >= start && !processed.has(m) && months.length < 3; m = addMonths(m, -1)) months.unshift(m);
  for (const m of months) {
    const inputs = await payrollInputs(m, [employee]);
    inputs.loans = new Map();
    const slip = slipFor(leaver, m, inputs, null, today);
    earnings.push({ key: "salary", label: `Salary for ${m} (${slip.payDays - slip.lateDays} paid days)`, amount: slip.earnedGross });
    for (const k of ["pf", "esi", "pt", "tds"]) {
      const amt = lineSum(slip.deductions, k);
      if (amt) deductions.push({ key: k, label: `${slip.deductions.find((d) => d.key === k).label} - ${m}`, amount: amt });
    }
    for (const d of slip.deductions.filter((x) => x.key === "other_deduction")) deductions.push({ key: d.key, label: d.label, amount: d.amount });
  }
  info.salaryMonths = months;

  // leave encashment: earned leave left this year
  const year = lastWorkingDay.slice(0, 4);
  const elUsed = sum(await HrLeave.find({ emp: employee._id, type: "EL", status: "approved", from: { $regex: `^${year}` } }).lean(), (l) => l.days);
  const elLeft = Math.max(0, (settings.quota?.EL || 0) - elUsed);
  info.elBalance = elLeft;
  const encash = Math.round(((structure.basic + structure.da) / settings.payroll.encashDivisor) * elLeft);
  if (encash > 0) earnings.push({ key: "leave_encashment", label: `Leave encashment (${elLeft} EL days)`, amount: encash });

  // gratuity
  const g = gratuityFor(structure, employee.joined, lastWorkingDay);
  info.service = { years: g.years, months: g.months, counted: g.counted };
  info.gratuityEligible = g.eligible;
  if (g.amount > 0) earnings.push({ key: "gratuity", label: `Gratuity (${g.counted} years)`, amount: g.amount });

  // notice period shortfall
  const served = Math.max(0, daysBetween(resignationDate, lastWorkingDay) + 1);
  const short = Math.max(0, noticeDays - served);
  info.notice = { required: noticeDays, served, short };
  if (short > 0) deductions.push({ key: "notice", label: `Notice period recovery (${short} days)`, amount: Math.round((grossRate / 30) * short) });

  // loans and advances still owed
  const loans = await HrLoan.find({ emp: employee._id, status: "approved" }).lean();
  const repaid = await loanRepayments(loans.map((l) => l._id), null);
  const owed = loans.map((l) => withBalance(l, repaid)).filter((l) => l.outstanding > 0);
  if (owed.length) deductions.push({ key: "loan", label: "Loan / advance outstanding", amount: sum(owed, (l) => l.outstanding) });
  info.structure = structure;

  return { earnings, deductions, info, servedDays: served };
}

const settleTotals = (s) => {
  s.totalEarnings = sum(s.earnings, (l) => l.amount);
  s.totalDeductions = sum(s.deductions, (l) => l.amount);
  s.net = s.totalEarnings - s.totalDeductions;
  return s;
};

const readSettlementDates = async (b) => {
  if (!isId(b.emp)) return { error: "Pick an employee" };
  const employee = await HrEmployee.findById(b.emp);
  if (!employee) return { error: "Employee not found" };
  if (!DATE_RE.test(b.resignationDate || "") || !DATE_RE.test(b.lastWorkingDay || "")) return { error: "Resignation date and last working day are required" };
  if (b.lastWorkingDay < b.resignationDate) return { error: "The last working day is before the resignation date" };
  if (employee.joined && b.lastWorkingDay < employee.joined) return { error: "The last working day is before the joining date" };
  return { employee };
};

export const listSettlements = async (req, res) => {
  try {
    res.json({ settlements: await HrSettlement.find().sort({ createdAt: -1 }) });
  } catch (err) { serverError(res, err); }
};

export const previewSettlement = async (req, res) => {
  try {
    const b = req.body || {};
    const { employee, error } = await readSettlementDates(b);
    if (error) return res.status(400).json({ message: error });
    const settings = await loadSettings();
    const noticeDays = b.noticeDays === undefined || b.noticeDays === "" ? settings.payroll.noticeDays : num(b.noticeDays);
    const p = await settlementPreview(employee, b.resignationDate, b.lastWorkingDay, noticeDays);
    res.json({ preview: settleTotals({ ...p, noticeDays }) });
  } catch (err) { serverError(res, err); }
};

export const saveSettlement = async (req, res) => {
  try {
    const b = req.body || {};
    const { employee, error } = await readSettlementDates(b);
    if (error) return res.status(400).json({ message: error });
    let s = isId(req.params.id) ? await HrSettlement.findById(req.params.id) : null;
    if (req.params.id && !s) return res.status(404).json({ message: "Settlement not found" });
    if (s && s.status !== "draft") return res.status(409).json({ message: "An approved settlement can't be changed" });
    if (!s && await HrSettlement.exists({ emp: employee._id })) {
      return res.status(409).json({ message: `${employee.name} already has a settlement. Open that one.` });
    }
    s ||= new HrSettlement({ emp: employee._id });
    Object.assign(s, {
      resignationDate: b.resignationDate, lastWorkingDay: b.lastWorkingDay,
      noticeDays: num(b.noticeDays), servedDays: Math.max(0, daysBetween(b.resignationDate, b.lastWorkingDay) + 1),
      earnings: cleanLines(b.earnings), deductions: cleanLines(b.deductions),
      info: b.info && typeof b.info === "object" ? b.info : {}, note: String(b.note || "").trim()
    });
    settleTotals(s);
    await s.save();
    res.status(req.params.id ? 200 : 201).json({ settlement: s });
  } catch (err) { serverError(res, err); }
};

// Approving closes the employee: inactive from the last working day, loans settled
export const approveSettlement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Settlement not found" });
    const s = await HrSettlement.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Settlement not found" });
    if (s.status !== "draft") return res.status(409).json({ message: "Already approved" });
    await HrEmployee.updateOne({ _id: s.emp }, { $set: { active: false, lastWorkingDay: s.lastWorkingDay } });
    if (s.deductions.some((d) => d.key === "loan")) {
      const loans = await HrLoan.find({ emp: s.emp, status: "approved" });
      const repaid = await loanRepayments(loans.map((l) => l._id), null);
      for (const loan of loans) {
        const { outstanding } = withBalance(loan.toObject(), repaid);
        loan.recoveredOutside = (loan.recoveredOutside || 0) + outstanding;
        loan.status = "closed";
        await loan.save();
      }
    }
    s.status = "approved";
    s.approvedAt = new Date();
    await s.save();
    res.json({ settlement: s });
  } catch (err) { serverError(res, err); }
};

export const paySettlement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Settlement not found" });
    const s = await HrSettlement.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Settlement not found" });
    if (s.status !== "approved") return res.status(409).json({ message: "Approve the settlement first" });
    const { mode, ref, date } = req.body || {};
    if (!PAY_MODES.includes(mode)) return res.status(400).json({ message: "Pick a payment mode" });
    if (!DATE_RE.test(date || "")) return res.status(400).json({ message: "Payment date is required" });
    s.status = "paid";
    s.payment = { mode, ref: String(ref || "").trim(), date };
    await s.save();
    res.json({ settlement: s });
  } catch (err) { serverError(res, err); }
};

export const deleteSettlement = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Settlement not found" });
    const s = await HrSettlement.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Settlement not found" });
    if (s.status !== "draft") return res.status(409).json({ message: "Only a draft settlement can be deleted" });
    await s.deleteOne();
    res.json({ message: "Settlement deleted" });
  } catch (err) { serverError(res, err); }
};

// ---------- CTC preview for the employee form ----------

export const previewStructure = async (req, res) => {
  try {
    const settings = await loadSettings();
    const b = req.body || {};
    const structure = b.gross !== undefined && !b.structure
      ? effectiveStructure(null, num(b.gross), settings.payroll.split)
      : cleanStructure(b.structure);
    res.json({ structure, gross: structureTotal(structure), ctc: ctcOf(structure, { pfOn: b.pfOn !== false, esiOn: b.esiOn !== false }, settings) });
  } catch (err) { serverError(res, err); }
};
