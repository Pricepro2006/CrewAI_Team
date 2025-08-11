#!/usr/bin/env tsx
/**
 * Test Retry Logic for BrightData MCP Service
 */

import BrightDataMCPService from '../src/services/BrightDataMCPService.js';

async function testRetryLogic() {
  console.log('🧪 Testing Retry Logic for BrightData MCP Service\n');
  console.log('===========================================\n');
  
  const service = new BrightDataMCPService('./data/walmart_grocery.db');
  
  // Test 1: Single product fetch with retry
  console.log('📝 Test 1: Fetching single product with retry logic');
  console.log('This may fail on first attempt (10% chance) and retry automatically\n');
  
  const milkUrl = 'https://www.walmart.com/ip/10450114';
  const product = await service.fetchWalmartProduct(milkUrl, 3);
  
  if (product) {
    console.log('✅ Product fetched successfully:');
    console.log(`  Name: ${product.name}`);
    console.log(`  Price: $${product.current_price}`);
    console.log(`  In Stock: ${product.in_stock ? 'Yes' : 'No'}\n`);
  } else {
    console.log('❌ Failed to fetch product after all retries\n');
  }
  
  // Test 2: Search with retry
  console.log('📝 Test 2: Searching products with retry logic');
  console.log('This may fail on first attempt (10% chance) and retry automatically\n');
  
  const searchResults = await service.searchWalmartProducts('milk eggs bread', '29301', 5, 3);
  
  if (searchResults.length > 0) {
    console.log(`✅ Search returned ${searchResults.length} products:`);
    searchResults.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - $${p.current_price}`);
    });
    console.log();
  } else {
    console.log('❌ Search failed after all retries\n');
  }
  
  // Test 3: Bulk price fetch with retry
  console.log('📝 Test 3: Bulk price fetch with retry logic\n');
  
  const productIds = ['10450114', '172844767', '44390948'];
  const prices = await service.getBulkPrices(productIds);
  
  if (prices.size > 0) {
    console.log(`✅ Fetched ${prices.size} prices:`);
    prices.forEach((price, id) => {
      console.log(`  ${id}: $${price.toFixed(2)}`);
    });
    console.log();
  } else {
    console.log('❌ Bulk price fetch failed\n');
  }
  
  // Test 4: Store availability with retry
  console.log('📝 Test 4: Store availability check with retry\n');
  
  const availability = await service.getStoreAvailability('10450114', '1326');
  
  if (availability) {
    console.log('✅ Store availability checked:');
    console.log(`  Store: ${availability.storeName}`);
    console.log(`  In Stock: ${availability.inStock ? 'Yes' : 'No'}`);
    console.log(`  Quantity: ${availability.quantity || 'N/A'}\n`);
  } else {
    console.log('❌ Availability check failed\n');
  }
  
  console.log('===========================================');
  console.log('✅ Retry Logic Test Complete!');
  console.log('===========================================\n');
  
  console.log('📌 Summary:');
  console.log('• Retry logic implemented with exponential backoff');
  console.log('• Default 3 retry attempts for all operations');
  console.log('• Delays: 1s, 2s, 4s between retries');
  console.log('• All failed attempts are logged for debugging');
  console.log('• Successful responses are cached to reduce API calls\n');
  
  service.close();
}

// Run test
testRetryLogic().catch(console.error);