import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";

// People who can sign in to the HR app. Kept in the HR database, separate from portal users.
// Login needs all three: username (the organisation name, same for everyone) + employee code + password.
// The employee code says who is signing in: the admin, or an employee from the register.
const hrUserSchema = new mongoose.Schema({
    name:{ type:String, required:true, trim:true },
    // organisation name, e.g. "indiadeals"; shared by every login, so not unique
    username:{ type:String, required:true, trim:true, lowercase:true },
    // e.g. "989780" or "ID101"; stored uppercase so "id101" and "ID101" match
    employeeCode:{ type:String, required:true, unique:true, trim:true, uppercase:true },
    password:{ type:String, required:true },
    role:{ type:String, enum:["admin", "employee"], default:"employee" },
    // the employee record this login belongs to (employee logins only)
    employee:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee" }
},{timestamps:true});

hrUserSchema.set("toJSON", {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
    }
});

const HrUser = hrDB.model("HrUser", hrUserSchema);

// Username every employee login gets; the admin script sets the admin's own
export const hrOrgUsername = () => String(process.env.HR_ORG_USERNAME || "Indiadeals").toLowerCase().trim();

export default HrUser;
