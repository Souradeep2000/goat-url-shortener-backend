import {
  shards,
  globalSequelize,
  globalReplicas,
  shardReplicas,
} from "../connections/postgres_config.js";
import dotenv from "dotenv";
import crypto from "crypto";
import Analytics from "./Analytics.js";
import AggregatedAnalytics from "./AggregatedAnalytics.js";

dotenv.config();

const numShards = shards.length;

function computeHashKey(shortUrl, numShards) {
  const hash = crypto.createHash("sha256").update(shortUrl).digest();
  return Math.abs(hash.readUInt32BE(0) ^ hash.readUInt32BE(4)) % numShards;
}

const setupDatabase = async () => {
  try {
    const promises = [setupGlobal()];
    for (let i = 0; i < numShards; i++) {
      promises.push(setupShards(i));
    }
    await Promise.all(promises);
  } catch (err) {
    console.error("❌ Error setting up database:", err);
  }
};

const setupGlobal = async () => {
  try {
    await globalSequelize.authenticate();
    await globalSequelize.sync({ alter: true });

    await Analytics.sync({ alter: true });
    await AggregatedAnalytics.sync({ alter: true });

    console.log("✅ Global database synced successfully");

    await globalSequelize.query(`
      CREATE TABLE IF NOT EXISTS shorturls_shard_map (
        "shortUrl" TEXT PRIMARY KEY,
        "shardIdx" INTEGER NOT NULL,
        "userId" TEXT
      ) PARTITION BY HASH ("shortUrl");
    `);

    for (let i = 0; i < numShards; i++) {
      await globalSequelize.query(`
        CREATE TABLE IF NOT EXISTS shorturls_shard_map_${i}
        PARTITION OF shorturls_shard_map
        FOR VALUES WITH (MODULUS ${numShards}, REMAINDER ${i});
      `);
    }

    await Promise.all(
      globalReplicas.map(async (replica, index) => {
        await replica.authenticate();
        // console.log(`✅ Connected to Global Replica ${index + 1}`);
      })
    );

    await globalSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shorturls_userid ON "shorturls_shard_map" ("userId");
      CREATE INDEX IF NOT EXISTS idx_analytics_shortUrlId ON "Analytics" ("shortUrlId");
      CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON "Analytics" ("timestamp");
      CREATE INDEX IF NOT EXISTS idx_analytics_ipAddress ON "Analytics" ("ipAddress");
    `);

    console.log("✅ Global setup completed successfully!");
  } catch (error) {
    console.error("❌ Error setting up global-database:", error);
  }
};

const setupShards = async (idx) => {
  try {
    const sequelize = shards[idx];
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log(`✅ Shard${idx} synced successfully`);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id BIGINT PRIMARY KEY,
        "shortUrl" TEXT NOT NULL,
        "longUrl" TEXT NOT NULL,
        "userId" TEXT,
        "createdAt" TIMESTAMP NOT NULL
      ) PARTITION BY HASH (id);
    `);

    for (let i = 0; i < numShards; i++) {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS urls_${i}
        PARTITION OF urls
        FOR VALUES WITH (MODULUS ${numShards}, REMAINDER ${i});
      `);
    }

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_shortUrl ON urls (id, "shortUrl");
      CREATE INDEX IF NOT EXISTS idx_urls_createdAt ON urls ("createdAt");
      CREATE INDEX IF NOT EXISTS idx_urls_userId_createdAt ON urls ("userId", "createdAt");
    `);

    await Promise.all(
      shardReplicas[idx].map(async (replica, index) => {
        await replica.authenticate();
        // console.log(`✅ Connected to Shard Replica ${index + 1}`);
      })
    );

    console.log(`✅ Shard${idx} setup completed successfully!`);
  } catch (error) {
    console.error(`❌ Error setting up Shard${idx}:`, error);
  }
};

const cleanupDatabase = async () => {
  try {
    const promises = [cleanupGlobalDatabase()];
    for (let i = 0; i < numShards; i++) {
      promises.push(cleanupShards(i));
    }
    await Promise.all(promises);
  } catch (err) {
    console.error("❌ Error cleaning up database:", err);
  }
};

const cleanupGlobalDatabase = async () => {
  try {
    for (let i = 0; i < numShards; i++) {
      await globalSequelize.query(
        `DROP TABLE IF EXISTS shorturls_shard_map_${i} CASCADE;`
      );
    }
    await globalSequelize.query(
      `DROP TABLE IF EXISTS shorturls_shard_map CASCADE;`
    );
    await globalSequelize.query(`DROP TABLE IF EXISTS "Analytics" CASCADE;`);
    await globalSequelize.query(
      `DROP TABLE IF EXISTS "AggregatedAnalytics" CASCADE;`
    );
    console.log("✅ Global-database cleanup completed successfully!");
  } catch (error) {
    console.error("❌ Error cleaning up global-database:", error);
  }
};

const cleanupShards = async (idx) => {
  try {
    const sequelize = shards[idx];
    await sequelize.query(
      `DROP TRIGGER IF EXISTS shorturl_unique_trigger ON urls;`
    );
    await sequelize.query(
      `DROP FUNCTION IF EXISTS enforce_unique_shorturl CASCADE;`
    );
    for (let i = 0; i < numShards; i++) {
      await sequelize.query(`DROP TABLE IF EXISTS urls_${i} CASCADE;`);
    }
    await sequelize.query(`DROP TABLE IF EXISTS urls CASCADE;`);
    await sequelize.query(`DROP TABLE IF EXISTS "Analytics" CASCADE;`);
    console.log(`✅ Shard${idx} cleanup completed successfully!`);
  } catch (error) {
    console.error(`❌ Error cleaning up Shard${idx}:`, error);
  }
};

export { setupDatabase, cleanupDatabase };
