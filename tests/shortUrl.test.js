// Mock Firebase Admin before importing anything
jest.mock("firebase-admin", () => ({
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: "mockedUserId" }),
  }),
}));

import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";

// Import Firebase Admin after mocking
import admin from "firebase-admin";

// Mock Redis rate limiter
import { redis_rate_limiter } from "../connections/redis_config.js";
jest.spyOn(redis_rate_limiter, "get").mockResolvedValue(null);
jest.spyOn(redis_rate_limiter, "setex").mockResolvedValue(null);
jest.spyOn(redis_rate_limiter, "decr").mockResolvedValue(1);

beforeAll(async () => {
  jest.setTimeout(10000);
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

describe("Short URL API Tests", () => {
  let testShortUrl = "test123";
  let testRegion = "asia";
  let testLongUrl = "https://example.com";
  let userId = "user-123";
  let validToken = "valid-firebase-token";

  test("Should create a short URL (Authenticated User)", async () => {
    // Override the mock for this test
    admin.auth().verifyIdToken.mockResolvedValue({ uid: userId });

    const res = await request(app)
      .post("/api/shorturl")
      .set("Authorization", `Bearer ${validToken}`) // Set Firebase token
      .send({
        shortUrl: testShortUrl,
        longUrl: testLongUrl,
        region: testRegion,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shortUrl).toBe(testShortUrl);
  });

  test("Should create a short URL (Unauthenticated User)", async () => {
    const res = await request(app)
      .post("/api/shorturl") // No auth token
      .send({
        shortUrl: testShortUrl,
        longUrl: testLongUrl,
        region: testRegion,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shortUrl).toBe(testShortUrl);
  });

  test("Should enforce rate limiting (Exceeded limit for Unauthenticated User)", async () => {
    jest.spyOn(redis_rate_limiter, "get").mockResolvedValue("0"); // Simulate limit exceeded

    const res = await request(app)
      .post("/api/shorturl") // No auth token
      .send({
        shortUrl: testShortUrl,
        longUrl: testLongUrl,
        region: testRegion,
      });

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe("Rate limit exceeded. Try later.");
  });

  test("Should retrieve the short URL details", async () => {
    const res = await request(app).get(
      `/api/shorturl/${testRegion}/${testShortUrl}`
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.longUrl).toBe(testLongUrl);
  });

  test("Should return 404 for a non-existing short URL", async () => {
    const res = await request(app).get(
      `/api/shorturl/${testRegion}/nonexistent123`
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
