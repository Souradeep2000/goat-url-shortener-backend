import { DataTypes } from "sequelize";
import { globalSequelize } from "../connections/postgres_config";

const Analytics = globalSequelize.define("Analytics", {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  shortUrlId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: "Urls",
      key: "id",
    },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
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

export default Analytics;
