import express from "express";
import { registerUser, loginUser, getMe, logoutUser, updateuserprofile } from "../controllers/authController.js";
import { sendOtp, verifyOtp } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../config/multers3.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authMiddleware, getMe);
router.post("/logout", logoutUser);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/updateuserprofile",upload.fields([
    {name:'logo',maxCount:1},
    {name:'profile',maxCount:1},
]) ,updateuserprofile);

export default router;