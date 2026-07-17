import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    senderIp: {
      type: String,
      default: null,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    message: {
      type: String,
      required: true,
    },

    messageType: {
      type: String,
      enum: ["text", "image", "pdf", "video", "audio"],
      default: "text",
    },

    attachment: {
      type: String,
      default: "",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Either sender or senderIp is required
messageSchema.pre("validate", function (next) {
  if (!this.sender && !this.senderIp) {
    return next(new Error("Either sender or senderIp is required."));
  }

  next();
});

export default mongoose.model("Message", messageSchema);