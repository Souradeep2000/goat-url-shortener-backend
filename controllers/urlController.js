import SnowflakeID from "node-snowflake"
import shards from "../db.js"; 

const generateSnowflakeId = () => SnowflakeID.generate();

// Choose a shard based on Snowflake ID
const getShardIndex = (id) => Number(id) % shards.length;

export const createShortUrl = async (req, res) => {
  try {
    const id = generateSnowflakeId();
    const { shortUrl, longUrl, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const shardIndex = getShardIndex(id);
    const sequelize = shards[shardIndex];

    // Execute raw SQL query to insert data
    await sequelize.query(
      `INSERT INTO urls (id, "shortUrl", "longUrl", "userId", "createdAt") 
       VALUES ($1, $2, $3, $4, NOW())`,
      { bind: [id, shortUrl, longUrl, userId] }
    );

    res.json({ success: true, id, shortUrl, shard: shardIndex });
  } catch (err) {
    console.error("Database Insert Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getShortUrl = async (req, res) => {
    try {
      const { shortUrl } = req.params;
  
      // Query any shard (PostgreSQL will find the right partition)
      const sequelize = shards[0];
  
      const [result] = await sequelize.query(
        `SELECT * FROM urls WHERE "shortUrl" = $1`,
        { bind: [shortUrl] }
      );
  
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: "URL not found" });
      }
  
      res.json({ success: true, data: result[0] });
    } catch (err) {
      console.error("Database Query Error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
