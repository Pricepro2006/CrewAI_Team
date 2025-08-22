import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { GroceryListRepository } from '../GroceryRepository';
import type { GroceryList, GroceryItem } from '../GroceryRepository';

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => ({
      prepare: vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn()
      })),
      exec: vi.fn(),
      transaction: vi.fn((fn) => fn),
      close: vi.fn()
    }))
  };
});

describe('GroceryListRepository', () => {
  let repository: GroceryListRepository;
  let mockDb: any;

  beforeEach(() => {
    // Create a new mock database instance
    mockDb = new Database(':memory:');
    repository = new GroceryListRepository(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createList', () => {
    it('should create a new grocery list', () => {
      const mockList: Partial<GroceryList> = {
        user_id: 'user123',
        name: 'Weekly Shopping',
        description: 'Groceries for the week',
        budget: 100.00,
        list_type: 'shopping',
        status: 'active'
      };

      const mockResult = {
        lastInsertRowid: 1,
        changes: 1
      };

      const mockRun = vi.fn().mockReturnValue(mockResult);
      const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
      mockDb.prepare = mockPrepare;

      const result = repository.createList(mockList as GroceryList);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO grocery_lists'));
      expect(mockRun).toHaveBeenCalled();
      expect(result).toBe('1');
    });

    it('should generate a UUID if no id is provided', () => {
      const mockList: Partial<GroceryList> = {
        user_id: 'user123',
        name: 'Shopping List'
      };

      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      repository.createList(mockList as GroceryList);

      const runCall = mockRun.mock.calls[0][0];
      expect(runCall.id).toBeDefined();
      expect(runCall.id).toMatch(/^[a-f0-9-]+$/);
    });

    it('should handle database errors gracefully', () => {
      const mockList: Partial<GroceryList> = {
        user_id: 'user123',
        name: 'Error Test'
      };

      const mockRun = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      expect(() => repository.createList(mockList as GroceryList)).toThrow('Failed to create grocery list');
    });
  });

  describe('getListById', () => {
    it('should retrieve a list by id', () => {
      const mockListData = {
        id: 'list123',
        user_id: 'user123',
        list_name: 'Weekly Shopping',
        description: 'Test description',
        list_type: 'shopping',
        status: 'active',
        store_id: '1234',
        estimated_total: 100.00,
        items_count: 5,
        shared_with: null,
        tags: '["groceries"]',
        metadata: '{"key": "value"}',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      const mockGet = vi.fn().mockReturnValue(mockListData);
      mockDb.prepare = vi.fn().mockReturnValue({ get: mockGet });

      const result = repository.getListById('list123', 'user123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM grocery_lists'));
      expect(mockGet).toHaveBeenCalledWith({ id: 'list123', user_id: 'user123' });
      expect(result).toEqual(expect.objectContaining({
        id: 'list123',
        name: 'Weekly Shopping',
        tags: ['groceries'],
        metadata: { key: 'value' }
      }));
    });

    it('should return null for non-existent list', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare = vi.fn().mockReturnValue({ get: mockGet });

      const result = repository.getListById('nonexistent', 'user123');

      expect(result).toBeNull();
    });
  });

  describe('getUserLists', () => {
    it('should retrieve all lists for a user', () => {
      const mockLists = [
        {
          id: 'list1',
          list_name: 'List 1',
          user_id: 'user123',
          status: 'active',
          tags: '["tag1"]',
          metadata: '{}'
        },
        {
          id: 'list2',
          list_name: 'List 2',
          user_id: 'user123',
          status: 'completed',
          tags: null,
          metadata: null
        }
      ];

      const mockAll = vi.fn().mockReturnValue(mockLists);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      const result = repository.getUserLists('user123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM grocery_lists'));
      expect(mockAll).toHaveBeenCalledWith({ user_id: 'user123' });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('List 1');
      expect(result[0].tags).toEqual(['tag1']);
    });

    it('should filter by status when provided', () => {
      const mockAll = vi.fn().mockReturnValue([]);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      repository.getUserLists('user123', 'active');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND status = ?')
      );
      expect(mockAll).toHaveBeenCalledWith({ user_id: 'user123', status: 'active' });
    });
  });

  describe('addItemsToList', () => {
    it('should add items to a list', () => {
      const items: Partial<GroceryItem>[] = [
        {
          product_id: 'prod1',
          quantity: 2,
          price_at_addition: 5.99,
          notes: 'Test note'
        },
        {
          product_id: 'prod2',
          quantity: 1,
          price_at_addition: 3.99
        }
      ];

      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
      const mockTransaction = vi.fn((fn) => fn());
      
      mockDb.prepare = mockPrepare;
      mockDb.transaction = mockTransaction;

      const result = repository.addItemsToList('list123', items as GroceryItem[]);

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO grocery_items'));
      expect(mockRun).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it('should handle empty items array', () => {
      const result = repository.addItemsToList('list123', []);
      expect(result).toBe(true);
    });

    it('should handle transaction errors', () => {
      const items: Partial<GroceryItem>[] = [
        { product_id: 'prod1', quantity: 1 }
      ];

      mockDb.transaction = vi.fn(() => {
        throw new Error('Transaction failed');
      });

      expect(() => repository.addItemsToList('list123', items as GroceryItem[]))
        .toThrow('Failed to add items to list');
    });
  });

  describe('updateItemStatus', () => {
    it('should update item status', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.updateItemStatus('item123', 'purchased');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE grocery_items SET status = ?')
      );
      expect(mockRun).toHaveBeenCalledWith({
        id: 'item123',
        status: 'purchased',
        purchased_at: expect.any(String)
      });
      expect(result).toBe(true);
    });

    it('should return false when no rows are updated', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.updateItemStatus('nonexistent', 'purchased');
      expect(result).toBe(false);
    });
  });

  describe('deleteList', () => {
    it('should delete a list and its items', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
      const mockTransaction = vi.fn((fn) => fn());
      
      mockDb.prepare = mockPrepare;
      mockDb.transaction = mockTransaction;

      const result = repository.deleteList('list123', 'user123');

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockPrepare).toHaveBeenCalledTimes(2); // Delete items + delete list
      expect(result).toBe(true);
    });

    it('should return false when list does not exist', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });
      mockDb.transaction = vi.fn((fn) => fn());

      const result = repository.deleteList('nonexistent', 'user123');
      expect(result).toBe(false);
    });
  });

  describe('getListStats', () => {
    it('should calculate list statistics', () => {
      const mockStats = {
        total_items: 10,
        purchased_count: 6,
        pending_count: 4,
        total_spent: 59.99,
        estimated_remaining: 40.01
      };

      const mockGet = vi.fn().mockReturnValue(mockStats);
      mockDb.prepare = vi.fn().mockReturnValue({ get: mockGet });

      const result = repository.getListStats('list123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('COUNT'));
      expect(result).toEqual(mockStats);
    });

    it('should return default stats for empty list', () => {
      const mockGet = vi.fn().mockReturnValue(null);
      mockDb.prepare = vi.fn().mockReturnValue({ get: mockGet });

      const result = repository.getListStats('list123');

      expect(result).toEqual({
        total_items: 0,
        purchased_count: 0,
        pending_count: 0,
        total_spent: 0,
        estimated_remaining: 0
      });
    });
  });

  describe('searchLists', () => {
    it('should search lists by query', () => {
      const mockLists = [
        { id: 'list1', list_name: 'Healthy Food', tags: '["healthy"]', metadata: '{}' },
        { id: 'list2', list_name: 'Party Supplies', tags: null, metadata: null }
      ];

      const mockAll = vi.fn().mockReturnValue(mockLists);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      const result = repository.searchLists('user123', 'healthy');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND')
      );
      expect(mockAll).toHaveBeenCalledWith({
        user_id: 'user123',
        query: '%healthy%'
      });
      expect(result).toHaveLength(2);
    });
  });
});