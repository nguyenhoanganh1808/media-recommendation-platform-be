import { body } from 'express-validator';

/**
 * Validation rules for creating a new list
 */
export const createListValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('List name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('List name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
];

/**
 * Validation rules for updating a list
 */
export const updateListValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('List name cannot be empty')
    .isLength({ min: 1, max: 100 })
    .withMessage('List name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
];

/**
 * Validation rules for adding an item to a list
 */
export const addItemValidation = [
  body('mediaId').trim().notEmpty().withMessage('Media ID is required'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
];

/**
 * Validation rules for updating a list item
 */
export const updateItemValidation = [
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
];

/**
 * Validation rules for reordering list items
 */
export const reorderItemsValidation = [
  body('items')
    .isArray()
    .withMessage('Items must be an array')
    .notEmpty()
    .withMessage('Items array cannot be empty'),
  body('items.*.id').notEmpty().withMessage('Each item must have an ID'),
  body('items.*.order')
    .isInt({ min: 0 })
    .withMessage('Each item must have a valid order number'),
];
