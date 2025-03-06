import { Kafka } from "kafkajs";
import Analytics from "../models/Analytics.js";

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
      const { shortUrlId, ipAddress, referrer, device, timestamp } = data;

      try {
        await Analytics.create({
          shortUrlId,
          ipAddress,
          referrer,
          device,
          timestamp,
        });
      } catch (error) {
        console.error("❌ Error storing analytics:", error);
      }
    },
  });
};
