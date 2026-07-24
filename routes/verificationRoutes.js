import express from "express";
import upload from "../config/multers3.js";
import {
  submitVerification,
  addDocument,
  removeDocument,
  updateBankDetails,
} from "../controllers/verificationController.js";

const router = express.Router();

router.post("/submit", upload.fields([{ name: "document", maxCount: 1 }]), submitVerification);
router.post("/documents", upload.fields([{ name: "document", maxCount: 1 }]), addDocument);
router.delete("/documents/:docId", removeDocument);
router.put("/bank", upload.fields([{ name: "chequeFile", maxCount: 1 }]), updateBankDetails);

export default router;
