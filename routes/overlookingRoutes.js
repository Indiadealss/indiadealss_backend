import upload from "../config/multers3.js";
import express from "express";
import { createoverlookingFeature, getoverlookingFeature } from "../controllers/overlookingController.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createoverlookingFeature);
router.get("/getoverlookingFeature", getoverlookingFeature);


export default router;