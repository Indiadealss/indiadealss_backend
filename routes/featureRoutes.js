import upload from "../config/multers3.js";
import express from "express";
import { createfeature, getLocalAdvantages, localAdvantages } from "../controllers/addFeature.js";
import { getFeature } from "../controllers/addFeature.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createfeature);
router.get("/getFeatures", getFeature);
router.post("/localAdvantages", upload.single("icon"),localAdvantages);
router.get("/getlocationAdvantages",getLocalAdvantages)


export default router;