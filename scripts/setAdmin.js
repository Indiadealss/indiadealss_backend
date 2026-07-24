// Promote a user to admin (or demote back to user).
// Usage: node scripts/setAdmin.js <email-or-mobile> [role]
//   node scripts/setAdmin.js 1998keshavyadav@gmail.com admin
//   node scripts/setAdmin.js 1998keshavyadav@gmail.com user

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config({ path: `${process.cwd()}/.env` });

const identifier = process.argv[2];
const role = process.argv[3] || "admin";

if (!identifier) {
  console.error("Usage: node scripts/setAdmin.js <email-or-mobile> [admin|user]");
  process.exit(1);
}

if (!["admin", "user"].includes(role)) {
  console.error("role must be 'admin' or 'user'");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI not found. Check .env location");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOneAndUpdate(
  { $or: [{ email: identifier }, { mobile: identifier }] },
  { $set: { role } },
  { new: true }
);

if (!user) {
  console.error(`No user found with email/mobile "${identifier}"`);
  process.exit(1);
}

console.log(`✅ ${user.name || user.email || user.mobile} is now role="${user.role}"`);
process.exit(0);
