import express from "express";
import { getAlllistingWithleads, getAllProjectlistingWithleads, getListinglead, getycrmhomepage } from "../controllers/mycrmcontroller.js";

const router = express.Router();

router.get('/getcrmHomepage',getycrmhomepage);
router.get('/allListing',getAlllistingWithleads);
router.get('/leadbyid',getListinglead);
router.get('/getprojectslisting',getAllProjectlistingWithleads)

export default router;