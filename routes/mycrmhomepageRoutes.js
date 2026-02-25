import express from "express";
import { getycrmhomepage } from "../controllers/mycrmcontroller.js";

const router = express.Router();

router.get('/getcrmHomepage',getycrmhomepage);

export default router;