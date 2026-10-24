import jwt from "jsonwebtoken";
import HrUser from "../models/hr/HrUser.js";
import HrEmployee from "../models/hr/HrEmployee.js";

export const HR_COOKIE = "hr_token";
export const hrJwtSecret = () => process.env.HR_JWT_SECRET || process.env.JWT_SECRET;

// Employee logins only work while their employee record exists and is active
export const loadHrEmployee = async (user) => {
  if (user.role !== "employee") return null;
  const employee = user.employee && await HrEmployee.findById(user.employee);
  return employee && employee.active ? employee : undefined;
};

// HR app has its own login (users live in the HR database), so it uses its own cookie.
// Sets req.hrUser, and req.hrEmployee for employee logins.
const hrAuthMiddleware = async (req, res, next) => {
  const token = req.cookies?.[HR_COOKIE];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, hrJwtSecret());
    const user = await HrUser.findById(payload.hr_user_id);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const employee = await loadHrEmployee(user);
    if (employee === undefined) return res.status(401).json({ message: "Your employee account is not active" });

    req.hrUser = user;
    req.hrEmployee = employee;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Routes that change company data or show everyone's data
export const requireHrAdmin = (req, res, next) => {
  if (req.hrUser?.role !== "admin") return res.status(403).json({ message: "Only the HR admin can do this" });
  next();
};

export default hrAuthMiddleware;
