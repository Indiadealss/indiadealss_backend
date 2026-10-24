import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

export const LEAVE_TYPES = ["CL","SL","EL","LWP"];

const hrLeaveSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    type:{ type:String, enum:LEAVE_TYPES, required:true },
    from:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    to:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    // working days in the range (weekly offs and holidays excluded)
    days:{ type:Number, required:true, min:0 },
    reason:{ type:String, default:"" },
    status:{ type:String, enum:["pending","approved","rejected"], default:"pending" },
    applied:{ type:String },
    sample:{ type:Boolean, default:false }
},{timestamps:true});

hrLeaveSchema.index({ emp:1, from:1 });
hrLeaveSchema.set("toJSON", hrToJSON);

const HrLeave = hrDB.model("HrLeave", hrLeaveSchema);

export default HrLeave;
