import { redis_rate_limiter } from "../connections/redis_config.js";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT);
const UNAUTH_LIMIT = Number(process.env.UNAUTH_RATE_LIMIT);
const AUTH_TTL = Number(process.env.AUTH_TTL); // 1 hour
const UNAUTH_TTL = Number(process.env.UNAUTH_TTL); // 1 day

const hashIP = (ip) => crypto.createHash("md5").update(ip).digest("hex");

const rateLimiter = async (req, res, next) => {
  const userId = req.user ? `u:${req.user}` : `i:${hashIP(req.ip)}`;
  const limit = req.user ? AUTH_LIMIT : UNAUTH_LIMIT;
  const ttl = req.user ? AUTH_TTL : UNAUTH_TTL;
  const key = `${userId}`;

  try {
    const existingTokens = await redis_rate_limiter.get(key);

    if (existingTokens === null) {
      await redis_rate_limiter.set(key, limit - 1, "NX", "EX", ttl);
      return next();
    }
    // Used Redis transactions (MULTI/EXEC) for atomicity
    const pipeline = redis_rate_limiter.multi();

    pipeline.decr(key);
    pipeline.ttl(key);

    const results = await pipeline.exec();

    let tokensLeft = results[0][1]; // Extract updated token count
    let remainingTTL = results[1][1]; // Extract remaining TTL

    if (tokensLeft >= 0) {
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
