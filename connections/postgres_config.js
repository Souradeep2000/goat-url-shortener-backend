import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const poolConfig = {
  max: 20, // Increase max connections
  min: 5,
  acquire: 30000,
  idle: 10000,
};

const shards = [
  new Sequelize(process.env.DATABASE_URL_SHARD3_SINGAPORE, {
    dialect: "postgres",
    logging: false,
    pool: poolConfig,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }),
  new Sequelize(process.env.DATABASE_URL_SHARD1_EAST_US, {
    dialect: "postgres",
    logging: false,
    pool: poolConfig,
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
    pool: poolConfig,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }),
];

const shardReplicas = [
  [
    new Sequelize(process.env.DATABASE_URL_SHARD3_SINGAPORE_REPLICA_1, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD3_SINGAPORE_REPLICA_2, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD3_SINGAPORE_REPLICA_3, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD3_SINGAPORE_REPLICA_4, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
  ],
  [
    new Sequelize(process.env.DATABASE_URL_SHARD1_EAST_US_REPLICA_1, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD1_EAST_US_REPLICA_2, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD1_EAST_US_REPLICA_3, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD1_EAST_US_REPLICA_4, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
  ],
  [
    new Sequelize(process.env.DATABASE_URL_SHARD2_FRANKFURT_REPLICA_1, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD2_FRANKFURT_REPLICA_2, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD2_FRANKFURT_REPLICA_3, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
    new Sequelize(process.env.DATABASE_URL_SHARD2_FRANKFURT_REPLICA_4, {
      dialect: "postgres",
      logging: false,
      pool: poolConfig,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    }),
  ],
];

const globalSequelize = new Sequelize(process.env.GLOBAL_DATABASE, {
  dialect: "postgres",
  logging: false,
  pool: poolConfig,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

const globalReplicas = [
  new Sequelize(process.env.GLOBAL_DATABASE_REPLICA_1, {
    dialect: "postgres",
    logging: false,
    pool: poolConfig,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  }),
  new Sequelize(process.env.GLOBAL_DATABASE_REPLICA_2, {
    dialect: "postgres",
    logging: false,
    pool: poolConfig,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  }),
  new Sequelize(process.env.GLOBAL_DATABASE_REPLICA_3, {
    dialect: "postgres",
    logging: false,
    pool: poolConfig,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  }),
  new Sequelize(process.env.GLOBAL_DATABASE_REPLICA_4, {
    dialect: "postgres",
    logging: false,
    pool: poolConfig,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  }),
];

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing database...");
  await globalSequelize.close();
  await Promise.all(
    shards.map(async (shard, index) => {
      try {
        await shard.close();
        // console.log(`Shard ${index} closed successfully.`);
      } catch (error) {
        console.error(`Error closing shard ${index}:`, error);
      }
    })
  );
  await Promise.all(
    shardReplicas.flat().map(async (replica, index) => {
      try {
        await replica.close();
        // console.log(`Replica ${index} closed.`);
      } catch (error) {
        console.error(`Error closing replica ${index}:`, error);
      }
    })
  );
  await Promise.all(
    globalReplicas.flat().map(async (replica, index) => {
      try {
        await replica.close();
        // console.log(`Replica ${index} closed.`);
      } catch (error) {
        console.error(`Error closing replica ${index}:`, error);
      }
    })
  );
  process.exit(0);
});

export { shards, globalSequelize, globalReplicas, shardReplicas };
