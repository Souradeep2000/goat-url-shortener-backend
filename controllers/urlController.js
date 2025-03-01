import { shards, globalSequelize } from "../connections/postgres_config.js";
import SnowflakeID from "../middlewares/snowflake.js";
import { redisNodes } from "../connections/redis_config.js";
import { regionMap } from "../middlewares/regionMap.js";

export const createShortUrl = async (req, res) => {
  const { shortUrl, longUrl, userId, region } = req.body;
  const regionCode = regionMap[region];
  const shardIdx = regionCode % shards.length; // Maps region to shard

  const global_t = await globalSequelize.transaction();
  const shard_t = await shards[shardIdx].transaction();

  try {
    const snowflake = new SnowflakeID();
    const id = snowflake.generate(regionCode);
    // console.log(id);

    const timestamp = Number(id >> 22n) + 1735689600000;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID required" });
    }

    const globalInsertQuery = `
      INSERT INTO shorturls_shard_map ("shortUrl", "shardIdx")
      VALUES (:shortUrl, :shardIdx);
    `;

    const global_result = await globalSequelize.query(globalInsertQuery, {
      replacements: { shortUrl, shardIdx },
      transaction: global_t,
    });

    console.log(`✅ Inserted into Global DB. Assigned to Shard ${shardIdx}`);

    // Step 2: Insert into the correct shard

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

    // ✅ Store the newly created short URL in Redis (Cache)
    const redisClient = redisNodes[regionCode % redisNodes.length];

    await redisClient.setex(
      `shortUrl:${shortUrl}`,
      86400,
      JSON.stringify(insertedUrl)
    );

    await global_t.commit();
    await shard_t.commit();

    res.json({ success: true, id, shortUrl, shard: shardIdx });
  } catch (err) {
    await global_t.rollback();
    await shard_t.rollback();
    console.error("❌ Error inserting into DB:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getShortUrl = async (req, res) => {
  try {
    const { shortUrl, region } = req.params;

    const regionCode = regionMap[region];

    const redisClient = redisNodes[regionCode % redisNodes.length];

    //Check Redis Cache (Cache Hit)
    const cachedData = await redisClient.get(`shortUrl:${shortUrl}`);
    if (cachedData) {
      // console.log(`✅ Cache HIT from Redis Shard ${redisIdx}!`);
      return res.json({ success: true, data: JSON.parse(cachedData) });
    }

    const [shardResult] = await globalSequelize.query(
      `SELECT "shardIdx" FROM shorturls_shard_map WHERE "shortUrl" = :shortUrl LIMIT 1`,
      { replacements: { shortUrl } }
    );

    const shardIdx = shardResult?.[0]?.shardIdx;
    if (!shardIdx && shardIdx !== 0) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }

    const [result] = await shards[shardIdx].query(
      `SELECT * FROM urls WHERE "shortUrl" = :shortUrl LIMIT 1`,
      { replacements: { shortUrl } }
    );

    const urlData = result?.[0];
    if (!urlData) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }

    await redisClient.setex(
      `shortUrl:${shortUrl}`,
      86400,
      JSON.stringify(urlData)
    );

    res.json({ success: true, data: result[0] });
  } catch (err) {
    console.error("Database Query Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
