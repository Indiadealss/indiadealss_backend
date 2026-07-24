import mongoose from "mongoose";

const businessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    logoUrl: {
      type: String,
      default: "",
    },

    businessName: {
      type: String,
      trim: true,
      default: "",
    },

    businessType: {
      type: String,
      trim: true,
      default: "",
    },

    registrationNumber: {
      type: String,
      trim: true,
      default: "",
    },

    yearOfEstablishment: {
      type: String,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      default: "",
    },

    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    businessPhone: {
      type: String,
      trim: true,
      default: "",
    },

    alternatePhone: {
      type: String,
      trim: true,
      default: "",
    },

    addressLine1: {
      type: String,
      trim: true,
      default: "",
    },

    addressLine2: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    pinCode: {
      type: String,
      trim: true,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const BusinessProfile = mongoose.model(
  "BusinessProfile",
  businessProfileSchema
);

export default BusinessProfile;