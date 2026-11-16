import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";

// One pending login OTP. The password was already checked; this is the second step.
// Kept in the database (not memory) so it survives restarts; MongoDB removes it after it expires.
const hrOtpSchema = new mongoose.Schema({
    user:{ type:mongoose.Schema.Types.ObjectId, ref:"HrUser", required:true },
    // sha256 of the code, never the code itself
    codeHash:{ type:String, required:true },
    // "hr" or "crm": where the login started
    app:{ type:String, default:"hr" },
    mobile:{ type:String, required:true },
    attempts:{ type:Number, default:0 },
    sentAt:{ type:Date, default:Date.now },
    expiresAt:{ type:Date, required:true }
});

hrOtpSchema.index({ expiresAt:1 }, { expireAfterSeconds:0 });

const HrOtp = hrDB.model("HrOtp", hrOtpSchema);

export default HrOtp;
