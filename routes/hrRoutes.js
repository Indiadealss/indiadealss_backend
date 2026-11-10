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
import {
  listPayrollRuns, getPayroll, generatePayroll, updatePayslip, approvePayroll, unlockPayroll, payPayroll,
  listPayslips, emailPayslip,
  listRevisions, createRevision, deleteRevision, previewStructure,
  listAdjustments, createAdjustment, deleteAdjustment,
  listLoans, createLoan, updateLoan, deleteLoan,
  getTax, saveTaxDeclaration, getForm16,
  getCompliance, getComplianceTracker, saveStatutoryPayment,
  listSettlements, previewSettlement, saveSettlement, approveSettlement, paySettlement, deleteSettlement,
} from "../controllers/hrPayrollController.js";
import {
  getDirectory, listRequests, createRequest, setRequestStatus, deleteRequest,
  listPosts, createPost, likePost, deletePost,
} from "../controllers/hrPortalController.js";

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
router.delete("/leaves/:id", deleteHrLeave);

router.get("/salary", admin, getHrSalary);
router.put("/salary", admin, saveHrSalary);

// ---------- home page & self service ----------

router.get("/directory", getDirectory);

router.get("/requests", listRequests);
router.post("/requests", createRequest);
router.patch("/requests/:id/status", admin, setRequestStatus);
router.delete("/requests/:id", deleteRequest);

router.get("/posts", listPosts);
router.post("/posts", createPost);
router.post("/posts/:id/like", likePost);
router.delete("/posts/:id", deletePost);

// ---------- payroll ----------
// Employees can read their own payslips, loans and tax, request loans and file their tax declaration.

router.get("/payroll", admin, listPayrollRuns);
router.get("/payroll/:month", admin, getPayroll);
router.post("/payroll/:month/generate", admin, generatePayroll);
router.put("/payroll/:month/slips/:id", admin, updatePayslip);
router.post("/payroll/:month/approve", admin, approvePayroll);
router.post("/payroll/:month/unlock", admin, unlockPayroll);
router.post("/payroll/:month/pay", admin, payPayroll);

router.get("/payslips", listPayslips);
router.post("/payslips/:id/email", admin, emailPayslip);

router.post("/structure/preview", admin, previewStructure);
router.get("/employees/:id/revisions", admin, listRevisions);
router.post("/employees/:id/revisions", admin, createRevision);
router.delete("/revisions/:rid", admin, deleteRevision);

router.get("/adjustments", admin, listAdjustments);
router.post("/adjustments", admin, createAdjustment);
router.delete("/adjustments/:id", admin, deleteAdjustment);

router.get("/loans", listLoans);
router.post("/loans", createLoan);
router.patch("/loans/:id", admin, updateLoan);
router.delete("/loans/:id", admin, deleteLoan);

router.get("/tax", getTax);
router.put("/tax/:emp", saveTaxDeclaration);
router.get("/tax/:emp/form16", getForm16);

router.get("/compliance", admin, getCompliance);
router.get("/compliance/tracker", admin, getComplianceTracker);
router.put("/compliance/payments", admin, saveStatutoryPayment);

router.get("/settlements", admin, listSettlements);
router.post("/settlements/preview", admin, previewSettlement);
router.post("/settlements", admin, saveSettlement);
router.put("/settlements/:id", admin, saveSettlement);
router.post("/settlements/:id/approve", admin, approveSettlement);
router.post("/settlements/:id/pay", admin, paySettlement);
router.delete("/settlements/:id", admin, deleteSettlement);

router.post("/sample", admin, loadHrSample);
router.delete("/sample", admin, clearHrSample);

export default router;
