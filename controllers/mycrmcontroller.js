import mongoose from "mongoose";
import Property from "../models/Property.js";
import Lead from "../models/Lead.js";

export const getycrmhomepage = async (req,res) => {
    try {
        const id = req.query.id || '';

        const now = new Date();

        // First day of current month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // First day of Next month
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() +1, 1)
        
        // const leads = await Lead.countDocuments({owner:id})
        const propertyDetails = await Property.find({owner:id})
        const totalListings = await Property.countDocuments({
  owner: id,
});
        const activeListings = await Property.countDocuments({
  owner: id,
   $or: [
    { npxid: { $exists: true, $nin: [null, ""] } },
    { spid: { $exists: true, $nin: [null, ""] } }
  ]
});
        let data = [];
        const leadsdetails = await Lead.find({
          projectOwner:id,
          createdAt: {
            $gte: startOfMonth,
            $lt: startOfNextMonth,
          }
        })

        const totalLeads = await Lead.find({
          projectOwner:id,
        })
        .populate('property_id', 'projectname bathroom apartment_name availabestatus balconies property propertyType');

        console.log(totalLeads, 'total leads are present');

        const stats = {
          totalListings: totalListings,
          activeListings: activeListings,
          activeListingsPct: '100%',
          totalLeads: leadsdetails.length,
          savedProperties: 0,
          unreadMessages:0,

        }

        data.push(propertyDetails,leadsdetails,totalLeads, stats)
        res.status(200).json({
      data: data,
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
}


export const getAlllistingWithleads = async (req, res) => {
  try {
    const id = req.query.id || "";

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    let status = req.query.status || "all";

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    // ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid owner id"
      });
    }

     let query = {
      owner: id,
      purpose: { $in: ["sell", "Buy", "Rent"] }
    };


    if (status && status !== "all") {
      query.status = status;
    }

    

    const propertyCount = await Property.countDocuments(query);

    const propertyDetails = await Property.find(query)
      .skip(skip)
      .limit(limit);

    const leads = await Lead.find({ projectOwner: id });

    console.log(leads, 'leads are present');

    res.status(200).json({
      total: propertyCount,
      properties: propertyDetails, // ✅ fixed
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};

export const getPlainlistingWithleads = async (req, res) => {
  try {
    const id = req.query.id || "";

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    let status = req.query.status || "all";

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    

    // ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid owner id"
      });
    }

        let query = {
      owner: id,
      purpose: { $in: ["sell", "Buy", "Rent"] },
      listing:'plain'
    };

    
    if (status && status !== "all") {
      query.status = status;
    }

    const propertyCount = await Property.countDocuments(query);

    const propertyDetails = await Property.find(query)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total: propertyCount,
      properties: propertyDetails, // ✅ fixed
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};

export const getPlatinumlistingWithleads = async (req, res) => {
  try {
    const id = req.query.id || "";

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    let status = req.query.status || "all";

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    // ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid owner id"
      });
    }


        let query = {
      owner: id,
      purpose: { $in: ["sell", "Buy", "Rent"] },
      listing:'Platinum'
    };

    
    if (status && status !== "all") {
      query.status = status;
    }
    const propertyCount = await Property.countDocuments(query);

    const propertyDetails = await Property.find(query)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total: propertyCount,
      properties: propertyDetails, // ✅ fixed
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};


export const getPremimumlistingWithleads = async (req, res) => {
  try {
    const id = req.query.id || "";

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    let status = req.query.status || "all";

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    // ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid owner id"
      });
    }


        let query = {
      owner: id,
      purpose: { $in: ["sell", "Buy", "Rent"] },
      listing:'Premimum'
    };

    
    if (status && status !== "all") {
      query.status = status;
    }

    const propertyCount = await Property.countDocuments(query);

    const propertyDetails = await Property.find(query)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total: propertyCount,
      properties: propertyDetails, // ✅ fixed
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};

export const getInfinitylistingWithleads = async (req, res) => {
  try {
    const id = req.query.id || "";

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    let status = req.query.status || "all";

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    // ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid owner id"
      });
    }


        let query = {
      owner: id,
      purpose: { $in: ["sell", "Buy", "Rent"] },
      listing:'Infinity' 
    };

    
    if (status && status !== "all") {
      query.status = status;
    }

    const propertyCount = await Property.countDocuments(query);

    const propertyDetails = await Property.find(query)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total: propertyCount,
      properties: propertyDetails, // ✅ fixed
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};

export const getAllProjectlistingWithleads = async (req, res) => {
  try {
    const id = req.query.id || "";

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    let status = req.query.status || "all";

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    // ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid owner id"
      });
    }


        let query = {
      owner: id,
      purpose: { $in: ["sell", "Buy", "Rent"] }
    };

    
    if (status && status !== "all") {
      query.status = status;
    }

    const propertyCount = await Property.countDocuments({ owner: id,purpose:'Project' });

    const propertyDetails = await Property.find({ owner: id,purpose:'Project' })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total: propertyCount,
      properties: propertyDetails, // ✅ fixed
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};


export const getListinglead = async (req, res) => {
  try {

    const id = req.query.id;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 2;

    if (page < 1) page = 1;
    if (limit < 1) limit = 2;

    const skip = (page - 1) * limit;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid property id"
      });
    }

    const leadsCount = await Lead.countDocuments({ property_id: id });

    const leadsdetails = await Lead.find({ property_id: id })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total: leadsCount,
      leads: leadsdetails,
      page,
      limit
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};