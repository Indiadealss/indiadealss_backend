import upload from "../config/multers3.js";
import express from "express";
import { createPicture } from "../controllers/pictureController.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createPicture);


export default router;