import crypto from "crypto";
import path from "path";
import multer from "multer";
import mongoose from "mongoose";
import HrDocument, { DOC_TYPES } from "../models/hr/HrDocument.js";
import HrEmployee from "../models/hr/HrEmployee.js";
import { docStorage, putDoc, getDoc, deleteDoc } from "../utils/hrDocStore.js";

// Employee documents. The HR admin sees, uploads and deletes everyone's; an employee sees and uploads
// only their own and can't delete (so HR keeps the record).

const MAX_MB = 10;
const ALLOWED = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const isEmployee = (req) => req.hrUser?.role === "employee";
const isAdmin = (req) => req.hrUser?.role === "admin";
const ownId = (req) => String(req.hrEmployee?._id || "");
const serverError = (res, err) => {
    console.error(err);
    res.status(500).json({ message: "Server error" });
};

// multer in memory, then we decide where it goes; errors become a clear 400
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname))),
}).single("file");

export const receiveDocument = (req, res, next) => upload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE" ? `The file must be ${MAX_MB} MB or smaller`
        : err instanceof multer.MulterError ? "Upload a PDF, JPG, PNG, WEBP or Word file" : "Upload failed";
    if (!(err instanceof multer.MulterError)) console.error(err);
    res.status(400).json({ message });
});

// may this login act on employee :id ?
const canAccess = (req, empId) => isAdmin(req) || (isEmployee(req) && ownId(req) === String(empId));

export const listDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id) || !canAccess(req, id)) return res.status(404).json({ message: "Employee not found" });
        const documents = await HrDocument.find({ emp: id }).sort({ createdAt: -1 });
        res.json({ documents, types: DOC_TYPES, maxMb: MAX_MB });
    } catch (err) { serverError(res, err); }
};

export const uploadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id) || !canAccess(req, id)) return res.status(404).json({ message: "Employee not found" });
        const employee = await HrEmployee.findById(id).select("name");
        if (!employee) return res.status(404).json({ message: "Employee not found" });
        if (!req.file) return res.status(400).json({ message: "Choose a file to upload" });
        const type = String(req.body?.type || "");
        if (!DOC_TYPES.includes(type)) return res.status(400).json({ message: "Pick the document type" });

        const storage = docStorage();
        const key = `hr-documents/${id}/${crypto.randomUUID()}${ALLOWED[req.file.mimetype]}`;
        await putDoc(storage, key, req.file.buffer, req.file.mimetype);
        const name = path.basename(String(req.file.originalname || "document")).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document";
        try {
            const document = await HrDocument.create({
                emp: id, type, name, mime: req.file.mimetype, size: req.file.size,
                note: String(req.body?.note || "").trim().slice(0, 300), storage, key,
                uploadedBy: isAdmin(req) ? "admin" : "employee",
                uploaderName: isAdmin(req) ? "HR" : req.hrEmployee?.name || "",
            });
            res.status(201).json({ document });
        } catch (err) {
            await deleteDoc(storage, key);
            throw err;
        }
    } catch (err) { serverError(res, err); }
};

// GET /documents/:docId/file  (?download=1 to save instead of opening)
export const downloadDocument = async (req, res) => {
    try {
        const { docId } = req.params;
        if (!mongoose.isValidObjectId(docId)) return res.status(404).json({ message: "Document not found" });
        const doc = await HrDocument.findById(docId);
        if (!doc || !canAccess(req, doc.emp)) return res.status(404).json({ message: "Document not found" });
        const stream = await getDoc(doc.storage, doc.key);
        const disposition = req.query.download ? "attachment" : "inline";
        res.setHeader("Content-Type", doc.mime);
        res.setHeader("Content-Disposition", `${disposition}; filename="${doc.name.replace(/"/g, "")}"`);
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        stream.on("error", (err) => {
            console.error("HR document read failed:", err.message);
            if (!res.headersSent) res.status(404).json({ message: "File is missing" });
            else res.end();
        });
        stream.pipe(res);
    } catch (err) {
        if (err?.name === "NoSuchKey") return res.status(404).json({ message: "File is missing" });
        serverError(res, err);
    }
};

export const removeDocument = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: "Only HR can delete documents" });
        const { docId } = req.params;
        const doc = mongoose.isValidObjectId(docId) && await HrDocument.findByIdAndDelete(docId);
        if (!doc) return res.status(404).json({ message: "Document not found" });
        await deleteDoc(doc.storage, doc.key);
        res.json({ deleted: true });
    } catch (err) { serverError(res, err); }
};

// when an employee record is deleted
export const deleteEmployeeDocuments = async (empId) => {
    const docs = await HrDocument.find({ emp: empId });
    await HrDocument.deleteMany({ emp: empId });
    for (const d of docs) await deleteDoc(d.storage, d.key);
};
