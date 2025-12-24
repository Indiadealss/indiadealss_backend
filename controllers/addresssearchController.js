import axios from "axios";
import dotenv from 'dotenv';
import  Mapping from '../models/Maping.js'

dotenv.config();




export const addresssearch = async  (req, res) => {
  const { query,city } = req.query;

  if (!query && !city) {
    return res.status(400).json({ message: "Query parameter is required" });
  }

  try {

    const findLocation = await Mapping.find({
      name: { $regex: `^${query}`, $options: "i" }
    });

    console.log(findLocation);
    
    // Google Places Text Search API endpoint
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      params: {
        query: city ? `${query} in ${city}` : query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const results = response.data.results.map((place) => {
      const formatted = place.formatted_address.split(",");
      const country = formatted.pop()?.trim() || "";
      const pincodeMatch = formatted[formatted.length - 1]?.match(/\b\d{6}\b/);
      const pincode = pincodeMatch ? pincodeMatch[0] : "000000";
      const state = formatted[formatted.length - 1]
      ?.replace(pincode, "")
      ?.trim() || "";
      const city = formatted[formatted.length - 2] ?.trim() || "";
      const sector = formatted[formatted.length -4] ?.trim() || "";
      return {
        name:place.name,
        address:place.formatted_address,
        sector,
        city,
        state,
        pincode,
        country,
        location: place.geometry.location,
        place_id:place.place_id,
      };
    });

    const existingAddresses = await Mapping .find({
      address:{ $in: results.map((r) => r.address)},
    });

    const newResults = results.filter(
      (r) => !existingAddresses.some((e)=> e.address === r.address)
    );

    let loca = [];
    if(newResults.length > 0){
      loca = await Mapping.insertMany(newResults);
    }


    res.status(200).json({message:`${newResults.length} New locations added`, results , loca,existingAddresses });
  } catch (error) {
    console.error("Google Maps API error:", error.message);
    res.status(500).json({ message: "Failed to fetch data from Google Maps API" });
  }
};

