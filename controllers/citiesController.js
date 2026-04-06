import axios from "axios";
import dotenv from "dotenv";
import City from "../models/City.js";

dotenv.config();

const parseGoogleCity = (place, query) => {
  const components = place.address_components || [];
  const cityComponent = components.find((c) =>
    c.types.includes("locality") ||
    c.types.includes("postal_town") ||
    c.types.includes("administrative_area_level_3")
  );
  const stateComponent = components.find((c) =>
    c.types.includes("administrative_area_level_1")
  );
  const countryComponent = components.find((c) =>
    c.types.includes("country")
  );

  const city = cityComponent?.long_name || place.name || query;
  const state = stateComponent?.long_name || "";
  const country = countryComponent?.long_name || "India";

  return { city: city.trim(), state: state.trim(), country: country.trim() };
};

export const searchCity = async (req, res) => {
  try {
    const { query } = req.query; // ?query=del

    if (!query) {
      return res.status(400).json({ success: false, message: "Query is required" });
    }

    // Case-insensitive partial search in local DB
    const citiees = await City.find({
      city: { $regex: query, $options: "i" },
    }).limit(10);

    if (citiees.length > 0) {
      return res.json({ success: true, count: citiees.length, data: citiees });
    }

    const response = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      params: {
        query,
        type: "locality",
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (!response.data.results || response.data.results.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [], message: "No cities found from Google" });
    }

    const parsedCities = response.data.results.map((place) => parseGoogleCity(place, query));

    const uniqueCities = [];
    const seen = new Set();
    for (const cityObj of parsedCities) {
      const key = cityObj.city.toLowerCase();
      if (cityObj.city && !seen.has(key)) {
        seen.add(key);
        uniqueCities.push(cityObj);
      }
    }

    const existingCities = await City.find({
      city: { $in: uniqueCities.map((item) => item.city) },
    });

    const existingCityNames = new Set(existingCities.map((item) => item.city.toLowerCase()));
    const newCities = uniqueCities.filter((item) => !existingCityNames.has(item.city.toLowerCase()));

    let insertedCities = [];
    if (newCities.length > 0) {
      insertedCities = await City.insertMany(newCities);
    }

    const resultCities = [...existingCities, ...insertedCities].slice(0, 10);
    return res.json({ success: true, count: resultCities.length, data: resultCities, googleFound: parsedCities.length, inserted: insertedCities.length });
  } catch (err) {
    console.error("City search error:", err.response?.data || err.message || err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};