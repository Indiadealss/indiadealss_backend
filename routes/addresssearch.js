import express from 'express';
import { addresssearch, citySearch } from '../controllers/addresssearchController.js';


const router = express.Router();

router.get("/", addresssearch);
router.get("/city-search", citySearch);


export default router;