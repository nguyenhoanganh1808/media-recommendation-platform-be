import { Response } from "express";

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    stack?: string;

    // statusCode: number;
    details?: any;
  };
  meta?: {
    pagination?: {
      currentPage: number;
      itemsPerPage: number;
      totalItems: number;
      totalPages: number;
    };
    [key: string]: any;
  };
}

/**
 * Send a success response
 *
 * @param res Express response object
 * @param data Data to include in the response
 * @param message Success message
 * @param statusCode HTTP status code (default: 200)
 * @param meta Additional metadata
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Operation successful",
  statusCode = 200,
  meta?: ApiResponse<T>["meta"]
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
};

/**
 * Send an error response
 *
 * @param res Express response object
 * @param message Error message
 * @param statusCode HTTP status code (default: 400)
 * @param errorCode Error code
 * @param details Error details
 */
export const sendError = (
  res: Response,
  message = "Operation failed",
  statusCode = 400,
  errorCode = "BAD_REQUEST",
  stack?: any,
  details?: Record<string, string>
): void => {
  const response: ApiResponse<null> = {
    success: false,
    message,
    error: {
      code: errorCode,
      details,
    },
  };

  if (details) {
    response.error!.stack = stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Create pagination metadata
 *
 * @param page Current page
 * @param limit Items per page
 * @param total Total number of items
 * @returns Pagination metadata
 */
export const createPagination = (
  page: number,
  limit: number,
  total: number
): ApiResponse<any>["meta"] => {
  const totalPages = Math.ceil(total / limit);

  return {
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalItems: total,
      totalPages,
    },
  };
};

export default {
  sendSuccess,
  sendError,
  createPagination,
};
