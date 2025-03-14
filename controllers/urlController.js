import {
  shards,
  globalSequelize,
  globalReplicas,
  shardReplicas,
} from "../connections/postgres_config.js";
import SnowflakeID from "../middlewares/snowflake.js";
import { redisNodes } from "../connections/redis_config.js";
import { regionMap } from "../middlewares/regionMap.js";
import { sendAnalyticsEvent } from "../connections/kafka.js";
import crypto from "crypto";
import { nanoid } from "nanoid";

const hashIP = (ip) => crypto.createHash("md5").update(ip).digest("hex");

const validateCustomAlias = (alias) => {
  const aliasRegex = /^[a-zA-Z0-9_-]{3,20}$/; // Allow letters, numbers, underscores, and hyphens (3-20 chars)
  return aliasRegex.test(alias);
};

export const createShortUrl = async (req, res) => {
  const { longUrl, region, customAlias } = req.body;

  const baseUrl = `${req.protocol}://${req.get("host")}/`;

  let shortUrl = baseUrl + (customAlias || nanoid(8));

  if (customAlias && !validateCustomAlias(customAlias)) {
    return res.status(400).json({ message: "Invalid custom alias" });
  }

  const userId = req.user ? `u:${req.user}` : `i:${hashIP(req.ip)}`;
  const regionCode = regionMap[region];
  const shardIdx = regionCode % shards.length;

  const global_t = await globalSequelize.transaction();
  const shard_t = await shards[shardIdx].transaction();

  try {
    const snowflake = new SnowflakeID();
    const id = snowflake.generate(regionCode);

    const timestamp = Number(id >> 22n) + 1735689600000;

    const globalInsertQuery = `
      INSERT INTO shorturls_shard_map ("shortUrl", "shardIdx", "userId")
      VALUES (:shortUrl, :shardIdx, :userId);
    `;

    const global_result = await globalSequelize.query(globalInsertQuery, {
      replacements: { shortUrl, shardIdx, userId },
      transaction: global_t,
    });

    console.log(`✅ Inserted into Global DB. Assigned to Shard ${shardIdx}`);

    const insertQuery = `
      INSERT INTO urls ("id", "shortUrl", "longUrl", "userId", "createdAt")
          VALUES (:id, :shortUrl, :longUrl, :userId, TO_TIMESTAMP(:timestamp / 1000.0))
      RETURNING *;
    `;

    const shard_result = await shards[shardIdx].query(insertQuery, {
      replacements: { id, shortUrl, longUrl, userId, timestamp },
      transaction: shard_t,
    });

    const insertedUrl = shard_result?.[0]?.[0];
    if (!insertedUrl) throw new Error("Insertion failed!");

    const redisClient = redisNodes[regionCode % redisNodes.length];

    await redisClient.setex(`${shortUrl}`, 86400, JSON.stringify(insertedUrl));

    await global_t.commit();
    await shard_t.commit();

    res.json({ success: true, id, shortUrl, shard: shardIdx });
  } catch (err) {
    if (!global_t.finished) await global_t.rollback();
    if (!shard_t.finished) await shard_t.rollback();
    console.error("❌ Error inserting into DB:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getShortUrl = async (req, res) => {
  try {
    const shortUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const region = "asia";
    const regionCode = regionMap[region];

    const redisClient = redisNodes[regionCode % redisNodes.length];

    //Check Redis Cache (Cache Hit)
    const cachedData = await redisClient.get(`${shortUrl}`);
    if (cachedData) {
      const urlData = JSON.parse(cachedData);

      // await sendAnalyticsEvent({
      //   shortUrlId: urlData.id,
      //   ipAddress: req.ip,
      //   country: region, // You can add GeoIP later
      //   referrer: req.get("Referer") || "Direct",
      //   device: req.headers["user-agent"],
      //   timestamp: new Date(),
      // });

      // return res.json({ success: true, data: JSON.parse(cachedData) });
      return res.redirect(301, urlData.longUrl);
    }

    const globalDBSequelize = getRandomReplica(globalReplicas);

    const [shardResult] = await globalDBSequelize.query(
      `SELECT "shardIdx" FROM shorturls_shard_map WHERE "shortUrl" = :shortUrl LIMIT 1`,
      { replacements: { shortUrl } }
    );

    const shardIdx = shardResult?.[0]?.shardIdx;
    if (!shardIdx && shardIdx !== 0) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }

    const shardSequelize = getRandomReplica(shardReplicas[shardIdx]);
    const [result] = await shardSequelize.query(
      `SELECT * FROM urls WHERE "shortUrl" = :shortUrl LIMIT 1`,
      { replacements: { shortUrl } }
    );

    const urlData = result?.[0];
    if (!urlData) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }

    // await sendAnalyticsEvent({
    //   shortUrlId: urlData.id,
    //   ipAddress: req.ip,
    //   country: region,
    //   referrer: req.get("Referer") || "Direct",
    //   device: req.headers["user-agent"],
    //   timestamp: new Date(),
    // });

    await redisClient.setex(`${shortUrl}`, 86400, JSON.stringify(urlData));

    // res.json({ success: true, data: result[0] });
    return res.redirect(301, urlData.longUrl);
  } catch (err) {
    console.error("Database Query Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getRandomReplica = (replicas) =>
  replicas[Math.floor(Math.random() * replicas.length)];
