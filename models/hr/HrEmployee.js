import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

const hrEmployeeSchema = new mongoose.Schema({
    code:{ type:String, required:true, unique:true, trim:true },
    name:{ type:String, required:true, trim:true },
    dept:{ type:String, required:true, trim:true },
    designation:{ type:String, trim:true, default:"" },
    // monthly gross salary in rupees, drives payroll
    gross:{ type:Number, min:0, default:0 },
    // fixed monthly TDS in rupees
    tds:{ type:Number, min:0, default:0 },
    // shift start, "HH:MM"
    shift:{ type:String, default:"09:30", match:/^\d{2}:\d{2}$/ },
    // date of joining, "YYYY-MM-DD"
    joined:{ type:String, default:"" },
    // usual work location (one of the company sites)
    base:{ type:String, default:"" },
    active:{ type:Boolean, default:true },
    // example records created by "Load sample company"
    sample:{ type:Boolean, default:false }
},{timestamps:true});

hrEmployeeSchema.set("toJSON", hrToJSON);

const HrEmployee = hrDB.model("HrEmployee", hrEmployeeSchema);

export default HrEmployee;
