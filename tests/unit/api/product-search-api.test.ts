/**
 * Unit Tests for Product Search API
 * Tests the product search functionality with filtering, sorting, and pagination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/api/app.js';
import { WalmartGroceryService } from '../../../src/api/services/WalmartGroceryService.js';
import type { WalmartProduct } from '../../../src/types/walmart-grocery.js';

// Mock the Walmart Grocery Service
vi.mock('../../../src/api/services/WalmartGroceryService.js');

describe('Product Search API', () => {
  let mockWalmartService: any;

  const mockProducts: WalmartProduct[] = [
    {
      id: 'prod-1',
      name: 'Organic Whole Milk',
      brand: 'Horizon',
      current_price: 4.99,
      regular_price: 5.49,
      in_stock: true,
      category: 'Dairy',
      image_url: 'https://example.com/milk.jpg',
      description: 'Fresh organic whole milk',
      unit: 'gallon',
      size: '1 gal'
    },
    {
      id: 'prod-2',
      name: 'Whole Grain Bread',
      brand: 'Dave\'s Killer Bread',
      current_price: 5.49,
      regular_price: 5.49,
      in_stock: true,
      category: 'Bakery',
      image_url: 'https://example.com/bread.jpg',
      description: 'Nutritious whole grain bread',
      unit: 'loaf',
      size: '24 oz'
    },
    {
      id: 'prod-3',
      name: 'Greek Yogurt',
      brand: 'Chobani',
      current_price: 1.29,
      regular_price: 1.49,
      in_stock: false,
      category: 'Dairy',
      image_url: 'https://example.com/yogurt.jpg',
      description: 'Protein-rich Greek yogurt',
      unit: 'container',
      size: '5.3 oz'
    }
  ];

  beforeEach(() => {
    mockWalmartService = {
      searchProducts: vi.fn(),
      getProductsByCategory: vi.fn(),
      getProductsByBrand: vi.fn(),
      getProductById: vi.fn(),
      updateProductPricing: vi.fn()
    };
    
    (WalmartGroceryService as any).mockImplementation(() => mockWalmartService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/walmart/products/search', () => {
    it('should search products by query', async () => {
      mockWalmartService.searchProducts.mockResolvedValue({
        products: mockProducts.slice(0, 2),
        total: 2,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: 'milk', limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.hasMore).toBe(false);
    });

    it('should filter products by category', async () => {
      const dairyProducts = mockProducts.filter(p => p.category === 'Dairy');
      mockWalmartService.searchProducts.mockResolvedValue({
        products: dairyProducts,
        total: 2,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', category: 'Dairy', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(2);
      expect(response.body.products.every((p: WalmartProduct) => p.category === 'Dairy')).toBe(true);
    });

    it('should filter products by brand', async () => {
      const horizonProducts = mockProducts.filter(p => p.brand === 'Horizon');
      mockWalmartService.searchProducts.mockResolvedValue({
        products: horizonProducts,
        total: 1,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', brand: 'Horizon', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].brand).toBe('Horizon');
    });

    it('should filter by price range', async () => {
      const affordableProducts = mockProducts.filter(p => p.current_price <= 2.00);
      mockWalmartService.searchProducts.mockResolvedValue({
        products: affordableProducts,
        total: 1,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', minPrice: 0, maxPrice: 2.00, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].current_price).toBeLessThanOrEqual(2.00);
    });

    it('should filter by stock availability', async () => {
      const inStockProducts = mockProducts.filter(p => p.in_stock);
      mockWalmartService.searchProducts.mockResolvedValue({
        products: inStockProducts,
        total: 2,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', inStock: true, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(2);
      expect(response.body.products.every((p: WalmartProduct) => p.in_stock)).toBe(true);
    });

    it('should sort products by price ascending', async () => {
      const sortedProducts = [...mockProducts].sort((a, b) => a.current_price - b.current_price);
      mockWalmartService.searchProducts.mockResolvedValue({
        products: sortedProducts,
        total: 3,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', sortBy: 'price', sortOrder: 'asc', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products[0].current_price).toBeLessThanOrEqual(response.body.products[1].current_price);
    });

    it('should sort products by price descending', async () => {
      const sortedProducts = [...mockProducts].sort((a, b) => b.current_price - a.current_price);
      mockWalmartService.searchProducts.mockResolvedValue({
        products: sortedProducts,
        total: 3,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', sortBy: 'price', sortOrder: 'desc', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.products[0].current_price).toBeGreaterThanOrEqual(response.body.products[1].current_price);
    });

    it('should handle pagination correctly', async () => {
      mockWalmartService.searchProducts.mockResolvedValue({
        products: mockProducts.slice(1, 2), // Return second product
        total: 3,
        hasMore: true
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', limit: 1, offset: 1 });

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.total).toBe(3);
      expect(response.body.hasMore).toBe(true);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ limit: -1 }); // Invalid limit

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('limit must be positive');
    });

    it('should handle service errors gracefully', async () => {
      mockWalmartService.searchProducts.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: 'milk' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Product search failed');
    });
  });

  describe('GET /api/walmart/products/:id', () => {
    it('should get product by ID', async () => {
      mockWalmartService.getProductById.mockResolvedValue(mockProducts[0]);

      const response = await request(app)
        .get('/api/walmart/products/prod-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('prod-1');
      expect(response.body.name).toBe('Organic Whole Milk');
    });

    it('should return 404 for non-existent product', async () => {
      mockWalmartService.getProductById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/walmart/products/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Product not found');
    });

    it('should validate product ID format', async () => {
      const response = await request(app)
        .get('/api/walmart/products/'); // Empty ID

      expect(response.status).toBe(404); // Express handles this as route not found
    });
  });

  describe('GET /api/walmart/categories', () => {
    it('should return available product categories', async () => {
      const categories = ['Dairy', 'Bakery', 'Produce', 'Meat & Seafood', 'Frozen'];
      mockWalmartService.getProductsByCategory.mockResolvedValue(categories);

      const response = await request(app)
        .get('/api/walmart/categories');

      expect(response.status).toBe(200);
      expect(response.body.categories).toEqual(categories);
    });
  });

  describe('GET /api/walmart/brands', () => {
    it('should return available brands', async () => {
      const brands = ['Horizon', 'Dave\'s Killer Bread', 'Chobani', 'Great Value'];
      mockWalmartService.getProductsByBrand.mockResolvedValue(brands);

      const response = await request(app)
        .get('/api/walmart/brands');

      expect(response.status).toBe(200);
      expect(response.body.brands).toEqual(brands);
    });
  });

  describe('Advanced Search Features', () => {
    it('should support faceted search', async () => {
      mockWalmartService.searchProducts.mockResolvedValue({
        products: mockProducts,
        total: 3,
        hasMore: false,
        facets: {
          categories: { 'Dairy': 2, 'Bakery': 1 },
          brands: { 'Horizon': 1, 'Dave\'s Killer Bread': 1, 'Chobani': 1 },
          priceRanges: { '$0-2': 1, '$2-5': 1, '$5+': 1 }
        }
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: '', includeFacets: true });

      expect(response.status).toBe(200);
      expect(response.body.facets).toBeDefined();
      expect(response.body.facets.categories).toBeDefined();
    });

    it('should support search suggestions', async () => {
      const suggestions = ['milk', 'milk chocolate', 'almond milk', 'coconut milk'];
      mockWalmartService.searchProducts.mockResolvedValue({
        suggestions,
        products: [],
        total: 0,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: 'mil', suggestions: true });

      expect(response.status).toBe(200);
      expect(response.body.suggestions).toEqual(suggestions);
    });

    it('should support fuzzy search', async () => {
      mockWalmartService.searchProducts.mockResolvedValue({
        products: [mockProducts[0]], // Returns milk for "mlik" typo
        total: 1,
        hasMore: false
      });

      const response = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: 'mlik', fuzzy: true }); // Typo in "milk"

      expect(response.status).toBe(200);
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toContain('Milk');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache search results', async () => {
      mockWalmartService.searchProducts.mockResolvedValue({
        products: mockProducts,
        total: 3,
        hasMore: false
      });

      // First request
      const response1 = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: 'milk' });

      // Second identical request should use cache
      const response2 = await request(app)
        .get('/api/walmart/products/search')
        .query({ q: 'milk' });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response2.headers['x-cache']).toBe('HIT'); // Cache header
    });

    it('should handle concurrent requests efficiently', async () => {
      mockWalmartService.searchProducts.mockResolvedValue({
        products: mockProducts,
        total: 3,
        hasMore: false
      });

      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/walmart/products/search')
          .query({ q: 'test' })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Service should have been called efficiently (potentially cached)
      expect(mockWalmartService.searchProducts).toHaveBeenCalled();
    });
  });
});