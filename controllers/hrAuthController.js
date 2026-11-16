import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import HrUser from "../models/hr/HrUser.js";
import HrOtp from "../models/hr/HrOtp.js";
import { sendOtpText } from "../utils/otpHelper.js";
import { HR_COOKIE, hrJwtSecret, loadHrEmployee } from "../middleware/hrAuthMiddleware.js";

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 12 * 60 * 60 * 1000,
};

const startSession = (res, user, employee) => {
  const token = jwt.sign({ hr_user_id: user._id }, hrJwtSecret(), { expiresIn: "12h" });
  res.cookie(HR_COOKIE, token, cookieOptions);
  res.status(200).json({ user, employee });
};

// ---------- login OTP ----------
// Employee logins (HR portal and CRM) need the password and then an OTP sent to the mobile on their HR record.
// HR_LOGIN_OTP=off turns the OTP step off. HR_OTP_CONSOLE=true prints the OTP in the server log instead of
// sending an SMS (for local testing only).

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const otpOn = () => process.env.HR_LOGIN_OTP !== "off";
const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const mobileOf = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};
const maskMobile = (m) => `XXXXXX${m.slice(-4)}`;

async function sendLoginOtp(doc) {
  const code = String(crypto.randomInt(100000, 1000000));
  doc.codeHash = hashCode(code);
  doc.attempts = 0;
  doc.sentAt = new Date();
  doc.expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await doc.save();
  if (process.env.HR_OTP_CONSOLE === "true" && !isProd) {
    console.log(`[HR login OTP] ${doc.mobile}: ${code}`);
    return;
  }
  await sendOtpText(doc.mobile, code);
}

// Employee login: username + employee code + password, then OTP. app: "hr" (default) or "crm".
// The HR admin has its own login (hrAdminLogin).
export const hrLogin = async (req, res) => {
  try {
    const { username, employeeCode, password } = req.body;
    const app = req.body.app === "crm" ? "crm" : "hr";
    if (!username || !employeeCode || !password) {
      return res.status(400).json({ message: "Username, employee code and password are required" });
    }

    // username and employee code must belong to the same account
    const user = await HrUser.findOne({
      username: String(username).toLowerCase().trim(),
      employeeCode: String(employeeCode).toUpperCase().trim(),
    });
    const match = user && await bcrypt.compare(String(password), user.password);
    // one message for every mismatch, so it doesn't reveal which field was wrong
    if (!match) return res.status(400).json({ message: "Wrong username, employee code or password" });
    if (user.role === "admin") return res.status(403).json({ message: "HR admin signs in on the admin login page" });

    const employee = await loadHrEmployee(user);
    if (employee === undefined) return res.status(403).json({ message: "Your employee account is not active. Contact HR." });
    if (app === "crm" && !employee.crmAccess) return res.status(403).json({ message: "CRM access isn't turned on for you. Ask HR to enable it." });

    if (!otpOn()) return startSession(res, user, employee);

    const mobile = mobileOf(employee.phone);
    if (!mobile) return res.status(400).json({ message: "There's no valid mobile number on your HR record for the OTP. Ask HR to add it." });
    await HrOtp.deleteMany({ user: user._id });
    const otp = new HrOtp({ user: user._id, app, mobile, codeHash: "-", expiresAt: new Date() });
    try {
      await sendLoginOtp(otp);
    } catch (err) {
      await otp.deleteOne();
      console.error("login OTP SMS failed:", err.message);
      return res.status(502).json({ message: "Couldn't send the OTP SMS. Try again in a minute." });
    }
    res.status(200).json({ otpRequired: true, challenge: String(otp._id), mobile: maskMobile(mobile), expiresIn: OTP_TTL_MS / 1000 });
  } catch (err) {
    console.error("hrLogin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Second step: the OTP from the SMS
export const hrVerifyOtp = async (req, res) => {
  try {
    const { challenge, otp } = req.body || {};
    if (!mongoose.isValidObjectId(challenge) || !otp) return res.status(400).json({ message: "Enter the OTP" });
    const doc = await HrOtp.findById(challenge);
    if (!doc || doc.expiresAt < new Date()) return res.status(400).json({ message: "This OTP has expired. Sign in again." });
    if (doc.attempts >= OTP_MAX_ATTEMPTS) {
      await doc.deleteOne();
      return res.status(429).json({ message: "Too many wrong attempts. Sign in again." });
    }
    if (hashCode(String(otp).trim()) !== doc.codeHash) {
      doc.attempts += 1;
      await doc.save();
      const left = OTP_MAX_ATTEMPTS - doc.attempts;
      return res.status(400).json({ message: left ? `Wrong OTP. ${left} attempt${left > 1 ? "s" : ""} left.` : "Too many wrong attempts. Sign in again." });
    }
    await doc.deleteOne();

    const user = await HrUser.findById(doc.user);
    const employee = user && await loadHrEmployee(user);
    if (user?.role === "admin") return startSession(res, user, null);
    if (!user || !employee) return res.status(403).json({ message: "Your employee account is not active. Contact HR." });
    if (doc.app === "crm" && !employee.crmAccess) return res.status(403).json({ message: "CRM access isn't turned on for you. Ask HR to enable it." });
    startSession(res, user, employee);
  } catch (err) {
    console.error("hrVerifyOtp error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const hrResendOtp = async (req, res) => {
  try {
    const { challenge } = req.body || {};
    if (!mongoose.isValidObjectId(challenge)) return res.status(400).json({ message: "Sign in again" });
    const doc = await HrOtp.findById(challenge);
    if (!doc || doc.expiresAt < new Date()) return res.status(400).json({ message: "This OTP has expired. Sign in again." });
    const wait = Math.ceil((doc.sentAt.getTime() + OTP_RESEND_MS - Date.now()) / 1000);
    if (wait > 0) return res.status(429).json({ message: `Wait ${wait} seconds before asking for a new OTP` });
    try {
      await sendLoginOtp(doc);
    } catch (err) {
      console.error("login OTP SMS failed:", err.message);
      return res.status(502).json({ message: "Couldn't send the OTP SMS. Try again in a minute." });
    }
    res.json({ message: `New OTP sent to ${maskMobile(doc.mobile)}`, expiresIn: OTP_TTL_MS / 1000 });
  } catch (err) {
    console.error("hrResendOtp error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// HR admin login: username + password only
export const hrAdminLogin = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: "Username and password are required" });

    // employees share the organisation username, so only admin accounts are checked here
    const admins = await HrUser.find({ username: String(username).toLowerCase().trim(), role: "admin" });
    let user = null;
    for (const a of admins) {
      if (await bcrypt.compare(String(password), a.password)) { user = a; break; }
    }
    if (!user) return res.status(400).json({ message: "Wrong username or password" });

    // with a mobile saved on the admin account, the admin also needs the OTP
    const mobile = otpOn() && mobileOf(user.phone);
    if (!mobile) return startSession(res, user, null);
    await HrOtp.deleteMany({ user: user._id });
    const otp = new HrOtp({ user: user._id, app: "hr-admin", mobile, codeHash: "-", expiresAt: new Date() });
    try {
      await sendLoginOtp(otp);
    } catch (err) {
      await otp.deleteOne();
      console.error("admin login OTP SMS failed:", err.message);
      return res.status(502).json({ message: "Couldn't send the OTP SMS. Try again in a minute." });
    }
    res.status(200).json({ otpRequired: true, challenge: String(otp._id), mobile: maskMobile(mobile), expiresIn: OTP_TTL_MS / 1000 });
  } catch (err) {
    console.error("hrAdminLogin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// HR admin sets (or clears) the mobile for their login OTP. Needs the current password.
export const hrSetAdminPhone = async (req, res) => {
  try {
    const { phone = "", password } = req.body || {};
    const user = await HrUser.findById(req.hrUser._id);
    if (!user || !password || !(await bcrypt.compare(String(password), user.password))) {
      return res.status(400).json({ message: "Current password is wrong" });
    }
    const mobile = String(phone).trim() ? mobileOf(phone) : "";
    if (mobile === null) return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
    user.phone = mobile;
    await user.save();
    res.json({ user, message: mobile ? `Login OTP will go to ${maskMobile(mobile)}` : "Login OTP turned off for the admin" });
  } catch (err) {
    console.error("hrSetAdminPhone error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// HR admin changes their own password
export const hrChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Current and new password are required" });
    if (String(newPassword).length < 8) return res.status(400).json({ message: "New password must be at least 8 characters" });

    const user = await HrUser.findById(req.hrUser._id);
    if (!user || !(await bcrypt.compare(String(currentPassword), user.password))) {
      return res.status(400).json({ message: "Current password is wrong" });
    }
    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ message: "Password changed" });
  } catch (err) {
    console.error("hrChangePassword error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const hrMe = async (req, res) => {
  res.status(200).json({ user: req.hrUser, employee: req.hrEmployee });
};

export const hrLogout = async (req, res) => {
  const { maxAge, ...opts } = cookieOptions;
  res.clearCookie(HR_COOKIE, opts);
  res.json({ message: "Logged out" });
};
