import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sequelize from "./db.js";
import morgan from "morgan";
import { setupDatabase, cleanupDatabase } from "./models/Url.js";
import Analytics from "./models/Analytics.js";
import { verifyUser } from "./middlewares/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to DB");

    // await cleanupDatabase();
    // await setupDatabase();
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
};

const syncDB = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log("✅ Database synced successfully");
  } catch (error) {
    console.error("❌ Database sync error:", error);
  }
};

(async () => {
  await connectDB();
  await syncDB();
})();

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("URL Shortener Backend is Running!");
});
app.get("/protected-route", verifyUser, (req, res) => {
  res.json({ message: "You are logged in!", user: req.user });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
