import express from "express";
import { registerUser, loginUser, getMe, logoutUser } from "../controllers/authController.js";
import { sendOtp, verifyOtp } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getMe);
router.post("/logout", logoutUser);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

export default router;