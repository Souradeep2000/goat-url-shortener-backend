import { DataTypes } from "sequelize";
import shards from "../db.js";

const Analytics = shards.map((sequelize, index) =>
  sequelize.define("Analytics", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shortUrl: {
      type: DataTypes.STRING,
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
  })
);

export default Analytics;
