import upload from "../config/multers3.js";
import express from "express";
import { createUpcomming, getUpcomming } from "../controllers/upcomingprojectsController.js";

const router = express.Router();

router.post("/upcomingProjects", upload.single("images"), createUpcomming);
router.get("/get",getUpcomming);

export default router;