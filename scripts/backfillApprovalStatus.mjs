// One-time migration: properties created before the approval-workflow feature
// have no approvalStatus field. They were already live, so grandfather them in
// as "approved" instead of hiding them pending manual re-approval.
import mongoose from "mongoose";
import dotenv from "dotenv";
import Property from "../models/Property.js";

dotenv.config({ path: `${process.cwd()}/.env` });
await mongoose.connect(process.env.MONGO_URI);

const result = await Property.updateMany(
  { approvalStatus: { $exists: false } },
  { $set: { approvalStatus: "approved" } }
);

console.log(`✅ Backfilled ${result.modifiedCount} properties to approvalStatus="approved"`);
process.exit(0);
