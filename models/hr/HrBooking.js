import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// Bill status of the commission invoice raised on the builder
export const BILL_STATUSES = ["pending", "raised", "partial", "received", "cancelled"];

// A property booking and the commission / incentive on it. Entered by HR admin on the Incentives page.
// The candidate's incentive can be paid with a month's salary: it is then an "incentive" line on
// Bonus & payments (HrAdjustment), linked here so the two stay in step.
const hrBookingSchema = new mongoose.Schema({
    // date of booking, "YYYY-MM-DD"
    date:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    // source candidate: the employee who brought the booking
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    channelPartner:{ type:String, trim:true, default:"" },
    clientName:{ type:String, trim:true, required:true },
    mobile:{ type:String, trim:true, default:"" },
    email:{ type:String, trim:true, lowercase:true, default:"" },
    builder:{ type:String, trim:true, default:"" },
    project:{ type:String, trim:true, default:"" },
    unitNo:{ type:String, trim:true, default:"" },
    // free text, e.g. "1250 sq ft" or "3 BHK"
    unitSize:{ type:String, trim:true, default:"" },
    // amounts in rupees
    loginPrice:{ type:Number, default:0, min:0 },
    totalCommission:{ type:Number, default:0, min:0 },
    billStatus:{ type:String, enum:BILL_STATUSES, default:"pending" },
    receivedCommission:{ type:Number, default:0, min:0 },
    cpCommission:{ type:Number, default:0, min:0 },
    incentive:{ type:Number, default:0, min:0 },
    // salary month the incentive is paid in, "YYYY-MM"; "" = not sent to payroll
    payMonth:{ type:String, default:"", match:/^(\d{4}-\d{2})?$/ },
    adjustment:{ type:mongoose.Schema.Types.ObjectId, ref:"HrAdjustment" },
    remarks:{ type:String, trim:true, default:"" }
},{timestamps:true});

hrBookingSchema.index({ date:-1 });
hrBookingSchema.index({ emp:1, date:-1 });
hrBookingSchema.set("toJSON", hrToJSON);

const HrBooking = hrDB.model("HrBooking", hrBookingSchema);

export default HrBooking;
