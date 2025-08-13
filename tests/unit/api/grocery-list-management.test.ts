/**
 * Unit Tests for Grocery List Management API
 * Tests CRUD operations for grocery lists, items, and sharing functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/api/app.js';
import { ListManagementService } from '../../../src/api/services/ListManagementService.js';
import type { GroceryList, GroceryItem } from '../../../src/types/walmart-grocery.js';

// Mock the List Management Service
vi.mock('../../../src/api/services/ListManagementService.js');

describe('Grocery List Management API', () => {
  let mockListService: any;
  const mockUserId = 'user-123';
  const mockListId = 'list-456';

  const mockGroceryList: GroceryList = {
    id: mockListId,
    name: 'Weekly Groceries',
    description: 'My weekly shopping list',
    user_id: mockUserId,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    is_shared: false,
    due_date: new Date('2024-01-07'),
    items: []
  };

  const mockGroceryItems: GroceryItem[] = [
    {
      id: 'item-1',
      list_id: mockListId,
      product_id: 'prod-1',
      name: 'Organic Milk',
      quantity: 2,
      unit: 'gallon',
      price: 4.99,
      category: 'Dairy',
      is_purchased: false,
      notes: 'Whole milk preferred',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01')
    },
    {
      id: 'item-2',
      list_id: mockListId,
      product_id: 'prod-2',
      name: 'Whole Grain Bread',
      quantity: 1,
      unit: 'loaf',
      price: 5.49,
      category: 'Bakery',
      is_purchased: true,
      notes: '',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-02')
    }
  ];

  beforeEach(() => {
    mockListService = {
      createList: vi.fn(),
      getLists: vi.fn(),
      getListById: vi.fn(),
      updateList: vi.fn(),
      deleteList: vi.fn(),
      addItem: vi.fn(),
      getItems: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      shareList: vi.fn(),
      unshareList: vi.fn(),
      getSharedLists: vi.fn(),
      duplicateList: vi.fn(),
      clearPurchasedItems: vi.fn()
    };
    
    (ListManagementService as any).mockImplementation(() => mockListService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/walmart/lists', () => {
    it('should create a new grocery list', async () => {
      const newList = {
        name: 'New Shopping List',
        description: 'My new list',
        due_date: '2024-02-01'
      };

      mockListService.createList.mockResolvedValue({
        ...mockGroceryList,
        ...newList,
        id: 'new-list-id'
      });

      const response = await request(app)
        .post('/api/walmart/lists')
        .set('Authorization', `Bearer mock-token`)
        .send(newList);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(newList.name);
      expect(response.body.description).toBe(newList.description);
      expect(mockListService.createList).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining(newList)
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/walmart/lists')
        .set('Authorization', `Bearer mock-token`)
        .send({}); // Missing name

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name is required');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/walmart/lists')
        .send({ name: 'Test List' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/walmart/lists', () => {
    it('should get user\'s grocery lists', async () => {
      mockListService.getLists.mockResolvedValue([
        mockGroceryList,
        { ...mockGroceryList, id: 'list-2', name: 'Weekend List' }
      ]);

      const response = await request(app)
        .get('/api/walmart/lists')
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(response.body.lists).toHaveLength(2);
      expect(response.body.lists[0].name).toBe('Weekly Groceries');
    });

    it('should support pagination', async () => {
      mockListService.getLists.mockResolvedValue([mockGroceryList]);

      const response = await request(app)
        .get('/api/walmart/lists')
        .query({ limit: 10, offset: 0 })
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(mockListService.getLists).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ limit: 10, offset: 0 })
      );
    });

    it('should filter by due date', async () => {
      mockListService.getLists.mockResolvedValue([mockGroceryList]);

      const response = await request(app)
        .get('/api/walmart/lists')
        .query({ dueBefore: '2024-01-10' })
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(mockListService.getLists).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ dueBefore: new Date('2024-01-10') })
      );
    });
  });

  describe('GET /api/walmart/lists/:id', () => {
    it('should get grocery list by ID', async () => {
      mockListService.getListById.mockResolvedValue({
        ...mockGroceryList,
        items: mockGroceryItems
      });

      const response = await request(app)
        .get(`/api/walmart/lists/${mockListId}`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(mockListId);
      expect(response.body.items).toHaveLength(2);
    });

    it('should return 404 for non-existent list', async () => {
      mockListService.getListById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/walmart/lists/non-existent')
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('List not found');
    });

    it('should not allow access to other user\'s private lists', async () => {
      mockListService.getListById.mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .get(`/api/walmart/lists/${mockListId}`)
        .set('Authorization', `Bearer other-user-token`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('PUT /api/walmart/lists/:id', () => {
    it('should update grocery list', async () => {
      const updates = {
        name: 'Updated List Name',
        description: 'Updated description'
      };

      mockListService.updateList.mockResolvedValue({
        ...mockGroceryList,
        ...updates
      });

      const response = await request(app)
        .put(`/api/walmart/lists/${mockListId}`)
        .set('Authorization', `Bearer mock-token`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updates.name);
      expect(mockListService.updateList).toHaveBeenCalledWith(
        mockListId,
        mockUserId,
        updates
      );
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put(`/api/walmart/lists/${mockListId}`)
        .set('Authorization', `Bearer mock-token`)
        .send({ name: '' }); // Empty name

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name cannot be empty');
    });
  });

  describe('DELETE /api/walmart/lists/:id', () => {
    it('should delete grocery list', async () => {
      mockListService.deleteList.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/walmart/lists/${mockListId}`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(204);
      expect(mockListService.deleteList).toHaveBeenCalledWith(mockListId, mockUserId);
    });

    it('should return 404 for non-existent list', async () => {
      mockListService.deleteList.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/walmart/lists/non-existent')
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('List not found');
    });
  });

  describe('POST /api/walmart/lists/:id/items', () => {
    it('should add item to grocery list', async () => {
      const newItem = {
        product_id: 'prod-3',
        name: 'Greek Yogurt',
        quantity: 3,
        unit: 'container',
        price: 1.29,
        category: 'Dairy',
        notes: 'Vanilla flavor'
      };

      mockListService.addItem.mockResolvedValue({
        ...newItem,
        id: 'item-3',
        list_id: mockListId,
        is_purchased: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      const response = await request(app)
        .post(`/api/walmart/lists/${mockListId}/items`)
        .set('Authorization', `Bearer mock-token`)
        .send(newItem);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(newItem.name);
      expect(response.body.quantity).toBe(newItem.quantity);
    });

    it('should validate item data', async () => {
      const response = await request(app)
        .post(`/api/walmart/lists/${mockListId}/items`)
        .set('Authorization', `Bearer mock-token`)
        .send({ name: 'Test' }); // Missing required fields

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('quantity is required');
    });
  });

  describe('PUT /api/walmart/lists/:id/items/:itemId', () => {
    it('should update grocery list item', async () => {
      const updates = {
        quantity: 3,
        is_purchased: true,
        notes: 'Got organic version'
      };

      mockListService.updateItem.mockResolvedValue({
        ...mockGroceryItems[0],
        ...updates
      });

      const response = await request(app)
        .put(`/api/walmart/lists/${mockListId}/items/item-1`)
        .set('Authorization', `Bearer mock-token`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(3);
      expect(response.body.is_purchased).toBe(true);
    });

    it('should mark item as purchased', async () => {
      mockListService.updateItem.mockResolvedValue({
        ...mockGroceryItems[0],
        is_purchased: true
      });

      const response = await request(app)
        .patch(`/api/walmart/lists/${mockListId}/items/item-1/purchase`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(response.body.is_purchased).toBe(true);
    });
  });

  describe('DELETE /api/walmart/lists/:id/items/:itemId', () => {
    it('should remove item from grocery list', async () => {
      mockListService.removeItem.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/walmart/lists/${mockListId}/items/item-1`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(204);
      expect(mockListService.removeItem).toHaveBeenCalledWith('item-1', mockUserId);
    });
  });

  describe('List Sharing', () => {
    it('should share grocery list', async () => {
      const shareData = {
        email: 'friend@example.com',
        permission: 'edit'
      };

      mockListService.shareList.mockResolvedValue({
        shareId: 'share-123',
        sharedWith: shareData.email,
        permission: shareData.permission
      });

      const response = await request(app)
        .post(`/api/walmart/lists/${mockListId}/share`)
        .set('Authorization', `Bearer mock-token`)
        .send(shareData);

      expect(response.status).toBe(200);
      expect(response.body.sharedWith).toBe(shareData.email);
    });

    it('should get shared lists', async () => {
      mockListService.getSharedLists.mockResolvedValue([
        { ...mockGroceryList, sharedBy: 'friend@example.com', permission: 'view' }
      ]);

      const response = await request(app)
        .get('/api/walmart/lists/shared')
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(response.body.lists).toHaveLength(1);
      expect(response.body.lists[0].sharedBy).toBe('friend@example.com');
    });

    it('should unshare grocery list', async () => {
      mockListService.unshareList.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/walmart/lists/${mockListId}/share/share-123`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(204);
    });
  });

  describe('Advanced Features', () => {
    it('should duplicate grocery list', async () => {
      mockListService.duplicateList.mockResolvedValue({
        ...mockGroceryList,
        id: 'duplicated-list',
        name: 'Copy of Weekly Groceries'
      });

      const response = await request(app)
        .post(`/api/walmart/lists/${mockListId}/duplicate`)
        .set('Authorization', `Bearer mock-token`)
        .send({ name: 'Copy of Weekly Groceries' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Copy of Weekly Groceries');
    });

    it('should clear purchased items', async () => {
      mockListService.clearPurchasedItems.mockResolvedValue(1); // 1 item removed

      const response = await request(app)
        .delete(`/api/walmart/lists/${mockListId}/purchased`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(response.body.removedCount).toBe(1);
    });

    it('should get list statistics', async () => {
      const response = await request(app)
        .get(`/api/walmart/lists/${mockListId}/stats`)
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalItems: expect.any(Number),
        purchasedItems: expect.any(Number),
        totalCost: expect.any(Number),
        estimatedCost: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockListService.getLists.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/walmart/lists')
        .set('Authorization', `Bearer mock-token`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch lists');
    });

    it('should validate list ownership', async () => {
      mockListService.updateList.mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .put(`/api/walmart/lists/${mockListId}`)
        .set('Authorization', `Bearer wrong-user-token`)
        .send({ name: 'Hacked List' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });
});