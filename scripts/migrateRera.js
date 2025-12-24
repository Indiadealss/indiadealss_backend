import mongoose from "mongoose";
import dotenv from "dotenv";
import Mapping from "../models/Maping.js";

dotenv.config({ path: `${process.cwd()}/.env` });

console.log("MONGO_URI:", process.env.MONGO_URI);

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not found. Check .env location");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const migrateNpxid = async () => {
  const docs = await Mapping.find({
    $or: [
      { npxid: { $exists: false } },
      { npxid: null },
      { npxid: "N/A" },
      { npxid: "" }
    ]
  }).select("_id").lean();

  console.log(`Found ${docs.length} records`);

  for (const doc of docs) {
    await Mapping.updateOne(
      { _id: doc._id },
      { $set: { npxid: `NPX-${doc._id}` } }
    );

    console.log(`Updated ${doc._id}`);
  }

  console.log("🎉 Migration complete");
  process.exit(0);
};

migrateNpxid();