import mongoose from "mongoose";
import Property from '../models/Property.js';
import { generateDescription, generateFAQ } from "../utils/generateDescription.js";
import Feature from "../models/Feature.js";
import Mapping from "../models/Maping.js";

export const createProperty = async (req, res) => {
  try {



    const { owner, faqanswer, location, imageTypes, purpose, projectname, Buldingfeature, rera, officeUnits, description, projecttitle, titleDescription, projectdeveloper, ...propertyData } = req.body;

    const generateShortId = (objectId) => {
      return objectId
        .toString()
        .slice(-5)
        .toLowerCase();
    };


    if (!owner || !mongoose.Types.ObjectId.isValid(owner)) {
      return res.status(400).json({ success: false, message: "Valid owner ID is required" });
    }

    if (!location) {
      return res.status(400).json({ success: false, message: "Location is required" });
    }

    if (!req.body.npxid) {
      delete req.body.npxid;
    }


    const imageTypesArray = Array.isArray(imageTypes)
      ? imageTypes
      : imageTypes
        ? [imageTypes]
        : [];

    const fileFields = [];
    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("fields_")) {
        const index = Number(key.split("_")[1]);
        try {
          fileFields.push({
            index,
            fields: JSON.parse(req.body[key]),
          })
        } catch {
          fileFields.push({ index, fields: [] })
        }

        delete propertyData[key];
      }
    });
    // Map images if uploaded
    if (req.files && req.files.images) {
      // console.log(req.files,req.files.imageTypes,req.imageTypes)
      propertyData.images = req.files.images.map((file, index) => {
        const matchedFields = fileFields.find((f) => f.index === index);
        return { src: file.location, type: imageTypesArray[index] || "general", fields: matchedFields ? matchedFields.fields : [] }
      });

    } else {
      // No image uploaded
      propertyData.images = [{ src: 'No image uploaded' }];
    }

    // Map videos if uploaded
    if (req.files && req.files.video) {
      propertyData.video = req.files.video.map((file) => ({ src: file.location }));
    } else {
      // No video uploaded
      propertyData.video = [{ src: 'No image uploaded' }]
    }

    const formattedLocation = Array.isArray(location) ? location[0] : location;


    console.log('Buldingfeature:', Buldingfeature);

    // ************* AI GENERATION LOGIC *************
    if (purpose === "Project") {
      let featureIds = [];

      if (Array.isArray(Buldingfeature)) {
        featureIds = Buldingfeature;
      } else if (typeof Buldingfeature === "string" && Buldingfeature.trim() !== "") {
        try {
          featureIds = JSON.parse(Buldingfeature);
        } catch (error) {
          featureIds = [Buldingfeature];
        }
      }

      console.log("📦 Final Feature IDs:", featureIds);

      // Fetch names from DB
      const featureDocs = await Feature.find({ _id: { $in: featureIds } });

      const featureNames = featureDocs.map(feat => feat.name);

      

      // Generate description using names (NOT JSON.parse)
      propertyData.projectDescription = description;


      if (Array.isArray(faqanswer) && faqanswer.length > 0) {
        propertyData.faq = faqanswer;
      } else {
        propertyData.faq = [];
      }
      propertyData.rera = rera;
      propertyData.officeUnits = officeUnits;
      propertyData.projecttitle = projecttitle;
      propertyData.titleDescription = titleDescription;
      propertyData.projectdeveloper = projectdeveloper;
    }
    else {
      propertyData.projectDescription = description;
    }

    propertyData.purpose = purpose;
    propertyData.Buldingfeature = Buldingfeature;
    propertyData.projectname = projectname

    const tempId = new mongoose.Types.ObjectId();
    const shortId = await generateShortId(tempId);

    const payload = {
      _id: tempId,
      owner,
      location: formattedLocation,
      ...propertyData,
    };


    if (purpose === "Project") {
      payload.npxid = shortId;   // example: NPX4A91F

      const parseLocation = JSON.parse(location).Address;
      const cleanedAddress = parseLocation.split(",").slice(1).join(",").trim();

      const findLocation = await Mapping.updateOne({ address: cleanedAddress }, { $set: { "npxid": payload.npxid } });

      console.log(findLocation);

    } else {
      payload.spid = shortId;     // example: SP4A91F
    }

    const property = await Property.create(payload);


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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;


    const {
      location = '',
      projectname = '',
      purpose = '',
      propertyType = '',
      ownership = '',
      furnishing = '',
      minPrice = '',
      maxPrice = '',
      bedroom = '',
      bathroom = '',
    } = req.query;

    // Build a dynamic filter object
    const filter = {};

    // Location (regex match inside JSON string)
    if (location && location !== 'All India') {
      const cityRegex = new RegExp(`"City":"${location}"`, 'i');
      filter.location = { $regex: cityRegex };
    }

    // console.log(purpose);

    // Purpose filter
    if (purpose) {
      filter.purpose = purpose;
    }

    if (projectname) {
      filter.projectname = projectname;
    }

    // Property type (e.g. flat, commercial, plot)
    if (propertyType) {
      const typesArray = propertyType.split(',').map(v => v.trim());
      filter.propertyType = { $in: typesArray.map(v => new RegExp(`^${v}$`, 'i')) };
      console.log(typesArray);

    }

    // Ownership
    if (ownership) {
      filter.ownership = ownership;
    }

    // Furnishing status
    if (furnishing) {
      filter.furnishing = furnishing;
    }

    // Bedrooms & Bathrooms
    if (bedroom) {
      filter.bedroom = bedroom;
    }
    if (bathroom) {
      filter.bathroom = bathroom;
    }

    // Price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Fetch properties using filter
    console.log(filter);

    const properties = await Property.find(filter)
      .populate('owner', 'name mobile email -_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Property.countDocuments(filter);

    console.log("TOTAL PROPERTIES FOUND:", properties, total);
    console.log("PROPERTIES FETCHED IN THIS PAGE:", properties.length);

    res.status(200).json({
      data: properties,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message })
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      })
    }
  }
};



export const getProperty = async (req, res) => {
  try {
    // const id ="68c14e6f35abf4f09e96e848"
    const { id } = req.params; // this works only if route has "/:id"
    const property = await Property.findById(id)
      .populate("owner", "name email mobile updatedAt -_id")
      .populate("Buldingfeature", "name icon")
      .populate("amenitie", "name icon label");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPropertyByRera = async (req, res) => {
  try {
    // const id ="68c14e6f35abf4f09e96e848"
    const { npxid } = req.params; // this works only if route has "/:id"

    console.log(npxid);

    const property = await Property.findOne({ npxid })
      .populate("owner", "name email mobile updatedAt -_id")
      .populate("Buldingfeature", "name icon")
      .populate("amenitie", "name icon label");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getPropertyByspid = async (req, res) => {
  try {
    const { spid } = req.params; // this works only if route has "spid"

    console.log(spid);

    const property = await Property.findOne({ spid })
      .populate("owner", "name email mobile updatedAt -_id")
      .populate("Buldingfeature", "name icon")
      .populate("amenitie", "name icon label");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


