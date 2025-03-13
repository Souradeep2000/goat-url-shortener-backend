import {
  globalReplicas,
  shardReplicas,
} from "../connections/postgres_config.js";
import crypto from "crypto";

const hashIP = (ip) => crypto.createHash("md5").update(ip).digest("hex");

export const getAnalytics = async (req, res) => {
  try {
    const { shortUrlId, startDate, endDate, period } = req.query;
    const whereClause = { shortUrlId };

    // Auto-set startDate and endDate based on period
    const today = new Date();
    if (period === "monthly") {
      const firstDayOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
      whereClause.date = { [Op.gte]: firstDayOfMonth };
    } else if (period === "yearly") {
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      whereClause.date = { [Op.gte]: firstDayOfYear };
    } else {
      if (startDate && endDate) {
        whereClause.date = { [Op.between]: [startDate, endDate] };
      } else if (startDate) {
        whereClause.date = { [Op.gte]: startDate };
      } else if (endDate) {
        whereClause.date = { [Op.lte]: endDate };
      }
    }

    const result = await AggregatedAnalytics.findAll({ where: whereClause });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Database Query Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getUserUrls = async (req, res) => {
  try {
    const userId = req.user ? `u:${req.user}` : `i:${hashIP(req.ip)}`;
    const globalDBSequelize = getRandomReplica(globalReplicas);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch total count for pagination metadata
    const [[{ totalCount }]] = await globalDBSequelize.query(
      `SELECT COUNT(*) AS "totalCount" FROM shorturls_shard_map WHERE "userId" = :userId`,
      { replacements: { userId } }
    );

    if (totalCount === 0) {
      return res.status(404).json({ success: false, message: "No URLs found" });
    }

    // Fetch paginated short URLs and corresponding shard indices
    const [shardMappings] = await globalDBSequelize.query(
      `SELECT "shardIdx", "shortUrl" FROM shorturls_shard_map
      WHERE "userId" = :userId
      ORDER BY "shortUrl" DESC
      LIMIT :limit OFFSET :offset`,
      { replacements: { userId, limit, offset } }
    );

    const urls = [];

    // Fetch paginated data from each shard
    await Promise.all(
      shardMappings.map(async ({ shardIdx, shortUrl }) => {
        const shardSequelize = getRandomReplica(shardReplicas[shardIdx]);
        const [shardUrls] = await shardSequelize.query(
          `SELECT * FROM urls WHERE "shortUrl" = :shortUrl`,
          { replacements: { shortUrl } }
        );
        urls.push(...shardUrls);
      })
    );

    res.json({
      success: true,
      urls,
      pagination: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        pageSize: limit,
      },
    });
  } catch (err) {
    console.error("Database Query Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getRandomReplica = (replicas) =>
  replicas[Math.floor(Math.random() * replicas.length)];
