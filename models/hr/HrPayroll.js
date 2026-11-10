import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";
import { structureSchema } from "./HrEmployee.js";

// ---------- payroll run: one per month ----------
// pending  = generated, can be recalculated
// approved = locked: no recalculation, attendance/leave/adjustments for the month are frozen
// paid     = every payslip in the run is paid

const hrPayrollSchema = new mongoose.Schema({
    // "YYYY-MM"
    month:{ type:String, required:true, unique:true, match:/^\d{4}-\d{2}$/ },
    status:{ type:String, enum:["pending", "approved", "paid"], default:"pending" },
    generatedAt:{ type:Date },
    approvedAt:{ type:Date },
    paidAt:{ type:Date },
    count:{ type:Number, default:0 },
    totals:{ type:Object, default:{} }
},{timestamps:true});

hrPayrollSchema.set("toJSON", hrToJSON);
export const HrPayroll = hrDB.model("HrPayroll", hrPayrollSchema);

// ---------- payslip: one per employee per month ----------

const lineSchema = new mongoose.Schema({
    key:{ type:String, required:true },
    label:{ type:String, required:true },
    amount:{ type:Number, default:0 },
    // loan id for EMI lines, adjustment id for one-time payments
    ref:{ type:String }
},{ _id:false });

const hrPayslipSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    month:{ type:String, required:true, match:/^\d{4}-\d{2}$/ },
    // employee details as they were when the payslip was made
    code:String, name:String, dept:String, designation:String, branch:String, joined:String,
    pan:String, uan:String, esiNo:String, email:String,
    bank:{ type:Object, default:{} },
    // calendar days in the month, and the attendance count behind the pay
    days:Number,
    att:{ type:Object, default:{} },
    payDays:Number,
    lopDays:Number,
    lateDays:Number,
    structure:{ type:structureSchema, default:() => ({}) },
    grossRate:Number,
    earnings:{ type:[lineSchema], default:[] },
    deductions:{ type:[lineSchema], default:[] },
    // employer contributions (not part of take-home)
    employer:{ type:Object, default:{} },
    pfWage:Number, epsWage:Number, edliWage:Number, esiWage:Number,
    // taxable earnings this month, and the part that is one-time (bonus, arrears ...)
    taxable:Number, taxableOneTime:Number,
    grossEarnings:Number,
    earnedGross:Number,
    totalDeductions:Number,
    net:Number,
    regime:String,
    // manual overtime hours from the payroll preview; null = from punches
    otOverride:{ type:Number, default:null },
    status:{ type:String, enum:["pending", "approved", "paid"], default:"pending" },
    payment:{
        mode:{ type:String, default:"" },
        ref:{ type:String, default:"" },
        date:{ type:String, default:"" }
    },
    emailedAt:{ type:Date }
},{timestamps:true});

hrPayslipSchema.index({ emp:1, month:1 }, { unique:true });
hrPayslipSchema.index({ month:1 });
hrPayslipSchema.set("toJSON", hrToJSON);
export const HrPayslip = hrDB.model("HrPayslip", hrPayslipSchema);

// ---------- salary revision / increment ----------

const hrRevisionSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    // first month the new structure applies, "YYYY-MM"
    effective:{ type:String, required:true, match:/^\d{4}-\d{2}$/ },
    structure:{ type:structureSchema, required:true },
    prevStructure:{ type:structureSchema, default:() => ({}) },
    reason:{ type:String, default:"" },
    arrears:{ type:Number, default:0 }
},{timestamps:true});

hrRevisionSchema.index({ emp:1, effective:1 });
hrRevisionSchema.set("toJSON", hrToJSON);
export const HrRevision = hrDB.model("HrRevision", hrRevisionSchema);

// ---------- one-time payments and deductions for a month ----------

export const ADJUSTMENT_TYPES = {
    performance_bonus:{ label:"Performance bonus", kind:"earning", taxable:true, esi:false },
    festival_bonus:{ label:"Festival bonus", kind:"earning", taxable:true, esi:false },
    incentive:{ label:"Incentive", kind:"earning", taxable:true, esi:true },
    arrears:{ label:"Arrears", kind:"earning", taxable:true, esi:true },
    overtime:{ label:"Overtime (extra)", kind:"earning", taxable:true, esi:true },
    leave_encashment:{ label:"Leave encashment", kind:"earning", taxable:true, esi:false },
    reimbursement:{ label:"Reimbursement", kind:"earning", taxable:false, esi:false },
    other_earning:{ label:"Other earning", kind:"earning", taxable:true, esi:false },
    other_deduction:{ label:"Other deduction", kind:"deduction", taxable:false, esi:false }
};

const hrAdjustmentSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    month:{ type:String, required:true, match:/^\d{4}-\d{2}$/ },
    type:{ type:String, enum:Object.keys(ADJUSTMENT_TYPES), required:true },
    amount:{ type:Number, required:true, min:0 },
    note:{ type:String, default:"" }
},{timestamps:true});

hrAdjustmentSchema.index({ month:1, emp:1 });
hrAdjustmentSchema.set("toJSON", hrToJSON);
export const HrAdjustment = hrDB.model("HrAdjustment", hrAdjustmentSchema);

// ---------- loans and salary advances ----------
// Repayments are the EMI lines on approved/paid payslips, so the balance always matches payroll.

const hrLoanSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    kind:{ type:String, enum:["loan", "advance"], default:"loan" },
    amount:{ type:Number, required:true, min:1 },
    months:{ type:Number, default:1, min:1 },
    emi:{ type:Number, default:0, min:0 },
    // first month the EMI is deducted, "YYYY-MM"
    startMonth:{ type:String, default:"" },
    reason:{ type:String, default:"" },
    status:{ type:String, enum:["requested", "approved", "rejected", "closed"], default:"requested" },
    // recovered outside payroll, e.g. in the full & final settlement
    recoveredOutside:{ type:Number, default:0 },
    requestedOn:{ type:String },
    approvedOn:{ type:String }
},{timestamps:true});

hrLoanSchema.index({ emp:1 });
hrLoanSchema.set("toJSON", hrToJSON);
export const HrLoan = hrDB.model("HrLoan", hrLoanSchema);

// ---------- tax declaration, one per employee per financial year ----------

const hrTaxDeclarationSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    // "2026-27"
    fy:{ type:String, required:true, match:/^\d{4}-\d{2}$/ },
    regime:{ type:String, enum:["new", "old"], default:"new" },
    // yearly amounts in rupees
    rentPaid:{ type:Number, default:0, min:0 },
    metro:{ type:Boolean, default:false },
    sec80C:{ type:Number, default:0, min:0 },
    sec80D:{ type:Number, default:0, min:0 },
    sec80CCD1B:{ type:Number, default:0, min:0 },
    homeLoanInterest:{ type:Number, default:0, min:0 },
    otherDeductions:{ type:Number, default:0, min:0 },
    otherIncome:{ type:Number, default:0, min:0 },
    // salary and TDS from a previous employer in the same year
    prevIncome:{ type:Number, default:0, min:0 },
    prevTds:{ type:Number, default:0, min:0 },
    status:{ type:String, enum:["submitted", "verified"], default:"submitted" }
},{timestamps:true});

hrTaxDeclarationSchema.index({ emp:1, fy:1 }, { unique:true });
hrTaxDeclarationSchema.set("toJSON", hrToJSON);
export const HrTaxDeclaration = hrDB.model("HrTaxDeclaration", hrTaxDeclarationSchema);

// ---------- statutory payments (PF, ESI, PT, TDS challans) ----------

const hrStatutorySchema = new mongoose.Schema({
    type:{ type:String, enum:["pf", "esi", "pt", "tds"], required:true },
    month:{ type:String, required:true, match:/^\d{4}-\d{2}$/ },
    amount:{ type:Number, default:0, min:0 },
    paidOn:{ type:String, default:"" },
    challan:{ type:String, default:"" },
    note:{ type:String, default:"" }
},{timestamps:true});

hrStatutorySchema.index({ type:1, month:1 }, { unique:true });
hrStatutorySchema.set("toJSON", hrToJSON);
export const HrStatutoryPayment = hrDB.model("HrStatutoryPayment", hrStatutorySchema);

// ---------- full & final settlement ----------

const hrSettlementSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    resignationDate:{ type:String, required:true },
    lastWorkingDay:{ type:String, required:true },
    noticeDays:{ type:Number, default:30 },
    servedDays:{ type:Number, default:0 },
    earnings:{ type:[lineSchema], default:[] },
    deductions:{ type:[lineSchema], default:[] },
    totalEarnings:{ type:Number, default:0 },
    totalDeductions:{ type:Number, default:0 },
    net:{ type:Number, default:0 },
    // facts behind the numbers, shown on the F&F statement
    info:{ type:Object, default:{} },
    note:{ type:String, default:"" },
    status:{ type:String, enum:["draft", "approved", "paid"], default:"draft" },
    payment:{
        mode:{ type:String, default:"" },
        ref:{ type:String, default:"" },
        date:{ type:String, default:"" }
    },
    approvedAt:{ type:Date }
},{timestamps:true});

hrSettlementSchema.index({ emp:1 });
hrSettlementSchema.set("toJSON", hrToJSON);
export const HrSettlement = hrDB.model("HrSettlement", hrSettlementSchema);
