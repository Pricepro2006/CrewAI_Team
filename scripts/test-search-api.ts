#!/usr/bin/env tsx
/**
 * Test the Walmart search functionality directly
 */

import Database from 'better-sqlite3';

async function testSearch(query: string) {
  console.log('===========================================');
  console.log(`   Testing Search: "${query}"`);
  console.log('===========================================\n');
  
  const db = new Database('./data/walmart_grocery.db');
  
  try {
    // Search for products
    const stmt = db.prepare(`
      SELECT 
        id,
        product_id,
        name,
        current_price as price,
        regular_price,
        in_stock,
        department as category,
        brand,
        thumbnail_url,
        average_rating,
        review_count
      FROM walmart_products 
      WHERE LOWER(name) LIKE ? 
         OR LOWER(department) LIKE ?
         OR LOWER(brand) LIKE ?
      ORDER BY current_price ASC
      LIMIT 10
    `);
    
    const searchTerm = `%${query.toLowerCase()}%`;
    const results = stmt.all(searchTerm, searchTerm, searchTerm) as any[];
    
    console.log(`Found ${results.length} products:\n`);
    
    results.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Price: $${product.price?.toFixed(2) || '0.00'}`);
      console.log(`   Category: ${product.category || 'Unknown'}`);
      console.log(`   In Stock: ${product.in_stock ? 'Yes' : 'No'}`);
      console.log(`   Product ID: ${product.product_id}`);
      console.log('');
    });
    
    if (results.length === 0) {
      console.log('No products found. Let me check what products exist...\n');
      
      // Show some sample products
      const sampleStmt = db.prepare(`
        SELECT name, current_price, department 
        FROM walmart_products 
        LIMIT 5
      `);
      
      const samples = sampleStmt.all() as any[];
      console.log('Sample products in database:');
      samples.forEach(p => {
        console.log(`  - ${p.name} ($${p.current_price}) - ${p.department}`);
      });
    }
    
  } catch (error) {
    console.error('Error searching:', error);
  } finally {
    db.close();
  }
}

// Test different searches
async function main() {
  await testSearch('milk');
  await testSearch('eggs');
  await testSearch('bread');
  await testSearch('chicken');
}

main().catch(console.error);