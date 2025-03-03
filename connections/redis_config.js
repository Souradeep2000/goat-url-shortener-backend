import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redisNodes = [
  new Redis(process.env.REDIS_SHARD_MUMBAI),
  new Redis(process.env.REDIS_SHARD_AMERICA),
];

export const redis_rate_limiter = new Redis(
  process.env.REDIS_RATE_LIMITER_MUMBAI
);

const allRedisNodes = [...redisNodes, redis_rate_limiter];

allRedisNodes.forEach((redis, index) => {
  // redis.on("connect", () => {
  //   console.log(`✅ Redis Node ${index + 1} Connected`);
  // });

  // redis.on("ready", () => {
  //   console.log(`🚀 Redis Node ${index + 1} Ready to Use`);
  // });

  redis.on("error", (err) => {
    console.error(`❌ Redis Node ${index + 1} Error:`, err);
  });

  // redis.on("end", () => {
  //   console.warn(`⚠️ Redis Node ${index + 1} Disconnected`);
  // });

  redis.on("reconnecting", () => {
    console.log(`🔄 Redis Node ${index + 1} Reconnecting...`);
  });
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing Redis connections...");

  await Promise.all(
    allRedisNodes.map(async (redisClient, index) => {
      try {
        await redisClient.quit();
        console.log(`Redis shard ${index} closed successfully.`);
      } catch (error) {
        console.error(`Error closing Redis shard ${index}:`, error);
      }
    })
  );

  process.exit(0);
});

export const flushAllRedisShards = async () => {
  try {
    const flushPromises = allRedisNodes.map(async (client, index) => {
      await client.flushall();
    });

    await Promise.all(flushPromises);
    console.log("🎉 All Redis shards cleaned.");
  } catch (err) {
    console.log("redis flush failed ❌");
  }
};
