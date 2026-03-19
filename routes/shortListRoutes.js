import express from "express";
import { getUserShortlist, toggleShortlist } from "../controllers/shortList.js";

const router = express.Router();

// Toggle (Add/Remove)
router.post("/toggle", toggleShortlist);

// Get user shortlist
router.get("/:userId", getUserShortlist);

export default router;