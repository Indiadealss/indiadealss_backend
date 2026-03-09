import express from "express";
import { getAlllistingWithleads, getListinglead, getycrmhomepage } from "../controllers/mycrmcontroller.js";

const router = express.Router();

router.get('/getcrmHomepage',getycrmhomepage);
router.get('/allListing',getAlllistingWithleads);
router.get('/leadbyid',getListinglead);

export default router;