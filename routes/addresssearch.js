import express from 'express';
import { addresssearch } from '../controllers/addresssearchController.js';


const router = express.Router();

router.get("/", addresssearch);


export default router;