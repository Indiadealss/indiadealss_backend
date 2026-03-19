import mongoose from "mongoose";

const shortlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

const shortlist =   mongoose.model("Shortlist", shortlistSchema);
export default shortlist;