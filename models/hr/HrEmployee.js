import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// Monthly salary components in rupees. Gross = the sum of all of them.
export const STRUCTURE_KEYS = ["basic", "hra", "da", "conveyance", "medical", "special"];
const structureSchema = new mongoose.Schema(
    Object.fromEntries(STRUCTURE_KEYS.map((k) => [k, { type:Number, min:0, default:0 }])),
    { _id:false }
);
export { structureSchema };

// same roles as the CRM's team page
export const CRM_ROLES = ["Admin", "Sales Manager", "Sales Agent", "Telecaller"];

const hrEmployeeSchema = new mongoose.Schema({
    code:{ type:String, required:true, unique:true, trim:true },
    name:{ type:String, required:true, trim:true },
    fatherName:{ type:String, trim:true, default:"" },
    dept:{ type:String, required:true, trim:true },
    designation:{ type:String, trim:true, default:"" },
    email:{ type:String, trim:true, lowercase:true, default:"" },
    phone:{ type:String, trim:true, default:"" },
    // date of birth "YYYY-MM-DD", for the birthday wishes on the home page
    dob:{ type:String, default:"" },
    // current salary structure; earlier and future ones are in HrRevision
    structure:{ type:structureSchema, default:() => ({}) },
    // monthly gross salary in rupees (sum of the structure)
    gross:{ type:Number, min:0, default:0 },
    // monthly basic salary in rupees, the starting value for each month's salary sheet
    basic:{ type:Number, min:0, default:0 },
    // monthly revenue target in rupees, set when the employee joins; each month's salary sheet starts from it
    target:{ type:Number, min:0, default:0 },
    // fixed monthly TDS in rupees; 0 = work it out from the tax declaration
    tds:{ type:Number, min:0, default:0 },
    taxRegime:{ type:String, enum:["new", "old"], default:"new" },
    // statutory deductions that apply to this employee
    pfOn:{ type:Boolean, default:true },
    esiOn:{ type:Boolean, default:true },
    ptOn:{ type:Boolean, default:true },
    pan:{ type:String, trim:true, uppercase:true, default:"" },
    uan:{ type:String, trim:true, default:"" },
    esiNo:{ type:String, trim:true, default:"" },
    bank:{
        holder:{ type:String, trim:true, default:"" },
        accountNo:{ type:String, trim:true, default:"" },
        ifsc:{ type:String, trim:true, uppercase:true, default:"" },
        bankName:{ type:String, trim:true, default:"" },
        mode:{ type:String, enum:["NEFT", "RTGS", "IMPS", "Cheque", "Cash"], default:"NEFT" }
    },
    // shift start, "HH:MM"
    shift:{ type:String, default:"09:30", match:/^\d{2}:\d{2}$/ },
    // shift end, "HH:MM"; "" = start + the full-day hours in Settings
    shiftEnd:{ type:String, default:"", match:/^(\d{2}:\d{2})?$/ },
    // the Settings shift this employee is on ("" = custom timings); its timings are copied into shift / shiftEnd
    shiftName:{ type:String, trim:true, default:"" },
    // date of joining, "YYYY-MM-DD"
    joined:{ type:String, default:"" },
    // set by the full & final settlement, "YYYY-MM-DD"
    lastWorkingDay:{ type:String, default:"" },
    // usual work location (one of the company sites), also the branch on payroll reports
    base:{ type:String, default:"" },
    active:{ type:Boolean, default:true },
    // the employee's HR login also signs them in to the CRM, with this role
    crmAccess:{ type:Boolean, default:false },
    crmRole:{ type:String, enum:CRM_ROLES, default:"Sales Agent" },
    // example records created by "Load sample company"
    sample:{ type:Boolean, default:false }
},{timestamps:true});

hrEmployeeSchema.set("toJSON", hrToJSON);

const HrEmployee = hrDB.model("HrEmployee", hrEmployeeSchema);

export default HrEmployee;
