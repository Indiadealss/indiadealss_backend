import express from 'express';
import multer from 'multer';
import upload from "../config/multers3.js";
import { createdealer, getcampain, getcampainbyid } from '../controllers/adddelerDetailsController.js';

const router = express.Router();


router.post("/adddelear", upload.fields([
  { name: "images", maxCount: 1 },
  { name: "video", maxCount: 1 },
])
,createdealer);
router.get("/geddealer",getcampain);
router.get("/getcampainbyid/:npxid",getcampainbyid);


export default router