/**
 * Comprehensive Microservices Integration Tests
 * 
 * Phase 8 Task 2: End-to-end testing of the complete Walmart Grocery Agent
 * microservices architecture with real-world scenarios and cross-service interactions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { WalmartServiceMesh } from '../../src/microservices/WalmartServiceMesh.js';
import { ServiceDiscovery } from '../../src/microservices/discovery/ServiceDiscovery.js';
import { LoadBalancer } from '../../src/microservices/discovery/LoadBalancer.js';
import { HealthChecker } from '../../src/microservices/discovery/HealthChecker.js';
import { ServiceRegistry } from '../../src/microservices/discovery/ServiceRegistry.js';
import { CircuitBreakerManager } from '../../src/core/events/CircuitBreaker.js';
import { EventBus } from '../../src/core/events/EventBus.js';
import { logger } from '../../src/utils/logger.js';

// Types for test scenarios
interface ShoppingSession {
  userId: string;
  sessionId: string;
  familyId?: string;
  budget?: number;
  dietaryRestrictions?: string[];
  preferences?: Record<string, any>;
}

interface GroceryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  location: string;
  nutritionInfo?: Record<string, any>;
  allergens?: string[];
}

interface ShoppingCart {
  sessionId: string;
  items: Array<{
    item: GroceryItem;
    quantity: number;
    addedAt: Date;
  }>;
  totalPrice: number;
  estimatedTax: number;
  deliveryFee: number;
}

interface ServiceHealthMetrics {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  throughput: number;
}

describe('Microservices Integration Tests - Real World Scenarios', () => {
  // Test infrastructure
  let serviceMesh: WalmartServiceMesh;
  let redis: Redis;
  let eventBus: EventBus;
  let circuitBreaker: CircuitBreakerManager;
  let axiosClient: AxiosInstance;
  
  // Service endpoints
  const API_BASE = 'http://localhost:3000';
  const WS_BASE = 'ws://localhost:8080';
  const NLP_BASE = 'http://localhost:3008';
  const PRICING_BASE = 'http://localhost:3007';
  const CACHE_BASE = 'http://localhost:3006';
  
  // Test data
  let testSessions: ShoppingSession[] = [];
  let mockProductCatalog: GroceryItem[] = [];
  let websocketClients: WebSocket[] = [];

  beforeAll(async () => {
    // Setup Redis for testing
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 14, // Use separate DB for integration tests
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    await redis.connect();
    await redis.flushdb();

    // Initialize core components
    eventBus = new EventBus(redis);
    circuitBreaker = new CircuitBreakerManager();
    
    // Initialize service mesh
    serviceMesh = WalmartServiceMesh.getInstance({
      autoStart: true,
      healthCheckEnabled: true,
      metricsEnabled: true,
      circuitBreakerEnabled: true,
      loadBalancingEnabled: true,
      proxyEnabled: true
    });

    // Deploy all services
    const deploymentSuccess = await serviceMesh.deployAllServices();
    if (!deploymentSuccess) {
      throw new Error('Failed to deploy service mesh');
    }

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Setup HTTP client with timeout and retries
    axiosClient = axios.create({
      timeout: 10000,
      validateStatus: () => true, // Don't throw on HTTP errors
    });

    // Initialize test data
    await setupTestData();

    logger.info('Integration test setup complete', 'INTEGRATION_TEST');
  });

  afterAll(async () => {
    // Cleanup WebSocket connections
    websocketClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Shutdown service mesh
    await serviceMesh.shutdown();
    
    // Cleanup Redis
    await redis.flushdb();
    await redis.disconnect();
    
    logger.info('Integration test cleanup complete', 'INTEGRATION_TEST');
  });

  beforeEach(async () => {
    // Reset test state
    testSessions = [];
    websocketClients = [];
    
    // Clear any test-specific Redis data
    const keys = await redis.keys('test:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    websocketClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    websocketClients = [];
  });

  describe('Complete Grocery Shopping Workflow', () => {
    it('should handle end-to-end grocery shopping flow', async () => {
      const session = createTestSession('user-001', 150.00, ['gluten-free']);
      
      // Step 1: Create shopping session
      const sessionResponse = await axiosClient.post(`${API_BASE}/api/grocery/session`, session);
      expect(sessionResponse.status).toBe(200);
      
      const { sessionId } = sessionResponse.data;
      
      // Step 2: Process natural language query
      const nlpQuery = "I need organic apples, gluten-free bread, and some chicken breast for dinner";
      const nlpResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: nlpQuery,
        sessionId,
        context: { dietaryRestrictions: ['gluten-free'] }
      });
      
      expect(nlpResponse.status).toBe(200);
      expect(nlpResponse.data.intent).toBe('add_items');
      expect(nlpResponse.data.entities).toContain('organic apples');
      expect(nlpResponse.data.entities).toContain('gluten-free bread');
      
      // Step 3: Product matching and recommendations
      const matchingResponse = await axiosClient.post(`${API_BASE}/api/grocery/match-products`, {
        sessionId,
        nlpResults: nlpResponse.data,
        preferences: session.preferences
      });
      
      expect(matchingResponse.status).toBe(200);
      expect(matchingResponse.data.matches).toHaveLength(3);
      
      // Step 4: Get pricing for matched products
      const productIds = matchingResponse.data.matches.map((m: any) => m.productId);
      const pricingResponse = await axiosClient.post(`${PRICING_BASE}/pricing/bulk-quote`, {
        productIds,
        location: '90210',
        sessionId
      });
      
      expect(pricingResponse.status).toBe(200);
      expect(pricingResponse.data.total).toBeGreaterThan(0);
      
      // Step 5: Add items to cart
      const cartResponse = await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId,
        items: matchingResponse.data.matches.map((m: any, index: number) => ({
          productId: m.productId,
          quantity: 1,
          price: pricingResponse.data.items[index].price
        }))
      });
      
      expect(cartResponse.status).toBe(200);
      expect(cartResponse.data.cart.items).toHaveLength(3);
      expect(cartResponse.data.cart.totalPrice).toBeLessThanOrEqual(session.budget!);
      
      // Step 6: Checkout process
      const checkoutResponse = await axiosClient.post(`${API_BASE}/api/grocery/checkout`, {
        sessionId,
        paymentMethod: 'credit_card',
        deliveryAddress: '123 Test St, Beverly Hills, CA 90210'
      });
      
      expect(checkoutResponse.status).toBe(200);
      expect(checkoutResponse.data.orderId).toBeDefined();
      expect(checkoutResponse.data.status).toBe('confirmed');
    });

    it('should handle multi-user family shopping', async () => {
      const familyId = 'family-001';
      const parentSession = createTestSession('parent-001', 200.00, [], familyId);
      const childSession = createTestSession('child-001', 50.00, ['nut-free'], familyId);
      
      // Create both sessions
      const [parentResponse, childResponse] = await Promise.all([
        axiosClient.post(`${API_BASE}/api/grocery/session`, parentSession),
        axiosClient.post(`${API_BASE}/api/grocery/session`, childSession)
      ]);
      
      expect(parentResponse.status).toBe(200);
      expect(childResponse.status).toBe(200);
      
      // Parent adds items
      await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: parentResponse.data.sessionId,
        items: [
          { productId: 'milk-001', quantity: 2, price: 3.99 },
          { productId: 'bread-001', quantity: 1, price: 2.49 }
        ]
      });
      
      // Child tries to add items (should be synced to family cart)
      const childAddResponse = await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: childResponse.data.sessionId,
        items: [
          { productId: 'snacks-001', quantity: 1, price: 4.99 }
        ]
      });
      
      expect(childAddResponse.status).toBe(200);
      
      // Check family cart synchronization
      const familyCartResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/cart/family/${familyId}`
      );
      
      expect(familyCartResponse.status).toBe(200);
      expect(familyCartResponse.data.items).toHaveLength(3);
      expect(familyCartResponse.data.contributors).toContain('parent-001');
      expect(familyCartResponse.data.contributors).toContain('child-001');
    });
  });

  describe('Cross-Service Interactions', () => {
    it('should validate NLP → Product Matching → Pricing pipeline', async () => {
      const session = createTestSession('pipeline-001', 100.00);
      
      // Create session
      const sessionResponse = await axiosClient.post(`${API_BASE}/api/grocery/session`, session);
      const { sessionId } = sessionResponse.data;
      
      // Complex NLP query
      const complexQuery = "I need 2 pounds of organic ground beef, a dozen free-range eggs, and some pasta sauce for under $30";
      
      // Step 1: NLP Processing
      const nlpResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: complexQuery,
        sessionId,
        options: { extractQuantities: true, extractBudget: true }
      });
      
      expect(nlpResponse.status).toBe(200);
      expect(nlpResponse.data.budget).toBe(30);
      expect(nlpResponse.data.entities).toHaveLength(3);
      
      // Step 2: Product Matching with quantity awareness
      const matchingResponse = await axiosClient.post(`${API_BASE}/api/grocery/match-products`, {
        sessionId,
        nlpResults: nlpResponse.data,
        options: { respectQuantities: true, budgetFilter: true }
      });
      
      expect(matchingResponse.status).toBe(200);
      expect(matchingResponse.data.matches.every((m: any) => m.quantity > 0)).toBe(true);
      
      // Step 3: Pricing with quantity-based calculations
      const pricingResponse = await axiosClient.post(`${PRICING_BASE}/pricing/bulk-quote`, {
        items: matchingResponse.data.matches.map((m: any) => ({
          productId: m.productId,
          quantity: m.quantity
        })),
        sessionId,
        options: { applyQuantityDiscounts: true }
      });
      
      expect(pricingResponse.status).toBe(200);
      expect(pricingResponse.data.total).toBeLessThanOrEqual(30);
      expect(pricingResponse.data.quantityDiscounts).toBeDefined();
    });

    it('should handle cache warming across services', async () => {
      const popularQueries = [
        "milk and bread",
        "chicken breast and vegetables",
        "organic fruits",
        "gluten-free pasta"
      ];
      
      // Trigger cache warming
      const warmingResponse = await axiosClient.post(`${CACHE_BASE}/cache/warm`, {
        type: 'popular_queries',
        data: popularQueries,
        priority: 'high'
      });
      
      expect(warmingResponse.status).toBe(200);
      
      // Wait for cache warming to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test that cached queries are faster
      const startTime = Date.now();
      const cachedResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: popularQueries[0],
        sessionId: 'cache-test-001'
      });
      const cachedResponseTime = Date.now() - startTime;
      
      expect(cachedResponse.status).toBe(200);
      expect(cachedResponseTime).toBeLessThan(500); // Should be fast due to caching
      
      // Verify cache hit in response headers or metadata
      expect(cachedResponse.data.cached || cachedResponse.headers['x-cache-hit']).toBeTruthy();
    });

    it('should manage WebSocket real-time updates across services', async () => {
      const session = createTestSession('ws-001', 75.00);
      
      // Create WebSocket connection
      const ws = new WebSocket(`${WS_BASE}/grocery`);
      websocketClients.push(ws);
      
      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Subscribe to session updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: {
          sessionId: session.sessionId,
          events: ['cart_updated', 'price_changed', 'item_availability_changed']
        }
      }));
      
      // Wait for subscription confirmation
      await waitForWebSocketMessage(messages, m => m.type === 'subscription_confirmed');
      
      // Trigger events from different services
      await axiosClient.post(`${API_BASE}/api/grocery/session`, session);
      
      // Add item to cart (should trigger WebSocket update)
      await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: session.sessionId,
        items: [{ productId: 'test-001', quantity: 1, price: 5.99 }]
      });
      
      // Simulate price change from pricing service
      await axiosClient.post(`${PRICING_BASE}/pricing/update`, {
        productId: 'test-001',
        newPrice: 4.99,
        reason: 'sale'
      });
      
      // Wait for WebSocket messages
      await waitForWebSocketMessage(messages, m => m.type === 'cart_updated');
      await waitForWebSocketMessage(messages, m => m.type === 'price_changed');
      
      const cartUpdateMessage = messages.find(m => m.type === 'cart_updated');
      const priceChangeMessage = messages.find(m => m.type === 'price_changed');
      
      expect(cartUpdateMessage).toBeDefined();
      expect(cartUpdateMessage.payload.items).toHaveLength(1);
      
      expect(priceChangeMessage).toBeDefined();
      expect(priceChangeMessage.payload.newPrice).toBe(4.99);
    });
  });

  describe('Service Discovery and Failover', () => {
    it('should handle service discovery and load balancing', async () => {
      const serviceName = 'walmart-pricing';
      const serviceDiscovery = ServiceDiscovery.getInstance();
      
      // Discover pricing service instances
      const instances = await serviceDiscovery.discoverServices(serviceName);
      expect(instances.length).toBeGreaterThan(0);
      
      // Test load balancing across instances
      const responseTypes = new Set();
      const requestPromises = [];
      
      for (let i = 0; i < 10; i++) {
        requestPromises.push(
          axiosClient.get(`${API_BASE}/service-mesh/pricing/health`)
            .then(response => {
              if (response.status === 200) {
                responseTypes.add(response.data.instance || 'default');
              }
              return response;
            })
        );
      }
      
      const responses = await Promise.all(requestPromises);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      expect(successfulResponses.length).toBe(10);
      // If multiple instances are running, we should see different instance IDs
      if (instances.length > 1) {
        expect(responseTypes.size).toBeGreaterThan(1);
      }
    });

    it('should handle circuit breaker activation and recovery', async () => {
      const serviceName = 'walmart-nlp-queue';
      
      // Force service to fail by sending invalid requests
      const failurePromises = [];
      for (let i = 0; i < 5; i++) {
        failurePromises.push(
          axiosClient.post(`${NLP_BASE}/nlp/process`, {
            query: null, // Invalid query to force error
            sessionId: 'circuit-test'
          }).catch(() => ({ status: 500 })) // Convert error to response
        );
      }
      
      await Promise.all(failurePromises);
      
      // Wait for circuit breaker to potentially activate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if circuit breaker is activated
      const healthResponse = await axiosClient.get(`${API_BASE}/service-mesh/services`);
      expect(healthResponse.status).toBe(200);
      
      const nlpService = healthResponse.data.services.find(
        (s: any) => s.name === serviceName
      );
      
      if (nlpService) {
        // Either the service recovered or circuit breaker is managing it
        expect(['healthy', 'degraded']).toContain(nlpService.status);
      }
      
      // Test recovery with valid request
      const recoveryResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: "test recovery query",
        sessionId: 'circuit-recovery-test'
      });
      
      // Should either succeed or gracefully handle circuit breaker state
      expect([200, 503]).toContain(recoveryResponse.status);
    });

    it('should maintain service registry consistency', async () => {
      const serviceRegistry = ServiceRegistry.getInstance();
      
      // Get current service state
      const initialServices = await serviceRegistry.getAll();
      const initialCount = initialServices.length;
      
      // Register a temporary test service
      const testService = {
        id: 'test-service-001',
        name: 'test-service',
        version: '1.0.0',
        host: 'localhost',
        port: 9999,
        protocol: 'http' as const,
        health_endpoint: '/health',
        tags: ['test'],
        metadata: { test: true }
      };
      
      const registrationSuccess = await serviceRegistry.register(testService);
      expect(registrationSuccess).toBe(true);
      
      // Verify service was registered
      const updatedServices = await serviceRegistry.getAll();
      expect(updatedServices.length).toBe(initialCount + 1);
      
      const registeredService = updatedServices.find(s => s.id === testService.id);
      expect(registeredService).toBeDefined();
      expect(registeredService!.name).toBe(testService.name);
      
      // Test service lookup
      const foundService = await serviceRegistry.getService(testService.id);
      expect(foundService).toBeDefined();
      expect(foundService!.host).toBe('localhost');
      
      // Deregister the test service
      const deregistrationSuccess = await serviceRegistry.deregister(testService.id);
      expect(deregistrationSuccess).toBe(true);
      
      // Verify service was removed
      const finalServices = await serviceRegistry.getAll();
      expect(finalServices.length).toBe(initialCount);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain shopping cart consistency across failures', async () => {
      const session = createTestSession('consistency-001', 200.00);
      
      // Create session and add items
      await axiosClient.post(`${API_BASE}/api/grocery/session`, session);
      
      const initialItems = [
        { productId: 'consistent-001', quantity: 2, price: 10.99 },
        { productId: 'consistent-002', quantity: 1, price: 15.99 },
        { productId: 'consistent-003', quantity: 3, price: 7.99 }
      ];
      
      await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: session.sessionId,
        items: initialItems
      });
      
      // Verify cart state
      const cartResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/cart/${session.sessionId}`
      );
      expect(cartResponse.status).toBe(200);
      expect(cartResponse.data.items).toHaveLength(3);
      
      // Simulate partial failure by trying to add conflicting items
      const conflictResponse = await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: session.sessionId,
        items: [
          { productId: 'consistent-001', quantity: -1, price: 10.99 } // Invalid quantity
        ]
      });
      
      // Should handle conflict gracefully
      expect([400, 422]).toContain(conflictResponse.status);
      
      // Verify original cart is unchanged
      const finalCartResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/cart/${session.sessionId}`
      );
      expect(finalCartResponse.status).toBe(200);
      expect(finalCartResponse.data.items).toHaveLength(3);
      expect(finalCartResponse.data.items[0].quantity).toBe(2); // Original quantity preserved
    });

    it('should synchronize price updates across cache layers', async () => {
      const productId = 'price-sync-001';
      const initialPrice = 19.99;
      const updatedPrice = 17.99;
      
      // Set initial price
      await axiosClient.post(`${PRICING_BASE}/pricing/update`, {
        productId,
        price: initialPrice,
        source: 'manual'
      });
      
      // Verify price in cache
      const cacheResponse1 = await axiosClient.get(
        `${CACHE_BASE}/cache/price/${productId}`
      );
      expect(cacheResponse1.status).toBe(200);
      expect(cacheResponse1.data.price).toBe(initialPrice);
      
      // Update price
      await axiosClient.post(`${PRICING_BASE}/pricing/update`, {
        productId,
        price: updatedPrice,
        source: 'sale'
      });
      
      // Wait for cache invalidation and update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify updated price in cache
      const cacheResponse2 = await axiosClient.get(
        `${CACHE_BASE}/cache/price/${productId}`
      );
      expect(cacheResponse2.status).toBe(200);
      expect(cacheResponse2.data.price).toBe(updatedPrice);
      
      // Verify consistency across multiple service calls
      const pricingResponse = await axiosClient.get(
        `${PRICING_BASE}/pricing/${productId}`
      );
      expect(pricingResponse.status).toBe(200);
      expect(pricingResponse.data.price).toBe(updatedPrice);
    });

    it('should handle transaction integrity during checkout', async () => {
      const session = createTestSession('transaction-001', 100.00);
      
      // Setup cart with items
      await axiosClient.post(`${API_BASE}/api/grocery/session`, session);
      await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: session.sessionId,
        items: [
          { productId: 'transaction-001', quantity: 1, price: 29.99 },
          { productId: 'transaction-002', quantity: 2, price: 15.99 }
        ]
      });
      
      // Start checkout process
      const checkoutResponse = await axiosClient.post(`${API_BASE}/api/grocery/checkout/initiate`, {
        sessionId: session.sessionId,
        paymentMethod: 'credit_card'
      });
      
      expect(checkoutResponse.status).toBe(200);
      const { checkoutId, reservationId } = checkoutResponse.data;
      
      // Verify inventory is reserved
      const reservationResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/reservation/${reservationId}`
      );
      expect(reservationResponse.status).toBe(200);
      expect(reservationResponse.data.status).toBe('active');
      
      // Simulate payment failure
      const paymentResponse = await axiosClient.post(`${API_BASE}/api/grocery/checkout/payment`, {
        checkoutId,
        paymentToken: 'invalid_token'
      });
      
      expect([400, 402]).toContain(paymentResponse.status);
      
      // Verify reservation is released and cart is restored
      const finalReservationResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/reservation/${reservationId}`
      );
      expect(finalReservationResponse.status).toBe(200);
      expect(['released', 'expired']).toContain(finalReservationResponse.data.status);
      
      const cartResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/cart/${session.sessionId}`
      );
      expect(cartResponse.status).toBe(200);
      expect(cartResponse.data.items).toHaveLength(2); // Cart restored
    });
  });

  describe('Performance Validation', () => {
    it('should meet end-to-end latency requirements', async () => {
      const session = createTestSession('perf-001', 150.00);
      const testQueries = [
        "I need milk and bread",
        "organic vegetables for salad",
        "chicken breast and rice",
        "gluten-free snacks for kids"
      ];
      
      const latencyResults: number[] = [];
      
      for (const query of testQueries) {
        const startTime = Date.now();
        
        // Complete pipeline: Session → NLP → Matching → Pricing → Cart
        await axiosClient.post(`${API_BASE}/api/grocery/session`, { 
          ...session, 
          sessionId: `${session.sessionId}-${Date.now()}` 
        });
        
        const nlpResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
          query,
          sessionId: session.sessionId
        });
        
        const matchingResponse = await axiosClient.post(`${API_BASE}/api/grocery/match-products`, {
          sessionId: session.sessionId,
          nlpResults: nlpResponse.data
        });
        
        const pricingResponse = await axiosClient.post(`${PRICING_BASE}/pricing/bulk-quote`, {
          productIds: matchingResponse.data.matches.map((m: any) => m.productId),
          sessionId: session.sessionId
        });
        
        await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
          sessionId: session.sessionId,
          items: matchingResponse.data.matches.map((m: any, index: number) => ({
            productId: m.productId,
            quantity: 1,
            price: pricingResponse.data.items[index].price
          }))
        });
        
        const endTime = Date.now();
        latencyResults.push(endTime - startTime);
      }
      
      const avgLatency = latencyResults.reduce((a, b) => a + b, 0) / latencyResults.length;
      const maxLatency = Math.max(...latencyResults);
      
      // Performance requirements
      expect(avgLatency).toBeLessThan(3000); // Average under 3 seconds
      expect(maxLatency).toBeLessThan(5000); // Max under 5 seconds
      expect(latencyResults.every(l => l < 10000)).toBe(true); // All under 10 seconds
    });

    it('should validate queue processing rates', async () => {
      const batchSize = 20;
      const queries = Array.from({ length: batchSize }, (_, i) => 
        `Test query ${i + 1} for batch processing`
      );
      
      const startTime = Date.now();
      const requestPromises = queries.map((query, index) => 
        axiosClient.post(`${NLP_BASE}/nlp/process`, {
          query,
          sessionId: `batch-${index}`,
          priority: 'normal'
        })
      );
      
      const responses = await Promise.all(requestPromises);
      const endTime = Date.now();
      
      const successfulResponses = responses.filter(r => r.status === 200);
      const processingTime = endTime - startTime;
      const throughput = (successfulResponses.length / processingTime) * 1000; // requests per second
      
      expect(successfulResponses.length).toBe(batchSize);
      expect(throughput).toBeGreaterThan(2); // At least 2 requests per second
      expect(processingTime).toBeLessThan(15000); // Under 15 seconds for batch
    });

    it('should validate cache effectiveness', async () => {
      const cacheTestQuery = "popular cached item search";
      const sessionId = 'cache-effectiveness-001';
      
      // First request (cache miss)
      const startTime1 = Date.now();
      const response1 = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: cacheTestQuery,
        sessionId
      });
      const responseTime1 = Date.now() - startTime1;
      
      expect(response1.status).toBe(200);
      
      // Second request (should be cached)
      const startTime2 = Date.now();
      const response2 = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: cacheTestQuery,
        sessionId
      });
      const responseTime2 = Date.now() - startTime2;
      
      expect(response2.status).toBe(200);
      
      // Cache should significantly improve performance
      expect(responseTime2).toBeLessThan(responseTime1 * 0.8); // At least 20% faster
      expect(responseTime2).toBeLessThan(500); // Cached response under 500ms
      
      // Verify cache hit in response metadata
      expect(response2.data.cached || response2.headers['x-cache-hit']).toBeTruthy();
    });
  });

  describe('Real-World Data Tests', () => {
    it('should handle actual Walmart product catalogs', async () => {
      // Simulate real product data structure
      const walmartProducts = [
        {
          id: 'walmart-001',
          name: 'Great Value Whole Milk, 1 Gallon',
          brand: 'Great Value',
          category: 'Dairy',
          price: 3.68,
          location: 'Dallas, TX',
          inStock: true,
          upc: '078742370460',
          nutrition: { calories: 150, fat: 8, protein: 8 }
        },
        {
          id: 'walmart-002',
          name: 'Organic Bananas, 2 lb',
          brand: 'Organic',
          category: 'Produce',
          price: 1.98,
          location: 'Dallas, TX',
          inStock: true,
          upc: '078742370461',
          organic: true
        }
      ];
      
      // Test product search and matching
      const searchResponse = await axiosClient.post(`${API_BASE}/api/grocery/search`, {
        query: "Great Value milk",
        location: "Dallas, TX",
        filters: { category: 'Dairy', inStock: true }
      });
      
      expect(searchResponse.status).toBe(200);
      expect(searchResponse.data.results).toContain(
        expect.objectContaining({
          name: expect.stringContaining('Great Value'),
          category: 'Dairy'
        })
      );
      
      // Test NLP understanding of product variations
      const nlpResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: "I need a gallon of milk and some bananas",
        sessionId: 'walmart-catalog-001',
        context: { location: 'Dallas, TX' }
      });
      
      expect(nlpResponse.status).toBe(200);
      expect(nlpResponse.data.entities).toContain(
        expect.objectContaining({
          type: 'product',
          value: expect.stringMatching(/milk|banana/i)
        })
      );
    });

    it('should handle seasonal variations and pricing', async () => {
      const seasonalProducts = [
        { id: 'seasonal-001', name: 'Pumpkins', season: 'fall', basePrice: 2.99 },
        { id: 'seasonal-002', name: 'Strawberries', season: 'spring', basePrice: 4.99 },
        { id: 'seasonal-003', name: 'Christmas Ham', season: 'winter', basePrice: 89.99 }
      ];
      
      // Test seasonal pricing adjustments
      const currentSeason = getCurrentSeason();
      const pricingResponse = await axiosClient.post(`${PRICING_BASE}/pricing/seasonal`, {
        products: seasonalProducts,
        season: currentSeason,
        location: 'Seattle, WA'
      });
      
      expect(pricingResponse.status).toBe(200);
      
      const inSeasonProducts = pricingResponse.data.products.filter(
        (p: any) => p.season === currentSeason
      );
      const outOfSeasonProducts = pricingResponse.data.products.filter(
        (p: any) => p.season !== currentSeason
      );
      
      // In-season products should be at or below base price
      inSeasonProducts.forEach((product: any) => {
        expect(product.adjustedPrice).toBeLessThanOrEqual(product.basePrice);
      });
      
      // Out-of-season products may have higher prices
      if (outOfSeasonProducts.length > 0) {
        outOfSeasonProducts.forEach((product: any) => {
          expect(product.adjustedPrice).toBeGreaterThanOrEqual(product.basePrice * 0.8);
        });
      }
    });

    it('should handle geographic price differences', async () => {
      const testLocations = [
        { zipCode: '90210', city: 'Beverly Hills', state: 'CA' },
        { zipCode: '10001', city: 'New York', state: 'NY' },
        { zipCode: '30309', city: 'Atlanta', state: 'GA' },
        { zipCode: '98101', city: 'Seattle', state: 'WA' }
      ];
      
      const productId = 'geo-test-001';
      const locationPrices: Array<{ location: string; price: number }> = [];
      
      for (const location of testLocations) {
        const pricingResponse = await axiosClient.get(
          `${PRICING_BASE}/pricing/${productId}?zipCode=${location.zipCode}`
        );
        
        if (pricingResponse.status === 200) {
          locationPrices.push({
            location: `${location.city}, ${location.state}`,
            price: pricingResponse.data.price
          });
        }
      }
      
      expect(locationPrices.length).toBeGreaterThan(1);
      
      // Prices should vary by location (accounting for cost of living, taxes, etc.)
      const prices = locationPrices.map(lp => lp.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      // Should have some geographic variation
      expect(maxPrice - minPrice).toBeGreaterThan(0);
      
      // Variation should be reasonable (not more than 50% difference)
      expect(maxPrice / minPrice).toBeLessThan(1.5);
    });
  });

  // Helper Functions
  function createTestSession(userId: string, budget?: number, restrictions?: string[], familyId?: string): ShoppingSession {
    return {
      userId,
      sessionId: `session-${userId}-${Date.now()}`,
      familyId,
      budget,
      dietaryRestrictions: restrictions,
      preferences: {
        organic: restrictions?.includes('organic') || false,
        localProduce: true,
        bulkBuying: budget && budget > 100
      }
    };
  }

  async function setupTestData(): Promise<void> {
    // Initialize mock product catalog
    mockProductCatalog = [
      {
        id: 'milk-001',
        name: 'Organic Whole Milk 1 Gallon',
        category: 'Dairy',
        price: 4.99,
        inStock: true,
        location: 'Dallas, TX',
        nutritionInfo: { organic: true },
        allergens: ['milk']
      },
      {
        id: 'bread-001',
        name: 'Gluten-Free Sandwich Bread',
        category: 'Bakery',
        price: 3.99,
        inStock: true,
        location: 'Dallas, TX',
        allergens: []
      },
      {
        id: 'chicken-001',
        name: 'Organic Chicken Breast',
        category: 'Meat',
        price: 12.99,
        inStock: true,
        location: 'Dallas, TX',
        nutritionInfo: { organic: true, protein: 25 }
      }
    ];
    
    // Cache common products for faster testing
    await redis.set('test:products', JSON.stringify(mockProductCatalog));
    
    logger.info('Test data setup complete', 'INTEGRATION_TEST', {
      products: mockProductCatalog.length
    });
  }

  async function waitForWebSocketMessage(
    messages: any[],
    condition: (message: any) => boolean,
    timeoutMs: number = 5000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (messages.some(condition)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error(`Timeout waiting for WebSocket message after ${timeoutMs}ms`);
  }

  function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  }
});