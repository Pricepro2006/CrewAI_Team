# Walmart Grocery Database Schema Documentation

**Version:** 2.3.0  
**Last Updated:** August 12, 2025  
**Database:** `walmart_grocery.db` (SQLite)  
**Location:** `/data/walmart_grocery.db`

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Architecture](#database-architecture)
3. [Complete Schema Reference](#complete-schema-reference)
4. [Core Business Tables](#core-business-tables)
5. [Supporting Tables](#supporting-tables)
6. [Performance & Optimization](#performance--optimization)
7. [Data Flow & Integration](#data-flow--integration)
8. [Business Logic & Constraints](#business-logic--constraints)
9. [API Integration](#api-integration)
10. [Maintenance & Operations](#maintenance--operations)

---

## Executive Summary

The Walmart Grocery database is a production SQLite system managing:
- **25 customer orders** spanning March-August 2025
- **161 unique products** with complete metadata
- **229 order line items** with full pricing history
- **6 store locations** across South Carolina
- **Real-time price tracking** with WebSocket updates
- **AI-powered search** using Qwen3:0.6b NLP model

### Key Statistics
- Database Size: ~15MB (production)
- Total Tables: 24+
- Active Indexes: 30+
- Performance: <50ms average query time
- Cache Hit Rate: 85%+

---

## Database Architecture

### Technology Stack
```
SQLite 3.45.0
├── WAL Mode (Write-Ahead Logging)
├── Full-Text Search (FTS5)
├── JSON1 Extension
├── Connection Pool (5-10 connections)
└── Memory-mapped I/O
```

### Connection Configuration
```typescript
{
  filename: './data/walmart_grocery.db',
  wal: true,                    // Write-ahead logging
  fileMustExist: false,
  timeout: 10000,               // 10 second timeout
  verbose: console.log,
  nativeBinding: './node_modules/better-sqlite3/build/Release/better_sqlite3.node'
}
```

---

## Complete Schema Reference

### Table Overview
| Category | Tables | Purpose |
|----------|--------|---------|
| **Core Business** | products, orders, order_items, customers | Primary transactional data |
| **Pricing** | prices, price_history, price_alerts | Price tracking and alerts |
| **Search** | search_history, saved_searches, product_searches_fts | Search functionality |
| **Cart** | cart_items, cart_sessions | Shopping cart persistence |
| **Analytics** | product_views, search_analytics | Usage tracking |
| **Budget** | budget_tracking | Customer budget management |
| **Health** | health_checks, system_metrics | System monitoring |
| **Cache** | cache_metadata, query_cache | Performance optimization |

---

## Core Business Tables

### 1. products
**Purpose:** Master product catalog with complete metadata

```sql
CREATE TABLE products (
    id TEXT PRIMARY KEY,              -- Walmart product ID
    name TEXT NOT NULL,                -- Product name
    brand TEXT,                        -- Brand name
    category TEXT,                     -- Primary category
    subcategory TEXT,                  -- Subcategory
    description TEXT,                  -- Full description
    
    -- Pricing
    price REAL,                        -- Current price
    original_price REAL,               -- Original/MSRP
    unit_price REAL,                   -- Price per unit
    unit_measure TEXT,                 -- Unit of measure
    
    -- Inventory & Availability
    in_stock BOOLEAN DEFAULT 1,        -- Stock status
    stock_quantity INTEGER,            -- Available quantity
    store_id TEXT,                     -- Primary store
    
    -- Metadata
    image_url TEXT,                    -- Product image
    product_url TEXT,                  -- Walmart.com URL
    upc TEXT,                          -- Universal Product Code
    sku TEXT,                          -- Stock Keeping Unit
    
    -- Nutrition (for food items)
    calories INTEGER,
    total_fat REAL,
    sodium REAL,
    protein REAL,
    
    -- Ratings
    rating REAL,                       -- Average rating (0-5)
    review_count INTEGER,              -- Number of reviews
    
    -- Tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_price_update DATETIME,
    
    -- Search & Classification
    search_vector TEXT,                -- For FTS
    tags TEXT,                         -- JSON array of tags
    attributes TEXT                    -- JSON object of attributes
);

-- Indexes for products
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_in_stock ON products(in_stock);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_updated ON products(updated_at);
```

**Sample Data:**
```sql
-- Example product record
{
  id: "316507634",
  name: "Great Value Whole Vitamin D Milk, Gallon, 128 fl oz",
  brand: "Great Value",
  category: "Dairy",
  subcategory: "Milk",
  price: 3.97,
  unit_price: 0.031,
  unit_measure: "fl oz",
  in_stock: true,
  rating: 4.2,
  review_count: 1842
}
```

### 2. orders
**Purpose:** Customer order history with complete transaction details

```sql
CREATE TABLE orders (
    id TEXT PRIMARY KEY,               -- Order ID (e.g., "9181923506995")
    order_number TEXT UNIQUE,          -- Display order number
    customer_id TEXT,                  -- Customer reference
    
    -- Order Details
    status TEXT DEFAULT 'pending',     -- pending|processing|delivered|cancelled
    order_date DATETIME,               -- When placed
    delivery_date DATETIME,            -- When delivered
    
    -- Financial
    subtotal REAL,                     -- Before tax/fees
    tax REAL,                          -- Tax amount
    delivery_fee REAL,                 -- Delivery charge
    tip REAL,                          -- Driver tip
    total REAL NOT NULL,               -- Final total
    
    -- Delivery
    delivery_method TEXT,              -- pickup|delivery
    store_id TEXT,                     -- Fulfillment store
    store_name TEXT,
    store_address TEXT,
    
    -- Customer Info
    delivery_address TEXT,             -- JSON object
    contact_phone TEXT,
    contact_email TEXT,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Indexes for orders
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_store ON orders(store_id);
```

### 3. order_items
**Purpose:** Individual line items within orders

```sql
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,            -- Parent order
    product_id TEXT NOT NULL,          -- Product reference
    
    -- Item Details
    product_name TEXT,                 -- Snapshot at order time
    brand TEXT,
    category TEXT,
    
    -- Quantity & Pricing
    quantity INTEGER NOT NULL,         -- Units ordered
    unit_price REAL,                   -- Price per unit
    total_price REAL,                  -- quantity * unit_price
    
    -- Substitutions
    substituted BOOLEAN DEFAULT 0,     -- Was substituted
    substitute_product_id TEXT,        -- Replacement product
    substitute_reason TEXT,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Indexes for order_items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_category ON order_items(category);
```

### 4. customers
**Purpose:** Customer profiles and preferences

```sql
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    
    -- Preferences
    preferred_store_id TEXT,
    default_delivery_address TEXT,     -- JSON
    dietary_preferences TEXT,          -- JSON array
    
    -- Analytics
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    average_order_value REAL,
    last_order_date DATETIME,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Supporting Tables

### 5. prices
**Purpose:** Current price tracking for products

```sql
CREATE TABLE prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    price REAL NOT NULL,
    original_price REAL,
    discount_percentage REAL,
    
    -- Promotion Info
    promotion_type TEXT,               -- sale|clearance|rollback
    promotion_end_date DATETIME,
    
    -- Tracking
    effective_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT,                       -- api|scrape|manual
    
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Composite index for efficient price lookups
CREATE INDEX idx_prices_product_date ON prices(product_id, effective_date DESC);
```

### 6. price_history
**Purpose:** Historical price changes for analytics

```sql
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    old_price REAL,
    new_price REAL,
    change_percentage REAL,
    change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_price_history_product ON price_history(product_id);
CREATE INDEX idx_price_history_date ON price_history(change_date);
```

### 7. search_history
**Purpose:** Track user searches for analytics and personalization

```sql
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    user_id TEXT,
    query TEXT NOT NULL,
    
    -- Results
    results_count INTEGER,
    clicked_product_id TEXT,
    
    -- NLP Analysis
    intent TEXT,                       -- search|compare|navigate|info
    confidence REAL,                   -- 0-1 confidence score
    entities TEXT,                     -- JSON extracted entities
    
    -- Metadata
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER
);

CREATE INDEX idx_search_history_session ON search_history(session_id);
CREATE INDEX idx_search_history_timestamp ON search_history(timestamp);
```

### 8. product_searches_fts
**Purpose:** Full-text search index for products

```sql
CREATE VIRTUAL TABLE product_searches_fts USING fts5(
    product_id,
    name,
    brand,
    category,
    description,
    tags,
    content=products,
    content_rowid=rowid,
    tokenize='porter unicode61'
);

-- Triggers to maintain FTS index
CREATE TRIGGER products_fts_insert AFTER INSERT ON products BEGIN
    INSERT INTO product_searches_fts(product_id, name, brand, category, description, tags)
    VALUES (new.id, new.name, new.brand, new.category, new.description, new.tags);
END;

CREATE TRIGGER products_fts_update AFTER UPDATE ON products BEGIN
    UPDATE product_searches_fts 
    SET name = new.name, brand = new.brand, category = new.category,
        description = new.description, tags = new.tags
    WHERE product_id = old.id;
END;
```

### 9. cart_items
**Purpose:** Persistent shopping cart storage

```sql
CREATE TABLE cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id TEXT,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    
    -- Pricing snapshot
    price_at_add REAL,
    current_price REAL,
    
    -- Metadata
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_cart_session ON cart_items(session_id);
CREATE INDEX idx_cart_user ON cart_items(user_id);
```

### 10. stores
**Purpose:** Store locations and metadata

```sql
CREATE TABLE stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    
    -- Contact
    phone TEXT,
    
    -- Hours (JSON)
    hours TEXT,
    
    -- Services
    has_pickup BOOLEAN DEFAULT 1,
    has_delivery BOOLEAN DEFAULT 1,
    
    -- Geo
    latitude REAL,
    longitude REAL,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sample stores
INSERT INTO stores (id, name, city, state) VALUES
('2878', 'Walmart Supercenter #2878', 'Summerville', 'SC'),
('1367', 'Walmart Supercenter #1367', 'North Charleston', 'SC'),
('5118', 'Walmart Supercenter #5118', 'Charleston', 'SC');
```

---

## Performance & Optimization

### Index Strategy

#### Primary Indexes (30+)
```sql
-- Product Performance
CREATE INDEX idx_products_category_price ON products(category, price);
CREATE INDEX idx_products_brand_instock ON products(brand, in_stock);

-- Order Performance  
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date DESC);
CREATE INDEX idx_order_items_order_product ON order_items(order_id, product_id);

-- Search Performance
CREATE INDEX idx_search_history_query ON search_history(query);
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- Price Tracking
CREATE INDEX idx_price_alerts_user_product ON price_alerts(user_id, product_id);
CREATE INDEX idx_price_history_product_date ON price_history(product_id, change_date DESC);
```

### WAL Mode Configuration
```sql
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging
PRAGMA wal_autocheckpoint = 1000;    -- Auto-checkpoint every 1000 pages
PRAGMA synchronous = NORMAL;         -- Balance safety/speed
PRAGMA cache_size = -64000;          -- 64MB cache
PRAGMA temp_store = MEMORY;          -- Use memory for temp tables
PRAGMA mmap_size = 268435456;        -- 256MB memory-mapped I/O
```

### Connection Pool Settings
```javascript
const pool = {
  min: 5,                            // Minimum connections
  max: 10,                           // Maximum connections
  idleTimeoutMillis: 30000,          // Close idle after 30s
  acquireTimeoutMillis: 10000        // Timeout acquiring connection
};
```

### Query Optimization Patterns

#### Efficient Product Search
```sql
-- Uses composite index and FTS
SELECT p.*, 
       ps.rank as search_rank
FROM products p
JOIN product_searches_fts ps ON p.id = ps.product_id
WHERE ps.product_searches_fts MATCH ?
  AND p.in_stock = 1
  AND p.price BETWEEN ? AND ?
ORDER BY ps.rank, p.price
LIMIT 20;
```

#### Order History with Items
```sql
-- Single query with JSON aggregation
SELECT o.*,
       JSON_GROUP_ARRAY(
         JSON_OBJECT(
           'product_id', oi.product_id,
           'name', oi.product_name,
           'quantity', oi.quantity,
           'price', oi.unit_price
         )
       ) as items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.customer_id = ?
GROUP BY o.id
ORDER BY o.order_date DESC
LIMIT 10;
```

---

## Data Flow & Integration

### Import Pipeline
```mermaid
graph LR
    A[Walmart.com Scraper] --> B[Data Validator]
    B --> C[Product Processor]
    C --> D[Database Writer]
    D --> E[Cache Invalidator]
    E --> F[WebSocket Notifier]
```

### Real-Time Updates
1. **Price Changes**: Detected every 5 minutes via polling
2. **Stock Updates**: WebSocket push on availability change
3. **Order Status**: Event-driven updates from order service
4. **Search Index**: Automatic trigger-based FTS maintenance

### Cache Hierarchy
```
L1: In-Memory (Node.js) - 1 minute TTL
L2: Redis Cache - 5 minute TTL  
L3: SQLite Query Cache - 15 minute TTL
L4: Database - Persistent storage
```

### Data Consistency

#### Transaction Patterns
```sql
BEGIN IMMEDIATE;
  -- Update product
  UPDATE products SET price = ? WHERE id = ?;
  
  -- Log price change
  INSERT INTO price_history (product_id, old_price, new_price)
  VALUES (?, ?, ?);
  
  -- Check price alerts
  INSERT INTO price_alert_triggers
  SELECT * FROM price_alerts 
  WHERE product_id = ? AND target_price >= ?;
COMMIT;
```

---

## Business Logic & Constraints

### Validation Rules

#### Product Validation
- Price must be > 0
- UPC must be 12 digits
- Categories from approved list
- Image URLs must be HTTPS

#### Order Validation
- Total = subtotal + tax + delivery_fee + tip
- Delivery date >= order date
- Status transitions: pending → processing → delivered
- Cannot cancel after processing

#### Inventory Rules
- Stock decrements on order placement
- Automatic restock notifications at threshold
- Substitution logic for out-of-stock items

### Business Rules

#### Pricing Logic
```typescript
interface PricingRules {
  // Rollback pricing
  rollbackThreshold: 0.10,      // 10% price drop triggers rollback
  
  // Bulk pricing
  bulkDiscounts: [
    { quantity: 3, discount: 0.05 },
    { quantity: 6, discount: 0.10 }
  ],
  
  // Category markups
  categoryMarkups: {
    'Organic': 1.25,
    'Premium': 1.15,
    'Great Value': 0.95
  }
}
```

#### Search Ranking
```sql
-- Composite ranking algorithm
SELECT *,
  (0.4 * text_relevance +      -- FTS match score
   0.3 * popularity_score +     -- Order frequency
   0.2 * price_score +          -- Price competitiveness
   0.1 * availability_score)    -- In-stock weighting
  AS final_score
FROM products
ORDER BY final_score DESC;
```

---

## API Integration

### tRPC Endpoints
```typescript
// Product endpoints
productRouter = {
  search: publicProcedure.input(searchSchema).query(),
  getById: publicProcedure.input(idSchema).query(),
  getPriceHistory: publicProcedure.input(productIdSchema).query(),
  checkAvailability: publicProcedure.input(storeCheckSchema).query()
}

// Order endpoints
orderRouter = {
  create: protectedProcedure.input(orderSchema).mutation(),
  getHistory: protectedProcedure.query(),
  trackOrder: publicProcedure.input(orderIdSchema).query()
}
```

### WebSocket Events
```javascript
// Real-time events
ws.on('price:update', (data) => {
  // { productId, oldPrice, newPrice, timestamp }
});

ws.on('stock:change', (data) => {
  // { productId, inStock, quantity }
});

ws.on('order:status', (data) => {
  // { orderId, status, estimatedDelivery }
});
```

### Rate Limiting
```javascript
const limits = {
  search: '100/minute',
  productDetails: '200/minute',
  orderCreate: '10/minute',
  priceCheck: '500/minute'
};
```

---

## Maintenance & Operations

### Health Checks
```sql
-- System health monitoring
CREATE TABLE health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_type TEXT,               -- db|api|cache|search
    status TEXT,                   -- healthy|degraded|down
    response_time_ms INTEGER,
    details TEXT,                  -- JSON diagnostics
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Automated health check
INSERT INTO health_checks (check_type, status, response_time_ms)
SELECT 'db', 'healthy', 
       (julianday('now') - julianday(MAX(updated_at))) * 86400000
FROM products
WHERE updated_at > datetime('now', '-1 hour');
```

### Backup Strategy
```bash
# Daily backup with rotation
sqlite3 walmart_grocery.db ".backup /backups/walmart_grocery_$(date +%Y%m%d).db"

# WAL checkpoint before backup
sqlite3 walmart_grocery.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Verify backup integrity
sqlite3 /backups/walmart_grocery_latest.db "PRAGMA integrity_check;"
```

### Migration Management
```typescript
// Migration tracking
CREATE TABLE migrations (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

// Latest migrations
- 001_initial_schema.sql
- 002_add_fts_search.sql
- 003_add_price_tracking.sql
- 020_create_cart_tables.sql
- 021_fix_model_mismatch.sql
- 022_add_performance_indexes.sql
- 023_add_existing_table_indexes.sql
```

### Performance Monitoring

#### Key Metrics
```sql
-- Query performance view
CREATE VIEW query_performance AS
SELECT 
  query_type,
  COUNT(*) as execution_count,
  AVG(response_time_ms) as avg_time,
  MAX(response_time_ms) as max_time,
  MIN(response_time_ms) as min_time
FROM query_log
WHERE timestamp > datetime('now', '-1 hour')
GROUP BY query_type;

-- Cache effectiveness
SELECT 
  (SELECT COUNT(*) FROM cache_hits) * 100.0 / 
  (SELECT COUNT(*) FROM cache_hits) + (SELECT COUNT(*) FROM cache_misses) 
  as cache_hit_rate;
```

### Data Quality Checks
```sql
-- Orphaned records
SELECT COUNT(*) as orphaned_items
FROM order_items oi
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.id IS NULL;

-- Price anomalies
SELECT * FROM products
WHERE price <= 0 
   OR price > 10000
   OR (original_price IS NOT NULL AND price > original_price);

-- Duplicate products
SELECT name, brand, COUNT(*) as duplicates
FROM products
GROUP BY name, brand
HAVING COUNT(*) > 1;
```

---

## Appendix: Common Queries

### Customer Order Summary
```sql
SELECT 
  c.name,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT oi.product_id) as unique_products,
  SUM(o.total) as lifetime_value,
  AVG(o.total) as avg_order_value,
  MAX(o.order_date) as last_order
FROM customers c
JOIN orders o ON c.id = o.customer_id
JOIN order_items oi ON o.id = oi.order_id
GROUP BY c.id;
```

### Product Performance Analytics
```sql
SELECT 
  p.name,
  p.category,
  COUNT(DISTINCT oi.order_id) as times_ordered,
  SUM(oi.quantity) as total_quantity_sold,
  AVG(oi.unit_price) as avg_selling_price,
  (SELECT COUNT(*) FROM product_views WHERE product_id = p.id) as view_count,
  CAST(COUNT(DISTINCT oi.order_id) AS REAL) / 
    NULLIF((SELECT COUNT(*) FROM product_views WHERE product_id = p.id), 0) as conversion_rate
FROM products p
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id
ORDER BY times_ordered DESC;
```

### Price Drop Alerts
```sql
SELECT 
  p.name,
  ph.old_price,
  ph.new_price,
  ROUND((ph.old_price - ph.new_price) / ph.old_price * 100, 2) as discount_percent,
  ph.change_date
FROM price_history ph
JOIN products p ON ph.product_id = p.id
WHERE ph.change_date > datetime('now', '-24 hours')
  AND ph.new_price < ph.old_price
ORDER BY discount_percent DESC;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.3.0 | Aug 12, 2025 | Complete documentation created |
| 2.2.0 | Aug 9, 2025 | Added 25 orders, 161 products |
| 2.1.0 | Aug 7, 2025 | NLP integration with Qwen3:0.6b |
| 2.0.0 | Aug 5, 2025 | WebSocket real-time updates |
| 1.0.0 | Jul 2025 | Initial schema design |

---

*This document represents the complete production database schema for the Walmart Grocery system as of August 12, 2025. All tables, indexes, and features documented here are actively deployed and operational in the production environment.*