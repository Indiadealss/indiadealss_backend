import Campain from '../models/campain.js'

// Helper to build the file metadata object multer gives us into what we store
function buildFileMeta(file, publicFolder) {
  if (!file) return undefined;
  return {
    filename: file.filename,
    path: `/uploads/${publicFolder}/${file.filename}`,
    mimetype: file.mimetype,
    size: file.size,
  };
}

// POST /api/campaigns
// Expects multipart/form-data: all text fields from the Create Campaign form,
// plus optional files "brokerLogo" and "promotionalVideo" (handled by multer upstream).
exports.createCampaign = async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      projectType,
      campaignTitle,
      campaignStatus,
      brokerName,
      mobileNumber,
      email,
      city,
      description,
      startDate,
      endDate,
      leadRouting,
    } = req.body;

    if (!projectId || !projectName || !campaignTitle || !brokerName || !mobileNumber) {
      return res.status(400).json({
        message:
          "projectId, projectName, campaignTitle, brokerName and mobileNumber are required",
      });
    }

    const brokerLogoFile = req.files?.brokerLogo?.[0];
    const promoVideoFile = req.files?.promotionalVideo?.[0];

    const campaign = await Campaign.create({
      projectId,
      projectName,
      projectType,
      campaignTitle,
      campaignStatus,
      brokerName,
      mobileNumber,
      email,
      city,
      description,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      leadRouting,
      brokerLogo: buildFileMeta(brokerLogoFile, "logos"),
      promotionalVideo: buildFileMeta(promoVideoFile, "videos"),
    });

    return res.status(201).json({
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to create campaign",
    });
  }
};

// GET /api/campaigns
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    return res.status(200).json({ data: campaigns });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch campaigns" });
  }
};

// GET /api/campaigns/:id
exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    return res.status(200).json({ data: campaign });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch campaign" });
  }
};

// PUT /api/campaigns/:id
// Supports updating text fields and, optionally, replacing the logo/video files.
exports.updateCampaign = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (req.files?.brokerLogo?.[0]) {
      updates.brokerLogo = buildFileMeta(req.files.brokerLogo[0], "logos");
    }
    if (req.files?.promotionalVideo?.[0]) {
      updates.promotionalVideo = buildFileMeta(req.files.promotionalVideo[0], "videos");
    }
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    const campaign = await Campaign.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.status(200).json({ message: "Campaign updated successfully", data: campaign });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update campaign" });
  }
};

// DELETE /api/campaigns/:id
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    return res.status(200).json({ message: "Campaign deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete campaign" });
  }
};
