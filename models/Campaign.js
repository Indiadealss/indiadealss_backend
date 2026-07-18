import mongoose from 'mongoose'

const CampaignSchema = new mongoose.Schema(
  {
    // Address Verification
    projectId: {
         type: String, 
         required: true, 
         trim: true 
        },
    projectName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    projectType: { 
        type: String, 
        trim: true 
    },
    campaignTitle: { 
        type: String, 
        required: true, 
        trim: true 
    },
    campaignStatus: {
      type: String,
      trim: true,
      default: "Active",
    },

    // Broker / Dealer Details
    brokerName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    mobileNumber: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        trim: true, 
        lowercase: true 
    },
    city: { 
        type: String, 
        trim: true 
    },

    // Media Upload (populated from multer file info)
    brokerLogo: {
      type: String,
    },
    promotionalVideo: {
      type: String,
    },

    // Campaign Details
    description: { 
        type: String,
        trim: true 
    },
    startDate: { 
        type: Date 
    },
    endDate: { 
        type: Date 
    },
    leadRouting: { 
        type: String, 
        trim: true 
    },
  },
  { timestamps: true }
);

const campain = mongoose.model("Campaign", CampaignSchema);

export default campain;
