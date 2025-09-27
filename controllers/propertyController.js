import Property from '../models/Property.js';

// export const createProperty = (req, res) => {
    
//   res.send("Property created");
// };

// Create property
export const createProperty = async (req, res) => {
  try {
    // const { title, description, price, address, images } = req.body;
    const {images,title,description,purpose,propertyType,status,area,bathroom,bedrooms,otherrooms,furnishing,balconies,floor, location,price,deposit,size,amenties,heighlights,coveredparking,uncoverdedparking} = req.body;

    // 'await' can only be used inside async functions
   // const property = await Property.create({ title, description, price, address, images });
    const property = await Property.create({ images,title,description,purpose,propertyType,status,area,bathroom,bedrooms,otherrooms,furnishing,balconies,floor, location,price,deposit,size,amenties,heighlights,coveredparking,uncoverdedparking });

    res.status(201).json({
      success: true,
      property
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
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


