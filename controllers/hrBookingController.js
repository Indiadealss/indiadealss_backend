import mongoose from "mongoose";
import HrEmployee from "../models/hr/HrEmployee.js";
import HrBooking, { BILL_STATUSES } from "../models/hr/HrBooking.js";
import { HrAdjustment, HrPayroll } from "../models/hr/HrPayroll.js";
import { monthLocked } from "./hrPayrollController.js";

// Bookings and the commission / incentive on each (Incentives page, HR admin only)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const isId = (v) => mongoose.isValidObjectId(v);
const amount = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
const text = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const LOCKED = (m) => `Payroll for ${m} is approved and locked, and this booking's incentive is on it. Unlock that payroll first.`;

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
};

// balance is always total - received, never typed
const out = (b) => {
  const j = b.toJSON ? b.toJSON() : b;
  if (j.adjustment) j.adjustment = String(j.adjustment);
  return { ...j, balanceCommission: Math.round((j.totalCommission - j.receivedCommission) * 100) / 100 };
};

const withPayStatus = async (b) => {
  const run = b.adjustment && b.payMonth ? await HrPayroll.findOne({ month: b.payMonth }).select("status") : null;
  return { ...out(b), payStatus: !b.adjustment ? "" : run?.status || "pending" };
};

const fields = (b) => ({
  date: text(b.date, 10),
  emp: b.emp,
  channelPartner: text(b.channelPartner),
  clientName: text(b.clientName),
  mobile: text(b.mobile, 20),
  email: text(b.email),
  builder: text(b.builder),
  project: text(b.project),
  unitNo: text(b.unitNo, 60),
  unitSize: text(b.unitSize, 60),
  loginPrice: amount(b.loginPrice),
  totalCommission: amount(b.totalCommission),
  billStatus: BILL_STATUSES.includes(b.billStatus) ? b.billStatus : "pending",
  receivedCommission: amount(b.receivedCommission),
  cpCommission: amount(b.cpCommission),
  incentive: amount(b.incentive),
  payMonth: MONTH_RE.test(b.payMonth || "") ? b.payMonth : "",
  remarks: text(b.remarks, 500),
});

const check = async (f) => {
  if (!DATE_RE.test(f.date)) return "Enter the date of booking";
  if (!isId(f.emp) || !(await HrEmployee.exists({ _id: f.emp }))) return "Pick the source candidate";
  if (!f.clientName) return "Enter the client name";
  if (f.receivedCommission > f.totalCommission) return "Received commission can't be more than the total commission";
  if (f.payMonth && !(f.incentive > 0)) return "Enter the candidate incentive to pay it with salary";
  return "";
};

const adjNote = (f) => `Booking ${f.date}: ${f.clientName}${f.project ? ` · ${f.project}` : ""}${f.unitNo ? ` ${f.unitNo}` : ""}`.slice(0, 200);

// Keep the linked "incentive" line on Bonus & payments in step with the booking.
// Returns an error message, or "" when done.
const syncAdjustment = async (booking, f) => {
  const current = booking.adjustment ? await HrAdjustment.findById(booking.adjustment) : null;
  const wanted = f.payMonth && f.incentive > 0 ? { emp: String(f.emp), month: f.payMonth, amount: f.incentive } : null;
  const same = current && wanted && String(current.emp) === wanted.emp && current.month === wanted.month && current.amount === wanted.amount;

  if (same) {
    if (current.note !== adjNote(f) && !(await monthLocked(current.month))) {
      current.note = adjNote(f);
      await current.save();
    }
    return "";
  }
  if (current && (await monthLocked(current.month))) return LOCKED(current.month);
  if (wanted && (await monthLocked(wanted.month))) return `Payroll for ${wanted.month} is approved and locked. Pick another month or unlock it first.`;
  if (current) await current.deleteOne();
  booking.adjustment = undefined;
  if (wanted) {
    const adj = await HrAdjustment.create({ ...wanted, type: "incentive", note: adjNote(f) });
    booking.adjustment = adj._id;
  }
  return "";
};

export const listBookings = async (req, res) => {
  try {
    const filter = {};
    const { from, to, emp } = req.query;
    if (DATE_RE.test(from || "") || DATE_RE.test(to || "")) {
      filter.date = {};
      if (DATE_RE.test(from || "")) filter.date.$gte = from;
      if (DATE_RE.test(to || "")) filter.date.$lte = to;
    }
    if (isId(emp)) filter.emp = emp;
    const list = await HrBooking.find(filter).sort({ date: -1, createdAt: -1 });
    // where the incentive stands: the payroll run of its salary month (pending / approved / paid)
    const months = [...new Set(list.map((b) => b.payMonth).filter(Boolean))];
    const runs = new Map((await HrPayroll.find({ month: { $in: months } }).select("month status")).map((p) => [p.month, p.status]));
    res.json({ bookings: list.map((b) => ({ ...out(b), payStatus: !b.adjustment ? "" : runs.get(b.payMonth) || "pending" })) });
  } catch (err) { serverError(res, err); }
};

export const createBooking = async (req, res) => {
  try {
    const f = fields(req.body || {});
    const bad = await check(f);
    if (bad) return res.status(400).json({ message: bad });
    const booking = new HrBooking(f);
    const locked = await syncAdjustment(booking, f);
    if (locked) return res.status(409).json({ message: locked });
    await booking.save();
    res.status(201).json({ booking: await withPayStatus(booking) });
  } catch (err) { serverError(res, err); }
};

export const updateBooking = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Booking not found" });
    const booking = await HrBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const f = fields({ ...booking.toObject(), ...(req.body || {}) });
    const bad = await check(f);
    if (bad) return res.status(400).json({ message: bad });
    const locked = await syncAdjustment(booking, f);
    if (locked) return res.status(409).json({ message: locked });
    booking.set(f);
    await booking.save();
    res.json({ booking: await withPayStatus(booking) });
  } catch (err) { serverError(res, err); }
};

export const deleteBooking = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Booking not found" });
    const booking = await HrBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const adj = booking.adjustment ? await HrAdjustment.findById(booking.adjustment) : null;
    if (adj && (await monthLocked(adj.month))) return res.status(409).json({ message: LOCKED(adj.month) });
    if (adj) await adj.deleteOne();
    await booking.deleteOne();
    res.json({ message: "Removed" });
  } catch (err) { serverError(res, err); }
};
