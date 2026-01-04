import express from 'express';
import multer from 'multer';
import { createdealer, getcampain } from '../controllers/adddelerDetailsController.js';

const router = express.Router();

const upload = multer();

router.post("/adddelear", upload.fields([
    {name:"images",maxCount:2},
    {name:"video",maxCount:2}
]),createdealer);
router.get("/geddealer",getcampain);


export default router