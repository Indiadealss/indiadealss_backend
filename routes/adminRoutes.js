import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
  getAdminStats,
  getAdminProperties,
  updateAdminPropertyStatus,
  deleteAdminProperty,
  getAdminLeads,
  getAdminUsers,
  updateAdminUserRole,
} from "../controllers/adminController.js";

const router = express.Router();

// everything below requires a logged-in admin
router.use(authMiddleware, adminMiddleware);

router.get("/stats", getAdminStats);

router.get("/properties", getAdminProperties);
router.put("/properties/:id/status", updateAdminPropertyStatus);
router.delete("/properties/:id", deleteAdminProperty);

router.get("/leads", getAdminLeads);

router.get("/users", getAdminUsers);
router.put("/users/:id/role", updateAdminUserRole);

export default router;
