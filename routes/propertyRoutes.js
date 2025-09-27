import express from "express";
import { getAllProperties, createProperty,getProperty } from "../controllers/propertyController.js";
//import sessionMiddleware from "../middleware/sessionMiddleware.js";

const router = express.Router();

router.get("/getAllProperties",  getAllProperties);
router.post("/createProperty", createProperty);
router.get("/getProperty", getProperty); 

export default router;
