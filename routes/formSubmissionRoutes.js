import express from "express";
import cors from "cors";
import multer from "multer";
import { submitForm, getFormSubmissions } from "../controllers/formSubmissionController.js";
import { createPlotApplication, markPlotApplicationPaid, getPlotApplications } from "../controllers/plotApplicationController.js";
import formUpload from "../config/formUpload.js";

const router = express.Router();
const upload = multer();

// External websites call this route, so it gets its own CORS config.
// FORM_ALLOWED_ORIGINS = comma separated list, e.g. "https://site1.com,https://site2.com"
// If not set, every origin is allowed.
const formOrigins = process.env.FORM_ALLOWED_ORIGINS
    ? process.env.FORM_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*';

router.use(cors({ origin: formOrigins }));

// Optional API key check: if FORM_API_KEY is set, caller must send header "x-api-key"
const checkApiKey = (req,res,next) => {
    if(process.env.FORM_API_KEY && req.get('x-api-key') !== process.env.FORM_API_KEY){
        return res.status(401).json({success:false,message:"Invalid API key"});
    }
    next();
};

// Strict API key check: plot applications hold Aadhaar details and documents,
// so these routes stay closed unless FORM_API_KEY is set and sent.
const requireApiKey = (req,res,next) => {
    if(!process.env.FORM_API_KEY || req.get('x-api-key') !== process.env.FORM_API_KEY){
        return res.status(401).json({success:false,message:"Invalid API key"});
    }
    next();
};

const plotDocuments = (req,res,next) => {
    formUpload.fields([
        { name:"aadhaarCard", maxCount:1 },
        { name:"panCard", maxCount:1 },
        { name:"photo", maxCount:1 }
    ])(req,res,(err) => {
        if(!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? "Each document must be 5 MB or smaller"
            : err instanceof multer.MulterError ? "Documents must be JPG, PNG, WEBP or PDF files"
            : "Document upload failed";
        if(!(err instanceof multer.MulterError)) console.error(err);
        res.status(400).json({success:false,message});
    });
};

// upload.none() lets the form be sent as JSON, urlencoded, or multipart/form-data
router.post("/submit", checkApiKey, upload.none(), submitForm);
router.get("/list", checkApiKey, getFormSubmissions);

// Plot booking micro-site: application with documents → MongoDB + S3 + Google Sheet
router.post("/plot-application", requireApiKey, plotDocuments, createPlotApplication);
router.patch("/plot-application/:applicationId/payment", requireApiKey, markPlotApplicationPaid);
router.get("/plot-application/list", requireApiKey, getPlotApplications);

export default router;
