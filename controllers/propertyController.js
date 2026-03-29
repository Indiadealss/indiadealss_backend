import mongoose from "mongoose";
import Property from '../models/Property.js';
import { generateDescription, generateFAQ } from "../utils/generateDescription.js";
import Feature from "../models/Feature.js";
import Mapping from "../models/Maping.js";


export const createPropertyBasic = async (req, res) => {
  try {
    const { owner, location, purpose } = req.body;

    const tempId = new mongoose.Types.ObjectId();
    

    const payload = {
      _id: tempId,
      owner,
      location,
      purpose
    };

    

    const property = await Property.create(payload);

    res.status(201).json({
      success: true,
      propertyId: property._id
    });

  } catch (error) {
  console.error("Create Basic Error:", error);
  res.status(500).json({
    success: false,
    message: error.message
  });
}
};

export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    const data = { ...req.body };

    // ❌ prevent overwrite
    delete data.images;
    delete data.video;

    const updated = await Property.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    res.json({ success: true, property: updated });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const uploadImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const imageObj = {
      src: req.file.location,
      type: req.body.type || "general",
      fields: []
    };

    const property = await Property.findByIdAndUpdate(
      id,
      { $push: { images: imageObj } },
      { new: true }
    );

    const newImage = property.images[property.images.length - 1];

    res.json({
      success: true,
      image: newImage
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const uploadVideo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video uploaded" });
    }

    const PropertyVideo = await Property.findByIdAndUpdate(id, {
      $push: { video: { src: req.file.location } }
    });

     const newVideo = PropertyVideo.video[PropertyVideo.video.length - 1];
    
    console.log(newVideo);
    
    res.json({ success: true, video:newVideo });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const updateImageMeta = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const { type, fields } = req.body;

    console.log('h');
    
    await Property.updateOne(
      { _id: id, "images._id": imageId },
      {
        $set: {
          "images.$.type": type,
          "images.$.fields": fields || []
        }
      }
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const publishProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const {purpose} = req.body

    console.log(id,purpose , 'this is the purpose and id');
    

    const payload = {
      status:"active"
    }

    const shortId = id.toString().slice(-5).toLowerCase();
    if (purpose === "Project") {
      payload.npxid = shortId;
    } else {
      payload.spid = shortId;
    }

    await Property.findByIdAndUpdate(id, {
      $set: payload
    });

    res.json({ success: true });

  } catch (error) {
    console.log(error,error.message , 'this is the error');
    
    res.status(500).json({ success: false });
  }
};

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

      console.log(faqanswer, typeof (faqanswer), Array.isArray(faqanswer), 'fdjslkjlsfdjldsflannsdaiof')

      // Proper FAQ Handling
      if (faqanswer) {
        try {
          const parsedFaq =
            typeof faqanswer === "string"
              ? JSON.parse(faqanswer)
              : faqanswer;

          propertyData.faq = parsedFaq;
        } catch (err) {
          console.error("Invalid FAQ format:", err);
          propertyData.faq = {};
        }
      } else {
        propertyData.faq = {};
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


export const updatePropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    let data = { ...req.body };
    console.log(data,'data issdsflsafd  sdah asas');
    
    // 🔥 REMOVE ONLY RESTRICTED FIELDS
    const restrictedFields = [
      "owner",
      "_id",
      "createdAt",
      "__v"
    ];

    restrictedFields.forEach(field => {
      delete data[field];
    });

    // optional: images & video handle separately
    delete data.images;
    delete data.video;
    

    const updated = await Property.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    res.json({ success: true, property: updated });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};



export const deleteImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const image = property.images.id(imageId);

    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    // 🔥 (optional but recommended) delete from S3
    // const fileKey = image.src.split(".com/")[1];
    // await s3.deleteObject({ Bucket: process.env.BUCKET, Key: fileKey }).promise();

    // remove from DB
    image.deleteOne();

    await property.save();

    const updatedProperty = await Property.findById(id);

    res.json({ success: true, message: "Image deleted", data:updatedProperty });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const deleteVideo = async (req, res) => {
  try {
    const { id, videoId } = req.params;

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }
console.log(videoId);

    const video = property.video.id(videoId);

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    // 🔥 optional S3 delete
    // const fileKey = video.src.split(".com/")[1];
    // await s3.deleteObject({ Bucket: process.env.BUCKET, Key: fileKey }).promise();

    video.deleteOne();

    const updatedProperty = await Property.findById(id);

    await property.save();

    res.json({ success: true, message: "Video deleted", data:updatedProperty });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    const slug = req.query.slug || '';

    console.log(slug);
    


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
    // console.log(filter);

    const properties = await Property.find(filter)
      .populate('owner', 'name mobile email -_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Property.countDocuments(filter);

    // console.log("TOTAL PROPERTIES FOUND:", properties, total);
    // console.log("PROPERTIES FETCHED IN THIS PAGE:", properties.length);

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


export const getProjectNames = async (req, res) => {
  try {
    const projects = await Property.find({ npxid: { $exists: true, $ne: "" } })
      .select("projectname location npxid availabestatus"); // only project name

      console.log(projects);
      
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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
      .populate("amenitie", "name icon label")
      .populate("overlo","name label icon")
      .populate("otherrooms", "name label icon");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


