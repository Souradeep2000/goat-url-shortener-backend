import { globalSequelize } from "../connections/postgres_config.js";
import { DataTypes, Sequelize } from "sequelize";
import cron from "node-cron";

const AggregatedAnalytics = globalSequelize.define("AggregatedAnalytics", {
  shortUrlId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    primaryKey: true,
  },
  totalClicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  uniqueVisitors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  countryStats: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  deviceStats: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  referrerStats: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
});

async function aggregateAnalytics() {
  try {
    await globalSequelize.query(`INSERT INTO "AggregatedAnalytics" ("shortUrlId", "date", "totalClicks", "uniqueVisitors", "countryStats", "deviceStats", "referrerStats", "createdAt")
SELECT
  "shortUrlId",
  DATE("timestamp") AS date,
  COUNT(*) AS totalClicks,
  COUNT(DISTINCT "ipAddress") AS uniqueVisitors,
  (
    SELECT jsonb_object_agg(country, cnt)
    FROM (
      SELECT "country", COUNT(*) AS cnt
      FROM "Analytics"
      WHERE "country" IS NOT NULL
      GROUP BY "country"
    ) sub
  ) AS countryStats,
  (
    SELECT jsonb_object_agg(device, cnt)
    FROM (
      SELECT "device", COUNT(*) AS cnt
      FROM "Analytics"
      WHERE "device" IS NOT NULL
      GROUP BY "device"
    ) sub
  ) AS deviceStats,
  (
    SELECT jsonb_object_agg(referrer, cnt)
    FROM (
      SELECT "referrer", COUNT(*) AS cnt
      FROM "Analytics"
      WHERE "referrer" IS NOT NULL
      GROUP BY "referrer"
    ) sub
  ) AS referrerStats,
  NOW()
FROM "Analytics"
GROUP BY "shortUrlId", DATE("timestamp")
ON CONFLICT ("shortUrlId", "date")
DO UPDATE SET 
  "totalClicks" = "AggregatedAnalytics"."totalClicks" + EXCLUDED."totalClicks", 
  "uniqueVisitors" = "AggregatedAnalytics"."uniqueVisitors" + EXCLUDED."uniqueVisitors",
  "countryStats" = "AggregatedAnalytics"."countryStats" || EXCLUDED."countryStats",
  "deviceStats" = "AggregatedAnalytics"."deviceStats" || EXCLUDED."deviceStats",
  "referrerStats" = "AggregatedAnalytics"."referrerStats" || EXCLUDED."referrerStats";
 `);

    console.log("✅ Aggregation completed.");
  } catch (error) {
    console.error("❌ Error during analytics aggregation:", error);
  }
}

cron.schedule("*/2 * * * *", async () => {
  console.log("Running daily analytics aggregation...");
  try {
    await aggregateAnalytics();
  } catch (error) {
    console.error("❌ Cron job error:", error);
  }
});
// Explanation of */1 * * * *
// */1 → Every 1 minute  , 0 * * * * -> every oth min of every hour
// * → Every hour
// * → Every day of the month
// * → Every month
// * → Every day of the week

// AggregatedAnalytics.sync({ alter: true }).then(() => {
//   console.log("✅ AggregatedAnalytics table is ready.");
// });
export default AggregatedAnalytics;
