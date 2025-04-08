import { Request, Response, NextFunction } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { sendError } from '../utils/responseFormatter';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  errorCode?: string;
  details?: Record<string, string>;

  constructor(
    message: string,
    statusCode: number,
    errorCode?: string,
    details?: Record<string, string>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errorCode = errorCode;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle Prisma errors
const handlePrismaKnownRequestError = (err: PrismaClientKnownRequestError) => {
  let message = 'Database error occurred';
  let statusCode = 500;
  let code = 'DATABASE_ERROR';

  switch (err.code) {
    case 'P2002':
      const field = (err.meta?.target as string[]) || ['field'];
      message = `Duplicate value for ${field.join(', ')}. Please use another value.`;
      statusCode = 409;
      code = 'DUPLICATE_ENTRY';
      break;
    case 'P2025':
      message = 'Record not found';
      statusCode = 404;
      code = 'NOT_FOUND';
      break;
    case 'P2003':
      message = 'Related record not found';
      statusCode = 400;
      code = 'FOREIGN_KEY_CONSTRAINT';
      break;
  }

  return new AppError(message, statusCode);
};

// Handle Prisma validation errors
const handlePrismaValidationError = (err: PrismaClientValidationError) => {
  return new AppError('Invalid input data', 400);
};

// Handle JWT errors
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

// Handle JWT expired error
const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again.', 401);

// Error handler middleware
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = err;
  if (!(error instanceof Error)) {
    error = new AppError('An unknown error occurred', 500);
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  let message = error.message;
  let errorCode =
    error instanceof AppError ? error.errorCode : 'INTERNAL_ERROR';
  let details = error instanceof AppError ? error.details : undefined;

  // Handle specific errors
  if (error instanceof PrismaClientKnownRequestError) {
    error = handlePrismaKnownRequestError(error);
  }
  if (error instanceof PrismaClientValidationError) {
    error = handlePrismaValidationError(error);
  }
  if (error.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (error.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Logging
  logger.error({
    statusCode: error instanceof AppError ? error.statusCode : 500,
    message: error.message,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    stack: config.NODE_ENV === 'development' ? error.stack : undefined, // Hide stack trace in production
    details,
  });

  // Development error response - with stack trace
  if (config.NODE_ENV === 'development') {
    sendError(
      res,
      error.message,
      error.statusCode,
      error.code,
      error.stack,
      details
    );
    return;
  }

  // Production error response - without sensitive error details
  // Don't leak operational details for security reasons
  if (error instanceof AppError && error.isOperational) {
    sendError(res, message, error.statusCode, errorCode, undefined, details);
    return;
  }

  // Generic error message for non-operational errors in production
  sendError(res, 'Something went wrong', 500, 'INTERNAL_ERROR');
};
