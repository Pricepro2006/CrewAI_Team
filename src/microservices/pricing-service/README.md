# Pricing Microservice

A high-performance pricing service with 3-tier cache hierarchy for efficient price lookups and reduced API calls to external services.

## Architecture

```
Memory Cache (L1) → Redis Cache (L2) → SQLite Cache (L3) → Walmart API (L4)
     ~1ms              ~10ms              ~50ms            ~500ms+
```

### Cache Layers

1. **Memory Cache (L1)**: LRU cache with TTL for fastest lookups
2. **Redis Cache (L2)**: Distributed cache for shared state across instances  
3. **SQLite Cache (L3)**: Persistent cache with longer TTL
4. **Walmart API (L4)**: External API with rate limiting and retries

## Features

- **3-Tier Cache Hierarchy**: Optimized for speed and cache hit rates
- **Rate Limited API Access**: Intelligent rate limiting for external APIs
- **Cache Warming**: Pre-populate caches with popular products
- **Cache Invalidation**: Selective cache invalidation by product/store
- **Metrics & Monitoring**: Comprehensive metrics for cache performance
- **Real-time Updates**: WebSocket support for price streaming
- **Batch Operations**: Efficient batch processing for multiple products
- **Event-Driven**: Emits events for monitoring and integration

## Quick Start

### Standalone Service

```bash
# Start the pricing microservice
npm run start:pricing-service

# Or with environment variables
PRICING_SERVICE_PORT=3003 \
WALMART_API_KEY=your-key \
REDIS_HOST=localhost \
npm run start:pricing-service
```

### Integration Usage

```typescript
import { pricingIntegration } from './src/microservices/pricing-service';

// Initialize the service
await pricingIntegration.initialize({
  cache: {
    memory: { maxSize: 10000, ttl: 300 },
    redis: { ttl: 3600, keyPrefix: 'price:' }
  },
  api: {
    apiKey: process.env.WALMART_API_KEY,
    rateLimit: 10
  }
});

// Get a single price
const price = await pricingIntegration.getPrice({
  productId: 'PROD123',
  storeId: 'store1',
  quantity: 1,
  includePromotions: true
});

// Get batch prices
const prices = await pricingIntegration.getBatchPrices([
  { productId: 'PROD1', storeId: 'store1' },
  { productId: 'PROD2', storeId: 'store1' }
]);
```

## API Endpoints

### Single Price Lookup
```http
GET /api/pricing/price/:productId?storeId=store1&quantity=1&includePromotions=true
```

### Batch Price Lookup
```http
POST /api/pricing/prices/batch
Content-Type: application/json

{
  "products": [
    { "productId": "PROD1", "storeId": "store1", "quantity": 1 },
    { "productId": "PROD2", "storeId": "store1", "quantity": 2 }
  ],
  "strategy": "parallel"
}
```

### Cache Management
```http
POST /api/pricing/cache/control
Content-Type: application/json

{
  "action": "warm",
  "productIds": ["PROD1", "PROD2"],
  "storeIds": ["store1", "store2"]
}
```

### Metrics
```http
GET /api/pricing/metrics?reset=false
```

### Real-time Price Stream
```http
GET /api/pricing/stream/:productId?storeId=store1
```

## Configuration

### Environment Variables

```bash
# Service Configuration
PRICING_SERVICE_PORT=3003
NODE_ENV=development

# Cache Configuration
MEMORY_CACHE_SIZE=10000
MEMORY_CACHE_TTL=300
REDIS_CACHE_TTL=3600
REDIS_KEY_PREFIX=price:
SQLITE_CACHE_TTL=86400

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Walmart API Configuration
WALMART_API_URL=https://api.walmart.com
WALMART_API_KEY=your-api-key
API_RATE_LIMIT=10
API_TIMEOUT=5000
API_RETRIES=3

# Database
SQLITE_PATH=./data/price_cache.db

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Programmatic Configuration

```typescript
const pricingService = new PricingService({
  cache: {
    memory: {
      maxSize: 10000,    // Max items in memory cache
      ttl: 300           // TTL in seconds
    },
    redis: {
      ttl: 3600,         // TTL in seconds
      keyPrefix: 'price:' // Key prefix for Redis
    },
    sqlite: {
      ttl: 86400,        // TTL in seconds
      tableName: 'price_cache'
    }
  },
  api: {
    baseUrl: 'https://api.walmart.com',
    apiKey: 'your-key',
    rateLimit: 10,      // Requests per second
    timeout: 5000,      // Request timeout in ms
    retries: 3          // Max retries
  }
});
```

## Performance Optimization

### Cache Hit Rates
- **Memory Cache**: ~95% for frequently accessed items
- **Redis Cache**: ~85% for moderately accessed items  
- **SQLite Cache**: ~75% for occasionally accessed items
- **API Calls**: <5% for well-tuned caches

### Recommended TTL Settings
- **Memory**: 5 minutes (fast updates, low memory usage)
- **Redis**: 1 hour (balance between freshness and performance)
- **SQLite**: 24 hours (long-term persistence with cleanup)

### Batch Processing
- Use batch endpoints for multiple products
- Configure `batchSize` based on memory constraints
- Use parallel processing for better throughput

## Monitoring

### Key Metrics
- **Hit Rates**: Cache effectiveness by layer
- **Latency**: Response time per cache layer
- **Error Rates**: API and cache failures
- **Cache Size**: Memory usage and capacity

### Events
```typescript
pricingService.on('cache:hit', ({ level, key, latency }) => {
  console.log(`Cache hit at ${level}: ${key} (${latency}ms)`);
});

pricingService.on('api:fetch', ({ productId, latency, success }) => {
  console.log(`API fetch for ${productId}: ${latency}ms (${success})`);
});

pricingService.on('error', ({ source, error }) => {
  console.error(`Error from ${source}:`, error);
});
```

## Testing

```bash
# Run all tests
npm test src/microservices/pricing-service

# Run with coverage
npm run test:coverage -- src/microservices/pricing-service

# Run specific test
npm test src/microservices/pricing-service/__tests__/PricingService.test.ts
```

## Production Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3003
CMD ["npm", "run", "start:pricing-service"]
```

### Health Checks
The service provides a health endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "service": "pricing-microservice",
  "uptime": 3600,
  "metrics": {
    "cacheHitRate": "89.5%",
    "memoryCacheSize": "8500/10000",
    "errors": { "redis": 0, "sqlite": 0, "api": 2 }
  }
}
```

### Scaling Considerations

1. **Horizontal Scaling**: Multiple instances share Redis cache
2. **Database Scaling**: SQLite suitable for single instance, consider PostgreSQL for multi-instance
3. **Rate Limiting**: Coordinate API rate limits across instances
4. **Memory Management**: Monitor memory cache size and eviction rates

## Security

- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: Per-IP rate limiting on all endpoints  
- **Error Handling**: Sanitized error responses
- **CORS Configuration**: Environment-specific CORS origins
- **No Credential Exposure**: API keys never logged or returned

## License

MIT License - see LICENSE file for details.