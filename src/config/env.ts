import dotenv from "dotenv";
import path from "path";

// Load environment variables from the .env file
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Validate required environment variables
const requiredEnvVars = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is required`);
  }
});

// Environment configuration
export const config = {
  // Node environment
  NODE_ENV: process.env.NODE_ENV,
  SERVER_URL: process.env.SERVER_URL || "http://localhost:3000",

  // Server configuration
  PORT: parseInt(process.env.PORT || "3000", 10),
  HTTPS_PORT: parseInt(process.env.HTTPS_PORT || "3443", 10),
  API_PREFIX: process.env.API_PREFIX || "/api",
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : "*",

  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL,

  // Redis configuration
  REDIS_URL: process.env.REDIS_URL,
  REDIS_TTL: parseInt(process.env.REDIS_TTL || "3600", 10), // Default: 1 hour

  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || "900000",
    10,
  ), // Default: 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // Default: 100 requests per window

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Media API keys for external services
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  RAWG_API_KEY: process.env.RAWG_API_KEY,

  // Email configuration (for notifications)
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,

  // File upload configuration
  UPLOAD_DIRECTORY: process.env.UPLOAD_DIRECTORY || "uploads",
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || "5000000", 10), // Default: 5MB

  // Recommendation engine configuration
  RECOMMENDATION_BATCH_SIZE: parseInt(
    process.env.RECOMMENDATION_BATCH_SIZE || "100",
    10,
  ),
  RECOMMENDATION_UPDATE_INTERVAL:
    process.env.RECOMMENDATION_UPDATE_INTERVAL || "0 */6 * * *", // Default: every 6 hours

  TZ: process.env.TZ || "UTC",
};

export type Env = "development" | "test" | "production";

export const isEnv = (env: Env): boolean => config.NODE_ENV === env;
