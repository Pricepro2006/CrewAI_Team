/**
 * Unit Tests for NLP Query Processing API
 * Tests the NLP service that processes natural language queries for Walmart products
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/api/app.js';
import { SimplifiedQwenProcessor } from '../../../src/microservices/nlp-service/SimplifiedQwenProcessor.js';

// Mock the NLP processor
vi.mock('../../../src/microservices/nlp-service/SimplifiedQwenProcessor.js');

describe('NLP Query Processing API', () => {
  let mockQwenProcessor: any;

  beforeEach(() => {
    mockQwenProcessor = {
      processQuery: vi.fn(),
      isHealthy: vi.fn().mockReturnValue(true),
      getStats: vi.fn().mockReturnValue({ processed: 0, errors: 0 })
    };
    
    // Mock the constructor
    (SimplifiedQwenProcessor as any).mockImplementation(() => mockQwenProcessor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/nlp/process', () => {
    it('should process simple product search query', async () => {
      mockQwenProcessor.processQuery.mockResolvedValue({
        intent: 'search_products',
        confidence: 0.95,
        items: ['milk', 'bread'],
        quantities: [],
        action: 'search',
        products: []
      });

      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: 'I need milk and bread',
          userId: 'test-user',
          sessionId: 'test-session'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        intent: 'search_products',
        confidence: 0.95,
        items: ['milk', 'bread'],
        action: 'search'
      });
    });

    it('should process add to cart intent', async () => {
      mockQwenProcessor.processQuery.mockResolvedValue({
        intent: 'add_items',
        confidence: 0.88,
        items: ['apples'],
        quantities: ['5'],
        action: 'add_to_cart',
        products: [{
          id: 'apple-123',
          name: 'Fresh Red Apples',
          brand: 'Great Value',
          price: 3.99,
          inStock: true
        }]
      });

      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: 'Add 5 apples to my cart',
          userId: 'test-user',
          sessionId: 'test-session'
        });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('add_items');
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toBe('Fresh Red Apples');
    });

    it('should handle complex multi-item queries', async () => {
      mockQwenProcessor.processQuery.mockResolvedValue({
        intent: 'add_items',
        confidence: 0.92,
        items: ['organic milk', 'whole grain bread', 'greek yogurt'],
        quantities: ['2', '1', '3'],
        action: 'add_to_cart',
        products: [
          {
            id: 'milk-organic-456',
            name: 'Organic Whole Milk',
            brand: 'Horizon',
            price: 4.99,
            inStock: true
          },
          {
            id: 'bread-whole-grain-789',
            name: 'Whole Grain Bread',
            brand: 'Dave\'s Killer Bread',
            price: 5.49,
            inStock: true
          }
        ]
      });

      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: 'I need 2 organic milk, 1 whole grain bread, and 3 greek yogurt',
          userId: 'test-user',
          sessionId: 'test-session'
        });

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.quantities).toHaveLength(3);
    });

    it('should return error for invalid input', async () => {
      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: '', // Empty text
          userId: 'test-user'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle NLP service errors gracefully', async () => {
      mockQwenProcessor.processQuery.mockRejectedValue(new Error('NLP service unavailable'));

      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: 'Add milk to cart',
          userId: 'test-user',
          sessionId: 'test-session'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('NLP processing failed');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: 'Add milk to cart'
          // Missing userId and sessionId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('userId is required');
    });

    it('should handle voice input processing', async () => {
      mockQwenProcessor.processQuery.mockResolvedValue({
        intent: 'search_products',
        confidence: 0.87,
        items: ['coffee'],
        quantities: [],
        action: 'search',
        products: []
      });

      const response = await request(app)
        .post('/api/nlp/process')
        .send({
          text: 'Find me some coffee please',
          userId: 'test-user',
          sessionId: 'test-session',
          isVoiceInput: true
        });

      expect(response.status).toBe(200);
      expect(response.body.intent).toBe('search_products');
    });
  });

  describe('GET /api/nlp/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/nlp/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        model: 'qwen3:0.6b',
        stats: expect.any(Object)
      });
    });

    it('should return unhealthy status when service is down', async () => {
      mockQwenProcessor.isHealthy.mockReturnValue(false);

      const response = await request(app)
        .get('/api/nlp/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('GET /api/nlp/intents', () => {
    it('should return supported intents', async () => {
      const response = await request(app)
        .get('/api/nlp/intents');

      expect(response.status).toBe(200);
      expect(response.body.intents).toEqual([
        'search_products',
        'add_items',
        'remove_items',
        'view_cart',
        'checkout',
        'price_check',
        'compare_products'
      ]);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on NLP processing', async () => {
      mockQwenProcessor.processQuery.mockResolvedValue({
        intent: 'search_products',
        confidence: 0.9,
        items: ['test'],
        quantities: [],
        action: 'search',
        products: []
      });

      // Make multiple rapid requests
      const requests = Array.from({ length: 15 }, () =>
        request(app)
          .post('/api/nlp/process')
          .send({
            text: 'test query',
            userId: 'rate-limit-test',
            sessionId: 'test-session'
          })
      );

      const responses = await Promise.all(requests);
      
      // Should have some 429 responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});