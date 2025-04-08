import { NextFunction, Request, Response } from 'express';
import * as listController from '../../src/api/lists/lists.controller';
import * as listService from '../../src/api/lists/lists.service';
import { sendSuccess } from '../../src/utils/responseFormatter';
import { AppError } from '../../src/middlewares/error.middleware';
import { prisma } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/api/lists/lists.service');
jest.mock('../../src/utils/responseFormatter');
jest.mock('../../src/middlewares/error.middleware');
jest.mock('../../src/config/database');

describe('Lists Controller Unit Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const mockSendSuccess = sendSuccess as jest.Mock;
  const mockListService = listService as jest.Mocked<typeof listService>;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user-123',
        role: 'USER',
        email: 'Bx4iA@example.com',
        username: 'testuser',
        isActive: true,
      },
      params: {},
      query: {},
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('getUserLists', () => {
    it('should get lists for authenticated user with default pagination', async () => {
      // Arrange
      const mockLists = [{ id: 'list-1', name: 'My List' }];
      const mockPagination = { page: 1, totalPages: 1 };
      mockListService.getListByUser.mockResolvedValue([
        mockLists,
        mockPagination,
      ]);

      // Act
      await listController.getUserLists(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.getListByUser).toHaveBeenCalledWith(
        'user-123',
        1,
        0,
        10
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockLists,
        'Lists retrieved successfully',
        200,
        mockPagination
      );
    });

    it('should use custom pagination when provided', async () => {
      // Arrange
      mockRequest.query = { page: '2', limit: '5' };
      const mockLists = [{ id: 'list-1', name: 'My List' }];
      const mockPagination = { page: 2, totalPages: 3 };
      mockListService.getListByUser.mockResolvedValue([
        mockLists,
        mockPagination,
      ]);

      // Act
      await listController.getUserLists(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.getListByUser).toHaveBeenCalledWith(
        'user-123',
        2,
        5,
        5
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockLists,
        'Lists retrieved successfully',
        200,
        mockPagination
      );
    });
  });

  describe('getListById', () => {
    it('should get a specific list by ID', async () => {
      // Arrange
      mockRequest.params = { id: 'list-123' };

      const mockList = {
        id: 'list-123',
        name: 'Test List',
        userId: 'user-123',
        description: 'A test list',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockListService.getListById.mockResolvedValue(mockList);

      // Act
      await listController.getListById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.getListById).toHaveBeenCalledWith(
        'list-123',
        'user-123'
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockList,
        'List retrieved successfully'
      );
    });
  });

  describe('createList', () => {
    it('should create a new list with provided data', async () => {
      // Arrange
      mockRequest.body = {
        name: 'New List',
        description: 'Description',
        isPublic: true,
      };
      const mockNewList = {
        id: 'list-new',
        name: 'New List',
        description: 'Description',
        isPublic: true,
        userId: 'user-123',

        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockListService.createList.mockResolvedValue(mockNewList);

      // Act
      await listController.createList(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.createList).toHaveBeenCalledWith(
        'user-123',
        'New List',
        'Description',
        true
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockNewList,
        'List created successfully',
        201
      );
    });
  });

  describe('updateList', () => {
    it('should update a list with provided data', async () => {
      // Arrange
      mockRequest.params = { id: 'list-123' };
      mockRequest.body = {
        name: 'Updated List',
        description: 'New description',
        isPublic: false,
      };
      const mockUpdatedList = {
        id: 'list-123',
        name: 'Updated List',
        description: 'New description',
        isPublic: false,
        userId: 'user-123', // <-- Required field

        createdAt: new Date(), // <-- Required field
        updatedAt: new Date(), // <-- Required field
      };
      mockListService.updateList.mockResolvedValue(mockUpdatedList);

      // Act
      await listController.updateList(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.updateList).toHaveBeenCalledWith('list-123', {
        name: 'Updated List',
        description: 'New description',
        isPublic: false,
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockUpdatedList,
        'List updated successfully'
      );
    });
  });

  describe('addItemToList', () => {
    it('should add an item to a list', async () => {
      // Arrange
      mockRequest.params = { listId: 'list-123' };
      mockRequest.body = { mediaId: 'media-456', notes: 'Great movie' };
      const mockListItem = {
        id: 'item-1',
        listId: 'list-123',
        mediaId: 'media-456',
        notes: 'Great movie',
        createdAt: new Date(),
        updatedAt: new Date(),
        order: 1,
      };
      mockListService.addItemToList.mockResolvedValue(mockListItem);

      // Act
      await listController.addItemToList(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.addItemToList).toHaveBeenCalledWith(
        'list-123',
        'media-456',
        'Great movie'
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockListItem,
        'Item added to list successfully',
        201
      );
    });
  });

  describe('updateListItem', () => {
    it('should update a list item', async () => {
      // Arrange
      mockRequest.params = { itemId: 'item-123' };
      mockRequest.body = { notes: 'Updated notes' };
      const mockUpdatedItem = {
        id: 'item-123',
        notes: 'Updated notes',
        createdAt: new Date(),
        updatedAt: new Date(),
        media: { title: 'Example Media' },
        listId: 'list-123',
        mediaId: 'media-123',
        order: 1,
      };
      mockListService.updateListItem.mockResolvedValue(mockUpdatedItem);

      // Act
      await listController.updateListItem(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.updateListItem).toHaveBeenCalledWith(
        'item-123',
        'Updated notes',
        mockRequest.user
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockUpdatedItem,
        'List item updated successfully'
      );
    });
  });

  describe('reorderListItems', () => {
    it('should reorder list items', async () => {
      // Arrange
      mockRequest.params = { listId: 'list-123' };
      mockRequest.body = {
        items: [
          { id: 'item-1', order: 0 },
          { id: 'item-2', order: 1 },
        ],
      };
      const mockUpdatedItems = [
        {
          id: 'item-1',
          order: 0,
          media: { title: 'Example Media' }, // ✅ Required field
          listId: 'list-123', // ✅ Required field
          mediaId: 'media-123', // ✅ Required field
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: 'Updated notes',
        },
        {
          id: 'item-2',
          order: 1,
          media: { title: 'Example Media' }, // ✅ Required field
          listId: 'list-123', // ✅ Required field
          mediaId: 'media-123', // ✅ Required field
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: 'Updated notes',
        },
      ];
      mockListService.reorderListItems.mockResolvedValue(mockUpdatedItems);

      // Act
      await listController.reorderListItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.reorderListItems).toHaveBeenCalledWith(
        'list-123',
        [
          { id: 'item-1', order: 0 },
          { id: 'item-2', order: 1 },
        ]
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockUpdatedItems,
        'List items reordered successfully'
      );
    });
  });

  describe('getUserPublicLists', () => {
    it('should get public lists for a specific user', async () => {
      // Arrange
      mockRequest.params = { userId: 'user-456' };
      const mockLists = [{ id: 'list-1', name: 'Public List', isPublic: true }];
      const mockPagination = { page: 1, totalPages: 1 };
      mockListService.getUserPublicLists.mockResolvedValue([
        mockLists,
        mockPagination,
      ]);

      // Act
      await listController.getUserPublicLists(
        mockRequest as Request,
        mockResponse as Response,
        mockNext as NextFunction
      );

      // Assert
      expect(mockListService.getUserPublicLists).toHaveBeenCalledWith(
        'user-456',
        1,
        0,
        10
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockLists,
        'Public lists retrieved successfully',
        200,
        mockPagination
      );
    });
  });
});
