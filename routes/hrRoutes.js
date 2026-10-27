import express from "express";
import hrAuthMiddleware, { requireHrAdmin as admin } from "../middleware/hrAuthMiddleware.js";
import { hrLogin, hrAdminLogin, hrMe, hrLogout, hrChangePassword } from "../controllers/hrAuthController.js";
import {
  getHrSettings, updateHrSettings,
  getHrEmployees, createHrEmployee, updateHrEmployee, deleteHrEmployee,
  getHrAttendance, punchHr, overrideHrAttendance,
  getHrLeaves, createHrLeave, updateHrLeaveStatus, deleteHrLeave,
  getHrSalary, saveHrSalary,
  loadHrSample, clearHrSample,
} from "../controllers/hrController.js";

const router = express.Router();

router.post("/auth/login", hrLogin);
router.post("/auth/admin-login", hrAdminLogin);
router.post("/auth/logout", hrLogout);

// everything below requires a signed-in HR user. Employees see only their own records
// (the controller filters); routes marked admin are for the HR admin only.
router.use(hrAuthMiddleware);

router.get("/auth/me", hrMe);
router.put("/auth/password", admin, hrChangePassword);

router.get("/settings", getHrSettings);
router.put("/settings", admin, updateHrSettings);

router.get("/employees", getHrEmployees);
router.post("/employees", admin, createHrEmployee);
router.put("/employees/:id", admin, updateHrEmployee);
router.delete("/employees/:id", admin, deleteHrEmployee);

router.get("/attendance", getHrAttendance);
router.post("/attendance/punch", punchHr);
router.put("/attendance/override", admin, overrideHrAttendance);

router.get("/leaves", getHrLeaves);
router.post("/leaves", createHrLeave);
router.patch("/leaves/:id/status", admin, updateHrLeaveStatus);
router.delete("/leaves/:id", admin, deleteHrLeave);

router.get("/salary", admin, getHrSalary);
router.put("/salary", admin, saveHrSalary);

router.post("/sample", admin, loadHrSample);
router.delete("/sample", admin, clearHrSample);

export default router;
