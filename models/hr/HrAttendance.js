import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// One document per employee per day.
// `in` / `out` come from the punch clock; `ov` is a manual correction by HR on the muster roll.
const hrAttendanceSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    // "YYYY-MM-DD"
    date:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    in:{ type:String },
    out:{ type:String },
    loc:{ type:String },
    ov:{ type:String, enum:["P","HD","A"] },
    sample:{ type:Boolean, default:false }
},{timestamps:true});

hrAttendanceSchema.index({ emp:1, date:1 }, { unique:true });
hrAttendanceSchema.index({ date:1 });
hrAttendanceSchema.set("toJSON", hrToJSON);

const HrAttendance = hrDB.model("HrAttendance", hrAttendanceSchema);

export default HrAttendance;
