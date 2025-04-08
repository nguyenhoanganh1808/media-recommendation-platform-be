// test/setup.ts
import { connectDB, disconnectDB } from "../src/config/database";
import { connectRedis, disconnectRedis } from "../src/config/redis";

// Set test environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";

beforeAll(async () => {
  // Set up any global configurations (e.g., database connection)
  await connectDB();
  await connectRedis();
});

afterAll(async () => {
  // Clean up any global configurations (e.g., database connection)
  await disconnectDB();
  await disconnectRedis();
});
