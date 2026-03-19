
import shortlist from "../models/shortlist.js";


// Toggle shortlist (Add / Remove)
export const toggleShortlist = async (req, res) => {
  try {
    const { userId, propertyId } = req.body;

    if (!userId || !propertyId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await shortlist.findOne({ userId, propertyId });

    if (existing) {
      await shortlist.findByIdAndDelete(existing._id);
      return res.status(200).json({
        success: true,
        message: "Removed from shortlist",
      });
    }

    const shortlist = await shortlist.create({
      userId,
      propertyId,
    });

    res.status(201).json({
      success: true,
      message: "Added to shortlist",
      data: shortlist,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all shortlisted properties of a user
export const getUserShortlist = async (req, res) => {
  try {
    const { userId } = req.params;

    const data = await shortlist.find({ userId })
    .populate({
         path: "propertyId",
        model: "Property", // 👈 optional (only needed fields)
      });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};