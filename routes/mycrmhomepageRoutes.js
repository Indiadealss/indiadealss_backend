import express from "express";
import { getAlllistingWithleads, getAllProjectlistingWithleads, getInfinitylistingWithleads, getListinglead, getPlainlistingWithleads, getPlatinumlistingWithleads, getPremimumlistingWithleads, getycrmhomepage } from "../controllers/mycrmcontroller.js";

const router = express.Router();

router.get('/getcrmHomepage',getycrmhomepage);
router.get('/allListing',getAlllistingWithleads);
router.get('/PlanListing',getPlainlistingWithleads);
router.get('/PlatinumListing',getPlatinumlistingWithleads);
router.get('/PremimumListing',getPremimumlistingWithleads);
router.get('/InfinityListing',getInfinitylistingWithleads);
router.get('/leadbyid',getListinglead);
router.get('/getprojectslisting',getAllProjectlistingWithleads);

export default router;