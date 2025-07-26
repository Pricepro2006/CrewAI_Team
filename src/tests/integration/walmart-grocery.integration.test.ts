/**
 * Walmart Grocery Agent Integration Test Suite
 * Comprehensive testing for all Walmart grocery functionality
 *
 * Integration Coordinator: End-to-end testing framework
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  createTestClient,
  type TestClient,
} from "../../shared/testing/test-client";
import { WebSocketTestClient } from "../../shared/testing/websocket-test-client";
import { DatabaseTestHelper } from "../../test/helpers/database-test-helper";
import { MockDataGenerator } from "../../test/helpers/mock-data-generator";
import type {
  WalmartProduct,
  ShoppingCart,
  SearchQuery,
  WalmartApiResponse,
} from "../../types/walmart-grocery";
import type {
  WalmartWebSocketEventType,
  WalmartCartItemEvent,
  WalmartOrderStatusEvent,
} from "../../types/walmart-websocket-events";
import { WALMART_CHANNELS } from "../../types/walmart-websocket-events";

describe("Walmart Grocery Agent Integration Tests", () => {
  let testClient: TestClient;
  let wsClient: WebSocketTestClient;
  let dbHelper: DatabaseTestHelper;
  let mockData: MockDataGenerator;
  let testUserId: string;
  let testStoreId: string;

  beforeAll(async () => {
    // Initialize test infrastructure
    testClient = await createTestClient({
      auth: { type: "test", userId: "test-user-walmart" },
    });

    wsClient = new WebSocketTestClient({
      url: process.env.WS_URL || "ws://localhost:3001",
      autoReconnect: false,
    });

    dbHelper = new DatabaseTestHelper();
    await dbHelper.setup();

    mockData = new MockDataGenerator();

    // Create test user and store
    testUserId = await dbHelper.createTestUser({
      email: "walmart-test@example.com",
      name: "Walmart Test User",
    });

    testStoreId = "5260"; // Test store ID
  });

  afterAll(async () => {
    await wsClient.disconnect();
    await dbHelper.cleanup();
    await testClient.close();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await dbHelper.clearTestData(["carts", "orders", "products"]);

    // Connect WebSocket
    await wsClient.connect();

    // Subscribe to test channels
    await wsClient.subscribe([
      WALMART_CHANNELS.USER_CART(testUserId),
      WALMART_CHANNELS.USER_ORDERS(testUserId),
      WALMART_CHANNELS.STORE_UPDATES(testStoreId),
    ]);
  });

  afterEach(async () => {
    // Unsubscribe from channels
    await wsClient.unsubscribeAll();

    // Reset mocks
    vi.clearAllMocks();
  });

  describe("Product Search Integration", () => {
    it("should search for products and receive real-time updates", async () => {
      const searchQuery: SearchQuery = {
        query: "organic milk",
        filters: {
          categories: ["dairy"],
          priceRange: { min: 0, max: 10 },
          availability: "in_stock",
          dietary: ["organic"],
        },
        sort: {
          field: "price",
          direction: "asc",
        },
        pagination: {
          page: 1,
          pageSize: 20,
        },
      };

      // Set up WebSocket event listener
      const searchEvents: any[] = [];
      wsClient.on("walmart.search.completed", (event) => {
        searchEvents.push(event);
      });

      // Perform search
      const response = await testClient.walmart.searchProducts(searchQuery);

      expect(response.success).toBe(true);
      expect(response.products).toBeDefined();
      expect(response.products.length).toBeGreaterThan(0);
      expect(response.analysis).toBeDefined();

      // Verify product structure
      const firstProduct = response.products[0];
      expect(firstProduct).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        price: expect.objectContaining({
          currency: "USD",
          regular: expect.any(Number),
        }),
        availability: expect.objectContaining({
          inStock: expect.any(Boolean),
        }),
      });

      // Wait for WebSocket event
      await wsClient.waitForEvent("walmart.search.completed", 5000);
      expect(searchEvents).toHaveLength(1);
      expect(searchEvents[0].data.query).toBe("organic milk");
    });

    it("should handle pagination correctly", async () => {
      const page1 = await testClient.walmart.searchProducts({
        query: "groceries",
        pagination: { page: 1, pageSize: 10 },
      });

      const page2 = await testClient.walmart.searchProducts({
        query: "groceries",
        pagination: { page: 2, pageSize: 10 },
      });

      expect(page1.products.length).toBe(10);
      expect(page2.products.length).toBeLessThanOrEqual(10);

      // Ensure no duplicate products between pages
      const page1Ids = new Set(page1.products.map((p) => p.id));
      const page2Ids = page2.products.map((p) => p.id);
      const duplicates = page2Ids.filter((id) => page1Ids.has(id));
      expect(duplicates).toHaveLength(0);
    });

    it("should cache search results appropriately", async () => {
      const query = { query: "cached search test" };

      // First search - should not be cached
      const result1 = await testClient.walmart.searchProducts(query);
      expect(result1.metadata?.cached).toBe(false);

      // Second search - should be cached
      const result2 = await testClient.walmart.searchProducts(query);
      expect(result2.metadata?.cached).toBe(true);

      // Results should be identical
      expect(result2.products).toEqual(result1.products);
    });
  });

  describe("Shopping Cart Management", () => {
    let testProduct: WalmartProduct;

    beforeEach(async () => {
      // Create a test product
      testProduct = await dbHelper.createTestProduct({
        name: "Test Grocery Item",
        price: 4.99,
        category: "produce",
      });
    });

    it("should add items to cart with real-time updates", async () => {
      const cartEvents: WalmartCartItemEvent[] = [];
      wsClient.on("walmart.cart.item_added", (event) => {
        cartEvents.push(event.data);
      });

      // Add item to cart
      const response = await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProduct.id,
        quantity: 3,
        operation: "add",
      });

      expect(response.success).toBe(true);
      expect(response.cartId).toBeDefined();

      // Wait for WebSocket event
      await wsClient.waitForEvent("walmart.cart.item_added", 3000);

      expect(cartEvents).toHaveLength(1);
      expect(cartEvents[0]).toMatchObject({
        userId: testUserId,
        action: "added",
        item: expect.objectContaining({
          productId: testProduct.id,
          quantity: 3,
        }),
      });
    });

    it("should handle cart updates and calculate totals correctly", async () => {
      // Add multiple items
      const cart1 = await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProduct.id,
        quantity: 2,
        operation: "add",
      });

      const testProduct2 = await dbHelper.createTestProduct({
        name: "Another Item",
        price: 7.99,
      });

      const cart2 = await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProduct2.id,
        quantity: 1,
        operation: "add",
      });

      // Get cart details
      const cartDetails = await testClient.walmart.getCart(testUserId);

      expect(cartDetails.items).toHaveLength(2);
      expect(cartDetails.subtotal).toBeCloseTo(17.97, 2); // (4.99 * 2) + 7.99

      // Update quantity
      const updateResponse = await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProduct.id,
        quantity: 5,
        operation: "update",
      });

      const updatedCart = await testClient.walmart.getCart(testUserId);
      expect(updatedCart.subtotal).toBeCloseTo(32.94, 2); // (4.99 * 5) + 7.99
    });

    it("should apply deals and discounts to cart", async () => {
      // Create a deal
      const deal = await dbHelper.createTestDeal({
        type: "percentage_off",
        value: 20,
        productIds: [testProduct.id],
      });

      // Add item to cart
      await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProduct.id,
        quantity: 2,
        operation: "add",
      });

      // Apply deal
      const cartWithDeal = await testClient.walmart.applyDeal({
        userId: testUserId,
        dealId: deal.id,
      });

      expect(cartWithDeal.discounts).toHaveLength(1);
      expect(cartWithDeal.discounts[0].amount).toBeCloseTo(1.998, 2); // 20% of 9.98
      expect(cartWithDeal.total).toBeCloseTo(7.982, 2);
    });

    it("should handle cart abandonment reminders", async () => {
      // Add item to cart
      await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProduct.id,
        quantity: 1,
        operation: "add",
      });

      // Simulate cart abandonment (advance time)
      await dbHelper.advanceTime(2 * 60 * 60 * 1000); // 2 hours

      // Check for abandonment event
      const abandonmentEvents: any[] = [];
      wsClient.on("walmart.cart.abandoned_reminder", (event) => {
        abandonmentEvents.push(event);
      });

      // Trigger abandonment check
      await testClient.walmart.checkAbandonedCarts();

      await wsClient.waitForEvent("walmart.cart.abandoned_reminder", 3000);
      expect(abandonmentEvents).toHaveLength(1);
      expect(abandonmentEvents[0].data.userId).toBe(testUserId);
    });
  });

  describe("Order Processing Workflow", () => {
    let testCart: ShoppingCart;
    let testProducts: WalmartProduct[];

    beforeEach(async () => {
      // Create test products and cart
      testProducts = await Promise.all([
        dbHelper.createTestProduct({ name: "Milk", price: 3.99 }),
        dbHelper.createTestProduct({ name: "Bread", price: 2.49 }),
        dbHelper.createTestProduct({ name: "Eggs", price: 4.99 }),
      ]);

      // Build cart
      for (const product of testProducts) {
        await testClient.walmart.cartOperation({
          userId: testUserId,
          productId: product.id,
          quantity: 1,
          operation: "add",
        });
      }

      testCart = await testClient.walmart.getCart(testUserId);
    });

    it("should place order and track status updates", async () => {
      const orderEvents: WalmartOrderStatusEvent[] = [];

      // Subscribe to order events
      wsClient.on("walmart.order.placed", (event) =>
        orderEvents.push(event.data),
      );
      wsClient.on("walmart.order.confirmed", (event) =>
        orderEvents.push(event.data),
      );
      wsClient.on("walmart.order.preparing", (event) =>
        orderEvents.push(event.data),
      );

      // Place order
      const orderResponse = await testClient.walmart.placeOrder({
        userId: testUserId,
        cartId: testCart.id,
        fulfillment: {
          method: "pickup",
          storeId: testStoreId,
          timeSlot: {
            date: "2025-01-25",
            startTime: "14:00",
            endTime: "15:00",
          },
        },
        payment: {
          method: "credit_card",
          token: "test-payment-token",
        },
      });

      expect(orderResponse.success).toBe(true);
      expect(orderResponse.orderId).toBeDefined();
      expect(orderResponse.order.status).toBe("pending");

      // Wait for order confirmation
      await wsClient.waitForEvent("walmart.order.confirmed", 5000);

      expect(orderEvents.length).toBeGreaterThanOrEqual(2);
      expect(
        orderEvents.find((e) => e.newStatus === "confirmed"),
      ).toBeDefined();

      // Get order details
      const orderDetails = await testClient.walmart.getOrder(
        orderResponse.orderId,
      );
      expect(orderDetails.status).toBe("confirmed");
      expect(orderDetails.items).toHaveLength(3);
      expect(orderDetails.totals.subtotal).toBeCloseTo(11.47, 2);
    });

    it("should handle order substitutions", async () => {
      // Place order with substitution preferences
      const order = await testClient.walmart.placeOrder({
        userId: testUserId,
        cartId: testCart.id,
        substitutionPreferences: {
          allow: true,
          preferences: {
            brandOnly: false,
            sizeFlexibility: "any",
            maxPriceDifference: 2.0,
          },
        },
        fulfillment: {
          method: "delivery",
          address: mockData.generateAddress(),
        },
        payment: {
          method: "walmart_pay",
        },
      });

      // Simulate substitution
      const substitutionEvent = await testClient.walmart.simulateSubstitution({
        orderId: order.orderId,
        originalProductId: testProducts[0].id,
        substituteProductId: await dbHelper
          .createTestProduct({
            name: "Organic Milk",
            price: 5.49,
          })
          .then((p) => p.id),
        reason: "out_of_stock",
      });

      // Listen for substitution event
      const subEvents: any[] = [];
      wsClient.on("walmart.order.substitution", (event) => {
        subEvents.push(event);
      });

      await wsClient.waitForEvent("walmart.order.substitution", 3000);

      expect(subEvents).toHaveLength(1);
      expect(subEvents[0].data.requiresApproval).toBe(true);
      expect(subEvents[0].data.priceDifference).toBeCloseTo(1.5, 2);
    });

    it("should track delivery progress", async () => {
      // Place delivery order
      const order = await testClient.walmart.placeOrder({
        userId: testUserId,
        cartId: testCart.id,
        fulfillment: {
          method: "delivery",
          address: mockData.generateAddress(),
          timeSlot: {
            date: "2025-01-25",
            startTime: "16:00",
            endTime: "18:00",
          },
        },
        payment: {
          method: "credit_card",
          token: "test-payment-token",
        },
      });

      // Simulate order progression
      const progressionSteps = [
        { status: "confirmed", delay: 1000 },
        { status: "preparing", delay: 2000 },
        { status: "ready", delay: 1000 },
        { status: "in_transit", delay: 3000 },
        { status: "delivered", delay: 1000 },
      ];

      const statusEvents: any[] = [];
      wsClient.on(/walmart\.order\..*/, (event) => {
        statusEvents.push(event);
      });

      // Progress through order statuses
      for (const step of progressionSteps) {
        await testClient.walmart.updateOrderStatus({
          orderId: order.orderId,
          status: step.status as any,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        });
        await new Promise((resolve) => setTimeout(resolve, step.delay));
      }

      // Verify all status transitions
      expect(statusEvents.length).toBeGreaterThanOrEqual(
        progressionSteps.length,
      );

      const finalOrder = await testClient.walmart.getOrder(order.orderId);
      expect(finalOrder.status).toBe("delivered");
      expect(finalOrder.timeline).toHaveLength(progressionSteps.length + 1); // +1 for initial placement
    });
  });

  describe("Store Operations Integration", () => {
    it("should check store inventory and availability", async () => {
      const inventoryCheck = await testClient.walmart.checkStoreInventory({
        storeId: testStoreId,
        productIds: testProducts.map((p) => p.id),
      });

      expect(inventoryCheck.store).toBeDefined();
      expect(inventoryCheck.inventory).toHaveLength(testProducts.length);

      inventoryCheck.inventory.forEach((item) => {
        expect(item).toMatchObject({
          productId: expect.any(String),
          inStock: expect.any(Boolean),
          quantity: expect.any(Number),
          aisle: expect.any(String),
        });
      });
    });

    it("should handle store service updates", async () => {
      const serviceEvents: any[] = [];
      wsClient.on("walmart.store.service_update", (event) => {
        serviceEvents.push(event);
      });

      // Update store service
      await testClient.walmart.updateStoreService({
        storeId: testStoreId,
        service: "pickup",
        status: "limited",
        reason: "High demand - extended wait times",
      });

      await wsClient.waitForEvent("walmart.store.service_update", 3000);

      expect(serviceEvents).toHaveLength(1);
      expect(serviceEvents[0].data).toMatchObject({
        storeId: testStoreId,
        service: "pickup",
        status: "limited",
      });
    });

    it("should find nearby stores with availability", async () => {
      const nearbyStores = await testClient.walmart.findNearbyStores({
        location: {
          zipCode: "72712",
          coordinates: {
            latitude: 36.3729,
            longitude: -94.2088,
          },
        },
        radius: 10, // miles
        services: ["pickup", "delivery"],
        productIds: [testProducts[0].id],
      });

      expect(nearbyStores.stores).toBeDefined();
      expect(nearbyStores.stores.length).toBeGreaterThan(0);

      nearbyStores.stores.forEach((store) => {
        expect(store).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          distance: expect.any(Number),
          services: expect.arrayContaining(["pickup"]),
          availability: expect.any(Object),
        });
      });
    });
  });

  describe("Data Collection and Scraping", () => {
    it("should scrape product data and store in RAG", async () => {
      const scrapingEvents: any[] = [];
      wsClient.on("walmart.scraping.progress", (event) => {
        scrapingEvents.push(event);
      });

      const scrapeResponse = await testClient.walmart.scrapeData({
        url: "https://www.walmart.com/ip/Great-Value-Whole-Milk/10450114",
        extractType: "product",
        options: {
          includeReviews: true,
          includeNutrition: true,
        },
      });

      expect(scrapeResponse.success).toBe(true);
      expect(scrapeResponse.recordsCollected).toBeGreaterThan(0);

      // Verify data was stored in RAG
      const ragSearch = await testClient.rag.search({
        query: "Great Value Whole Milk nutrition",
        limit: 1,
      });

      expect(ragSearch.results).toHaveLength(1);
      expect(ragSearch.results[0].score).toBeGreaterThan(0.7);
    });

    it("should handle batch scraping with rate limiting", async () => {
      const urls = [
        "https://www.walmart.com/browse/food/dairy/976759_976782",
        "https://www.walmart.com/browse/food/produce/976759_976793",
        "https://www.walmart.com/browse/food/meat-seafood/976759_976787",
      ];

      const startTime = Date.now();

      const scrapePromises = urls.map((url) =>
        testClient.walmart.scrapeData({
          url,
          extractType: "category",
        }),
      );

      const results = await Promise.all(scrapePromises);
      const endTime = Date.now();

      // Verify rate limiting (should take at least 3 seconds for 3 requests at 60/min)
      expect(endTime - startTime).toBeGreaterThanOrEqual(3000);

      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.recordsCollected).toBeGreaterThan(0);
      });
    });
  });

  describe("Recommendation Engine", () => {
    it("should generate personalized recommendations", async () => {
      // Create shopping history
      const purchaseHistory = await dbHelper.createPurchaseHistory(testUserId, {
        categories: ["dairy", "produce", "bakery"],
        brands: ["Great Value", "Marketside"],
        priceRange: { min: 2, max: 10 },
      });

      const recommendations = await testClient.walmart.getRecommendations({
        userId: testUserId,
        category: "grocery",
        budget: 50,
        dietaryRestrictions: ["gluten_free"],
      });

      expect(recommendations.recommendations).toBeDefined();
      expect(recommendations.recommendations.length).toBeGreaterThan(0);

      // Verify recommendations match user preferences
      recommendations.recommendations.forEach((rec) => {
        expect(rec.recommendationScore).toBeGreaterThan(0.5);
        expect(rec.reason).toBeDefined();

        // Check dietary restriction compliance
        if (rec.allergens) {
          const hasGluten = rec.allergens.find(
            (a) => a.type === "wheat" && a.contains,
          );
          expect(hasGluten).toBeUndefined();
        }
      });
    });

    it("should provide reorder suggestions", async () => {
      // Create order history
      const pastOrders = await dbHelper.createOrderHistory(testUserId, {
        frequentItems: testProducts.map((p) => ({
          productId: p.id,
          frequency: 4,
          lastOrdered: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        })),
      });

      const reorderSuggestions = await testClient.walmart.getRecommendations({
        userId: testUserId,
        type: "reorder",
      });

      expect(reorderSuggestions.type).toBe("reorder");
      expect(reorderSuggestions.products).toHaveLength(testProducts.length);

      // Verify products are sorted by reorder likelihood
      let previousScore = Infinity;
      reorderSuggestions.products.forEach((product) => {
        expect(product.recommendationScore).toBeLessThanOrEqual(previousScore);
        previousScore = product.recommendationScore;
      });
    });
  });

  describe("Deal and Promotion Management", () => {
    it("should find and apply applicable deals", async () => {
      // Create various deals
      const deals = await Promise.all([
        dbHelper.createTestDeal({
          type: "rollback",
          title: "Rollback on Dairy",
          discount: { type: "percentage", value: 15 },
          products: testProducts.filter((p) => p.category.name === "dairy"),
        }),
        dbHelper.createTestDeal({
          type: "bogo",
          title: "Buy One Get One Free - Bread",
          discount: { type: "bogo", value: 50 },
          products: testProducts.filter((p) => p.name.includes("Bread")),
        }),
      ]);

      // Add items to cart
      for (const product of testProducts) {
        await testClient.walmart.cartOperation({
          userId: testUserId,
          productId: product.id,
          quantity: 2,
          operation: "add",
        });
      }

      // Find applicable deals
      const applicableDeals = await testClient.walmart.findApplicableDeals({
        userId: testUserId,
        cartId: testCart.id,
      });

      expect(applicableDeals.deals).toHaveLength(2);
      expect(applicableDeals.totalSavings).toBeGreaterThan(0);

      // Apply deals
      const cartWithDeals = await testClient.walmart.applyDeals({
        userId: testUserId,
        dealIds: applicableDeals.deals.map((d) => d.id),
      });

      expect(cartWithDeals.discounts).toHaveLength(2);
      expect(cartWithDeals.total).toBeLessThan(cartWithDeals.subtotal);
    });

    it("should notify users of expiring deals", async () => {
      const dealEvents: any[] = [];
      wsClient.on("walmart.deal.expiring", (event) => {
        dealEvents.push(event);
      });

      // Create deal expiring soon
      const expiringDeal = await dbHelper.createTestDeal({
        type: "clearance",
        title: "Clearance - Final Day",
        validity: {
          endDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        },
      });

      // Trigger expiring deal check
      await testClient.walmart.checkExpiringDeals();

      await wsClient.waitForEvent("walmart.deal.expiring", 3000);

      expect(dealEvents).toHaveLength(1);
      expect(dealEvents[0].data.dealId).toBe(expiringDeal.id);
      expect(dealEvents[0].data.expiresIn).toBeLessThanOrEqual(30);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle network failures gracefully", async () => {
      // Simulate network failure
      await testClient.simulateNetworkFailure(true);

      try {
        await testClient.walmart.searchProducts({ query: "test" });
        expect.fail("Should have thrown network error");
      } catch (error: any) {
        expect(error.code).toBe("NETWORK_ERROR");
        expect(error.retryable).toBe(true);
      }

      // Restore network
      await testClient.simulateNetworkFailure(false);

      // Retry should succeed
      const retryResult = await testClient.walmart.searchProducts({
        query: "test",
      });
      expect(retryResult.success).toBe(true);
    });

    it("should handle rate limiting", async () => {
      // Make rapid requests to trigger rate limiting
      const requests = Array(10)
        .fill(null)
        .map((_, i) =>
          testClient.walmart.searchProducts({ query: `test ${i}` }),
        );

      const results = await Promise.allSettled(requests);

      const rateLimited = results.filter(
        (r) =>
          r.status === "rejected" && (r.reason as any).code === "RATE_LIMITED",
      );

      expect(rateLimited.length).toBeGreaterThan(0);

      // Verify rate limit headers
      const successfulResult = results.find((r) => r.status === "fulfilled");
      if (successfulResult && successfulResult.status === "fulfilled") {
        expect(successfulResult.value.rateLimit).toBeDefined();
        expect(successfulResult.value.rateLimit?.remaining).toBeLessThan(60);
      }
    });

    it("should recover from database failures", async () => {
      // Create cart
      await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProducts[0].id,
        quantity: 1,
        operation: "add",
      });

      // Simulate database failure
      await dbHelper.simulateFailure(true);

      try {
        await testClient.walmart.getCart(testUserId);
        expect.fail("Should have thrown database error");
      } catch (error: any) {
        expect(error.code).toBe("DATABASE_ERROR");
      }

      // Restore database
      await dbHelper.simulateFailure(false);

      // Should recover and return cached data if available
      const cart = await testClient.walmart.getCart(testUserId);
      expect(cart).toBeDefined();
      expect(cart.items).toHaveLength(1);
    });
  });

  describe("Performance and Load Testing", () => {
    it("should handle concurrent cart operations", async () => {
      const concurrentUsers = 10;
      const operationsPerUser = 5;

      const userIds = await Promise.all(
        Array(concurrentUsers)
          .fill(null)
          .map((_, i) =>
            dbHelper.createTestUser({ email: `concurrent${i}@test.com` }),
          ),
      );

      const operations = userIds.flatMap((userId) =>
        Array(operationsPerUser)
          .fill(null)
          .map((_, i) => ({
            userId,
            productId: testProducts[i % testProducts.length].id,
            quantity: Math.floor(Math.random() * 5) + 1,
            operation: "add" as const,
          })),
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(
        operations.map((op) => testClient.walmart.cartOperation(op)),
      );
      const endTime = Date.now();

      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(successful.length).toBeGreaterThan(operations.length * 0.95); // 95% success rate
      expect(endTime - startTime).toBeLessThan(10000); // Complete within 10 seconds

      // Verify cart consistency
      for (const userId of userIds) {
        const cart = await testClient.walmart.getCart(userId);
        expect(cart.items.length).toBeLessThanOrEqual(operationsPerUser);

        // Verify totals are calculated correctly
        const expectedSubtotal = cart.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        expect(cart.subtotal).toBeCloseTo(expectedSubtotal, 2);
      }
    });

    it("should maintain performance under search load", async () => {
      const searchQueries = [
        "milk",
        "bread",
        "eggs",
        "cheese",
        "butter",
        "apples",
        "bananas",
        "oranges",
        "lettuce",
        "tomatoes",
      ];

      const iterations = 5;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const query = searchQueries[i % searchQueries.length];
        const startTime = Date.now();

        await testClient.walmart.searchProducts({
          query,
          pagination: { page: 1, pageSize: 20 },
        });

        responseTimes.push(Date.now() - startTime);
      }

      const avgResponseTime =
        responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(1000); // Average under 1 second
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
    });
  });

  describe("Data Consistency and Integrity", () => {
    it("should maintain cart consistency across sessions", async () => {
      // Create cart in session 1
      const session1 = await createTestClient({
        auth: { type: "test", userId: testUserId },
      });

      await session1.walmart.cartOperation({
        userId: testUserId,
        productId: testProducts[0].id,
        quantity: 3,
        operation: "add",
      });

      const cart1 = await session1.walmart.getCart(testUserId);

      // Access cart from session 2
      const session2 = await createTestClient({
        auth: { type: "test", userId: testUserId },
      });

      const cart2 = await session2.walmart.getCart(testUserId);

      // Carts should be identical
      expect(cart2.id).toBe(cart1.id);
      expect(cart2.items).toEqual(cart1.items);
      expect(cart2.total).toBe(cart1.total);

      // Update from session 2
      await session2.walmart.cartOperation({
        userId: testUserId,
        productId: testProducts[1].id,
        quantity: 2,
        operation: "add",
      });

      // Verify update is visible in session 1
      const updatedCart1 = await session1.walmart.getCart(testUserId);
      expect(updatedCart1.items).toHaveLength(2);

      await session1.close();
      await session2.close();
    });

    it("should handle transaction rollback on order failure", async () => {
      // Add items to cart
      for (const product of testProducts) {
        await testClient.walmart.cartOperation({
          userId: testUserId,
          productId: product.id,
          quantity: 1,
          operation: "add",
        });
      }

      const cartBeforeOrder = await testClient.walmart.getCart(testUserId);

      // Attempt to place order with invalid payment
      try {
        await testClient.walmart.placeOrder({
          userId: testUserId,
          cartId: cartBeforeOrder.id,
          payment: {
            method: "credit_card",
            token: "invalid-token", // This will cause payment to fail
          },
          fulfillment: {
            method: "pickup",
            storeId: testStoreId,
          },
        });
        expect.fail("Order should have failed");
      } catch (error: any) {
        expect(error.code).toBe("PAYMENT_FAILED");
      }

      // Verify cart is unchanged
      const cartAfterFailure = await testClient.walmart.getCart(testUserId);
      expect(cartAfterFailure.items).toEqual(cartBeforeOrder.items);
      expect(cartAfterFailure.id).toBe(cartBeforeOrder.id);

      // Verify no order was created
      const orders = await testClient.walmart.getUserOrders(testUserId);
      expect(orders.orders).toHaveLength(0);
    });

    it("should prevent duplicate order submissions", async () => {
      // Add item to cart
      await testClient.walmart.cartOperation({
        userId: testUserId,
        productId: testProducts[0].id,
        quantity: 1,
        operation: "add",
      });

      const cart = await testClient.walmart.getCart(testUserId);

      // Submit order multiple times concurrently
      const orderPromises = Array(3)
        .fill(null)
        .map(() =>
          testClient.walmart.placeOrder({
            userId: testUserId,
            cartId: cart.id,
            payment: { method: "walmart_pay" },
            fulfillment: { method: "pickup", storeId: testStoreId },
          }),
        );

      const results = await Promise.allSettled(orderPromises);

      const successful = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      // Only one order should succeed
      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);

      // Verify only one order exists
      const orders = await testClient.walmart.getUserOrders(testUserId);
      expect(orders.orders).toHaveLength(1);
    });
  });
});

// WebSocket Test Client Helper
class WebSocketTestClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string | RegExp, Set<(...args: any[]) => void>> =
    new Map();
  private messageQueue: unknown[] = [];
  private connected = false;

  constructor(private config: { url: string; autoReconnect?: boolean }) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (this.config.autoReconnect) {
          setTimeout(() => this.connect(), 1000);
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  on(event: string | RegExp, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string | RegExp, handler?: (...args: any[]) => void): void {
    if (handler) {
      this.eventHandlers.get(event)?.delete(handler);
    } else {
      this.eventHandlers.delete(event);
    }
  }

  async subscribe(channels: string[]): Promise<void> {
    if (!this.connected) throw new Error("Not connected");

    this.ws!.send(
      JSON.stringify({
        type: "subscribe",
        channels,
      }),
    );
  }

  async unsubscribeAll(): Promise<void> {
    if (!this.connected) return;

    this.ws!.send(
      JSON.stringify({
        type: "unsubscribe_all",
      }),
    );
  }

  async waitForEvent(eventType: string, timeout = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const handler = (event: unknown) => {
        if ((event as any).type === eventType) {
          clearTimeout(timer);
          this.off(eventType, handler);
          resolve(event);
        }
      };

      this.on(eventType, handler);
    });
  }

  private handleMessage(message: unknown): void {
    this.messageQueue.push(message);

    // Emit to specific event handlers
    for (const [pattern, handlers] of this.eventHandlers) {
      let matches = false;

      if (typeof pattern === "string") {
        matches = (message as any).type === pattern;
      } else if (pattern instanceof RegExp) {
        matches = pattern.test((message as any).type);
      }

      if (matches) {
        handlers.forEach((handler) => handler(message));
      }
    }
  }
}
