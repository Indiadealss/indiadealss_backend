import Connected from "../models/Connected.js";


// Toggle shortlist (Add / Remove)
export const toggleConnected = async (req, res) => {
  try {
    const { userId, propertyId } = req.body;

    if (!userId || !propertyId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await Connected.findOne({ userId, propertyId });

    if (existing) {
      
      return res.status(200).json({
        success: true,
        message: "Alreaded Added",
      });
    }

    const shortlist = await Connected.create({
      userId,
      propertyId,
    });

    res.status(201).json({
      success: true,
      message: "User want to connect this property",
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
export const getUserConnected = async (req, res) => {
  try {
    const { userId } = req.params;

    const data = await Connected.find({ userId })
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