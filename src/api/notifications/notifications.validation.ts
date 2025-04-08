import { body, param, query } from 'express-validator';

/**
 * Validation rules for getting notifications
 */
export const getNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('includeRead')
    .optional()
    .isBoolean()
    .toBoolean()
    .withMessage('includeRead must be a boolean value'),
];

/**
 * Validation rules for marking a notification as read
 */
export const markAsReadValidation = [
  param('id').isUUID().withMessage('Invalid notification ID format'),
];

/**
 * Validation rules for deleting a notification
 */
export const deleteNotificationValidation = [
  param('id').isUUID().withMessage('Invalid notification ID format'),
];

/**
 * Validation rules for notification settings
 */
export const updateNotificationSettingsValidation = [
  body('newRecommendation')
    .optional()
    .isBoolean()
    .withMessage('newRecommendation must be a boolean'),
  body('newFollower')
    .optional()
    .isBoolean()
    .withMessage('newFollower must be a boolean'),
  body('newRating')
    .optional()
    .isBoolean()
    .withMessage('newRating must be a boolean'),
  body('newReview')
    .optional()
    .isBoolean()
    .withMessage('newReview must be a boolean'),
  body('listShare')
    .optional()
    .isBoolean()
    .withMessage('listShare must be a boolean'),
  body('systemNotification')
    .optional()
    .isBoolean()
    .withMessage('systemNotification must be a boolean'),
  body('emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('emailNotifications must be a boolean'),
  body('pushNotifications')
    .optional()
    .isBoolean()
    .withMessage('pushNotifications must be a boolean'),
];
