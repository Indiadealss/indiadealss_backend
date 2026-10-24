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

    const employee = await loadHrEmployee(user);
    if (employee === undefined) return res.status(403).json({ message: "Your employee account is not active. Contact HR." });

    const token = jwt.sign({ hr_user_id: user._id }, hrJwtSecret(), { expiresIn: "12h" });
    res.cookie(HR_COOKIE, token, cookieOptions);
    res.status(200).json({ user, employee });
  } catch (err) {
    console.error("hrLogin error:", err);
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
