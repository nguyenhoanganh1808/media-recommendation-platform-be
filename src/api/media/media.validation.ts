// media.validation.ts
import { body, param, query } from 'express-validator';
import { MediaType, MediaStatus } from '@prisma/client';

export const getAllMediaValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('type').optional().isIn(Object.values(MediaType)),
  query('genre').optional().isString(),
  query('search').optional().isString(),
  query('sortBy')
    .optional()
    .isIn(['popularity', 'releaseDate', 'averageRating', 'title']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

export const getMediaByIdValidation = [
  param('id').isUUID().withMessage('Invalid media ID'),
];

export const createMediaValidation = [
  body('title').isString().notEmpty().withMessage('Title is required'),
  body('description').optional().isString(),
  body('releaseDate').optional().isISO8601().toDate(),
  body('mediaType')
    .isIn(Object.values(MediaType))
    .withMessage('Invalid media type'),
  body('status').optional().isIn(Object.values(MediaStatus)),
  body('coverImage')
    .optional()
    .isURL()
    .withMessage('Cover image must be a valid URL'),
  body('backdropImage')
    .optional()
    .isURL()
    .withMessage('Backdrop image must be a valid URL'),

  // Conditional validations based on media type
  body('duration')
    .if(body('mediaType').equals('MOVIE'))
    .isInt({ min: 1 })
    .withMessage('Duration must be positive'),
  body('director').if(body('mediaType').equals('MOVIE')).isString(),

  body('developer').if(body('mediaType').equals('GAME')).isString(),
  body('publisher').if(body('mediaType').equals('GAME')).isString(),
  body('platforms').if(body('mediaType').equals('GAME')).isArray(),

  body('author').if(body('mediaType').equals('MANGA')).isString(),
  body('artist').if(body('mediaType').equals('MANGA')).isString(),
  body('volumeCount')
    .if(body('mediaType').equals('MANGA'))
    .optional()
    .isInt({ min: 0 }),
  body('isCompleted')
    .if(body('mediaType').equals('MANGA'))
    .optional()
    .isBoolean(),

  // Genres validation
  body('genres')
    .optional()
    .isArray()
    .withMessage('Genres must be an array of IDs'),
];

export const updateMediaValidation = [
  body('title').optional().isString().withMessage('Title must be a string'),
  body('description').optional().isString(),
  body('releaseDate').optional().isISO8601().toDate(),
  body('mediaType')
    .optional()
    .isIn(Object.values(MediaType))
    .withMessage('Invalid media type'),
  body('status')
    .optional()
    .isIn(Object.values(MediaStatus))
    .withMessage('Invalid media status'),
  body('coverImage')
    .optional()
    .isURL()
    .withMessage('Cover image must be a valid URL'),
  body('backdropImage')
    .optional()
    .isURL()
    .withMessage('Backdrop image must be a valid URL'),

  // Conditional validations based on media type (all optional)
  body('duration')
    .optional()
    .if(body('mediaType').equals('MOVIE'))
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('director').optional().if(body('mediaType').equals('MOVIE')).isString(),

  body('developer').optional().if(body('mediaType').equals('GAME')).isString(),
  body('publisher').optional().if(body('mediaType').equals('GAME')).isString(),
  body('platforms').optional().if(body('mediaType').equals('GAME')).isArray(),

  body('author').optional().if(body('mediaType').equals('MANGA')).isString(),
  body('artist').optional().if(body('mediaType').equals('MANGA')).isString(),
  body('volumeCount')
    .optional()
    .if(body('mediaType').equals('MANGA'))
    .isInt({ min: 0 })
    .withMessage('Volume count must be a non-negative integer'),
  body('isCompleted')
    .optional()
    .if(body('mediaType').equals('MANGA'))
    .isBoolean()
    .withMessage('isCompleted must be a boolean'),

  // Genres validation
  body('genres')
    .optional()
    .isArray()
    .withMessage('Genres must be an array of IDs'),
];

export const deleteMediaValidation = [
  param('id').isUUID().withMessage('Invalid media ID'),
];
