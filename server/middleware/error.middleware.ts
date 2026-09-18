import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (!config.isProduction) {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
  } else if (statusCode >= 500) {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 && config.isProduction ? 'An unexpected server error occurred.' : message,
    code: err.code || 'INTERNAL_ERROR',
    ...(config.isProduction ? {} : { stack: err.stack })
  });
}
