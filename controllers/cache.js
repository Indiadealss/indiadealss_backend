// cache.js
import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL);

// small helper
export const cacheKey = (q) => `city:${q.toLowerCase().trim()}`;