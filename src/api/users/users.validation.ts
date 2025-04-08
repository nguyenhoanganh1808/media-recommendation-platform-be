import { body, param } from 'express-validator';

export const createUserValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('username')
    .isString()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),

  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string'),

  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string'),

  body('bio')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
];

export const updateUserValidation = [
  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string'),
  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string'),
  body('bio')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('username')
    .optional()
    .isString()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
];

export const userIdValidation = [
  param('id').isUUID().withMessage('Invalid user ID format'),
];

export const followUserValidation = [
  param('id').isUUID().withMessage('Invalid user ID format'),
];

export default {
  createUserValidation,
  updateUserValidation,
  userIdValidation,
  followUserValidation,
};
