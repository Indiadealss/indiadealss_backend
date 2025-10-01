import express from "express";
import { getAllProperties, createProperty,getProperty } from "../controllers/propertyController.js";
import upload from "../config/multers3.js";
//import sessionMiddleware from "../middleware/sessionMiddleware.js";

const router = express.Router();

router.get("/getAllProperties",  getAllProperties);
router.post("/createProperty",
     upload.fields([
      {name:"images",maxCount:10},
      {name:"video",maxCount:5}
    ]),
     createProperty);
router.get("/getProperty", getProperty); 

export default router;
