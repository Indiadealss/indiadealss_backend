import express from "express";
import { searchCities, searchCity } from "../controllers/citiesController.js";

const router = express.Router();

router.get("/search",searchCity);
router.get("/searchCities",searchCities);

export default router;