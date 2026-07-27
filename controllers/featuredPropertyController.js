import FeaturedProperty from "../models/FeaturedProperty.js";

// Add a property to the featured list (admin)
export const addFeaturedProperty = async (req, res) => {
  try {
    const { propertyId, order } = req.body;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "propertyId is required" });
    }

    const existing = await FeaturedProperty.findOne({ propertyId });
    if (existing) {
      return res.status(409).json({ success: false, message: "Property is already featured" });
    }

    const featured = await FeaturedProperty.create({ propertyId, order });

    res.status(201).json({
      success: true,
      message: "Property added to featured list",
      data: featured,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get active featured properties, populated with property data (public)
export const getFeaturedProperties = async (req, res) => {
  try {
    const featured = await FeaturedProperty.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .populate({
        path: "propertyId",
        match: { approvalStatus: "approved" },
        model: "Property",
        select: "projectname projecttitle location images npxid",
      });

    const data = featured
      .filter((item) => item.propertyId)
      .map((item) => item.propertyId);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove a property from the featured list (admin)
export const removeFeaturedProperty = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await FeaturedProperty.findOneAndDelete({
      $or: [{ _id: id }, { propertyId: id }],
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Featured property not found" });
    }

    res.status(200).json({ success: true, message: "Property removed from featured list" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
