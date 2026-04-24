import axios from "axios";
import dotenv from "dotenv";
import City from "../models/City.js";

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



const normalize = (str) => str?.toLowerCase().trim();

// 🔹 detect type
const detectType = (name) => {
  const lower = name.toLowerCase();

  if (lower.includes("sector") || lower.includes("block")) return "area";

  if (
    lower.includes("metro") ||
    lower.includes("station") ||
    lower.includes("mall") ||
    lower.includes("hospital") ||
    lower.includes("school")
  ) {
    return "landmark";
  }

  return "city";
};

// 🔹 extract city properly
const extractCity = (terms = []) => {
  if (terms.length >= 3) return terms[terms.length - 3]?.value || "";
  if (terms.length >= 2) return terms[1]?.value || "";
  return "";
};

export const searchCities = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Query required" });
    }

    const normalizedQuery = normalize(query);

    // 🔥 Step 1: DB search (only cities)
    const localResults = await City.find({
      city: { $regex: `^${normalizedQuery}`, $options: "i" },
    }).limit(5);

    // 🔥 Step 2: Google API (with bias)
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
      {
        params: {
          input: query,
          key: process.env.GOOGLE_MAPS_API_KEY,

          // ✅ restrict India
          components: "country:in",

          // ✅ bias to Noida/Delhi NCR
          location: "28.5355,77.3910",
          radius: 50000,
        },
      }
    );

    const predictions = response.data.predictions || [];

    // 🔥 Step 3: Parse results
    const parsed = predictions.map((p) => {
      const terms = p.terms || [];

      const name = terms[0]?.value || "";
      const city = extractCity(terms);
      const state = terms[terms.length - 2]?.value || "";
      const country = terms[terms.length - 1]?.value || "";

      return {
        name,
        city,
        state,
        country,
        type: detectType(name),
      };
    });

    // 🔥 Step 4: Filter (IMPORTANT)
    const filtered = parsed.filter((item) => {
      if (!item.name) return false;

      // sector search → force sector results
      if (normalizedQuery.includes("sector")) {
        return item.name.toLowerCase().includes("sector");
      }

      return true;
    });

    // 🔥 Step 5: Deduplicate
    const unique = Array.from(
      new Map(
        filtered.map((c) => [
          `${normalize(c.name)}-${normalize(c.city)}-${c.type}`,
          c,
        ])
      ).values()
    );

    // 🔥 Step 6: Save only cities
    const cityOnly = unique.filter((i) => i.type === "city");

    const existing = await City.find({
      $or: cityOnly.map((c) => ({
        city: c.name,
        state: c.state,
        country: c.country,
      })),
    });

    const existingSet = new Set(
      existing.map(
        (c) =>
          `${normalize(c.city)}-${normalize(c.state)}-${normalize(c.country)}`
      )
    );

    const newCities = cityOnly.filter(
      (c) =>
        !existingSet.has(
          `${normalize(c.name)}-${normalize(c.state)}-${normalize(c.country)}`
        )
    );

    if (newCities.length > 0) {
      await City.insertMany(
        newCities.map((c) => ({
          city: normalize(c.name),
          state: normalize(c.state),
          country: normalize(c.country),
        }))
      );
    }

    // 🔥 Step 7: Ranking
    const rank = (item) => {
      if (normalizedQuery.includes("sector")) {
        if (item.type === "area") return 1;
        if (item.type === "landmark") return 2;
        return 3;
      }

      if (item.type === "city") return 1;
      if (item.type === "area") return 2;
      return 3;
    };

    unique.sort((a, b) => rank(a) - rank(b));

    // 🔥 Step 8: Merge DB + Google
    const finalResults = [
      ...unique,
      ...localResults.map((c) => ({
        name: c.city,
        city: c.city,
        state: c.state,
        country: c.country,
        type: "city",
      })),
    ];

    // 🔥 Step 9: Final dedupe
    const finalUnique = Array.from(
      new Map(
        finalResults.map((c) => [
          `${normalize(c.name)}-${normalize(c.city)}`,
          c,
        ])
      ).values()
    );

    return res.json({
      success: true,
      data: finalUnique.slice(0, 10),
    });
  } catch (error) {
    console.error("Search error:", error.response?.data || error.message);
    return res.status(500).json({ message: "Server error" });
  }
};