import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import HrUser from "../models/hr/HrUser.js";
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

// Employee login: username + employee code + password. The HR admin has its own login (hrAdminLogin).
export const hrLogin = async (req, res) => {
  try {
    const { username, employeeCode, password } = req.body;
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

    startSession(res, user, employee);
  } catch (err) {
    console.error("hrLogin error:", err);
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

    startSession(res, user, null);
  } catch (err) {
    console.error("hrAdminLogin error:", err);
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
