import express from "express";
import { genrateLeadUser, getLeadByUser } from "../controllers/gestLeadController.js";
import multer from "multer";


const router = express.Router();

const upload = multer();

router.post("/genrate", upload.none(),genrateLeadUser);
router.get("/getLeaduser",getLeadByUser)

export default router;