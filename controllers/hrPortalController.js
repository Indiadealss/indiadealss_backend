import mongoose from "mongoose";
import HrEmployee from "../models/hr/HrEmployee.js";
import HrAttendance from "../models/hr/HrAttendance.js";
import HrSettings from "../models/hr/HrSettings.js";
import { HrRequest, REQUEST_TYPES, HrPost, BADGES } from "../models/hr/HrPortal.js";
import { rangeLocked } from "./hrPayrollController.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const isId = (v) => mongoose.isValidObjectId(v);
const isEmployee = (req) => req.hrUser?.role === "employee";
const ownId = (req) => String(req.hrEmployee?._id || "");
const clean = (v, max = 1000) => String(v || "").trim().slice(0, max);

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
};

const istToday = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};

const LOCKED = "Payroll for that month is approved and locked. Ask HR to unlock it first.";

// ---------- colleague directory ----------
// What everyone may see about colleagues: enough for birthdays, new joiners and badges.

export const getDirectory = async (req, res) => {
  try {
    const list = await HrEmployee.find({ active: true }).select("code name dept designation joined dob base").sort({ name: 1 });
    res.json({
      people: list.map((e) => ({
        id: String(e._id), code: e.code, name: e.name, dept: e.dept, designation: e.designation, base: e.base,
        joined: e.joined,
        // the year of birth stays private
        birthday: e.dob ? e.dob.slice(5) : ""
      }))
    });
  } catch (err) { serverError(res, err); }
};

// ---------- CRM team ----------
// Employees with CRM access, as the CRM's team list. Only CRM users (and the HR admin) can read it.

export const getCrmTeam = async (req, res) => {
  try {
    if (isEmployee(req) && !req.hrEmployee?.crmAccess) return res.status(403).json({ message: "CRM access isn't turned on for you" });
    const list = await HrEmployee.find({ crmAccess: true }).select("code name email phone dept designation crmRole target active").sort({ name: 1 });
    res.json({
      team: list.map((e) => ({
        id: String(e._id), code: e.code, name: e.name, email: e.email, phone: e.phone, dept: e.dept, designation: e.designation,
        role: e.crmRole, target: e.target || 0, active: e.active
      }))
    });
  } catch (err) { serverError(res, err); }
};

// ---------- attendance requests ----------

export const listRequests = async (req, res) => {
  try {
    const requests = await HrRequest.find(isEmployee(req) ? { emp: ownId(req) } : {}).sort({ createdAt: -1 }).limit(500);
    res.json({ requests });
  } catch (err) { serverError(res, err); }
};

export const createRequest = async (req, res) => {
  try {
    const b = req.body || {};
    const emp = isEmployee(req) ? ownId(req) : b.emp;
    if (!isId(emp) || !(await HrEmployee.exists({ _id: emp }))) return res.status(400).json({ message: "Pick an employee" });
    if (!REQUEST_TYPES.includes(b.type)) return res.status(400).json({ message: "Pick a request type" });
    const from = b.from;
    const to = b.type === "regularize" ? b.from : b.to || b.from;
    if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) return res.status(400).json({ message: "Dates are required" });
    if (to < from) return res.status(400).json({ message: "The end date is before the start date." });
    const today = istToday();
    if (b.type === "regularize") {
      if (from > today) return res.status(400).json({ message: "You can only regularize a past day or today" });
      if (!TIME_RE.test(b.in || "") || !TIME_RE.test(b.out || "")) return res.status(400).json({ message: "Enter the in and out time" });
      if (b.out <= b.in) return res.status(400).json({ message: "Out time must be after in time" });
    }
    if (!clean(b.reason)) return res.status(400).json({ message: "Give a reason" });
    if (await rangeLocked(from, to)) return res.status(409).json({ message: LOCKED });
    const request = await HrRequest.create({
      emp, type: b.type, from, to, reason: clean(b.reason), applied: today,
      ...(b.type === "regularize" && { in: b.in, out: b.out })
    });
    res.status(201).json({ request });
  } catch (err) { serverError(res, err); }
};

// Approval writes the request onto attendance. Outdoor duty and WFH mark working days present.
async function applyRequest(r) {
  if (r.type === "regularize") {
    await HrAttendance.findOneAndUpdate(
      { emp: r.emp, date: r.from },
      { $set: { in: r.in, out: r.out, src: "reg" }, $unset: { ov: 1 } },
      { upsert: true }
    );
    return;
  }
  const settings = (await HrSettings.findOne({ key: "company" })) || new HrSettings();
  const hol = new Set(settings.holidays.map((h) => h.date));
  const ops = [];
  for (let d = new Date(r.from + "T00:00:00Z"); d <= new Date(r.to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    if (hol.has(date) || settings.weeklyOff.includes(d.getUTCDay())) continue;
    ops.push({ updateOne: { filter: { emp: r.emp, date }, update: { $set: { ov: "P", src: r.type === "wfh" ? "wfh" : "od" } }, upsert: true } });
  }
  if (ops.length) await HrAttendance.bulkWrite(ops);
}

export const setRequestStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (!isId(req.params.id)) return res.status(404).json({ message: "Request not found" });
    const r = await HrRequest.findById(req.params.id);
    if (!r) return res.status(404).json({ message: "Request not found" });
    if (r.status !== "pending") return res.status(409).json({ message: `This request is already ${r.status}` });
    if (await rangeLocked(r.from, r.to)) return res.status(409).json({ message: LOCKED });
    if (status === "approved") await applyRequest(r);
    r.status = status;
    await r.save();
    res.json({ request: r });
  } catch (err) { serverError(res, err); }
};

// Employees can withdraw their own pending requests; the admin can delete any pending one
export const deleteRequest = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Request not found" });
    const r = await HrRequest.findById(req.params.id);
    if (!r || (isEmployee(req) && String(r.emp) !== ownId(req))) return res.status(404).json({ message: "Request not found" });
    if (r.status !== "pending") return res.status(409).json({ message: "Only a pending request can be withdrawn" });
    await r.deleteOne();
    res.json({ message: "Request withdrawn" });
  } catch (err) { serverError(res, err); }
};

// ---------- posts: badges, wishes, announcements ----------

// ?type=badge|announcement|wish|congrats, ?to=<employee id> (wishes/congrats for someone)
export const listPosts = async (req, res) => {
  try {
    const filter = {};
    if (["badge", "wish", "congrats", "announcement"].includes(req.query.type)) filter.type = req.query.type;
    if (isId(req.query.to)) filter.to = req.query.to;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    res.json({ posts: await HrPost.find(filter).sort({ createdAt: -1 }).limit(limit) });
  } catch (err) { serverError(res, err); }
};

export const createPost = async (req, res) => {
  try {
    const b = req.body || {};
    const post = { type: b.type, by: req.hrUser._id, byName: req.hrUser.name, date: istToday(), message: clean(b.message) };
    if (b.type === "announcement") {
      if (isEmployee(req)) return res.status(403).json({ message: "Only HR can post announcements" });
      post.title = clean(b.title, 150);
      if (!post.title) return res.status(400).json({ message: "Give the announcement a title" });
    } else if (["badge", "wish", "congrats"].includes(b.type)) {
      if (!isId(b.to) || !(await HrEmployee.exists({ _id: b.to, active: true }))) return res.status(400).json({ message: "Pick a colleague" });
      if (isEmployee(req) && b.to === ownId(req)) return res.status(400).json({ message: "Pick a colleague, not yourself" });
      post.to = b.to;
      if (b.type === "badge") {
        if (!BADGES.includes(b.badge)) return res.status(400).json({ message: "Pick a badge" });
        if (!post.message) return res.status(400).json({ message: "Say what the badge is for" });
        post.badge = b.badge;
      } else {
        post.occasion = b.type === "wish" ? (b.occasion === "anniversary" ? "anniversary" : "birthday") : "welcome";
        // one wish per person per occasion per day
        const dup = await HrPost.exists({ type: b.type, by: req.hrUser._id, to: b.to, occasion: post.occasion, date: post.date });
        if (dup) return res.status(409).json({ message: "You've already sent this today" });
        post.message ||= b.type === "wish" ? (post.occasion === "birthday" ? "Happy birthday!" : "Happy work anniversary!") : "Welcome to the team!";
      }
    } else {
      return res.status(400).json({ message: "Invalid post" });
    }
    res.status(201).json({ post: await HrPost.create(post) });
  } catch (err) { serverError(res, err); }
};

export const likePost = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Post not found" });
    const post = await HrPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const me = String(req.hrUser._id);
    post.likes = post.likes.includes(me) ? post.likes.filter((x) => x !== me) : [...post.likes, me];
    await post.save();
    res.json({ post });
  } catch (err) { serverError(res, err); }
};

export const deletePost = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Post not found" });
    const post = await HrPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (isEmployee(req) && String(post.by) !== String(req.hrUser._id)) return res.status(403).json({ message: "You can only remove your own posts" });
    await post.deleteOne();
    res.json({ message: "Removed" });
  } catch (err) { serverError(res, err); }
};
