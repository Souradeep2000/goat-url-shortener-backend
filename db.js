import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const shards = [
  new Sequelize(process.env.DATABASE_URL_SHARD1_EAST_US, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }),
  new Sequelize(process.env.DATABASE_URL_SHARD2_FRANKFURT, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }),
];

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing database...");
  await Promise.all(
    shards.map(async (shard, index) => {
      try {
        await shard.close();
        console.log(`Shard ${index} closed successfully.`);
      } catch (error) {
        console.error(`Error closing shard ${index}:`, error);
      }
    })
  );
  process.exit(0);
});

export default shards;
