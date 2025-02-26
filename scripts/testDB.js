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

    // Insert test data
    console.log("\n📝 Inserting test data...");
    const insertQuery = `INSERT INTO "urls" ("shortUrl", "longUrl", "userId", "clicks", "createdAt") 
                         VALUES ($1, $2, $3, $4, $5) RETURNING *;`;

    const { rows: insertedData } = await client.query(insertQuery, [
      "test123",
      "https://example.com",
      "1",
      0,
      new Date(),
    ]);

    console.log("✅ Data inserted successfully!", insertedData[0]);

    // Check if test data exists
    const selectQuery = `SELECT * FROM "urls" WHERE "shortUrl" = 'test123';`;
    const { rows: data } = await client.query(selectQuery);

    if (data.length > 0) {
      console.log("\n🔍 Retrieved data:", data);
      console.log("✅ Database setup looks fine!");
    } else {
      console.log("\n❌ Data was not inserted. Check constraints or indexes.");
    }

    console.log("\n🗑️ Deleting test data...");
    const deleteQuery = `DELETE FROM "Urls" WHERE "shortUrl" = $1;`;

    await client.query(deleteQuery, ["test123"]);
    console.log("✅ Test data deleted successfully!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.end();
    console.log("🔌 Disconnected from PostgreSQL");
  }
}

testDatabase();
