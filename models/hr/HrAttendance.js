import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// Where the phone / laptop was when the employee punched (browser GPS). address is looked up afterwards, best effort.
const geoSchema = new mongoose.Schema({
    lat:{ type:Number, required:true },
    lng:{ type:Number, required:true },
    // metres, as reported by the device
    acc:{ type:Number },
    address:{ type:String, default:"" },
    at:{ type:String },
},{ _id:false });

// One document per employee per day.
// `in` / `out` come from the punch clock; `ov` is a manual correction by HR on the muster roll.
const hrAttendanceSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    // "YYYY-MM-DD"
    date:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    in:{ type:String },
    out:{ type:String },
    loc:{ type:String },
    inGeo:{ type:geoSchema },
    outGeo:{ type:geoSchema },
    // why the employee punched out before their shift ended
    earlyReason:{ type:String, trim:true, maxlength:500 },
    ov:{ type:String, enum:["P","HD","A"] },
    // set by an approved request: reg = regularized punches, od = outdoor duty, wfh = work from home
    src:{ type:String, enum:["reg","od","wfh"] },
    sample:{ type:Boolean, default:false }
},{timestamps:true});

hrAttendanceSchema.index({ emp:1, date:1 }, { unique:true });
hrAttendanceSchema.index({ date:1 });
hrAttendanceSchema.set("toJSON", hrToJSON);

const HrAttendance = hrDB.model("HrAttendance", hrAttendanceSchema);

export default HrAttendance;
