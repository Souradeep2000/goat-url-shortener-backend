import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { cleanupDatabase, setupDatabase } from "./models/Url.js";
import Analytics from "./models/Analytics.js";
import { verifyUser } from "./middlewares/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const connectDB = async () => {
  try {
    await cleanupDatabase();
    await setupDatabase();
    console.log("✅ Connected to DB");

    // 🔍 Check if Global DB is connected
    // await globalSequelize
    //   .authenticate()
    //   .then(() => console.log("✅ Global DB Connection Verified"))
    //   .catch((err) => console.error("❌ Global DB Connection Error:", err));
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
};

(async () => {
  await connectDB();
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
