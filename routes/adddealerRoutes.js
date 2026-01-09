import express from 'express';
import multer from 'multer';
import upload from "../config/multers3.js";
import { createdealer, getcampain, getcampainbyid } from '../controllers/adddelerDetailsController.js';

const router = express.Router();


router.post("/adddelear", upload.single("images"),upload.single("video"),createdealer);
router.get("/geddealer",getcampain);
router.get("/getcampainbyid",getcampainbyid);


export default router