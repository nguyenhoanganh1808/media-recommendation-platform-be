import express, { Request, Response, Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "./config/passport";

// Import configurations
import { config } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler } from "./middlewares/error.middleware";
import { rateLimiter } from "./middlewares/rateLimiter.middleware";
import { disconnectDB } from "./config/database";
import { disconnectRedis } from "./config/redis";

// Import routes
import authRoutes from "./api/auth/auth.routes";
import userRoutes from "./api/users/users.routes";
import mediaRoutes from "./api/media/media.routes";
import ratingRoutes from "./api/ratings/ratings.routes";
// import reviewRoutes from './api/media/media.routes';
import listRoutes from "./api/lists/lists.routes";
import recommendationRoutes from "./api/recommendations/recommendations.routes";
import notificationRoutes from "./api/notifications/notifications.routes";
import genreRoutes from "./api/genres/genres.routes";
import reviewRoutes from "./api/review/review.routes";

// Initialize Express application
const app: Express = express();

// Middleware
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "cdn.jsdelivr.net",
          "cdnjs.cloudflare.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "cdn.jsdelivr.net",
          "cdnjs.cloudflare.com",
        ],
        imgSrc: ["'self'", "data:", "cdn.jsdelivr.net"],
      },
    },
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Passport middleware
app.use(passport.initialize());

// Rate limiting
if (config.NODE_ENV === "production") {
  app.use(rateLimiter);
}

// Logging
if (config.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );
}

// Swagger documentation
// setupSwaggerRoutes(app);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "success", message: "API is running", data: null });
});

const API_PREFIX = config.API_PREFIX;

// API routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/media`, mediaRoutes);
app.use(`${API_PREFIX}/ratings`, ratingRoutes);
app.use(`${API_PREFIX}/lists`, listRoutes);
app.use(`${API_PREFIX}/recommendations`, recommendationRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/genres`, genreRoutes);
app.use(`${API_PREFIX}/reviews`, reviewRoutes);

// 404 handler
app.all("*", (req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// Global error handler
app.use(errorHandler);

// Handle graceful shutdown
process.on("exit", async () => {
  await disconnectDB();
  logger.info("Disconnected from database");
  await disconnectRedis();
  logger.info("Disconnected from redis");
});

export default app;
