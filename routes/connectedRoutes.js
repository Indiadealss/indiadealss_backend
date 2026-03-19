import express from "express";
import { getUserConnected, toggleConnected } from "../controllers/connectedList.js";

const router = express.Router();

// Toggle (Add/Remove)
router.post("/toggle", toggleConnected);

// Get user shortlist
router.get("/:userId", getUserConnected);

export default router;