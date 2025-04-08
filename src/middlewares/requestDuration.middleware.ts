import { Request, Response, NextFunction } from 'express';

export const requestDurationMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = process.hrtime(); // Get start time

  res.on('finish', () => {
    const duration = process.hrtime(start); // Calculate duration
    const durationMs = (duration[0] * 1e3 + duration[1] / 1e6).toFixed(2); // Convert to milliseconds
    res.setHeader('X-Response-Time', `${durationMs}ms`);
  });

  next();
};
