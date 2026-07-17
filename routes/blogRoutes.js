import express from "express";
import upload from "../config/multers3.js"; // <-- adjust this path to wherever your multer-S3 file lives
import { createBlog, getBlogs, getBlogById } from "../controllers/blogController.js";

const router = express.Router();

// Accepts two files: "thumbnail" and "cover", each max 1 file
const blogImageUpload = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "cover", maxCount: 1 },
]);

router.post("/", blogImageUpload, createBlog);
router.get("/", getBlogs);
router.get("/:slug", getBlogById);

export default router;
