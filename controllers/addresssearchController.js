import axios from "axios";
import dotenv from 'dotenv';


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

    res.status(200).json({ results });
  } catch (error) {
    console.error("Google Maps API error:", error.message);
    res.status(500).json({ message: "Failed to fetch data from Google Maps API" });
  }
};

