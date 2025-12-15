import upload from "../config/multers3.js";
import express from "express";
import { createotheroom, getotheroom } from "../controllers/otheroomController.js";

const router = express.Router();

router.post("/create", upload.single("icon"), createotheroom);
router.get("/getotheroom", getotheroom);


export default router;