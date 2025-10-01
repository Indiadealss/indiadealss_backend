import mongoose from "mongoose";
import Property from '../models/Property.js';

export const createProperty = async (req, res) => {
  try {

   

    const { owner, location, ...propertyData } = req.body;

    if (!owner || !mongoose.Types.ObjectId.isValid(owner)) {
      return res.status(400).json({ success: false, message: "Valid owner ID is required" });
    }

    if (!location) {
      return res.status(400).json({ success: false, message: "Location is required" });
    }

    // Map images if uploaded
    if (req.files && req.files.images) {
      propertyData.images = req.files.images.map((file) => ({ src: file.location }));
    }

    // Map videos if uploaded
    if (req.files && req.files.video) {
      propertyData.video = req.files.video.map((file) => ({ src: file.location }));
    }

    const formattedLocation = Array.isArray(location) ? location[0] : location;

    const property = await Property.create({
      owner,
      location: formattedLocation,
      ...propertyData,
    });

    res.status(201).json({ success: true, property });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};


// export const getAllProperties = (req, res) => {
//   res.send("All properties");
// };

export const getAllProperties = async (req, res) => {
  try {
    const properties = await Property.find(); // fetch all
    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getProperty = async (req, res) => {
  try {
    const id ="68c14e6f35abf4f09e96e848"
    // const { id } = req.params; // this works only if route has "/:id"
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


