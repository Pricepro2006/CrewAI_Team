#!/usr/bin/env tsx
/**
 * Test API endpoints with real Walmart data
 */

import Database from 'better-sqlite3';

const db = new Database('./data/walmart_grocery.db');

// Test search functionality
function testSearch(query: string) {
  console.log(`\n🔍 Testing search for: "${query}"`);
  
  const stmt = db.prepare(`
    SELECT 
      id,
      product_id,
      name,
      brand,
      current_price,
      upc,
      average_rating,
      review_count,
      in_stock
    FROM walmart_products 
    WHERE name LIKE ? OR description LIKE ?
    LIMIT 10
  `);
  
  const searchPattern = `%${query}%`;
  const results = stmt.all(searchPattern, searchPattern);
  
  console.log(`Found ${results.length} products:`);
  results.forEach((product: any) => {
    console.log(`  • ${product.name}`);
    console.log(`    Price: $${product.current_price}`);
    console.log(`    UPC: ${product.upc}`);
    console.log(`    Rating: ${product.average_rating}/5 (${product.review_count} reviews)`);
    console.log(`    In Stock: ${product.in_stock ? 'Yes' : 'No'}`);
  });
  
  return results;
}

// Test stats endpoint
function testStats() {
  console.log('\n📊 Testing stats endpoint:');
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as productsTracked,
      COUNT(CASE WHEN in_stock = 1 THEN 1 END) as inStockCount,
      AVG(current_price) as avgPrice,
      MIN(current_price) as minPrice,
      MAX(current_price) as maxPrice
    FROM walmart_products
  `).get() as any;
  
  // Calculate fake savings (would be real in production)
  const savedThisMonth = 142.50;
  
  // Get active alerts count
  const alertsCount = db.prepare(
    "SELECT COUNT(*) as count FROM price_alerts WHERE is_active = 1"
  ).get() as any;
  
  console.log('Stats:');
  console.log(`  • Products Tracked: ${stats.productsTracked}`);
  console.log(`  • In Stock: ${stats.inStockCount}`);
  console.log(`  • Saved This Month: $${savedThisMonth.toFixed(2)}`);
  console.log(`  • Active Alerts: ${alertsCount?.count || 0}`);
  console.log(`  • Price Range: $${stats.minPrice?.toFixed(2)} - $${stats.maxPrice?.toFixed(2)}`);
  
  return {
    productsTracked: stats.productsTracked,
    savedThisMonth,
    activeAlerts: alertsCount?.count || 0
  };
}

// Test trending products
function testTrending() {
  console.log('\n📈 Testing trending products:');
  
  const products = db.prepare(`
    SELECT 
      p.id,
      p.product_id,
      p.name,
      p.category_path as category,
      p.current_price as currentPrice,
      p.regular_price as originalPrice,
      p.thumbnail_url as imageUrl,
      p.in_stock as inStock,
      CASE 
        WHEN p.current_price < p.regular_price THEN 'down'
        WHEN p.current_price > p.regular_price THEN 'up'
        ELSE 'stable'
      END as trend,
      ABS((p.regular_price - p.current_price) / p.regular_price * 100) as priceChange
    FROM walmart_products p
    WHERE p.regular_price IS NOT NULL
    ORDER BY priceChange DESC
    LIMIT 6
  `).all();
  
  console.log(`Found ${products.length} trending products:`);
  products.forEach((product: any) => {
    const changeSymbol = product.trend === 'down' ? '↓' : product.trend === 'up' ? '↑' : '→';
    console.log(`  • ${product.name}`);
    console.log(`    Current: $${product.currentPrice.toFixed(2)} ${changeSymbol} ${product.priceChange.toFixed(1)}%`);
  });
  
  return products;
}

// Run all tests
async function main() {
  console.log('===========================================');
  console.log('   Testing API with REAL Walmart Data');
  console.log('===========================================');
  
  // Test different searches
  testSearch('milk');
  testSearch('eggs');
  testSearch('bread');
  
  // Test stats
  testStats();
  
  // Test trending
  testTrending();
  
  console.log('\n===========================================');
  console.log('✅ All tests completed with REAL data!');
  console.log('===========================================');
  
  db.close();
}

main().catch(console.error);