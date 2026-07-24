import express from "express";
import { getNotificationsMapping, markNotificationRead } from "../controllers/Notificationscontrollr.js";

const router = express.Router();

router.get("/getNotifications",getNotificationsMapping);
router.put("/:id/read", markNotificationRead);

export default router;