import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    guestIp: {
      type: String,
      default: null,
    },

    guestName: {
      type: String,
      default: null,
    },

    guestPhone: {
      type: String,
      default: null,
    },

    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    status: {
      type: String,
      enum: ["active", "closed", "blocked"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Conversation", conversationSchema);