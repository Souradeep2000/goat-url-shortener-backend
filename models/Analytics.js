import { DataTypes } from "sequelize";
import { globalSequelize } from "../connections/postgres_config.js";

const Analytics = globalSequelize.define("Analytics", {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  shortUrlId: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING,
  },
  referrer: {
    type: DataTypes.STRING,
  },
  device: {
    type: DataTypes.STRING,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// Analytics.sync({ alter: true }).then(() => {
//   console.log("✅ Analytics table is ready.");
// });

export default Analytics;
