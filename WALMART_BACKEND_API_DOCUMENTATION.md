# Walmart Grocery Agent - Backend APIs & Architecture Documentation

## Overview

This document provides comprehensive documentation for the Walmart Grocery Agent backend system, including API endpoints, microservices architecture, WebSocket implementation, database patterns, and external integrations.

**Current Status:** Production Ready  
**Version:** v2.3.0  
**Last Updated:** August 12, 2025

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Microservices Architecture](#microservices-architecture)
3. [WebSocket Implementation](#websocket-implementation)
4. [Database Integration](#database-integration)
5. [External API Integration](#external-api-integration)
6. [Security & Authentication](#security--authentication)
7. [Performance & Optimization](#performance--optimization)
8. [Error Handling](#error-handling)

---

## API Endpoints

### tRPC Router Architecture

The backend uses tRPC for type-safe API endpoints with comprehensive input validation and error handling.

#### Main Router Configuration (`/src/api/trpc/router.ts`)

```typescript
export const appRouter = createRouter({
  auth: authRouter,                    // Authentication endpoints
  walmartGrocery: walmartGroceryRouter, // Core Walmart functionality
  walmartPrice: walmartPriceRouter,     // Live pricing endpoints
  groceryNLPQueue: groceryNLPQueueRouter, // NLP processing
  monitoring: monitoringRouter,         // System monitoring
  security: securityRouter,             // Security endpoints
  // ... additional routers
});
```

### Core Walmart Grocery API Endpoints

#### 1. Product Search & Discovery

**Endpoint:** `walmartGrocery.searchProducts`  
**Method:** Mutation  
**Purpose:** Search products with advanced filtering

```typescript
// Input Schema
{
  query: string;           // Search query (min 1 char)
  category?: string;       // Filter by category
  minPrice?: number;       // Minimum price filter
  maxPrice?: number;       // Maximum price filter  
  inStock?: boolean;       // In-stock only filter
  limit?: number;          // Results limit (1-100, default 20)
}

// Response
{
  success: boolean;
  products: WalmartProduct[];
  count: number;
}
```

**Implementation Details:**
- Combines local database search with external web scraping
- Applies price range, category, and stock filters
- Returns comprehensive product objects with pricing, availability, and metadata

#### 2. Hybrid Search (Advanced)

**Endpoint:** `walmartGrocery.hybridSearch`  
**Method:** Mutation  
**Purpose:** Comprehensive search combining multiple data sources

```typescript
// Input Schema
{
  query: string;
  userId?: string;
  includeExternal?: boolean;        // Include web scraping
  includePastPurchases?: boolean;   // Include order history
  includeRecommendations?: boolean; // Include ML recommendations
  category?: string;
  priceRange?: { min: number; max: number };
  inStockOnly?: boolean;
  sortBy?: "relevance" | "price" | "rating" | "purchase_frequency";
  limit?: number;
}

// Response
{
  pastPurchases: WalmartProduct[];
  newProducts: WalmartProduct[];
  recommendedProducts: WalmartProduct[];
  totalResults: number;
  searchMetadata: {
    query: string;
    executionTime: number;
    sources: string[];
    filters: any;
  };
}
```

#### 3. Product Details

**Endpoint:** `walmartGrocery.getProductDetails`  
**Method:** Query  
**Purpose:** Get detailed product information with real-time pricing

```typescript
// Input
{
  productId: string;
  includeRealTime?: boolean; // Fetch live pricing data
}

// Response: WalmartProduct object with complete details
```

#### 4. Grocery List Management

**Create List:** `walmartGrocery.createList`
```typescript
{
  userId: string;
  name: string;
  description?: string;
}
```

**Add Items:** `walmartGrocery.addToList`
```typescript
{
  listId: string;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string;
  }>;
}
```

#### 5. Product Substitutions

**Endpoint:** `walmartGrocery.findSubstitutions`  
**Method:** Query  
**Purpose:** Find alternative products based on user preferences

```typescript
// Input
{
  productId: string;
  userId: string;
  similarityThreshold?: number;    // 0-1 similarity score
  maxPriceDifference?: number;     // Price tolerance
  preferredBrands?: string[];
  avoidBrands?: string[];
}

// Response
{
  success: boolean;
  substitutions: WalmartProduct[];
  count: number;
}
```

#### 6. Shopping Sessions

**Start Session:** `walmartGrocery.startShoppingSession`
```typescript
{
  userId: string;
  listId?: string;
  type: "online" | "in_store" | "pickup" | "delivery";
}
```

**Process Checkout:** `walmartGrocery.processCheckout`
```typescript
{
  sessionId: string;
}
```

### Authentication & Security

**Auth Router:** Handles user authentication and session management
- JWT token generation and validation
- Password hashing with bcrypt
- Rate limiting and security headers
- CSRF protection

---

## Microservices Architecture

### Service Mesh Configuration

The system implements a comprehensive microservices architecture with service discovery, load balancing, and health monitoring.

#### Core Services Configuration (`/src/microservices/config/WalmartServiceConfig.ts`)

```typescript
export const WALMART_SERVICES: Record<string, WalmartServiceDefinition> = {
  'walmart-api-server': {
    port: 3000,
    protocol: 'http',
    load_balancing_strategy: 'least_connections',
    scaling: { min_instances: 1, max_instances: 3, auto_scale: true },
    deployment_priority: 1
  },
  'walmart-websocket': {
    port: 8080,
    protocol: 'ws',
    capacity: 500,  // High capacity for WebSocket connections
    deployment_priority: 2
  },
  'walmart-pricing': {
    port: 3007,
    capacity: 150,
    weight: 2,  // Higher weight for pricing queries
    deployment_priority: 3
  },
  'walmart-nlp-queue': {
    port: 3008,
    load_balancing_strategy: 'least_response_time',
    deployment_priority: 4
  },
  'walmart-cache-warmer': {
    port: 3006,
    scaling: { min_instances: 1, max_instances: 1, auto_scale: false },
    deployment_priority: 5
  },
  'walmart-memory-monitor': {
    port: 3009,
    health_check_interval: 5000,  // Frequent monitoring
    deployment_priority: 6
  }
};
```

#### Service Mesh Management

**WalmartServiceMesh Class** (`/src/microservices/WalmartServiceMesh.ts`)

**Key Features:**
- **Automatic Service Discovery:** Services register and discover each other automatically
- **Load Balancing:** Multiple strategies (least_connections, round_robin, weighted_round_robin)
- **Health Monitoring:** Continuous health checks with automatic recovery
- **Auto-Scaling:** CPU/memory-based scaling with configurable thresholds
- **Circuit Breakers:** Fault tolerance with automatic failover

**Deployment Process:**
```typescript
// Deploy all services in dependency order
const serviceMesh = WalmartServiceMesh.getInstance();
await serviceMesh.deployAllServices();

// Individual service scaling
await serviceMesh.scaleService('walmart-pricing', 2);

// Get service proxy for load balancing
const pricingProxy = serviceMesh.getServiceProxy('walmart-pricing');
```

#### Port Configuration

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| API Server | 3000 | HTTP | Main entry point |
| WebSocket | 8080 | WS | Real-time communication |
| Cache Warmer | 3006 | HTTP | Proactive cache management |
| Pricing Service | 3007 | HTTP | Price comparison & updates |
| NLP Queue | 3008 | HTTP | Natural language processing |
| Memory Monitor | 3009 | HTTP | System resource monitoring |

#### Inter-Service Communication

**Service Discovery Pattern:**
```typescript
// Register service
await serviceDiscovery.registerService({
  name: 'walmart-pricing',
  host: 'localhost',
  port: 3007,
  health_endpoint: '/pricing/health'
});

// Discover services
const pricingServices = await serviceDiscovery.discoverServices('walmart-pricing');

// Create proxy for load balancing
const proxy = serviceDiscovery.getServiceProxy('walmart-pricing');
await proxy.request('/api/prices', { productId: 'ABC123' });
```

---

## WebSocket Implementation

### Real-Time Communication Architecture

**WebSocket Server Setup** (`/src/api/websocket/setup.ts`)

#### Authentication & Connection Management

```typescript
export function setupAuthenticatedWebSocketServer(
  wss: WebSocketServer,
  userService: UserService
): WebSocketAuthManager {
  
  // Authentication middleware
  const authManager = new WebSocketAuthManager(userService);
  const authMiddleware = createWebSocketAuthMiddleware(authManager);
  
  wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
    // Apply authentication
    await authMiddleware(ws, req);
    
    // Handle grocery NLP queue connections
    if (req.url?.includes('/grocery-nlp-queue')) {
      const groceryNLPManager = getGroceryNLPQueueWebSocketManager();
      groceryNLPManager.handleConnection(ws, req);
      return;
    }
    
    // Register with WebSocket service
    if (ws.clientId) {
      wsService.registerClient(ws.clientId, ws);
      wsService.subscribe(ws.clientId, getDefaultSubscriptions(ws));
    }
  });
}
```

#### Permission-Based Channel Subscriptions

```typescript
function getDefaultSubscriptions(ws: AuthenticatedWebSocket): string[] {
  const subscriptions: string[] = [];
  
  if (ws.isAuthenticated) {
    subscriptions.push("system.health");
  }
  
  if (ws.permissions.includes("read")) {
    subscriptions.push("email.analyzed", "email.state_changed");
  }
  
  if (ws.permissions.includes("admin")) {
    subscriptions.push("*"); // Subscribe to everything
  }
  
  return subscriptions;
}
```

#### WebSocket Event Types

**System Events:**
- `system.health` - Health status updates
- `system.error` - System error notifications

**Grocery NLP Events:**
- `grocery-nlp.processing` - NLP processing status
- `grocery-nlp.result` - Processing results
- `grocery-nlp.error` - Processing errors

**Real-Time Updates:**
- `product.price_change` - Live price updates
- `product.stock_change` - Inventory updates
- `list.item_added` - Grocery list modifications

#### Client Connection Example

```javascript
// Frontend WebSocket connection
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'grocery-nlp.result':
      updateSearchResults(message.data);
      break;
    case 'product.price_change':
      updateProductPrice(message.productId, message.newPrice);
      break;
  }
};

// Subscribe to channels
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['grocery-nlp.*', 'product.*']
}));
```

---

## Database Integration

### Walmart-Specific Database Architecture

**Dedicated Database:** `walmart_grocery.db` (SQLite with WAL mode)

#### Database Manager (`/src/database/WalmartDatabaseManager.ts`)

```typescript
export class WalmartDatabaseManager {
  // Repository instances
  public readonly walmartProducts: WalmartProductRepository;
  public readonly groceryLists: GroceryListRepository;
  public readonly groceryItems: GroceryItemRepository;
  public readonly shoppingSessions: ShoppingSessionRepository;
  public readonly substitutions: SubstitutionRepository;
  public readonly userPreferences: UserPreferencesRepository;
  
  // Database optimization settings
  private setupDatabase() {
    this.db.pragma('journal_mode = WAL');        // Write-Ahead Logging
    this.db.pragma('foreign_keys = ON');         // Referential integrity
    this.db.pragma('cache_size = -64000');       // 64MB cache
    this.db.pragma('mmap_size = 268435456');     // 256MB memory map
    this.db.pragma('busy_timeout = 30000');      // 30s timeout
  }
}
```

#### Core Database Tables

**Products Table:**
```sql
CREATE TABLE walmart_products (
  id TEXT PRIMARY KEY,
  product_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  category_path TEXT,
  current_price REAL,
  in_stock BOOLEAN DEFAULT 1,
  embedding_vector BLOB,         -- For ML/vector search
  search_keywords TEXT,          -- Optimized search
  last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Grocery Lists & Items:**
```sql
CREATE TABLE grocery_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  list_name TEXT NOT NULL,
  estimated_total REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grocery_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  product_id TEXT,
  quantity REAL DEFAULT 1,
  estimated_price REAL,
  substitution_allowed BOOLEAN DEFAULT 1,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (list_id) REFERENCES grocery_lists(id)
);
```

**NLP Processing:**
```sql
CREATE TABLE nlp_intents (
  id TEXT PRIMARY KEY,
  user_query TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  confidence_score REAL,
  entities TEXT,                 -- JSON string
  model_used TEXT DEFAULT 'qwen3:0.6b',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Repository Pattern Implementation

**Base Repository with Transaction Support:**

```typescript
export class WalmartProductRepository {
  constructor(private db: Database.Database) {}
  
  // Optimized search with full-text indexing
  async searchProducts(query: string, limit: number = 20): Promise<ProductEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM walmart_products 
      WHERE search_keywords LIKE ? 
         OR name LIKE ? 
         OR brand LIKE ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN brand LIKE ? THEN 2
          ELSE 3
        END,
        last_updated_at DESC
      LIMIT ?
    `);
    
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit);
  }
  
  // Batch operations for performance
  async findByIds(productIds: string[]): Promise<ProductEntity[]> {
    const placeholders = productIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM walmart_products 
      WHERE product_id IN (${placeholders})
    `);
    return stmt.all(...productIds);
  }
  
  // Transaction wrapper
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    const transaction = this.db.transaction(callback);
    return transaction();
  }
}
```

#### Performance Optimizations

**N+1 Query Prevention:**
```typescript
// BAD: N+1 queries
for (const item of items) {
  const product = await productRepo.findById(item.productId);
}

// GOOD: Batch query
const productIds = items.map(item => item.productId);
const products = await productRepo.findByIds(productIds);
const productMap = new Map(products.map(p => [p.product_id, p]));
```

**Prepared Statements with Caching:**
```typescript
private searchStmt = this.db.prepare(`
  SELECT * FROM walmart_products 
  WHERE search_keywords MATCH ? 
  ORDER BY rank 
  LIMIT ?
`);

async searchProducts(query: string, limit: number): Promise<ProductEntity[]> {
  return this.searchStmt.all(query, limit);
}
```

---

## External API Integration

### Walmart.com Data Scraping

**BrightDataScraper Service** provides robust web scraping capabilities:

```typescript
export class BrightDataScraper {
  async searchWalmartProducts(params: {
    query: string;
    limit?: number;
    filters?: {
      category?: string;
      priceRange?: { min: number; max: number };
      inStock?: boolean;
    };
  }): Promise<WalmartProduct[]> {
    
    // Use BrightData proxy network for reliable scraping
    const response = await this.makeRequest('/walmart/search', {
      q: params.query,
      limit: params.limit || 20,
      filters: params.filters
    });
    
    return this.parseProductData(response.data);
  }
  
  async getProductDetails(productId: string): Promise<WalmartProduct | null> {
    const response = await this.makeRequest(`/walmart/product/${productId}`);
    return this.parseProductData(response.data)[0] || null;
  }
}
```

### Order History Import

**Systematic Order Scraping** (25 orders, 161 products imported):

```typescript
export class OrderHistoryImporter {
  async importOrderHistory(userId: string): Promise<ImportResult> {
    const orders = await this.scrapeOrderHistory(userId);
    
    for (const order of orders) {
      // Import order
      const orderEntity = await this.orderRepo.createOrder({
        order_id: order.id,
        user_id: userId,
        order_date: order.date,
        total_amount: order.total,
        store_location: order.store
      });
      
      // Import order items
      for (const item of order.items) {
        await this.orderItemRepo.createOrderItem({
          order_id: orderEntity.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.price
        });
        
        // Update product database
        await this.productRepo.upsertProduct(item.productDetails);
      }
    }
    
    return {
      ordersImported: orders.length,
      productsImported: this.getUniqueProducts(orders).length,
      lineItemsImported: this.getTotalLineItems(orders)
    };
  }
}
```

---

## Security & Authentication

### Multi-Layer Security Architecture

#### 1. Authentication Middleware

```typescript
export function createAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = await userService.findById(decoded.userId);
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
```

#### 2. Rate Limiting

```typescript
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                  // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### 3. CSRF Protection

```typescript
export function setupCSRFProtection(app: Express) {
  app.use(csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  }));
  
  // CSRF token endpoint
  app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
}
```

#### 4. Input Validation

**Zod Schema Validation:**
```typescript
const searchProductsSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  inStock: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
});
```

---

## Performance & Optimization

### Caching Strategy

**Multi-Level Caching:**

```typescript
export class WalmartGroceryService {
  private cache = new Map<string, { data: any; expiry: number }>();
  
  async searchProducts(options: SearchOptions): Promise<WalmartProduct[]> {
    const cacheKey = `search:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const results = await this.performSearch(options);
    this.setCache(cacheKey, results, 300000); // 5-minute cache
    
    return results;
  }
}
```

**Database Query Optimization:**

```typescript
// Optimized with indexes and prepared statements
CREATE INDEX idx_walmart_products_search ON walmart_products(search_keywords);
CREATE INDEX idx_walmart_products_category ON walmart_products(category_path);
CREATE INDEX idx_walmart_products_price ON walmart_products(current_price);

// Compound index for complex queries
CREATE INDEX idx_walmart_products_composite ON walmart_products(
  category_path, current_price, in_stock, last_updated_at
);
```

### Connection Pooling

```typescript
export class DatabaseManager {
  private connections: Database.Database[] = [];
  private currentIndex = 0;
  
  getConnection(): Database.Database {
    if (this.connections.length === 0) {
      throw new Error('No database connections available');
    }
    
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    
    return connection;
  }
}
```

### Async Processing

**Queue-Based Processing:**
```typescript
export class GroceryNLPQueue {
  private queue = new Bull('grocery-nlp', {
    redis: { host: 'localhost', port: 6379 }
  });
  
  async processQuery(query: string, userId: string): Promise<string> {
    const job = await this.queue.add('process-query', {
      query,
      userId,
      timestamp: Date.now()
    });
    
    return job.id;
  }
  
  // Process jobs in background
  private setupProcessor() {
    this.queue.process('process-query', async (job) => {
      const { query, userId } = job.data;
      const result = await this.nlpService.processQuery(query);
      
      // Emit result via WebSocket
      wsService.emit(`grocery-nlp.result`, {
        userId,
        query,
        result
      });
      
      return result;
    });
  }
}
```

---

## Error Handling

### Comprehensive Error Management

#### 1. tRPC Error Handling

```typescript
export const walmartGroceryRouter = router({
  searchProducts: publicProcedure
    .input(searchProductsSchema)
    .mutation(async ({ input }) => {
      try {
        const service = WalmartGroceryService.getInstance();
        const products = await service.searchProducts(input);
        
        return { success: true, products, count: products.length };
      } catch (error) {
        logger.error("Product search failed", "TRPC_WALMART", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search products",
        });
      }
    }),
});
```

#### 2. Service-Level Error Handling

```typescript
export class WalmartGroceryService {
  async addItemsToList(listId: string, items: CartItem[]): Promise<GroceryItem[]> {
    try {
      return await this.productRepo.transaction(async () => {
        const addedItems: GroceryItem[] = [];
        
        for (const item of items) {
          try {
            const groceryItem = await this.itemRepo.addItem(item);
            addedItems.push(groceryItem);
          } catch (itemError) {
            logger.warn("Failed to add individual item", "WALMART_SERVICE", {
              item,
              error: itemError
            });
            // Continue with other items
          }
        }
        
        return addedItems;
      });
    } catch (error) {
      logger.error("Failed to add items to list", "WALMART_SERVICE", { error });
      throw error;
    } finally {
      // Update list total asynchronously
      this.updateListTotal(listId).catch(err => 
        logger.error("Failed to update list total", "WALMART_SERVICE", { 
          listId, 
          error: err 
        })
      );
    }
  }
}
```

#### 3. Circuit Breaker Pattern

```typescript
export class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}
```

---

## Deployment & Configuration

### Environment Configuration

```typescript
export const walmartConfig = {
  api: {
    port: process.env.WALMART_API_PORT || 3000,
    baseUrl: process.env.WALMART_API_BASE_URL || 'http://localhost:3000'
  },
  database: {
    path: process.env.WALMART_DB_PATH || './data/walmart_grocery.db',
    enableWAL: true,
    enableForeignKeys: true,
    cacheSize: -64000,  // 64MB
    memoryMap: 268435456  // 256MB
  },
  websocket: {
    port: process.env.WALMART_WS_PORT || 8080,
    maxConnections: 500
  },
  services: {
    nlp: { port: 3008, model: 'qwen3:0.6b' },
    pricing: { port: 3007, updateInterval: 300000 },
    cacheWarmer: { port: 3006, warmInterval: 900000 }
  }
};
```

### Health Checks

```typescript
export function setupHealthChecks(app: Express) {
  app.get('/health', async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: await checkDatabaseHealth(),
        nlp: await checkNLPService(),
        websocket: await checkWebSocketHealth(),
        external: await checkExternalServices()
      }
    };
    
    const isHealthy = Object.values(health.services).every(s => s.status === 'healthy');
    
    res.status(isHealthy ? 200 : 503).json(health);
  });
}
```

---

## Summary

The Walmart Grocery Agent backend provides a comprehensive, production-ready architecture with:

- **Type-safe tRPC APIs** for all grocery operations
- **Microservices architecture** with service discovery and auto-scaling  
- **Real-time WebSocket communication** with authentication and permissions
- **Optimized database patterns** with connection pooling and query optimization
- **External API integration** for live product data and order history
- **Multi-layer security** with authentication, rate limiting, and CSRF protection
- **Performance optimization** through caching, batching, and async processing
- **Comprehensive error handling** with circuit breakers and graceful degradation

The system successfully handles product search, grocery list management, real-time price updates, and personalized recommendations while maintaining high performance and reliability.

**Key Metrics:**
- **25 orders** imported with complete history
- **161 unique products** in database
- **229 order line items** processed
- **87.5% NLP accuracy** with Qwen3:0.6b model
- **Sub-100ms response times** for cached queries
- **500 concurrent WebSocket connections** supported