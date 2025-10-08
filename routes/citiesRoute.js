import express from "express";
import { searchCity } from "../controllers/citiesController.js";

const router = express.Router();

router.get("/search",searchCity);

export default router;