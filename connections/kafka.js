import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "url-shortener",
  brokers: ["localhost:9092"], // Ensure Kafka is running on this port
});

const producer = kafka.producer();
await producer.connect();

export const sendAnalyticsEvent = async (analyticsData) => {
  await producer.send({
    topic: "analytics-events",
    messages: [{ value: JSON.stringify(analyticsData) }],
  });
  //   await producer.disconnect();
};

const consumer = kafka.consumer({ groupId: "analytics-group" });

export const consumeAnalyticsEvents = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "analytics-events", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value.toString());
      const { shardIdx, shortUrl, ipAddress, referrer, device, timestamp } =
        data;

      if (
        shardIdx === undefined ||
        shardIdx < 0 ||
        shardIdx >= Analytics.length
      ) {
        console.error("❌ Invalid shardIdx:", shardIdx);
        return;
      }

      try {
        await Analytics[shardIdx].create({
          shortUrl,
          ipAddress,
          referrer,
          device,
          timestamp,
        });

        console.log(`✅ Stored analytics in Shard ${shardIdx}`);
      } catch (error) {
        console.error("❌ Error storing analytics:", error);
      }
    },
  });
};
