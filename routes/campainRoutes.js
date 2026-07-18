
import express from "express"
import campaignUpload from "../config/multers3.js";
import {createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign} from "../controllers/campaignController.js"

const router = express.Router();

// POST /api/campaigns  -> create a campaign (multipart/form-data: fields + brokerLogo + promotionalVideo)
router.post("/", campaignUpload.fields([
    { name: "brokerLogo", maxCount: 1 },
    { name: "promotionalVideo", maxCount: 1 },
  ]), createCampaign);

// GET /api/campaigns -> list all campaigns
router.get("/", getCampaigns);

// GET /api/campaigns/:id -> get single campaign
router.get("/:id", getCampaignById);

// PUT /api/campaigns/:id -> update a campaign (files optional)
router.put("/:id", campaignUpload.fields([
    { name: "brokerLogo", maxCount: 1 },
    { name: "promotionalVideo", maxCount: 1 },
  ]), updateCampaign);

// DELETE /api/campaigns/:id -> delete a campaign
router.delete("/:id", deleteCampaign);

export default router;
