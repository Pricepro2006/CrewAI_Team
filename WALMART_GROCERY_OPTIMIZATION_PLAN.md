# 🛒 Walmart Grocery Agent Optimization Plan

## 🎯 Scope: Walmart Grocery Agent ONLY
This plan is **specifically** for optimizing the Walmart Grocery Agent features:
- Live pricing integration
- Grocery list management with running totals
- Natural language grocery list building
- Real-time price updates via WebSocket

---

## ⚠️ Core Constraints
- **Ollama limit**: Max 2 concurrent operations for grocery intent parsing
- **Performance target**: <50ms for price lookups
- **WebSocket**: Single connection for all price updates
- **No over-engineering**: Simple, practical solutions only

---

## 1️⃣ Ollama Optimization for Grocery NLP

### Current Issue
- 3-4 concurrent grocery parsing requests degrade BI analysis
- Natural language processing for "add milk and eggs" needs optimization

### Proposed Solution
**Dedicated Grocery Queue with Priority**

```typescript
// src/services/GroceryNLPQueue.ts
class GroceryNLPQueue {
  private queue = new PQueue({ concurrency: 2 });
  private highPriority = new PQueue({ concurrency: 1 });
  
  // High priority for active user input
  async parseUserInput(text: string): Promise<GroceryIntent> {
    return this.highPriority.add(() => 
      ollama.generate({
        model: 'llama2:latest',
        prompt: `Parse grocery: "${text}"`,
        stream: false
      })
    );
  }
  
  // Lower priority for batch processing
  async parseBulkList(items: string[]): Promise<GroceryIntent[]> {
    return this.queue.add(() => 
      Promise.all(items.map(item => this.parseItem(item)))
    );
  }
}
```

### Configuration
```bash
# Environment variables for Walmart agent
WALMART_OLLAMA_CONCURRENCY=2
WALMART_OLLAMA_TIMEOUT=5s  # Faster timeout for grocery parsing
WALMART_OLLAMA_MODEL=llama2:7b  # Smaller model for faster response
```

### Benefits
- Prevents BI degradation
- Prioritizes active user input
- Batch processing for bulk imports

---

## 2️⃣ Live Pricing Performance

### Current State
- WebSocket connection for real-time prices
- Need to maintain <50ms response time

### Proposed Solution
**Tiered Caching Strategy**

```typescript
// src/services/WalmartPriceCache.ts
class WalmartPriceCache {
  // L1: In-memory cache (instant)
  private memCache = new LRUCache<string, Price>({ 
    max: 1000,
    ttl: 60 * 1000 // 1 minute
  });
  
  // L2: Redis cache (fast)
  private redis = new Redis();
  
  // L3: SQLite cache (persistent)
  private db = new Database('./data/walmart_prices.db');
  
  async getPrice(productId: string): Promise<Price> {
    // L1: Memory (0ms)
    if (this.memCache.has(productId)) {
      return this.memCache.get(productId);
    }
    
    // L2: Redis (1-2ms)
    const cached = await this.redis.get(`price:${productId}`);
    if (cached) {
      this.memCache.set(productId, cached);
      return cached;
    }
    
    // L3: Database (5-10ms)
    const stored = await this.db.get(productId);
    if (stored && !this.isStale(stored)) {
      await this.redis.setex(`price:${productId}`, 300, stored);
      this.memCache.set(productId, stored);
      return stored;
    }
    
    // L4: Fetch from Walmart API (100-500ms)
    const fresh = await this.fetchFromWalmart(productId);
    await this.updateAllCaches(productId, fresh);
    return fresh;
  }
}
```

### WebSocket Optimization
```typescript
// Single connection, multiple subscriptions
class WalmartWebSocketManager {
  private connection: WebSocket;
  private subscriptions = new Map<string, Set<callback>>();
  private reconnectDelay = 1000;
  
  connect() {
    this.connection = new WebSocket('wss://localhost:3000/walmart-prices');
    this.connection.on('message', this.handlePriceUpdate);
    this.connection.on('close', this.handleReconnect);
  }
  
  // Batch subscribe for grocery lists
  subscribeList(listId: string, productIds: string[]) {
    this.connection.send(JSON.stringify({
      action: 'subscribe_batch',
      listId,
      productIds
    }));
  }
}
```

---

## 3️⃣ Grocery List Running Totals

### Current State
- Need real-time total updates as items are added
- Must handle quantity changes efficiently

### Proposed Solution
**Reactive State Management**

```typescript
// src/stores/GroceryListStore.ts
class GroceryListStore {
  private items = new Map<string, GroceryItem>();
  private total = 0;
  private listeners = new Set<(total: number) => void>();
  
  addItem(item: GroceryItem) {
    this.items.set(item.id, item);
    this.recalculateTotal();
  }
  
  updateQuantity(itemId: string, quantity: number) {
    const item = this.items.get(itemId);
    if (item) {
      item.quantity = quantity;
      this.recalculateTotal();
    }
  }
  
  private recalculateTotal() {
    // Optimized calculation
    this.total = Array.from(this.items.values()).reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );
    
    // Notify listeners
    this.listeners.forEach(fn => fn(this.total));
  }
}
```

### Database Schema Optimization
```sql
-- Optimized for fast list operations
CREATE TABLE grocery_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  total REAL DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE grocery_items (
  id TEXT PRIMARY KEY,
  list_id TEXT REFERENCES grocery_lists(id),
  product_id TEXT,
  name TEXT,
  price REAL,
  quantity INTEGER DEFAULT 1,
  added_at INTEGER
);

-- Indexes for performance
CREATE INDEX idx_items_list ON grocery_items(list_id);
CREATE INDEX idx_items_product ON grocery_items(product_id);
```

---

## 4️⃣ SQLite Backup for Grocery Data

### Specific Requirements
- Backup user grocery lists
- Preserve price history
- Quick restore for user data

### Proposed Solution
**Incremental Grocery Backups**

```bash
#!/bin/bash
# scripts/backup-grocery-data.sh

# Backup grocery-specific tables only
sqlite3 data/crewai_enhanced.db <<EOF
.backup 'main' 'data/backups/grocery_$(date +%Y%m%d_%H%M%S).db' 
  grocery_lists 
  grocery_items 
  walmart_products 
  price_history
EOF

# Compress older backups
find data/backups -name "grocery_*.db" -mtime +1 -exec zstd {} \;

# Keep last 7 daily, 4 weekly
./scripts/rotate-grocery-backups.sh
```

---

## 5️⃣ Systemd Service (Walmart Agent Specific)

### User Service Configuration
```ini
# ~/.config/systemd/user/walmart-agent.service
[Unit]
Description=Walmart Grocery Agent
After=redis.service ollama.service

[Service]
Type=simple
WorkingDirectory=/home/pricepro2006/CrewAI_Team
Environment="NODE_ENV=production"
Environment="WALMART_OLLAMA_CONCURRENCY=2"
Environment="WALMART_CACHE_TTL=60"
ExecStart=/usr/bin/npm run dev:client:walmart
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

---

## 6️⃣ Reverse Proxy for Walmart Agent

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/walmart-grocery
server {
    listen 80;
    server_name grocery.local;
    
    # Main grocery UI
    location / {
        proxy_pass http://localhost:5178;
        proxy_http_version 1.1;
    }
    
    # WebSocket for live prices
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # API endpoints
    location /api/walmart/ {
        proxy_pass http://localhost:3000/api/walmart/;
        proxy_cache grocery_cache;
        proxy_cache_valid 200 1m;
    }
}
```

---

## 📊 Performance Targets

| Feature | Current | Target | Method |
|---------|---------|--------|--------|
| Price Lookup | Unknown | <50ms | 3-tier cache |
| NLP Parsing | Unknown | <2s | Priority queue |
| List Total Update | Unknown | <10ms | Reactive state |
| WebSocket Latency | Unknown | <100ms | Single connection |
| Grocery List Save | Unknown | <100ms | Batch writes |

---

## 🚀 Implementation Priority

### Phase 1: Core Performance (2 hours)
1. Implement GroceryNLPQueue with 2-operation limit
2. Set up 3-tier price caching
3. Test with concurrent operations

### Phase 2: User Experience (2 hours)
4. Optimize grocery list totals calculation
5. Implement WebSocket batching
6. Add progress indicators

### Phase 3: Reliability (1 hour)
7. Set up grocery data backups
8. Create systemd service
9. Configure nginx (optional)

---

## ✅ Success Metrics

- **NLP**: Max 2 Ollama operations, no BI degradation
- **Prices**: <50ms lookup time achieved
- **Lists**: Running totals update in <10ms
- **WebSocket**: Single stable connection
- **Backups**: Daily automated, <1min restore

---

## 🚫 NOT Doing

- ❌ Multiple Ollama models for grocery
- ❌ Distributed caching
- ❌ Complex price prediction
- ❌ Multi-region support
- ❌ GraphQL subscriptions

---

## 🔄 Rollback Plan

Each optimization independently reversible:
1. **NLP Queue**: Revert to direct calls
2. **Cache**: Disable tiers, use direct API
3. **WebSocket**: Fall back to polling
4. **Backups**: Manual backup command

---

**This plan is SPECIFICALLY for the Walmart Grocery Agent features only.**
**Ready for approval to begin implementation.**