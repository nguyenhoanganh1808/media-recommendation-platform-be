import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from './env';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${
      Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''
    }`;
  })
);

// Define log directory
const logDir = path.join(__dirname, '../../logs');

// Define file transport for production and staging
const fileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

// Define error file transport
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
});

// Configure transports based on environment
const transports = [];

// Add console transport for all environments
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), logFormat),
  })
);

// Add file transports for production and staging
if (config.NODE_ENV !== 'development') {
  transports.push(fileTransport, errorFileTransport);
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
