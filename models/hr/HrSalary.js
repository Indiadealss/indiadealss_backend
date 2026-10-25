import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// One row of the monthly salary sheet, per employee per month.
// HRA, TA, overtime pay and net salary are worked out from these numbers (see hrController).
const hrSalarySchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    // "YYYY-MM"
    month:{ type:String, required:true, match:/^\d{4}-\d{2}$/ },
    // monthly basic salary in rupees
    basic:{ type:Number, min:0, default:0 },
    overtimeHrs:{ type:Number, min:0, default:0 },
    // week offs in the month
    weekOff:{ type:Number, min:0, default:0 },
    // in rupees
    revenueTarget:{ type:Number, min:0, default:0 },
    achievement:{ type:Number, min:0, default:0 }
},{timestamps:true});

hrSalarySchema.index({ emp:1, month:1 }, { unique:true });
hrSalarySchema.index({ month:1 });
hrSalarySchema.set("toJSON", hrToJSON);

const HrSalary = hrDB.model("HrSalary", hrSalarySchema);

export default HrSalary;
