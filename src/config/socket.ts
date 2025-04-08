// src/config/socket.ts
import { Server as SocketServer } from "socket.io";
import http from "http";
import { logger } from "./logger";
import { verifyToken } from "../utils/jwt";
import { prisma } from "./database";
import { config } from "./env";

let io: SocketServer;

export function initializeSocket(server: http.Server) {
  io = new SocketServer(server, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error("Invalid token"));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user to socket
      socket.data.user = { id: user.id, username: user.username };
      next();
    } catch (error) {
      logger.error(`Socket authentication error: ${error}`);
      next(new Error("Authentication error"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    const username = socket.data.user.username;

    logger.info(`User connected: ${username} (${userId})`);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Send welcome event
    socket.emit("welcome", { message: "Connected to real-time server" });

    // Handle disconnection
    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${username} (${userId})`);
    });
  });

  logger.info("Socket.IO server initialized");
  return io;
}

export function getSocketIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}
