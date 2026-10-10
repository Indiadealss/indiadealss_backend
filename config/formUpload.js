import crypto from "crypto";
import path from "path";
import multer from "multer";
import multerS3 from "multer-s3";
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";

dotenv.config();

const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Uploads for plot application documents (Aadhaar, PAN, photo).
// Files get a random name so the URLs cannot be guessed.
const formUpload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
      cb(null, `plot-applications/${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: function (req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
});

export default formUpload;
