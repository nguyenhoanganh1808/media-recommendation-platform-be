import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { AppError } from './error.middleware';

// Middleware to validate request data
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Execute all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format the validation errors
    const extractedErrors = errors.array().reduce(
      (acc, err) => {
        // Check if err has a path property (express-validator v6+)
        if (err.type === 'field') {
          acc[err.path] = err.msg;
        } else if ('param' in err) {
          // Fallback for older express-validator versions
          acc[err.param as any] = err.msg;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    // Return validation error response
    return next(
      new AppError(
        'Validation failed. Please check your input.',
        400,
        'VALIDATION_ERROR',
        extractedErrors
      )
    );
  };
};

// Middleware to sanitize request data
export const sanitize = (req: Request, res: Response, next: NextFunction) => {
  // Remove any sensitive fields that should never be passed in
  const sensitiveFields = ['password', 'passwordConfirm', 'token'];

  if (req.body) {
    sensitiveFields.forEach((field) => {
      if (
        req.body[field] &&
        field !== 'password' &&
        field !== 'passwordConfirm'
      ) {
        delete req.body[field];
      }
    });
  }

  next();
};

// Middleware to validate content type
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('Content-Type');

    if (
      !contentType ||
      !allowedTypes.some((type) => contentType.includes(type))
    ) {
      return next(
        new AppError(
          `Unsupported Content-Type. Supported types: ${allowedTypes.join(', ')}`,
          415
        )
      );
    }

    next();
  };
};

// Middleware to validate query parameters
export const validateQueryParams = (allowedParams: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const queryParams = Object.keys(req.query);

    const invalidParams = queryParams.filter(
      (param) => !allowedParams.includes(param)
    );

    if (invalidParams.length > 0) {
      return next(
        new AppError(
          `Invalid query parameters: ${invalidParams.join(', ')}. Allowed parameters: ${allowedParams.join(', ')}`,
          400
        )
      );
    }

    next();
  };
};
