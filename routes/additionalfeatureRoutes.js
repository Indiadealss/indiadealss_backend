import upload from "../config/multers3.js";
import express from "express";
import { createadditionalFeature, getadditionalFeature } from "../controllers/additionalFeatureController.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createadditionalFeature);
router.get("/getadditionalfeature", getadditionalFeature);


export default router;