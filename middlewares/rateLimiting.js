import { redis_rate_limiter } from "../connections/redis_config";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT);
const UNAUTH_LIMIT = Number(process.env.UNAUTH_RATE_LIMIT);
const AUTH_TTL = Number(process.env.AUTH_TTL); // 1 hour
const UNAUTH_TTL = Number(process.env.UNAUTH_TTL); // 1 day

const hashIP = (ip) => crypto.createHash("md5").update(ip).digest("hex");

const rateLimiter = async (req, res, next) => {
  const userId = req.user ? `u:${req.user.id}` : `i:${hashIP(req.ip)}`;
  const limit = req.user ? AUTH_LIMIT : UNAUTH_LIMIT;
  const ttl = req.user ? AUTH_TTL : UNAUTH_TTL;
  const key = `rl:${userId}`;

  try {
    // Used Redis transactions (MULTI/EXEC) for atomicity
    const pipeline = redis_rate_limiter.multi();

    // Get the remaining tokens
    pipeline.get(key);
    const results = await pipeline.exec();
    let tokens = results[0] ? Number(results[0]) : null;

    if (tokens === null) {
      // First request, initialize counter
      await redis_rate_limiter.setex(key, ttl, limit - 1);
      return next();
    }

    if (tokens > 0) {
      // Decrement only if tokens exist
      await redis_rate_limiter.decr(key);
      return next();
    } else {
      return res.status(429).json({ error: "Rate limit exceeded. Try later." });
    }
  } catch (err) {
    console.error("Redis error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default rateLimiter;
