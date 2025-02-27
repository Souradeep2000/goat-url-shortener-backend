import shards from "../db.js";
import dotenv from "dotenv";

dotenv.config();

const setupShards = async (idx) => {
  try {
    // 1️⃣ Create Parent Table with Hash Partitioning
    const sequelize = shards[idx];
    await sequelize.sync({ alter: true });
    console.log(`✅Shard${idx} synced successfully`);

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

    // 3️⃣ Create Unique Short URLs Table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS short_urls_unique (
        "shortUrl" TEXT PRIMARY KEY
      );
    `);

    //4️⃣ Drop Existing Trigger if it Exists
    await sequelize.query(`
      DROP TRIGGER IF EXISTS shorturl_unique_trigger ON urls;
    `);

    // 5️⃣ Drop Existing Function if it Exists
    await sequelize.query(`
      DROP FUNCTION IF EXISTS enforce_unique_shorturl CASCADE;
    `);

    // 6️⃣ Function to Enforce Global Uniqueness
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION enforce_unique_shorturl()
      RETURNS TRIGGER AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM short_urls_unique WHERE "shortUrl" = NEW."shortUrl") THEN
          RAISE EXCEPTION '❌ Duplicate shortUrl detected!';
        END IF;

        INSERT INTO short_urls_unique ("shortUrl") VALUES (NEW."shortUrl");
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 7️⃣ Attach Trigger to Enforce Uniqueness Before Insert
    await sequelize.query(`
      CREATE TRIGGER shorturl_unique_trigger
      BEFORE INSERT ON urls
      FOR EACH ROW EXECUTE FUNCTION enforce_unique_shorturl();
    `);

    // 8️⃣ Add Indexes for Fast Queries
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

const setupDatabase = async () => {
  try {
    const promises = [];

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
