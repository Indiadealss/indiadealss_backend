import mongoose from "mongoose";
import hrDB from "../../config/hrDb.js";
import { hrToJSON } from "./toJSON.js";

// ---------- attendance requests ----------
// regularize = fix a day's punch-in / punch-out, outdoor = on duty outside the office,
// wfh = work from home. Approval writes them onto the attendance record.

export const REQUEST_TYPES = ["regularize", "outdoor", "wfh"];

const hrRequestSchema = new mongoose.Schema({
    emp:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee", required:true },
    type:{ type:String, enum:REQUEST_TYPES, required:true },
    from:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    to:{ type:String, required:true, match:/^\d{4}-\d{2}-\d{2}$/ },
    // regularize only, "HH:MM"
    in:{ type:String },
    out:{ type:String },
    reason:{ type:String, default:"" },
    status:{ type:String, enum:["pending", "approved", "rejected"], default:"pending" },
    applied:{ type:String }
},{timestamps:true});

hrRequestSchema.index({ emp:1, from:1 });
hrRequestSchema.set("toJSON", hrToJSON);
export const HrRequest = hrDB.model("HrRequest", hrRequestSchema);

// ---------- home page posts ----------
// badge = reward & recognition, wish = birthday / anniversary wish, congrats = welcome a new joiner,
// announcement = company notice from HR

export const POST_TYPES = ["badge", "wish", "congrats", "announcement"];
export const BADGES = ["great_job", "star_performer", "team_player", "customer_delight", "thank_you"];

const hrPostSchema = new mongoose.Schema({
    type:{ type:String, enum:POST_TYPES, required:true },
    // HrUser who posted, and the name shown
    by:{ type:mongoose.Schema.Types.ObjectId, ref:"HrUser", required:true },
    byName:{ type:String, required:true },
    // employee the post is for (not for announcements)
    to:{ type:mongoose.Schema.Types.ObjectId, ref:"HrEmployee" },
    badge:{ type:String, enum:BADGES },
    // wish: "birthday" | "anniversary"
    occasion:{ type:String },
    title:{ type:String, default:"" },
    message:{ type:String, default:"" },
    // HrUser ids
    likes:{ type:[String], default:[] },
    date:{ type:String }
},{timestamps:true});

hrPostSchema.index({ type:1, createdAt:-1 });
hrPostSchema.index({ to:1 });
hrPostSchema.set("toJSON", {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.to) ret.to = ret.to.toString();
        if (ret.by) ret.by = ret.by.toString();
        return ret;
    }
});
export const HrPost = hrDB.model("HrPost", hrPostSchema);
