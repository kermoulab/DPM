import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: any) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request', details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: any) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: any) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

/**
 * Centralized Express Error Handling Middleware.
 * Catches all errors from async route handlers, maps PostgreSQL codes,
 * and ensures no stack traces or database internals leak in production.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || undefined;

  // Handle PostgreSQL specific error codes
  if (err.code === '23505') {
    // Unique violation
    statusCode = 409;
    code = 'UNIQUE_VIOLATION';
    message = 'A record with this unique identifier or value already exists.';
    if (err.detail) {
      details = { detail: err.detail };
    }
  } else if (err.code === '23503') {
    // Foreign key violation
    statusCode = 409;
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'Cannot complete operation: referenced resource does not exist or is currently in use.';
    if (err.detail) {
      details = { detail: err.detail };
    }
  } else if (err.code === '23514') {
    // Check constraint violation
    statusCode = 400;
    code = 'CHECK_VIOLATION';
    message = 'Data constraint validation failed.';
  } else if (err.code === '22P02') {
    // Invalid text representation / syntax
    statusCode = 400;
    code = 'INVALID_INPUT_SYNTAX';
    message = 'Invalid data format provided for one or more fields.';
  } else if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === '08006') {
    // Connection failure
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Database service is temporarily unavailable. Please try again shortly.';
  }

  // Log error details appropriately
  if (!config.isProduction) {
    console.error(`[API Error] ${req.method} ${req.originalUrl} (${statusCode} ${code}):`, err);
  } else if (statusCode >= 500) {
    console.error(`[API Error] ${req.method} ${req.originalUrl} (${statusCode} ${code}):`, err.message);
  }

  // Build sanitized client response
  const response: Record<string, any> = {
    success: false,
    error: statusCode >= 500 && config.isProduction ? 'An unexpected server error occurred.' : message,
    code
  };

  if (details !== undefined) {
    response.details = details;
  }

  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
