import express from "express";
import { genrateLead, genrateLeadUser, getLead } from "../controllers/leadController.js";
import multer from "multer";



const router = express.Router();

const upload = multer();

router.post("/lead", upload.none(),genrateLead);
router.get("/getlead",getLead);
router.post("/genrate",genrateLeadUser)

export default router;