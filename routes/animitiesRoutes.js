import upload from "../config/multers3.js";
import express from "express";
import { createamenities, getanimities } from "../controllers/amenities.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createamenities);
router.get("/getAminities", getanimities);


export default router;