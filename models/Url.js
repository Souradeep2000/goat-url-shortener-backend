import { DataTypes, QueryTypes } from "sequelize";
import sequelize from "../db.js";

// const Url = sequelize.define(
//   "Urls",
//   {
//     id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//     },
//     shortUrl: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       unique: true,
//       field: "shortUrl",
//       validate: {
//         isUrl: true,
//       },
//     },
//     longUrl: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       validate: {
//         isUrl: true,
//       },
//     },
//     clicks: {
//       type: DataTypes.INTEGER,
//       defaultValue: 0,
//       allowNull: false,
//     },
//     userId: {
//       type: DataTypes.STRING,
//       allowNull: true,
//     },
//     createdAt: {
//       type: DataTypes.DATE,
//       allowNull: false,
//       defaultValue: DataTypes.NOW,
//     },
//   },
//   {
//     timestamps: true,
//     tableName: "urls",
//     // indexes: [
//     //   {
//     //     name: "idx_short_url",
//     //     fields: ["shortUrl"], // B-Tree index
//     //     using: "BTREE",
//     //   },
//     //   {
//     //     name: "idx_user_id",
//     //     fields: ["userId"], // B-Tree index
//     //     using: "BTREE",
//     //   },
//     // ],
//   }
// );

// Create Partitioned Table
const createPartitionedTable = async () => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS urls (
      id UUID DEFAULT gen_random_uuid(),
      "shortUrl" VARCHAR(255) NOT NULL,
      "longUrl" TEXT NOT NULL,
      clicks INT DEFAULT 0,
      "userId" VARCHAR(255),
      "createdAt" TIMESTAMP NOT NULL,
      PRIMARY KEY (id, "createdAt")
    ) PARTITION BY RANGE ("createdAt");`,
    { type: QueryTypes.RAW }
  );

  await createIndexes();
};

const createIndexes = async () => {
  await sequelize.query(
    `
    -- Unique index on shortUrl including createdAt (required for partitioning)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_shortUrl_createdAt 
    ON urls ("shortUrl", "createdAt");

    -- Index on createdAt for efficient range queries
    CREATE INDEX IF NOT EXISTS idx_urls_createdAt ON urls ("createdAt");

    -- Index on userId for user-specific queries
    CREATE INDEX IF NOT EXISTS idx_urls_userId ON urls ("userId");
    `,
    { type: QueryTypes.RAW }
  );

  console.log(`✅ Parent table and its indexes created`);
};

const createPartitionIfNeeded = async () => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const partitionName = `urls_${year}_${month}`;
    const nextMonth = new Date(year, now.getMonth() + 1, 1);
    const startDate = `${year}-${month}-01`;
    const endDate = `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-01`;

    // Check if partition exists
    const partitionExists = await sequelize.query(
      `SELECT 1 FROM pg_tables WHERE tablename = '${partitionName}';`,
      { type: QueryTypes.SELECT }
    );

    // If partition does not exist, create it
    if (partitionExists.length === 0) {
      await sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF urls
        FOR VALUES FROM ('${startDate}') TO ('${endDate}');
        `,
        { type: QueryTypes.RAW }
      );

      // await createPartitionIndexes(partitionName);

      console.log(
        `✅ Partition created: ${partitionName} (From ${startDate} to ${endDate})`
      );
    } else {
      console.log(`✔ Partition already exists: ${partitionName}`);
    }
  } catch (error) {
    console.error("❌ Partition creation error:", error);
  }
};

const dropTable = async () => {
  await sequelize.query(
    `DROP TABLE IF EXISTS urls CASCADE;`, // Drop the table if it exists (to avoid conflicts)
    { type: QueryTypes.RAW }
  );
};

export { createPartitionedTable, createPartitionIfNeeded, dropTable };
// export default Url;
