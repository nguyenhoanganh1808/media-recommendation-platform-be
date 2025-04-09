import https from "https";
import app from "./app";
import { logger } from "./config/logger";
import { config } from "./config/env";
import { connectDB } from "./config/database";
import { connectRedis } from "./config/redis";
import { initializeJobs } from "./jobs";
import { initializeSocket } from "./config/socket";
import fs from "fs";
import path from "path";
import http from "http";

const PORT = config.PORT;
const HTTPS_PORT = config.HTTPS_PORT;

async function startServer() {
  try {
    // Initialize database and Redis connections first
    await connectDB();
    await connectRedis();

    // Initialize jobs
    initializeJobs();

    // Create HTTP server (for redirects to HTTPS)
    if (config.NODE_ENV === "production") {
      http.createServer(app).listen(PORT, () => {
        logger.info(`HTTP server running on port ${PORT} (redirects to HTTPS)`);
      });
    }

    // Create HTTPS server
    const httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, "../cert/key.pem")), // Go up from `src` to root
      cert: fs.readFileSync(path.join(__dirname, "../cert/cert.pem")),
    };

    const server = https
      .createServer(httpsOptions, app)
      .listen(HTTPS_PORT, () => {
        logger.info(
          `HTTPS server running on port ${HTTPS_PORT} in ${config.NODE_ENV} mode`,
        );
        logger.info(
          `🔗 API Documentation available at https://localhost:${HTTPS_PORT}/docs`,
        );
      });

    // Initialize Socket.io
    initializeSocket(server);

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err: Error) => {
      logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
      logger.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (err: Error) => {
      logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
      logger.error(err.name, err.message);
      process.exit(1);
    });

    // Handle SIGTERM signal
    process.on("SIGTERM", () => {
      logger.info("👋 SIGTERM RECEIVED. Shutting down gracefully");
      server.close(() => {
        logger.info("💥 Process terminated!");
      });
    });

    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
const server = startServer();

export default server;
