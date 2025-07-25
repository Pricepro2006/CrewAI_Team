import { z } from "zod";
import {
  router,
  publicProcedure,
  commonSchemas,
  createFeatureRouter,
} from "../trpc/enhanced-router";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../utils/timeout";
import { BrightDataService } from "../../core/data-collection/BrightDataService";
import type { CollectedData } from "../../core/data-collection/types";
import { WalmartGroceryService } from "../services/WalmartGroceryService";
import { GroceryListRepository, GroceryItemRepository } from "../../database/repositories/GroceryRepository";
import { getDatabaseManager } from "../../database/DatabaseManager";
import type { WalmartProduct } from "../../types/walmart-grocery";

// Event emitter for real-time updates
const walmartEvents = new EventEmitter();

// Input validation schemas
const walmartSchemas = {
  productSearch: z.object({
    query: z.string().min(1).max(500),
    category: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    inStock: z.boolean().optional(),
    storeId: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
  }),

  productDetails: z.object({
    productId: z.string(),
    includeReviews: z.boolean().default(false),
    includeAvailability: z.boolean().default(true),
  }),

  cartOperation: z.object({
    userId: z.string(),
    productId: z.string(),
    quantity: z.number().min(1).max(99),
    operation: z.enum(["add", "update", "remove"]),
  }),

  dealAnalysis: z.object({
    productIds: z.array(z.string()).min(1).max(50),
    dealId: z.string().optional(),
    customerId: z.string().optional(),
  }),

  scraperConfig: z.object({
    url: z.string().url(),
    extractType: z.enum(["product", "search", "category", "deals"]),
    options: z.record(z.any()).optional(),
  }),

  // List management schemas
  createList: z.object({
    userId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  }),

  updateList: z.object({
    listId: z.string(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
  }),

  addItemToList: z.object({
    listId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().min(1).max(99),
      listId: z.string().optional(),
      notes: z.string().optional(),
    })),
  }),

  removeItemFromList: z.object({
    listId: z.string(),
    itemId: z.string(),
  }),

  // Order management schemas
  createOrder: z.object({
    userId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().min(1),
      price: z.number(),
    })),
    deliveryAddress: z.string(),
    deliveryDate: z.string(),
    deliverySlot: z.string(),
  }),

  updateOrderStatus: z.object({
    orderId: z.string(),
    status: z.enum(["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
  }),

  // Preference schemas
  updatePreferences: z.object({
    userId: z.string(),
    preferences: z.object({
      dietaryRestrictions: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      favoriteCategories: z.array(z.string()).optional(),
      preferredBrands: z.array(z.string()).optional(),
      avoidBrands: z.array(z.string()).optional(),
      deliveryPreferences: z.object({
        preferredDays: z.array(z.string()).optional(),
        preferredTimeSlots: z.array(z.string()).optional(),
      }).optional(),
    }),
  }),

  // Alert schemas
  createAlert: z.object({
    userId: z.string(),
    productId: z.string(),
    alertType: z.enum(["price_drop", "back_in_stock", "deal"]),
    targetPrice: z.number().optional(),
  }),

  // Price tracking schemas
  trackPrice: z.object({
    productId: z.string(),
    userId: z.string(),
    targetPrice: z.number().optional(),
  }),
};

// Create the Walmart grocery router
export const walmartGroceryRouter = createFeatureRouter(
  "walmartGrocery",
  router({
    // Search for products
    searchProducts: publicProcedure
      .input(walmartSchemas.productSearch)
      .mutation(async ({ input, ctx }) => {
        logger.info("Searching Walmart products", "WALMART", {
          query: input.query,
          filters: {
            category: input.category,
            priceRange: [input.minPrice, input.maxPrice],
            inStock: input.inStock,
          },
        });

        try {
          // Use BrightData service for product search
          const brightData = new BrightDataService(
            { rateLimitPerMinute: 60 },
            ctx.mcpTools, // Pass MCP tools from context
          );

          const collectedData = await brightData.collectEcommerceData({
            platform: "walmart",
            searchKeyword: input.query,
            maxProducts: input.limit,
          });

          // Transform CollectedData to WalmartProduct format
          const searchResults: WalmartProduct[] = collectedData.map(item => ({
            id: item.data.id || item.id,
            name: item.data.name || item.data.title || '',
            description: item.data.description,
            brand: item.data.brand,
            category: item.data.category || 'Uncategorized',
            price: parseFloat(item.data.price) || 0,
            originalPrice: item.data.originalPrice ? parseFloat(item.data.originalPrice) : undefined,
            unit: item.data.unit || 'each',
            size: item.data.size,
            imageUrl: item.data.imageUrl || item.data.image,
            inStock: item.data.inStock !== false,
            stockLevel: item.data.stockLevel,
            ratings: item.data.rating ? {
              average: parseFloat(item.data.rating),
              count: parseInt(item.data.reviewCount) || 0
            } : undefined,
            nutritionalInfo: item.data.nutritionalInfo,
            allergens: item.data.allergens,
            isOrganic: item.data.isOrganic,
            isGlutenFree: item.data.isGlutenFree,
            isVegan: item.data.isVegan
          }));

          // Process with MasterOrchestrator for enhanced analysis
          const processedResults = await ctx.masterOrchestrator.processQuery({
            text: `Analyze these Walmart grocery search results for "${input.query}" and provide recommendations`,
            metadata: {
              searchResults: searchResults,
              filters: input,
              requestType: "product_search",
            },
          });

          // Store in RAG system for future reference
          await ctx.ragSystem.addDocument(
            JSON.stringify({
              query: input.query,
              results: searchResults,
              analysis: processedResults,
              timestamp: new Date(),
            }),
            {
              id: `walmart-search-${Date.now()}`,
              title: `Walmart Search: ${input.query}`,
              tags: ["walmart", "search", "grocery"],
            },
          );

          // Emit real-time update
          walmartEvents.emit("search_completed", {
            query: input.query,
            resultCount: searchResults.length,
            timestamp: new Date(),
          });

          return {
            success: true,
            products: searchResults,
            analysis: processedResults.summary,
            metadata: {
              totalResults: searchResults.length,
              searchId: `search-${Date.now()}`,
              cached: false,
            },
          };
        } catch (error) {
          logger.error("Product search failed", "WALMART", { error });
          throw new Error(
            `Failed to search products: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }),

    // Get product details with scraping
    getProductDetails: publicProcedure
      .input(walmartSchemas.productDetails)
      .query(async ({ input, ctx }) => {
        logger.info("Fetching product details", "WALMART", {
          productId: input.productId,
          options: input,
        });

        try {
          // First check RAG cache
          const cachedData = await ctx.ragSystem.search(
            `walmart product ${input.productId}`,
            1,
          );

          if (cachedData.length > 0 && cachedData[0].score > 0.8) {
            logger.info("Returning cached product data", "WALMART");
            return {
              source: "cache",
              data: cachedData[0].content,
              timestamp: cachedData[0].metadata.timestamp,
            };
          }

          // Use BrightData for fresh data
          const brightData = new BrightDataService(
            { rateLimitPerMinute: 60 },
            ctx.mcpTools,
          );

          const productUrl = `https://www.walmart.com/ip/${input.productId}`;
          const productData = await brightData.collectEcommerceData({
            platform: "walmart",
            productUrl,
            // Note: includeReviews and includeAvailability are not supported by BrightData API
            // These were part of the product details input but not used in the actual collection
          });

          // Store in RAG for future use
          if (productData && productData.length > 0 && productData[0]) {
            await ctx.ragSystem.addDocument(JSON.stringify(productData[0].data), {
              id: `walmart-product-${input.productId}`,
              title: `Walmart Product: ${input.productId}`,
              tags: ["walmart", "product", "grocery"],
              productId: input.productId,
              timestamp: new Date(),
            });
          }

          return {
            source: "fresh",
            data: productData && productData.length > 0 && productData[0] ? productData[0].data : null,
            timestamp: new Date(),
          };
        } catch (error) {
          logger.error("Failed to fetch product details", "WALMART", { error });
          throw error;
        }
      }),

    // Cart operations with deal integration
    cartOperation: publicProcedure
      .input(walmartSchemas.cartOperation)
      .mutation(async ({ input, ctx }) => {
        logger.info("Processing cart operation", "WALMART", {
          operation: input.operation,
          userId: input.userId,
          productId: input.productId,
        });

        try {
          // Get user's cart from conversation service
          let cart = await ctx.conversationService.get(`cart-${input.userId}`);

          if (!cart) {
            cart = await ctx.conversationService.create();
            await ctx.conversationService.updateTitle(
              cart.id,
              `Cart for ${input.userId}`,
            );
          }

          // Process cart operation
          let cartUpdate;
          switch (input.operation) {
            case "add":
              cartUpdate = {
                action: "add_item",
                productId: input.productId,
                quantity: input.quantity,
              };
              break;
            case "update":
              cartUpdate = {
                action: "update_quantity",
                productId: input.productId,
                quantity: input.quantity,
              };
              break;
            case "remove":
              cartUpdate = {
                action: "remove_item",
                productId: input.productId,
              };
              break;
          }

          // Check for applicable deals
          const dealAnalysis = await ctx.dealDataService.analyzeDealForProducts(
            [input.productId],
            input.userId,
          );

          // Update cart in conversation
          await ctx.conversationService.addMessage(cart.id, {
            role: "system",
            content: JSON.stringify({
              type: "cart_update",
              update: cartUpdate,
              timestamp: new Date(),
              deals: dealAnalysis,
            }),
          });

          // Emit real-time update
          walmartEvents.emit("cart_updated", {
            userId: input.userId,
            cartId: cart.id,
            operation: input.operation,
            productId: input.productId,
            timestamp: new Date(),
          });

          return {
            success: true,
            cartId: cart.id,
            operation: input.operation,
            deals: dealAnalysis,
            message: `Cart ${input.operation} successful`,
          };
        } catch (error) {
          logger.error("Cart operation failed", "WALMART", { error });
          throw error;
        }
      }),

    // Analyze deals for products
    analyzeDeal: publicProcedure
      .input(walmartSchemas.dealAnalysis)
      .query(async ({ input, ctx }) => {
        logger.info("Analyzing deals for products", "WALMART", {
          productCount: input.productIds.length,
          dealId: input.dealId,
        });

        try {
          // Get product details for all products
          const productPromises = input.productIds.map(async (productId) => {
            const cached = await ctx.ragSystem.search(
              `walmart product ${productId}`,
              1,
            );
            return cached.length > 0 ? cached[0].content : null;
          });

          const products = await Promise.all(productPromises);

          // Analyze with deal service
          const dealAnalysis = await ctx.dealDataService.analyzeDealForProducts(
            input.productIds,
            input.customerId || "default",
          );

          // Process with MasterOrchestrator for recommendations
          const analysis = await ctx.masterOrchestrator.processQuery({
            text: "Analyze these products for deal opportunities and savings",
            metadata: {
              products: products.filter(Boolean),
              dealAnalysis,
              customerId: input.customerId,
            },
          });

          return {
            products: input.productIds,
            dealAnalysis,
            recommendations: analysis.summary,
            potentialSavings: dealAnalysis.totalSavings || 0,
            applicableDeals: dealAnalysis.deals || [],
          };
        } catch (error) {
          logger.error("Deal analysis failed", "WALMART", { error });
          throw error;
        }
      }),

    // Scrape Walmart data with BrightData
    scrapeData: publicProcedure
      .input(walmartSchemas.scraperConfig)
      .mutation(async ({ input, ctx }) => {
        logger.info("Scraping Walmart data", "WALMART", {
          url: input.url,
          type: input.extractType,
        });

        try {
          const brightData = new BrightDataService(
            { rateLimitPerMinute: 60 },
            ctx.mcpTools,
          );

          let scrapedData: CollectedData[];

          switch (input.extractType) {
            case "product":
              scrapedData = await brightData.collectEcommerceData({
                platform: "walmart",
                productUrl: input.url,
                // Note: includeReviews and includeAvailability are not supported by BrightData API
                // These options were removed from the collectEcommerceData call
              });
              break;

            case "search":
            case "category":
            case "deals":
              scrapedData = await brightData.collectWebScrapingData({
                url: input.url,
                extractionPrompt: `Extract ${input.extractType} data from this Walmart page`,
                followLinks: false,
                respectRobots: true,
              });
              break;

            default:
              throw new Error(`Unknown extract type: ${input.extractType}`);
          }

          // Store scraped data
          for (const data of scrapedData) {
            await ctx.ragSystem.addDocument(JSON.stringify(data.data), {
              id: data.id,
              title: `Walmart ${input.extractType}: ${input.url}`,
              tags: ["walmart", "scraped", input.extractType],
              url: input.url,
              timestamp: new Date(),
            });
          }

          // Emit completion event
          walmartEvents.emit("scraping_completed", {
            url: input.url,
            type: input.extractType,
            recordsCollected: scrapedData.length,
          });

          return {
            success: true,
            recordsCollected: scrapedData.length,
            data: scrapedData,
            message: `Successfully scraped ${scrapedData.length} records`,
          };
        } catch (error) {
          logger.error("Scraping failed", "WALMART", { error });
          throw error;
        }
      }),

    // Subscribe to real-time updates
    onUpdate: publicProcedure
      .input(
        z.object({
          events: z.array(
            z.enum(["search", "cart", "scraping", "deals", "all"]),
          ),
          userId: z.string().optional(),
        }),
      )
      .subscription(({ input }) => {
        return observable((observer) => {
          const handlers: Record<string, (data: any) => void> = {};

          // Subscribe to requested events
          if (input.events.includes("all") || input.events.includes("search")) {
            handlers.search_completed = (data) => {
              observer.next({ type: "search_completed", data });
            };
            walmartEvents.on("search_completed", handlers.search_completed);
          }

          if (input.events.includes("all") || input.events.includes("cart")) {
            handlers.cart_updated = (data) => {
              if (!input.userId || data.userId === input.userId) {
                observer.next({ type: "cart_updated", data });
              }
            };
            walmartEvents.on("cart_updated", handlers.cart_updated);
          }

          if (
            input.events.includes("all") ||
            input.events.includes("scraping")
          ) {
            handlers.scraping_completed = (data) => {
              observer.next({ type: "scraping_completed", data });
            };
            walmartEvents.on("scraping_completed", handlers.scraping_completed);
          }

          // Cleanup on unsubscribe
          return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
              walmartEvents.off(event, handler);
            });
          };
        });
      }),

    // Get shopping recommendations
    getRecommendations: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          category: z.string().optional(),
          budget: z.number().optional(),
          dietaryRestrictions: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        logger.info("Generating shopping recommendations", "WALMART", {
          userId: input.userId,
          filters: input,
        });

        try {
          // Get user's shopping history from conversations
          const userHistory = await ctx.conversationService.search(
            `cart-${input.userId}`,
            10,
          );

          // Analyze with MasterOrchestrator
          const recommendations = await ctx.masterOrchestrator.processQuery({
            text: "Generate personalized Walmart grocery shopping recommendations",
            metadata: {
              userId: input.userId,
              shoppingHistory: userHistory,
              preferences: {
                category: input.category,
                budget: input.budget,
                dietaryRestrictions: input.dietaryRestrictions,
              },
            },
          });

          return {
            userId: input.userId,
            recommendations: recommendations.summary,
            categories: recommendations.metadata?.categories || [],
            estimatedBudget: recommendations.metadata?.budget || 0,
            timestamp: new Date(),
          };
        } catch (error) {
          logger.error("Failed to generate recommendations", "WALMART", {
            error,
          });
          throw error;
        }
      }),

    // Upload receipt for analysis
    uploadReceipt: publicProcedure
      .input(
        z.object({
          userId: z.string(),
          receiptData: z.string(), // Base64 encoded
          mimeType: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        logger.info("Processing receipt upload", "WALMART", {
          userId: input.userId,
          mimeType: input.mimeType,
        });

        try {
          // Decode and process receipt
          const buffer = Buffer.from(input.receiptData, "base64");
          const receiptId = `receipt-${Date.now()}`;

          // Store in RAG system
          await ctx.ragSystem.addDocument(buffer.toString("utf-8"), {
            id: receiptId,
            title: `Walmart Receipt - ${input.userId}`,
            userId: input.userId,
            mimeType: input.mimeType,
            uploadedAt: new Date(),
            tags: ["walmart", "receipt", "purchase"],
          });

          // Analyze with MasterOrchestrator
          const analysis = await ctx.masterOrchestrator.processQuery({
            text: "Analyze this Walmart receipt for spending patterns and savings opportunities",
            metadata: {
              receiptId,
              userId: input.userId,
            },
          });

          return {
            success: true,
            receiptId,
            analysis: analysis.summary,
            insights: analysis.metadata?.insights || [],
          };
        } catch (error) {
          logger.error("Receipt upload failed", "WALMART", { error });
          throw error;
        }
      }),

    // Get grocery lists for a user
    getLists: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching grocery lists", "WALMART", {
          userId: input.userId,
        });

        try {
          const dbManager = await getDatabaseManager();
          const lists = await dbManager.groceryLists.getUserLists(input.userId);

          return {
            lists: lists.map(list => ({
              id: list.id,
              userId: list.user_id,
              name: list.list_name,
              description: list.description,
              items: [],
              totalEstimate: list.estimated_total || 0,
              createdAt: new Date(list.created_at || Date.now()),
              updatedAt: new Date(list.updated_at || Date.now()),
              tags: [],
              isShared: false,
            })),
          };
        } catch (error) {
          logger.error("Failed to fetch lists", "WALMART", { error });
          throw error;
        }
      }),

    // Create a new grocery list
    createList: publicProcedure
      .input(walmartSchemas.createList)
      .mutation(async ({ input, ctx }) => {
        logger.info("Creating grocery list", "WALMART", input);

        try {
          const walmartService = WalmartGroceryService.getInstance();
          const list = await walmartService.createGroceryList(
            input.userId,
            input.name,
            input.description,
          );

          return {
            success: true,
            list,
          };
        } catch (error) {
          logger.error("Failed to create list", "WALMART", { error });
          throw error;
        }
      }),

    // Update a grocery list
    updateList: publicProcedure
      .input(walmartSchemas.updateList)
      .mutation(async ({ input, ctx }) => {
        logger.info("Updating grocery list", "WALMART", input);

        try {
          const dbManager = await getDatabaseManager();
          
          await dbManager.groceryLists.updateList(input.listId, {
            list_name: input.name,
            description: input.description,
            updated_at: new Date().toISOString(),
          });

          return {
            success: true,
            listId: input.listId,
          };
        } catch (error) {
          logger.error("Failed to update list", "WALMART", { error });
          throw error;
        }
      }),

    // Delete a grocery list
    deleteList: publicProcedure
      .input(z.object({ listId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        logger.info("Deleting grocery list", "WALMART", input);

        try {
          const dbManager = await getDatabaseManager();
          
          await dbManager.groceryLists.deleteList(input.listId);

          return {
            success: true,
            listId: input.listId,
          };
        } catch (error) {
          logger.error("Failed to delete list", "WALMART", { error });
          throw error;
        }
      }),

    // Add items to a list
    addItemToList: publicProcedure
      .input(walmartSchemas.addItemToList)
      .mutation(async ({ input, ctx }) => {
        logger.info("Adding items to list", "WALMART", {
          listId: input.listId,
          itemCount: input.items.length,
        });

        try {
          const walmartService = WalmartGroceryService.getInstance();
          // Transform input items to match CartItem interface
          const cartItems = input.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            listId: input.listId,
            notes: item.notes
          }));

          const items = await walmartService.addItemsToList(
            input.listId,
            cartItems,
          );

          return {
            success: true,
            items,
          };
        } catch (error) {
          logger.error("Failed to add items", "WALMART", { error });
          throw error;
        }
      }),

    // Remove item from list
    removeItemFromList: publicProcedure
      .input(walmartSchemas.removeItemFromList)
      .mutation(async ({ input, ctx }) => {
        logger.info("Removing item from list", "WALMART", input);

        try {
          const dbManager = await getDatabaseManager();
          
          await dbManager.groceryItems.deleteItem(input.itemId);

          return {
            success: true,
            listId: input.listId,
            itemId: input.itemId,
          };
        } catch (error) {
          logger.error("Failed to remove item", "WALMART", { error });
          throw error;
        }
      }),

    // Get user orders
    getOrders: publicProcedure
      .input(z.object({
        userId: z.string(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching orders", "WALMART", input);

        try {
          // For now, return mock data until order repository is implemented
          const mockOrders = [{
            id: `order-${Date.now()}`,
            userId: input.userId,
            orderNumber: `WM${Date.now()}`,
            items: [],
            subtotal: 0,
            tax: 0,
            fees: 0,
            deliveryFee: 0,
            total: 0,
            status: "pending" as const,
            orderDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveryAddress: "123 Main St",
            deliveryDate: new Date(),
            deliverySlot: "10:00 AM - 12:00 PM",
          }];

          return {
            orders: mockOrders,
            totalCount: mockOrders.length,
          };
        } catch (error) {
          logger.error("Failed to fetch orders", "WALMART", { error });
          throw error;
        }
      }),

    // Get single order details
    getOrder: publicProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching order details", "WALMART", input);

        try {
          // Mock implementation
          return {
            order: {
              id: input.orderId,
              userId: "mock-user",
              orderNumber: `WM${input.orderId}`,
              items: [],
              subtotal: 0,
              tax: 0,
              fees: 0,
              deliveryFee: 0,
              total: 0,
              status: "pending" as const,
              orderDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              deliveryAddress: "123 Main St",
              deliveryDate: new Date(),
              deliverySlot: "10:00 AM - 12:00 PM",
            },
          };
        } catch (error) {
          logger.error("Failed to fetch order", "WALMART", { error });
          throw error;
        }
      }),

    // Create a new order
    createOrder: publicProcedure
      .input(walmartSchemas.createOrder)
      .mutation(async ({ input, ctx }) => {
        logger.info("Creating order", "WALMART", input);

        try {
          const orderId = `order-${Date.now()}`;
          const orderNumber = `WM${Date.now()}`;

          // Calculate totals
          const subtotal = input.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );
          const tax = subtotal * 0.08; // 8% tax
          const deliveryFee = subtotal >= 35 ? 0 : 4.95;
          const total = subtotal + tax + deliveryFee;

          const order = {
            id: orderId,
            userId: input.userId,
            orderNumber,
            items: input.items,
            subtotal,
            tax,
            fees: 0,
            deliveryFee,
            total,
            status: "pending" as const,
            orderDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveryAddress: input.deliveryAddress,
            deliveryDate: new Date(input.deliveryDate),
            deliverySlot: input.deliverySlot,
          };

          return {
            success: true,
            order,
          };
        } catch (error) {
          logger.error("Failed to create order", "WALMART", { error });
          throw error;
        }
      }),

    // Update order status
    updateOrderStatus: publicProcedure
      .input(walmartSchemas.updateOrderStatus)
      .mutation(async ({ input, ctx }) => {
        logger.info("Updating order status", "WALMART", input);

        try {
          return {
            success: true,
            orderId: input.orderId,
            status: input.status,
          };
        } catch (error) {
          logger.error("Failed to update order status", "WALMART", { error });
          throw error;
        }
      }),

    // Track order
    trackOrder: publicProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Tracking order", "WALMART", input);

        try {
          return {
            orderId: input.orderId,
            status: "preparing",
            trackingSteps: [
              { step: "Order Placed", completed: true, timestamp: new Date() },
              { step: "Preparing", completed: true, timestamp: new Date() },
              { step: "Out for Delivery", completed: false, timestamp: null },
              { step: "Delivered", completed: false, timestamp: null },
            ],
            estimatedDelivery: new Date(),
            driverInfo: null,
          };
        } catch (error) {
          logger.error("Failed to track order", "WALMART", { error });
          throw error;
        }
      }),

    // Get user preferences
    getPreferences: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching user preferences", "WALMART", input);

        try {
          return {
            preferences: {
              dietaryRestrictions: [],
              allergies: [],
              favoriteCategories: [],
              preferredBrands: [],
              avoidBrands: [],
              deliveryPreferences: {
                preferredDays: [],
                preferredTimeSlots: [],
              },
            },
          };
        } catch (error) {
          logger.error("Failed to fetch preferences", "WALMART", { error });
          throw error;
        }
      }),

    // Update user preferences
    updatePreferences: publicProcedure
      .input(walmartSchemas.updatePreferences)
      .mutation(async ({ input, ctx }) => {
        logger.info("Updating user preferences", "WALMART", input);

        try {
          return {
            success: true,
            preferences: input.preferences,
          };
        } catch (error) {
          logger.error("Failed to update preferences", "WALMART", { error });
          throw error;
        }
      }),

    // Get deal alerts
    getAlerts: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching deal alerts", "WALMART", input);

        try {
          return {
            alerts: [],
          };
        } catch (error) {
          logger.error("Failed to fetch alerts", "WALMART", { error });
          throw error;
        }
      }),

    // Create deal alert
    createAlert: publicProcedure
      .input(walmartSchemas.createAlert)
      .mutation(async ({ input, ctx }) => {
        logger.info("Creating deal alert", "WALMART", input);

        try {
          const alertId = `alert-${Date.now()}`;

          return {
            success: true,
            alert: {
              id: alertId,
              userId: input.userId,
              productId: input.productId,
              alertType: input.alertType,
              targetPrice: input.targetPrice,
              createdAt: new Date(),
              active: true,
            },
          };
        } catch (error) {
          logger.error("Failed to create alert", "WALMART", { error });
          throw error;
        }
      }),

    // Delete deal alert
    deleteAlert: publicProcedure
      .input(z.object({ alertId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        logger.info("Deleting deal alert", "WALMART", input);

        try {
          return {
            success: true,
            alertId: input.alertId,
          };
        } catch (error) {
          logger.error("Failed to delete alert", "WALMART", { error });
          throw error;
        }
      }),

    // Track product price
    trackPrice: publicProcedure
      .input(walmartSchemas.trackPrice)
      .mutation(async ({ input, ctx }) => {
        logger.info("Setting up price tracking", "WALMART", input);

        try {
          const trackingId = `track-${Date.now()}`;

          return {
            success: true,
            tracking: {
              id: trackingId,
              productId: input.productId,
              userId: input.userId,
              targetPrice: input.targetPrice,
              currentPrice: 0,
              createdAt: new Date(),
              active: true,
            },
          };
        } catch (error) {
          logger.error("Failed to track price", "WALMART", { error });
          throw error;
        }
      }),

    // Get price history
    getPriceHistory: publicProcedure
      .input(z.object({
        productId: z.string(),
        days: z.number().optional().default(30),
      }))
      .query(async ({ input, ctx }) => {
        logger.info("Fetching price history", "WALMART", input);

        try {
          // Mock price history data
          const history = [];
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;

          for (let i = 0; i < input.days; i++) {
            history.push({
              date: new Date(now - i * dayMs),
              price: 10 + Math.random() * 5,
              available: true,
            });
          }

          return {
            productId: input.productId,
            history: history.reverse(),
            lowestPrice: Math.min(...history.map(h => h.price)),
            highestPrice: Math.max(...history.map(h => h.price)),
            averagePrice: history.reduce((sum, h) => sum + h.price, 0) / history.length,
          };
        } catch (error) {
          logger.error("Failed to fetch price history", "WALMART", { error });
          throw error;
        }
      }),
  }),
);
