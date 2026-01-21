import express from "express";
import { genrateLead, getLead, getProjectLead } from "../controllers/leadController.js";
import multer from "multer";



const router = express.Router();

const upload = multer();

router.post("/lead", upload.none(),genrateLead);
router.get("/getlead",getLead);
router.get("/getleadbycam",getProjectLead)

export default router;