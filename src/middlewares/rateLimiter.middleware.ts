import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { config } from '../config/env';

// Default rate limiter for general API endpoints
export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS, // Default: 15 minutes
  max: config.RATE_LIMIT_MAX, // Default: 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
  },
  // Use Redis as store if available
  store: redisClient.isReady
    ? new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'ratelimit:',
      })
    : undefined,
});

// Stricter rate limiter for sensitive endpoints (auth, user creation, etc.)
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message:
      'Too many authentication attempts from this IP, please try again later.',
  },
  store: redisClient.isReady
    ? new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'authratelimit:',
      })
    : undefined,
});

// API key rate limiter (for external integrations)
export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use API key from headers or query parameters
    return (req.headers['x-api-key'] as string) || (req.query.apiKey as string);
  },
  message: {
    status: 'error',
    message: 'API rate limit exceeded, please slow down your requests.',
  },
  store: redisClient.isReady
    ? new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'apikeyratelimit:',
      })
    : undefined,
  skip: (req: Request) => !req.headers['x-api-key'] && !req.query.apiKey, // Skip if no API key
});

// Create dynamic rate limiter by user ID (when authenticated)
export const userRateLimiter = (
  maxRequests: number = 50,
  windowMs: number = 60 * 1000 // 1 minute
) => {
  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use user ID as the rate limiting key if authenticated
      return (req.user as any).id || req.ip || '';
    },
    message: {
      status: 'error',
      message: 'Too many requests, please try again later.',
    },
    store: redisClient.isReady
      ? new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: 'userratelimit:',
        })
      : undefined,
  });

  return limiter;
};

// Create IP-based rate limiter for specific routes
export const createIpRateLimiter = (
  maxRequests: number,
  windowMs: number,
  prefix: string = 'ip'
) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many requests from this IP, please try again later.',
    },
    store: redisClient.isReady
      ? new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: `${prefix}ratelimit:`,
        })
      : undefined,
  });
};
