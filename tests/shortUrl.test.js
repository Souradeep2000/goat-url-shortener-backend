import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";

beforeAll(async () => {
  jest.setTimeout(10000);
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

describe("Short URL API Tests", () => {
  let testShortUrl = "test123";
  let testRegion = "asia";
  let testLongUrl = "https://example.com";
  let userId = "user-123";

  test("Should create a short URL", async () => {
    const res = await request(app).post("/api/shorturl").send({
      shortUrl: testShortUrl,
      longUrl: testLongUrl,
      userId: userId,
      region: testRegion,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shortUrl).toBe(testShortUrl);
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

// afterAll(async () => {
//   await flushAllShards();

// });
