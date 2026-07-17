import express from "express";
import {
  sendMessage,
  getConversations,
  getMessages,
  replyMessage,
  markAsRead,
} from "../controllers/converationController.js";


const router = express.Router();

router.post("/send", sendMessage);

router.get("/conversations/:user_id", getConversations);

router.get("/:conversationId", getMessages);

router.post("/reply", replyMessage);

router.put("/read/:conversationId", markAsRead);

export default router;