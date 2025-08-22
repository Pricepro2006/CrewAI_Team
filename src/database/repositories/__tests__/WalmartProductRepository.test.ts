import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { WalmartProductRepository } from '../WalmartProductRepository';
import type { WalmartProduct, WalmartSearchFilters } from '../../../shared/types/walmart.types';

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

describe('WalmartProductRepository', () => {
  let repository: WalmartProductRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = new Database(':memory:');
    repository = new WalmartProductRepository(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchProducts', () => {
    it('should search products with basic query', () => {
      const mockProducts = [
        {
          product_id: 'prod1',
          name: 'Organic Bananas',
          brand: 'Fresh Produce',
          category: 'Fruits',
          price: 2.99,
          in_stock: 1,
          rating: 4.5,
          review_count: 100,
          image_url: 'http://example.com/banana.jpg'
        },
        {
          product_id: 'prod2',
          name: 'Banana Bread',
          brand: 'Bakery Fresh',
          category: 'Bakery',
          price: 4.99,
          in_stock: 1,
          rating: 4.2,
          review_count: 50,
          image_url: 'http://example.com/bread.jpg'
        }
      ];

      const mockAll = vi.fn().mockReturnValue(mockProducts);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      const result = repository.searchProducts('banana');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Organic Bananas');
    });

    it('should apply filters when searching', () => {
      const filters: WalmartSearchFilters = {
        category: 'Fruits',
        minPrice: 1.00,
        maxPrice: 5.00,
        inStock: true,
        minRating: 4.0
      };

      const mockAll = vi.fn().mockReturnValue([]);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      repository.searchProducts('apple', filters, 10, 0);

      const prepareCall = mockDb.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('category = ?');
      expect(prepareCall).toContain('price >= ?');
      expect(prepareCall).toContain('price <= ?');
      expect(prepareCall).toContain('in_stock = 1');
      expect(prepareCall).toContain('rating >= ?');
    });

    it('should handle limit and offset', () => {
      const mockAll = vi.fn().mockReturnValue([]);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      repository.searchProducts('test', {}, 20, 10);

      const prepareCall = mockDb.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('LIMIT ?');
      expect(prepareCall).toContain('OFFSET ?');
      
      const params = mockAll.mock.calls[0][0];
      expect(params.limit).toBe(20);
      expect(params.offset).toBe(10);
    });

    it('should handle database errors gracefully', () => {
      mockDb.prepare = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(() => repository.searchProducts('test')).toThrow('Failed to search products');
    });
  });

  describe('getProductById', () => {
    it('should retrieve a product by ID', () => {
      const mockProduct = {
        product_id: 'prod123',
        name: 'Test Product',
        brand: 'Test Brand',
        category: 'Test Category',
        price: 9.99,
        in_stock: 1,
        rating: 4.5,
        review_count: 100,
        image_url: 'http://example.com/product.jpg'
      };

      const mockGet = vi.fn().mockReturnValue(mockProduct);
      mockDb.prepare = vi.fn().mockReturnValue({ get: mockGet });

      const result = repository.getProductById('prod123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE product_id = ?')
      );
      expect(mockGet).toHaveBeenCalledWith('prod123');
      expect(result).toEqual(mockProduct);
    });

    it('should return null for non-existent product', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare = vi.fn().mockReturnValue({ get: mockGet });

      const result = repository.getProductById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getProductsByCategory', () => {
    it('should retrieve products by category', () => {
      const mockProducts = [
        { product_id: 'prod1', name: 'Milk', category: 'Dairy', price: 3.99 },
        { product_id: 'prod2', name: 'Cheese', category: 'Dairy', price: 5.99 }
      ];

      const mockAll = vi.fn().mockReturnValue(mockProducts);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      const result = repository.getProductsByCategory('Dairy');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = ?')
      );
      expect(mockAll).toHaveBeenCalledWith({ category: 'Dairy', limit: 50, offset: 0 });
      expect(result).toHaveLength(2);
    });

    it('should respect limit and offset parameters', () => {
      const mockAll = vi.fn().mockReturnValue([]);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      repository.getProductsByCategory('Fruits', 10, 5);

      expect(mockAll).toHaveBeenCalledWith({ category: 'Fruits', limit: 10, offset: 5 });
    });
  });

  describe('upsertProduct', () => {
    it('should insert or update a product', () => {
      const product: WalmartProduct = {
        product_id: 'prod123',
        name: 'New Product',
        brand: 'Brand X',
        category: 'Electronics',
        subcategory: 'Phones',
        description: 'A great product',
        price: 199.99,
        original_price: 249.99,
        discount_percentage: 20,
        in_stock: true,
        stock_quantity: 50,
        rating: 4.5,
        review_count: 200,
        image_url: 'http://example.com/product.jpg',
        product_url: 'http://walmart.com/product',
        upc: '123456789',
        model_number: 'MODEL123',
        weight: '1.5 lbs',
        dimensions: '6x3x1 inches',
        features: ['Feature 1', 'Feature 2'],
        tags: ['tag1', 'tag2'],
        seller_name: 'Seller X',
        seller_rating: 4.8,
        shipping_cost: 5.99,
        shipping_time: '2-3 days',
        return_policy: '30 days',
        created_at: new Date(),
        updated_at: new Date(),
        last_checked: new Date()
      };

      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.upsertProduct(product);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO walmart_products')
      );
      expect(mockRun).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle products with minimal data', () => {
      const product: Partial<WalmartProduct> = {
        product_id: 'prod456',
        name: 'Simple Product',
        price: 9.99
      };

      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.upsertProduct(product as WalmartProduct);

      expect(result).toBe(true);
      const runCall = mockRun.mock.calls[0][0];
      expect(runCall.product_id).toBe('prod456');
      expect(runCall.features).toBe(null);
      expect(runCall.tags).toBe(null);
    });

    it('should return false when no changes are made', () => {
      const product: Partial<WalmartProduct> = {
        product_id: 'prod789',
        name: 'Test Product'
      };

      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.upsertProduct(product as WalmartProduct);
      expect(result).toBe(false);
    });
  });

  describe('updateProductPrice', () => {
    it('should update product price', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.updateProductPrice('prod123', 19.99);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE walmart_products SET price = ?')
      );
      expect(mockRun).toHaveBeenCalledWith({
        product_id: 'prod123',
        price: 19.99,
        updated_at: expect.any(String)
      });
      expect(result).toBe(true);
    });

    it('should update price with original price', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.updateProductPrice('prod123', 19.99, 29.99);

      const runCall = mockRun.mock.calls[0][0];
      expect(runCall.original_price).toBe(29.99);
      expect(runCall.discount_percentage).toBe(33);
    });

    it('should return false when product not found', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.updateProductPrice('nonexistent', 19.99);
      expect(result).toBe(false);
    });
  });

  describe('updateProductStock', () => {
    it('should update product stock status', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.updateProductStock('prod123', true, 100);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE walmart_products SET in_stock = ?')
      );
      expect(mockRun).toHaveBeenCalledWith({
        product_id: 'prod123',
        in_stock: 1,
        stock_quantity: 100,
        updated_at: expect.any(String)
      });
      expect(result).toBe(true);
    });

    it('should handle out of stock status', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      repository.updateProductStock('prod123', false);

      const runCall = mockRun.mock.calls[0][0];
      expect(runCall.in_stock).toBe(0);
      expect(runCall.stock_quantity).toBe(0);
    });
  });

  describe('deleteProduct', () => {
    it('should delete a product', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.deleteProduct('prod123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM walmart_products WHERE product_id = ?')
      );
      expect(mockRun).toHaveBeenCalledWith('prod123');
      expect(result).toBe(true);
    });

    it('should return false when product not found', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockDb.prepare = vi.fn().mockReturnValue({ run: mockRun });

      const result = repository.deleteProduct('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getCategories', () => {
    it('should retrieve all unique categories', () => {
      const mockCategories = [
        { category: 'Fruits' },
        { category: 'Vegetables' },
        { category: 'Dairy' }
      ];

      const mockAll = vi.fn().mockReturnValue(mockCategories);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      const result = repository.getCategories();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT category')
      );
      expect(result).toEqual(['Fruits', 'Vegetables', 'Dairy']);
    });

    it('should handle empty categories', () => {
      const mockAll = vi.fn().mockReturnValue([]);
      mockDb.prepare = vi.fn().mockReturnValue({ all: mockAll });

      const result = repository.getCategories();
      expect(result).toEqual([]);
    });
  });
});