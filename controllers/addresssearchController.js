import axios from "axios";
import dotenv from 'dotenv';
import  Mapping from '../models/Maping.js'

dotenv.config();




export const addresssearch = async  (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ message: "Query parameter is required" });
  }

  try {
    // Google Places Text Search API endpoint
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      params: {
        query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const results = response.data.results.map((place) => ({
      name: place.name,
      address: place.formatted_address,
      location: place.geometry.location,
      place_id: place.place_id,
    }));

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


    res.status(200).json({message:'New locations added', results , loca });
  } catch (error) {
    console.error("Google Maps API error:", error.message);
    res.status(500).json({ message: "Failed to fetch data from Google Maps API" });
  }
};

