import pkg from "pg";
import dotenv from "dotenv";

const { Client } = pkg;
dotenv.config();

const client = new Client({
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_DB_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testDatabase() {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Check if the indexes exist
    const indexCheckQuery = `
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'urls';
    `;

    const { rows: indexes } = await client.query(indexCheckQuery);
    console.log("\n📌 Indexes on 'urls' table:");
    indexes.forEach((idx) => console.log(idx.indexname, "→", idx.indexdef));

    // Check partitions exist
    const partitionCheckQuery = `
      SELECT inhrelid::regclass AS partition_name
      FROM pg_inherits 
      JOIN pg_class AS child ON inhrelid = child.oid
      WHERE inhparent = 'urls'::regclass;
    `;

    const { rows: partitions } = await client.query(partitionCheckQuery);
    console.log("\n📂 Partitions:");
    partitions.forEach((p) => console.log(p.partition_name));

    // Insert test data into partitions
    console.log("\n📝 Inserting test data...");
    const testEntries = [
      { shortUrl: "test123", longUrl: "https://example.com", userId: "1" },
      { shortUrl: "test456", longUrl: "https://example2.com", userId: "2" },
    ];

    for (let entry of testEntries) {
      try {
        const insertQuery = `INSERT INTO urls ("shortUrl", "longUrl", "userId", "clicks", "createdAt") 
                             VALUES ($1, $2, $3, $4, $5) RETURNING *;`;

        const { rows: insertedData } = await client.query(insertQuery, [
          entry.shortUrl,
          entry.longUrl,
          entry.userId,
          0,
          new Date(),
        ]);

        console.log(`✅ Inserted: ${entry.shortUrl}`, insertedData[0]);
      } catch (err) {
        console.error(`❌ Error inserting ${entry.shortUrl}:`, err.message);
      }
    }

    // Check unique constraint enforcement
    console.log("\n⚠️ Testing unique constraint...");
    try {
      await client.query(
        `INSERT INTO urls ("shortUrl", "longUrl", "userId", "clicks", "createdAt") 
                          VALUES ($1, $2, $3, $4, $5);`,
        ["test123", "https://example3.com", "3", 0, new Date()]
      );
      console.log("❌ Error: Unique constraint failed to trigger!");
    } catch (err) {
      console.log("✅ Unique constraint working:", err.message);
    }

    // Retrieve and verify inserted data
    const selectQuery = `SELECT * FROM urls WHERE "shortUrl" = 'test123' OR "shortUrl" = 'test456';`;
    const { rows: data } = await client.query(selectQuery);

    if (data.length > 0) {
      console.log("\n🔍 Retrieved data:", data);
      console.log("✅ Database setup looks fine!");

      console.log("\n🗑️ Deleting test data...");
      const deleteQuery = `DELETE FROM urls WHERE "shortUrl" = $1;`;

      for (let entry of testEntries) {
        await client.query(deleteQuery, [entry.shortUrl]);
        await client.query(
          `DELETE FROM short_urls_unique WHERE "shortUrl" = $1;`,
          [entry.shortUrl]
        );
        console.log(`✅ Deleted: ${entry.shortUrl}`);
      }
    } else {
      console.log("\n❌ Data was not inserted. Check constraints or indexes.");
    }
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.end();
    console.log("🔌 Disconnected from PostgreSQL");
  }
}

testDatabase();
