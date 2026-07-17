import express from "express";
import { getNotificationsMapping } from "../controllers/Notificationscontrollr.js";

const router = express.Router();

router.get("/getNotifications",getNotificationsMapping);

export default router;