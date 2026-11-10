import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";

// Company-wide attendance and pay rules. A single document with key "company".
const hrSettingsSchema = new mongoose.Schema({
    key:{ type:String, required:true, unique:true, default:"company" },
    company:{ type:String, default:"IndiaDeals" },
    sites:{ type:[String], default:["Head office"] },
    // 0 = Sunday ... 6 = Saturday
    weeklyOff:{ type:[Number], default:[0] },
    holidays:{ type:[{ _id:false, date:String, name:String }], default:[] },
    graceMins:{ type:Number, default:10, min:0 },
    lateLimit:{ type:Number, default:3, min:0 },
    halfDayHours:{ type:Number, default:4.5, min:0 },
    // professional tax per month in rupees (0 in UP, Delhi and Haryana)
    pt:{ type:Number, default:0, min:0 },
    // employer details printed on payslips, Form 16 and statutory reports
    address:{ type:String, default:"" },
    companyPan:{ type:String, default:"" },
    tan:{ type:String, default:"" },
    pfCode:{ type:String, default:"" },
    esiCode:{ type:String, default:"" },
    payroll:{
        // rates in percent
        pf:{
            on:{ type:Boolean, default:true },
            employee:{ type:Number, default:12, min:0 },
            employer:{ type:Number, default:12, min:0 },
            eps:{ type:Number, default:8.33, min:0 },
            // PF is worked out on basic + DA up to this wage
            wageCap:{ type:Number, default:15000, min:0 },
            capWages:{ type:Boolean, default:true }
        },
        esi:{
            on:{ type:Boolean, default:true },
            employee:{ type:Number, default:0.75, min:0 },
            employer:{ type:Number, default:3.25, min:0 },
            // ESI applies while monthly gross is at or below this
            ceiling:{ type:Number, default:21000, min:0 }
        },
        // working hours in a full day: punch-out before shift start + this is early leaving,
        // time worked beyond it is overtime
        shiftHours:{ type:Number, default:9, min:1 },
        otAuto:{ type:Boolean, default:true },
        // overtime pay per hour = basic / otDivisorDays / shiftHours x otMultiplier
        otMultiplier:{ type:Number, default:1, min:0 },
        otDivisorDays:{ type:Number, default:30, min:1 },
        // late marks and early leavings beyond lateLimit: every this many cost half a day (0 = no deduction)
        latePerHalfDay:{ type:Number, default:3, min:0 },
        noticeDays:{ type:Number, default:30, min:0 },
        // leave encashment per day = (basic + DA) / this
        encashDivisor:{ type:Number, default:26, min:1 },
        // used to split a gross salary into components
        split:{
            basicPct:{ type:Number, default:50, min:0 },
            hraPct:{ type:Number, default:40, min:0 },
            daPct:{ type:Number, default:0, min:0 },
            conveyance:{ type:Number, default:1600, min:0 },
            medical:{ type:Number, default:1250, min:0 }
        }
    },
    quota:{
        CL:{ type:Number, default:12, min:0 },
        SL:{ type:Number, default:12, min:0 },
        EL:{ type:Number, default:15, min:0 },
        CO:{ type:Number, default:0, min:0 },
        SPL:{ type:Number, default:0, min:0 }
    },
    sample:{ type:Boolean, default:false }
},{timestamps:true});

hrSettingsSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        delete ret.key;
        return ret;
    }
});

const HrSettings = hrDB.model("HrSettings", hrSettingsSchema);

export default HrSettings;
