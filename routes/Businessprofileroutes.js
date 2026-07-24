import express from "express";
import { getBusinessProfile, updateBusinessProfile } from "../controllers/businessProfileController.js";

const router = express.Router();

router.get("/", getBusinessProfile);
router.put("/", updateBusinessProfile);

export default router;
