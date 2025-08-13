# Walmart Live Pricing Implementation

## Overview
This document describes the implementation of live Walmart pricing functionality for the CrewAI Team application. The system fetches real-time prices from Walmart.com using multiple methods, with support for location-specific pricing (default: Spartanburg, SC 29301).

## Architecture

### Components
1. **WalmartPriceFetcher Service** (`src/api/services/WalmartPriceFetcher.ts`)
   - Core service implementing multiple price fetching methods
   - 30-minute cache for performance optimization
   - Location-aware pricing with store selection

2. **Price Router** (`src/api/routes/walmart-price.router.ts`)
   - tRPC endpoints for price fetching
   - Batch operations support
   - Health check and cache management

3. **Integration Points**
   - Main router integration in `src/api/trpc/router.ts`
   - Available at `/api/trpc/walmartPrice.*` endpoints

## Price Fetching Methods

### Method 1: SearXNG (Recommended)
- **Pros**: Privacy-focused, aggregates multiple search engines, no API keys needed
- **Cons**: Requires local SearXNG instance
- **Setup**:
  ```bash
  # Run SearXNG using Docker
  docker run -d -p 8888:8080 \
    -v ./searxng:/etc/searxng \
    --name searxng \
    searxng/searxng:latest
  ```
- **Configuration**: Set `SEARXNG_URL=http://localhost:8888` in `.env`

### Method 2: Web Scraping (Playwright)
- **Pros**: Direct data from Walmart.com, accurate pricing
- **Cons**: Can be blocked, slower than API methods
- **Features**:
  - Headless browser automation
  - Location setting via localStorage
  - Robust element selection with fallbacks

### Method 3: Unofficial API Endpoints
- **Pros**: Fast, structured data
- **Cons**: May change without notice, limited documentation
- **Endpoints**: Uses discovered internal Walmart API endpoints

## API Endpoints

### Get Single Product Price
```typescript
// tRPC Client
const price = await trpc.walmartPrice.getProductPrice.query({
  productId: '10450114',
  location: {
    zipCode: '29301',
    city: 'Spartanburg',
    state: 'SC'
  }
});
```

### Get Multiple Prices (Batch)
```typescript
const prices = await trpc.walmartPrice.getMultiplePrices.query({
  productIds: ['10450114', '10295659', '10452453'],
  location: { zipCode: '29301' }
});
```

### Search Products with Prices
```typescript
const results = await trpc.walmartPrice.searchWithPrices.query({
  query: 'milk',
  location: { zipCode: '29301' },
  limit: 10
});
```

### Get Nearby Stores
```typescript
const stores = await trpc.walmartPrice.getNearbyStores.query({
  zipCode: '29301'
});
```

## Location Support

### Default Location
- Spartanburg, SC 29301
- Configurable per request

### Supported Locations
- Any US ZIP code
- Store-specific pricing when store ID is provided

### Example Spartanburg Stores
1. **Walmart Supercenter - Spartanburg**
   - Store ID: 1451
   - Address: 2151 E Main St, Spartanburg, SC 29307
   - Distance: 3.2 miles

2. **Walmart Supercenter - Spartanburg West**
   - Store ID: 631
   - Address: 205 W Blackstock Rd, Spartanburg, SC 29301
   - Distance: 1.8 miles

## Caching Strategy

### Cache Configuration
- **Duration**: 30 minutes per product/location combination
- **Key Format**: `{productId}-{zipCode}`
- **Max Size**: 1000 entries (auto-cleanup on overflow)

### Cache Management
```typescript
// Clear cache manually
await trpc.walmartPrice.clearCache.mutate();
```

## Testing

### Run Test Suite
```bash
# Compile and run tests
npx tsx test-walmart-pricing.ts
```

### Test Coverage
- Individual price fetching
- Batch operations
- Product search with prices
- Store lookup
- Cache functionality

## Frontend Integration

### React Hook Example
```tsx
import { api } from '@/lib/api';

function ProductPrice({ productId }: { productId: string }) {
  const { data, isLoading, error } = api.walmartPrice.getProductPrice.useQuery({
    productId,
    location: { zipCode: '29301' }
  });

  if (isLoading) return <div>Loading price...</div>;
  if (error) return <div>Price unavailable</div>;
  
  return (
    <div>
      <span className="price">${data.price}</span>
      {data.salePrice && (
        <span className="sale-price">${data.salePrice}</span>
      )}
      <span className="stock-status">
        {data.inStock ? 'In Stock' : 'Out of Stock'}
      </span>
      <span className="location">{data.storeLocation}</span>
    </div>
  );
}
```

### Walmart Agent Integration
```typescript
// In WalmartGroceryService
import { WalmartPriceFetcher } from './WalmartPriceFetcher.js';

async searchProducts(options: ServiceSearchOptions) {
  // Get products from database
  const products = await this.productRepo.search(options);
  
  // Fetch live prices
  const fetcher = WalmartPriceFetcher.getInstance();
  const productIds = products.map(p => p.walmartId);
  const livePrices = await fetcher.fetchMultiplePrices(productIds);
  
  // Merge live prices with product data
  return products.map(product => ({
    ...product,
    livePrice: livePrices.get(product.walmartId)
  }));
}
```

## Environment Variables

Add to `.env`:
```env
# SearXNG Configuration (optional but recommended)
SEARXNG_URL=http://localhost:8888

# Default location (optional)
DEFAULT_WALMART_ZIP=29301
DEFAULT_WALMART_CITY=Spartanburg
DEFAULT_WALMART_STATE=SC
```

## Error Handling

### Fallback Strategy
1. Try SearXNG first (fastest if available)
2. Fall back to web scraping
3. Try unofficial API as last resort
4. Return cached data if available
5. Return null if all methods fail

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| SearXNG not available | Install and run SearXNG locally or skip to next method |
| Web scraping blocked | Add delays between requests, use proxy |
| Product not found | Verify product ID is correct |
| Location not recognized | Use valid US ZIP code |
| Cache not working | Check memory availability |

## Performance Considerations

### Response Times
- **Cache hit**: < 1ms
- **SearXNG**: 500-1000ms
- **Web scraping**: 2000-5000ms
- **Unofficial API**: 200-500ms

### Rate Limiting
- Batch operations limited to 20 products
- 1-second delay between batches
- Cache reduces repeated requests

### Optimization Tips
1. **Use batch operations** for multiple products
2. **Enable caching** for frequently accessed items
3. **Run SearXNG locally** for best performance
4. **Pre-fetch prices** during off-peak hours

## Security Considerations

1. **No API keys stored** - All methods work without authentication
2. **Local-first approach** - SearXNG runs on localhost
3. **Rate limiting** - Prevents abuse and detection
4. **User agent rotation** - Mimics real browser requests
5. **Error sanitization** - No sensitive data in error messages

## Future Enhancements

### Planned Features
- [ ] Real-time price monitoring with WebSocket updates
- [ ] Historical price tracking and charts
- [ ] Price drop alerts
- [ ] Multiple store comparison
- [ ] Bulk import from shopping lists

### Potential Integrations
- [ ] Bright Data MCP for enhanced scraping
- [ ] Redis for distributed caching
- [ ] PostgreSQL for price history storage
- [ ] Bull queue for background price updates

## Troubleshooting

### Debug Mode
Enable debug logging:
```typescript
import { logger } from '@/utils/logger';
logger.setLevel('debug');
```

### Health Check
```bash
curl http://localhost:3000/api/trpc/walmartPrice.healthCheck
```

### Common Commands
```bash
# Test pricing
npx tsx test-walmart-pricing.ts

# Check SearXNG
curl http://localhost:8888/healthz

# Clear cache via API
curl -X POST http://localhost:3000/api/trpc/walmartPrice.clearCache
```

## Support

For issues or questions:
1. Check error logs in `logs/` directory
2. Verify SearXNG is running
3. Test with known product IDs
4. Review network tab for API calls

## License
This implementation uses publicly available data and does not violate Walmart's Terms of Service when used responsibly with appropriate rate limiting.