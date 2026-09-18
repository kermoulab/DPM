import type { Request, Response, NextFunction } from 'express';
import { BadRequestError } from './error.middleware.js';

export type ValidatorFn = (value: any, fieldName: string) => string | null;

export const v = {
  required(message?: string): ValidatorFn {
    return (val, field) => {
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        return message || `${field} is required.`;
      }
      return null;
    };
  },

  string(options: { min?: number; max?: number; message?: string } = {}): ValidatorFn {
    return (val, field) => {
      if (val === undefined || val === null) return null;
      if (typeof val !== 'string') {
        return options.message || `${field} must be a string.`;
      }
      const trimmed = val.trim();
      if (options.min !== undefined && trimmed.length < options.min) {
        return options.message || `${field} must be at least ${options.min} characters.`;
      }
      if (options.max !== undefined && trimmed.length > options.max) {
        return options.message || `${field} cannot exceed ${options.max} characters.`;
      }
      return null;
    };
  },

  email(message?: string): ValidatorFn {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (val, field) => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val !== 'string' || !emailRegex.test(val.trim())) {
        return message || `Invalid email address format.`;
      }
      return null;
    };
  },

  number(options: { min?: number; max?: number; integer?: boolean; message?: string } = {}): ValidatorFn {
    return (val, field) => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      if (isNaN(num)) {
        return options.message || `${field} must be a valid number.`;
      }
      if (options.integer && !Number.isInteger(num)) {
        return options.message || `${field} must be an integer.`;
      }
      if (options.min !== undefined && num < options.min) {
        return options.message || `${field} must be at least ${options.min}.`;
      }
      if (options.max !== undefined && num > options.max) {
        return options.message || `${field} cannot exceed ${options.max}.`;
      }
      return null;
    };
  },

  enum<T extends string>(allowed: readonly T[], message?: string): ValidatorFn {
    return (val, field) => {
      if (val === undefined || val === null || val === '') return null;
      if (!allowed.includes(val)) {
        return message || `${field} must be one of: ${allowed.join(', ')}.`;
      }
      return null;
    };
  },

  currencyCode(message?: string): ValidatorFn {
    return (val, field) => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val !== 'string' || !/^[A-Za-z]{3}$/.test(val.trim())) {
        return message || `Currency code must be a 3-letter ISO code (e.g. USD, EUR).`;
      }
      return null;
    };
  },

  array(options: { minLength?: number; message?: string } = {}): ValidatorFn {
    return (val, field) => {
      if (val === undefined || val === null) return null;
      if (!Array.isArray(val)) {
        return options.message || `${field} must be an array.`;
      }
      if (options.minLength !== undefined && val.length < options.minLength) {
        return options.message || `${field} must contain at least ${options.minLength} item(s).`;
      }
      return null;
    };
  }
};

export type Schema = Record<string, ValidatorFn | ValidatorFn[]>;

/**
 * Express middleware that validates req.body against a field validation schema.
 * If validation fails, immediately returns HTTP 400 with field-level error messages.
 */
export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      return next(new BadRequestError('Request body must be a valid JSON object.'));
    }

    const errors: Record<string, string> = {};

    for (const [field, rule] of Object.entries(schema)) {
      const val = req.body[field];
      const rules = Array.isArray(rule) ? rule : [rule];

      for (const fn of rules) {
        const err = fn(val, field);
        if (err) {
          errors[field] = err;
          break; // Move to next field after first failure
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      const firstMessage = Object.values(errors)[0];
      return res.status(400).json({
        success: false,
        error: firstMessage,
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
}
