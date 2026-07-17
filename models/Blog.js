import mongoose from "mongoose";

const linkSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
    },
    href: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
  },
  { _id: false } // prevents an _id for each link
);

const blogSchema = new mongoose.Schema(
  {
    blogName: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    category: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    links: {
      type: [linkSchema],
      default: [],
    },

    thumbnail: {
      type: String,
      default: null,
    },

    cover: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Blog", blogSchema);