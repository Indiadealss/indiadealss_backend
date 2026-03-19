import express from "express";
import { getUserViewed, toggleViewed } from "../controllers/viewedList.js";

const router = express.Router();

// Toggle (Add/Remove)
router.post("/toggle", toggleViewed);

// Get user shortlist
router.get("/:userId", getUserViewed);

export default router;