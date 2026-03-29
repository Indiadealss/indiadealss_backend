import upload from "../config/multers3.js";
import express from "express";
import { createoverlookingFeature, getoverlookingFeature, getOverlookingFeatureById } from "../controllers/overlookingController.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createoverlookingFeature);
router.get("/getoverlookingFeature", getoverlookingFeature);
router.get("/getOverlookingFeatureById",getOverlookingFeatureById)


export default router;