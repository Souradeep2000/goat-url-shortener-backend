import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { cleanupDatabase, setupDatabase } from "./models/Url.js";
import { verifyUser } from "./middlewares/auth.js";
import { createShortUrl, getShortUrl } from "./controllers/urlController.js";
import { flushAllRedisShards } from "./connections/redis_config.js";
import { consumeAnalyticsEvents } from "./connections/kafka.js";
import rateLimiter from "./middlewares/rateLimiting.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

BigInt.prototype.toJSON = function () {
  return this.toString();
};

consumeAnalyticsEvents()
  .then(() => console.log("Kafka Consumer started successfully 🚀"))
  .catch((err) => console.error("Error starting Kafka Consumer ❌:", err));

const connectDB = async () => {
  try {
    await cleanupDatabase();
    await flushAllRedisShards();
    await setupDatabase();
    console.log("✅ Connected to DB");
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

app.post("/api/shorturl", verifyUser, rateLimiter, createShortUrl);
app.get("/:shortUrl", getShortUrl);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
