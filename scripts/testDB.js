import { shards, globalSequelize } from "../connections/postgres_config.js";

import SnowflakeID from "../middlewares/snowflake.js";

async function testConnections() {
  try {
    await globalSequelize.authenticate();
    console.log("✅ Connected to Global Database");
  } catch (err) {
    console.error("❌ Failed to connect to Global Database:", err.message);
  }

  await Promise.all(
    shards.map(async (shard, index) => {
      try {
        await shard.authenticate();
        console.log(`✅ Connected to Shard ${index}`);
      } catch (err) {
        console.error(`❌ Failed to connect to Shard ${index}:`, err.message);
      }
    })
  );
}

// testConnections();

async function checkTables() {
  const globalQuery =
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";

  try {
    const [globalTables] = await globalSequelize.query(globalQuery);
    console.log("🔍 Raw Response from Global DB:", globalTables);

    // FIX: Ensure we correctly extract table names
    const tableNames = globalTables.map((row) => row?.table_name || row);
    console.log("📌 Tables in Global DB:", tableNames);
  } catch (err) {
    console.error("❌ Error checking tables in Global DB:", err.message);
  }

  await Promise.all(
    shards.map(async (shard, index) => {
      try {
        const [tables] = await shard.query(globalQuery);
        console.log(`🔍 Raw Response from Shard ${index}:`, tables);

        // FIX: Extract table names correctly
        const tableNames = tables.map((row) => row?.table_name || row);
        console.log(`📌 Tables in Shard ${index}:`, tableNames);
      } catch (err) {
        console.error(
          `❌ Error checking tables in Shard ${index}:`,
          err.message
        );
      }
    })
  );
}

// checkTables();

async function insertTestData() {
  const shortUrl = "test123";
  const userId = "1";

  const longUrl = "https://example.com";

  const snowflake = new SnowflakeID();
  const id = snowflake.generate();
  // console.log(id);
  const shardIdx = Number(id % BigInt(shards.length));
  const timestamp = Number(id >> 22n) + 1735689600000;

  const global_t = await globalSequelize.transaction();
  const shard_t = await shards[shardIdx].transaction();
  try {
    const globalInsertQuery = `
    WITH locked AS (
      SELECT "shardIdx" FROM shorturls_shard_map
      WHERE "shortUrl" = :shortUrl
      FOR UPDATE
    )
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

    console.log(`✅ Inserted into Shard ${shardIdx}:`, shard_result);
    await global_t.commit();
    await shard_t.commit();
  } catch (err) {
    await global_t.rollback();
    await shard_t.rollback();
    console.error("❌ Error inserting into DB:", err.message);
    return;
  }
}

insertTestData();
