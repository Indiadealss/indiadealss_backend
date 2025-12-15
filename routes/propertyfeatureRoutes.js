import upload from "../config/multers3.js";
import express from "express";
import { createpropertyFeature, getpropertyFeature } from "../controllers/propertyFeaturesController.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createpropertyFeature);
router.get("/getpropertyFeature", getpropertyFeature);


export default router;