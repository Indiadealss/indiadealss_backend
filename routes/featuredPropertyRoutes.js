import express from "express";
import {
  addFeaturedProperty,
  getFeaturedProperties,
  removeFeaturedProperty,
} from "../controllers/featuredPropertyController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/", getFeaturedProperties);
router.post("/", authMiddleware, adminMiddleware, addFeaturedProperty);
router.delete("/:id", authMiddleware, adminMiddleware, removeFeaturedProperty);

export default router;
