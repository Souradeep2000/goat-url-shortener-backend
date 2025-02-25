import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Url = sequelize.define("Url", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shortUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  longUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clicks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

export default Url;
