import { shards, globalSequelize } from "../db.js";
import dotenv from "dotenv";

dotenv.config();

const setupShards = async (idx) => {
  try {
    const sequelize = shards[idx];

    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log(`✅Shard${idx} synced successfully`);

    // 1️⃣ Create Parent Table with Hash Partitioning
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id BIGINT,
        "shortUrl" TEXT NOT NULL,
        "longUrl" TEXT NOT NULL,
        "userId" TEXT,
        clicks INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL,
        PRIMARY KEY (id, "shortUrl") 
      ) PARTITION BY HASH ("shortUrl");
    `);

    // 2️⃣ Create Hash Partitions (4 Partitions)
    for (let i = 0; i < 4; i++) {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS urls_${i}
        PARTITION OF urls
        FOR VALUES WITH (MODULUS 4, REMAINDER ${i});
      `);
    }

    // 3️⃣Drop Existing Function if it Exists
    await sequelize.query(`
      DROP FUNCTION IF EXISTS enforce_unique_shorturl CASCADE;
    `);

    // 4️⃣ Function to Enforce Global Uniqueness
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION enforce_unique_shorturl()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Ensure uniqueness in the global table
        INSERT INTO shorturls_shard_map ("shortUrl", "shardIdx")
        VALUES (NEW."shortUrl", NEW."shardIdx")
        ON CONFLICT ("shortUrl") DO NOTHING;
        
      IF NOT FOUND THEN
      RAISE EXCEPTION '❌ Duplicate shortUrl detected!';
      
      END IF;
      
      RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 5️⃣  Attach Trigger to Enforce Uniqueness Before Insert
    await sequelize.query(`
      CREATE TRIGGER shorturl_unique_trigger
      BEFORE INSERT ON urls
      FOR EACH ROW EXECUTE FUNCTION enforce_unique_shorturl();
    `);

    //  6️⃣ Add Indexes for Fast Queries
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_shortUrl ON urls ("shortUrl");
      CREATE INDEX IF NOT EXISTS idx_urls_createdAt ON urls ("createdAt");
      CREATE INDEX IF NOT EXISTS idx_urls_userId ON urls ("userId");
    `);

    console.log(`✅Shard${idx} setup completed successfully!`);
  } catch (error) {
    console.error(`❌ Error setting up Shard${idx}:`, error);
  }
};

const setupGlobal = async () => {
  try {
    await globalSequelize.authenticate();
    await globalSequelize.sync({ alter: true });
    console.log(`✅global-database synced successfully`);

    await globalSequelize.query(`
      CREATE TABLE shorturls_shard_map (
      "shortUrl" TEXT PRIMARY KEY,
      "shardIdx" INTEGER NOT NULL
    ) PARTITION BY HASH (shortUrl)`);

    for (let i = 0; i < 8; i++) {
      await globalSequelize.query(`
        CREATE TABLE IF NOT EXISTS shorturls_shard_map_${i}
        PARTITION OF shorturls_shard_map
        FOR VALUES WITH (MODULUS 8, REMAINDER ${i});
      `);
    }

    await globalSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shorturls_shard_hash 
      ON shorturls_shard_map ("shortUrl");
      `);

    console.log(`✅global setup completed successfully!`);
  } catch (error) {
    console.error(`❌ Error setting up global-database:`, error);
  }
};

const cleanupGlobalDatabase = async () => {
  try {
    for (let i = 0; i < 8; i++) {
      await globalSequelize.query(
        `DROP TABLE IF EXISTS shorturls_shard_map_${i} CASCADE;`
      );
    }

    await globalSequelize.query(
      `DROP TABLE IF EXISTS shorturls_shard_map CASCADE;`
    );
    console.log(`✅ global-database cleanup completed successfully!`);
  } catch (error) {
    console.error(`❌ Error cleaning up global-database:`, error);
  }
};

const setupDatabase = async () => {
  try {
    const promises = [];

    promises.push(setupGlobal());

    for (let i = 0; i < shards.length; i++) {
      promises.push(setupShards(i));
    }

    await Promise.all(promises);
  } catch (err) {
    console.log(err);
  }
};

const cleanupDatabase = async () => {
  try {
    const promises = [];

    promises.push(cleanupGlobalDatabase());

    for (let i = 0; i < shards.length; i++) {
      promises.push(cleanupShards(i));
    }

    await Promise.all(promises);
  } catch (err) {
    console.log(err);
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
    await sequelize.query(`DROP TABLE IF EXISTS short_urls_unique CASCADE;`);

    for (let i = 0; i < 4; i++) {
      await sequelize.query(`DROP TABLE IF EXISTS urls_${i} CASCADE;`);
    }

    await sequelize.query(`DROP TABLE IF EXISTS urls CASCADE;`);
    console.log(`✅ Shard${idx} cleanup completed successfully!`);
  } catch (error) {
    console.error(`❌ Error cleaning up Shard${idx}:`, error);
  }
};

export { setupDatabase, cleanupDatabase };
