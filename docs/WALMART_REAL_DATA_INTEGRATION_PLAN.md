# Walmart Real Data Integration - Complete Implementation Plan

## Current Status (January 8, 2025)
✅ **Completed:**
- Cleared fake/realistic data from database
- Successfully fetched REAL Walmart data using BrightData MCP
- Imported 5 real products with actual prices and UPCs
- Database schema properly configured
- API endpoints working with real data

## 📋 Master Todo List

### Phase 1: BrightData Service Integration (Priority: HIGH)
- [ ] **1.1** Create BrightData MCP wrapper service
- [ ] **1.2** Add authentication and rate limiting
- [ ] **1.3** Implement retry logic for failed requests
- [ ] **1.4** Add caching layer to reduce API calls
- [ ] **1.5** Create batch fetching for multiple products

### Phase 2: Web Scraping UI Integration (Priority: HIGH)
- [ ] **2.1** Test Web Scraping UI with Walmart URLs
- [ ] **2.2** Add Walmart-specific parsing logic
- [ ] **2.3** Create product extraction templates
- [ ] **2.4** Implement automatic database updates from scraped data
- [ ] **2.5** Add validation for scraped data quality

### Phase 3: Real-Time Price Updates (Priority: MEDIUM)
- [ ] **3.1** Implement WebSocket server on port 8080
- [ ] **3.2** Create price monitoring service
- [ ] **3.3** Add price change detection logic
- [ ] **3.4** Implement client-side WebSocket listeners
- [ ] **3.5** Create notification system for price drops

### Phase 4: Data Expansion (Priority: MEDIUM)
- [ ] **4.1** Fetch 100+ products from ZIP 29301 stores
- [ ] **4.2** Add category-based fetching
- [ ] **4.3** Implement store availability checking
- [ ] **4.4** Add nutritional information extraction
- [ ] **4.5** Create product image caching system

### Phase 5: Testing & Validation (Priority: HIGH)
- [ ] **5.1** Run all 30 Playwright tests in headed mode
- [ ] **5.2** Fix any failing tests with real data
- [ ] **5.3** Create integration tests for BrightData
- [ ] **5.4** Add E2E tests for price updates
- [ ] **5.5** Validate data accuracy against Walmart.com

---

## 📝 Detailed Step-by-Step Implementation Guide

### Step 1: Create BrightData MCP Integration Service
**File:** `/src/services/BrightDataMCPService.ts`

```typescript
// TODO: Create service that wraps MCP calls
class BrightDataMCPService {
  async fetchWalmartProduct(url: string)
  async searchWalmartProducts(query: string, zip: string)
  async getBulkPrices(productIds: string[])
  async getStoreAvailability(productId: string, storeId: string)
}
```

**Actions:**
1. Create new service file
2. Implement MCP tool calls using existing MCP integration
3. Add error handling and logging
4. Create TypeScript interfaces for responses
5. Add unit tests

---

### Step 2: Enhance Web Scraping UI for Walmart
**File:** `/src/ui/components/WebScraping/WebScraping.tsx`

**Actions:**
1. Add Walmart URL detection
2. Create custom parser for Walmart product pages
3. Add "Import to Database" button
4. Show real-time import progress
5. Display success/error notifications

**Test URLs:**
- `https://www.walmart.com/ip/Great-Value-Whole-Vitamin-D-Milk-Gallon-128-fl-oz/10450114`
- `https://www.walmart.com/search?q=groceries&affinityOverride=store_led&zipcode=29301`

---

### Step 3: Implement WebSocket Price Updates
**Files:**
- `/src/services/WebSocketServer.ts`
- `/src/ui/hooks/useWebSocket.ts`

**Actions:**
1. Create WebSocket server on port 8080
2. Implement price polling service (every 5 minutes)
3. Create diff detection for price changes
4. Emit events: `price-drop`, `price-increase`, `back-in-stock`
5. Update UI components to show real-time badges

**WebSocket Events:**
```javascript
{
  type: 'PRICE_UPDATE',
  productId: 'WM_10450114',
  oldPrice: 4.83,
  newPrice: 4.49,
  timestamp: '2025-01-08T12:00:00Z'
}
```

---

### Step 4: Bulk Data Import Script
**File:** `/scripts/fetch-walmart-29301-products.ts`

**Actions:**
1. Create script to fetch products by category
2. Use BrightData MCP for each category:
   - Produce (50 items)
   - Dairy (30 items)
   - Meat & Seafood (30 items)
   - Bakery (20 items)
   - Beverages (20 items)
3. Store all data with proper error handling
4. Generate import report
5. Schedule daily updates via cron

**Categories to Fetch:**
```typescript
const CATEGORIES = [
  { name: 'Produce', query: 'fresh fruits vegetables', limit: 50 },
  { name: 'Dairy', query: 'milk cheese yogurt eggs', limit: 30 },
  { name: 'Meat', query: 'chicken beef pork fish', limit: 30 },
  { name: 'Bakery', query: 'bread bagels muffins', limit: 20 },
  { name: 'Beverages', query: 'soda juice water coffee', limit: 20 }
];
```

---

### Step 5: Fix and Run All Tests
**File:** `/tests/e2e/walmart-grocery.spec.ts`

**Actions:**
1. Update test data to use real product IDs
2. Mock BrightData responses for testing
3. Run tests in headed mode: `npm run test:walmart -- --headed`
4. Fix any failing assertions
5. Add new tests for real-time features

**Test Scenarios:**
- Search for real products (milk, eggs, bread)
- Verify real prices display correctly
- Test price alert creation
- Validate WebSocket updates
- Check budget tracker with real data

---

## 🚀 Implementation Schedule

### Day 1 (Today)
- [x] Import initial real data (COMPLETED)
- [ ] Create BrightDataMCPService.ts
- [ ] Test Web Scraping UI with 1 Walmart URL
- [ ] Document findings

### Day 2
- [ ] Implement WebSocket server
- [ ] Add price monitoring service
- [ ] Create useWebSocket hook
- [ ] Test real-time updates

### Day 3
- [ ] Build bulk import script
- [ ] Fetch 100+ products from ZIP 29301
- [ ] Store in database
- [ ] Create import reports

### Day 4
- [ ] Fix all Playwright tests
- [ ] Run full test suite
- [ ] Create integration tests
- [ ] Document test results

### Day 5
- [ ] Performance optimization
- [ ] Add caching layers
- [ ] Implement rate limiting
- [ ] Final testing and deployment prep

---

## 🎯 Success Metrics

1. **Data Quality**
   - ✅ 100+ real products in database
   - ✅ All prices match Walmart.com
   - ✅ UPCs and ratings are accurate

2. **Feature Completeness**
   - ✅ Web Scraping UI works with Walmart URLs
   - ✅ Real-time price updates via WebSocket
   - ✅ BrightData integration fully functional

3. **Test Coverage**
   - ✅ All 30 Playwright tests passing
   - ✅ Integration tests for BrightData
   - ✅ E2E tests for user workflows

4. **Performance**
   - ✅ Search returns results in <500ms
   - ✅ WebSocket updates in <100ms
   - ✅ Can handle 100+ concurrent users

---

## 🔧 Technical Requirements

### Environment Variables
```bash
BRIGHT_DATA_API_KEY=<from_mcp_config>
WALMART_ZIP_CODE=29301
WEBSOCKET_PORT=8080
PRICE_UPDATE_INTERVAL=300000  # 5 minutes
```

### Database Tables Required
- `walmart_products` ✅ (exists)
- `price_history` ✅ (exists)
- `price_alerts` ✅ (exists)
- `store_availability` ❌ (to create)
- `product_images` ❌ (to create)

### API Endpoints Needed
- `/api/walmart/fetch-product` - Fetch single product
- `/api/walmart/bulk-import` - Import multiple products
- `/api/walmart/update-prices` - Update all prices
- `/api/walmart/check-availability` - Check store stock

---

## 📚 Resources & Documentation

### BrightData MCP Commands
```typescript
// Fetch Walmart product
mcp__Bright_Data__web_data_walmart_product({ 
  url: 'walmart.com/ip/...' 
})

// Search products
mcp__Bright_Data__search_engine({ 
  query: 'site:walmart.com groceries 29301' 
})

// Scrape product page
mcp__Bright_Data__scrape_as_markdown({ 
  url: 'walmart.com/ip/...' 
})
```

### Useful Walmart URLs
- Store Locator: `https://www.walmart.com/store/finder`
- ZIP 29301 Stores:
  - Store #1326: Spartanburg, SC
  - Store #5432: Spartanburg, SC  
  - Store #3669: Spartanburg, SC

### Testing Commands
```bash
# Run specific test
npm run test:walmart -- --grep "real prices"

# Run in headed mode
npm run test:walmart -- --headed

# Debug mode
npm run test:walmart -- --debug

# Generate report
npm run test:walmart -- --reporter=html
```

---

## ⚠️ Important Notes

1. **Rate Limiting**: BrightData has rate limits - implement exponential backoff
2. **Caching**: Cache product data for 1 hour to reduce API calls
3. **Error Handling**: Always have fallbacks for API failures
4. **Data Validation**: Verify prices are reasonable ($0.01 - $1000)
5. **Security**: Never expose API keys in client-side code

---

## 🎬 Next Immediate Actions

1. **RIGHT NOW**: Test Web Scraping UI with this URL:
   ```
   https://www.walmart.com/ip/Great-Value-Whole-Vitamin-D-Milk-Gallon-128-fl-oz/10450114
   ```

2. **Create BrightDataMCPService.ts** with basic methods

3. **Run one Playwright test** to verify real data works:
   ```bash
   npx playwright test tests/e2e/data-validation-test.spec.ts --headed
   ```

4. **Start WebSocket server** for real-time updates

5. **Fetch 10 more products** using BrightData MCP

---

**Created:** January 8, 2025  
**Author:** Claude Code  
**Status:** Ready for Implementation  
**Priority:** HIGH - Complete real data integration