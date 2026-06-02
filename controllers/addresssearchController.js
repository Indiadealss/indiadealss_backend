import axios from "axios";
import dotenv from 'dotenv';
import  Mapping from '../models/Maping.js'
import City from "../models/City.js";

dotenv.config();




export const addresssearch = async  (req, res) => {
  const { query,city } = req.query;

  if (!query && !city) {
    return res.status(400).json({ message: "Query parameter is required" });
  }

  try {

    const findLocation = query ? await Mapping.find({
      name: { $regex: `^${query}`, $options: "i" }
    }) : [];

    
    

    console.log('Query parameter:', query);
    console.log('findLocation results:', findLocation.length);
    
    // Google Places Text Search API endpoint
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      params: {
        query: city ? `${query} in ${city}` : query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    console.log(query,'query', city,'city',findLocation,'find location',response.data.results,'response data');

    if (!response.data.results || response.data.results.length === 0) {
      return res.status(200).json({message: "No locations found", results: [], loca: [], existingAddresses: [] });
    }

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

    const existingAddresses = await Mapping.find({
      address:{ $in: results.map((r) => r.address.trim())},
    });

    const newResults = results.filter(
      (r) => !existingAddresses.some((e)=> e.address?.trim() === r.address.trim())
    );

    let loca = [];
    if(newResults.length > 0){
      loca = await Mapping.insertMany(newResults);
    }


    res.status(200).json({message:`${newResults.length} New locations added`, results , loca,existingAddresses });
  } catch (error) {
    console.error("Error caught:", error.response?.data || error.message);
    console.error("Error status:", error.response?.status);
    console.error("Full error:", error);
    res.status(500).json({ message: "Failed to fetch data from Google Maps API", error: error.response?.data || error.message });
  }
};

export const citySearch = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res
      .status(400)
      .json({ message: "Query is required" });
  }

  try {
    // Google Places API
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (
      !response.data.results ||
      response.data.results.length === 0
    ) {
      return res.status(200).json({
        message: "No cities found",
        results: [],
      });
    }

    // Extract unique cities
    const citiesMap = new Map();

    response.data.results.forEach((place) => {
      const formatted =
        place.formatted_address.split(",");

      const city =
        formatted[formatted.length - 3]?.trim() || "";

      const state =
        formatted[formatted.length - 2]?.trim() || "";

      const country =
        formatted[formatted.length - 1]?.trim() || "";

      if (city) {
        citiesMap.set(city.toLowerCase(), {
          city,
          state,
          country,
        });
      }
    });

    const cities = [...citiesMap.values()];

    // Existing cities
    const existingCities = await City.find({
      city: {
        $in: cities.map((c) => c.city),
      },
    });

    // Filter new cities
    const newCities = cities.filter(
      (c) =>
        !existingCities.some(
          (e) =>
            e.city.toLowerCase() ===
            c.city.toLowerCase()
        )
    );

    // Save new cities
    let savedCities = [];

    if (newCities.length > 0) {
      savedCities = await City.insertMany(newCities);
    }

    // Return only city names
    return res.status(200).json({
      message: `${savedCities.length} new cities added`,
      results: cities.map((c) => c.city),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch cities",
      error: error.message,
    });
  }
};