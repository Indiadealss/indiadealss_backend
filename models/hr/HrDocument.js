import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// A file kept on an employee's record (Aadhaar, PAN, offer letter ...). The file itself is in S3 or a
// private folder (utils/hrDocStore.js); `key` is never sent to the browser.
export const DOC_TYPES = [
    "Aadhaar card", "PAN card", "Photo", "Resume", "Offer letter", "Appointment letter",
    "Educational certificate", "Experience / relieving letter", "Bank proof / cancelled cheque",
    "Address proof", "Other",
];

const hrDocumentSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true, index:true },
    type:{ type:String, enum:DOC_TYPES, required:true },
    // original file name, shown in the list
    name:{ type:String, required:true },
    mime:{ type:String, required:true },
    size:{ type:Number, required:true },
    note:{ type:String, default:"" },
    storage:{ type:String, enum:["s3", "local"], required:true },
    key:{ type:String, required:true },
    // "admin" or "employee"
    uploadedBy:{ type:String, required:true },
    uploaderName:{ type:String, default:"" },
},{ timestamps:true });

hrDocumentSchema.set("toJSON", {
    transform:(doc, ret) => {
        hrToJSON.transform(doc, ret);
        delete ret.key;
        delete ret.storage;
        return ret;
    },
});

const HrDocument = hrDB.model("HrDocument", hrDocumentSchema);

export default HrDocument;
