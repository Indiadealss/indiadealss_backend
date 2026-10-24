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
    // professional tax per month in rupees
    pt:{ type:Number, default:0, min:0 },
    quota:{
        CL:{ type:Number, default:12, min:0 },
        SL:{ type:Number, default:12, min:0 },
        EL:{ type:Number, default:15, min:0 }
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
