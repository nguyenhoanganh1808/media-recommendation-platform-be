import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async controller function to handle errors automatically
 * This eliminates the need for try/catch blocks in each controller
 *
 * @param fn The async controller function to wrap
 * @returns A function that handles the async controller and catches any errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
