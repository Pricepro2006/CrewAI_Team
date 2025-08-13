#!/usr/bin/env tsx

/**
 * Product Pricing Status Checker
 * 
 * Quick utility to check the current status of product pricing in the database
 * and identify products that need updates.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

interface PricingStatus {
  total_products: number;
  with_current_price: number;
  without_current_price: number;
  never_checked: number;
  checked_today: number;
  checked_this_week: number;
  stale_over_week: number;
  average_price: number;
  price_range: {
    min: number;
    max: number;
  };
}

class PricingStatusChecker {
  private db: Database.Database;

  constructor() {
    const dbPath = join(PROJECT_ROOT, 'data', 'walmart_grocery.db');
    this.db = new Database(dbPath);
  }

  /**
   * Get comprehensive pricing status
   */
  getStatus(): PricingStatus {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN current_price > 0 THEN 1 END) as with_current_price,
        COUNT(CASE WHEN current_price IS NULL OR current_price = 0 THEN 1 END) as without_current_price,
        COUNT(CASE WHEN last_checked_at IS NULL THEN 1 END) as never_checked,
        COUNT(CASE WHEN datetime(last_checked_at) >= datetime('now', 'start of day') THEN 1 END) as checked_today,
        COUNT(CASE WHEN datetime(last_checked_at) >= datetime('now', '-7 days') THEN 1 END) as checked_this_week,
        COUNT(CASE WHEN datetime(last_checked_at) < datetime('now', '-7 days') THEN 1 END) as stale_over_week,
        ROUND(AVG(CASE WHEN current_price > 0 THEN current_price END), 2) as average_price,
        MIN(CASE WHEN current_price > 0 THEN current_price END) as min_price,
        MAX(current_price) as max_price
      FROM walmart_products
    `).get() as any;

    return {
      total_products: stats.total_products,
      with_current_price: stats.with_current_price,
      without_current_price: stats.without_current_price,
      never_checked: stats.never_checked,
      checked_today: stats.checked_today,
      checked_this_week: stats.checked_this_week,
      stale_over_week: stats.stale_over_week,
      average_price: stats.average_price || 0,
      price_range: {
        min: stats.min_price || 0,
        max: stats.max_price || 0
      }
    };
  }

  /**
   * Get products that need urgent updates (no price or very old)
   */
  getUrgentUpdates(limit: number = 10): any[] {
    return this.db.prepare(`
      SELECT 
        product_id,
        name,
        brand,
        current_price,
        last_checked_at,
        CASE 
          WHEN current_price IS NULL OR current_price = 0 THEN 'Missing Price'
          WHEN last_checked_at IS NULL THEN 'Never Checked'
          WHEN datetime(last_checked_at) < datetime('now', '-7 days') THEN 'Stale (>7 days)'
          ELSE 'Recent'
        END as urgency_reason
      FROM walmart_products
      WHERE 
        current_price IS NULL 
        OR current_price = 0 
        OR last_checked_at IS NULL
        OR datetime(last_checked_at) < datetime('now', '-7 days')
      ORDER BY 
        CASE WHEN current_price IS NULL OR current_price = 0 THEN 0 ELSE 1 END ASC,
        last_checked_at ASC NULLS FIRST
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get recent price changes
   */
  getRecentUpdates(limit: number = 10): any[] {
    return this.db.prepare(`
      SELECT 
        product_id,
        name,
        current_price,
        regular_price,
        last_checked_at
      FROM walmart_products
      WHERE 
        datetime(last_checked_at) >= datetime('now', '-24 hours')
        AND current_price > 0
      ORDER BY last_checked_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get price distribution by range
   */
  getPriceDistribution(): any[] {
    return this.db.prepare(`
      SELECT 
        CASE 
          WHEN current_price = 0 OR current_price IS NULL THEN 'No Price'
          WHEN current_price < 5 THEN '$0-5'
          WHEN current_price < 10 THEN '$5-10'
          WHEN current_price < 25 THEN '$10-25'
          WHEN current_price < 50 THEN '$25-50'
          WHEN current_price < 100 THEN '$50-100'
          ELSE '$100+'
        END as price_range,
        COUNT(*) as product_count,
        ROUND(AVG(current_price), 2) as avg_price_in_range
      FROM walmart_products
      GROUP BY 
        CASE 
          WHEN current_price = 0 OR current_price IS NULL THEN 'No Price'
          WHEN current_price < 5 THEN '$0-5'
          WHEN current_price < 10 THEN '$5-10'
          WHEN current_price < 25 THEN '$10-25'
          WHEN current_price < 50 THEN '$25-50'
          WHEN current_price < 100 THEN '$50-100'
          ELSE '$100+'
        END
      ORDER BY 
        CASE 
          WHEN current_price = 0 OR current_price IS NULL THEN 0
          WHEN current_price < 5 THEN 1
          WHEN current_price < 10 THEN 2
          WHEN current_price < 25 THEN 3
          WHEN current_price < 50 THEN 4
          WHEN current_price < 100 THEN 5
          ELSE 6
        END
    `).all();
  }

  /**
   * Display comprehensive status report
   */
  displayReport(): void {
    console.log('🛒 Walmart Product Pricing Status Report');
    console.log('=' .repeat(50));
    
    const status = this.getStatus();
    
    // Overall stats
    console.log('\n📊 Overall Statistics:');
    console.log(`   Total Products: ${status.total_products.toLocaleString()}`);
    console.log(`   With Pricing: ${status.with_current_price.toLocaleString()} (${Math.round(status.with_current_price / status.total_products * 100)}%)`);
    console.log(`   Missing Pricing: ${status.without_current_price.toLocaleString()} (${Math.round(status.without_current_price / status.total_products * 100)}%)`);
    console.log(`   Average Price: $${status.average_price}`);
    console.log(`   Price Range: $${status.price_range.min} - $${status.price_range.max}`);
    
    // Freshness stats
    console.log('\n🕒 Data Freshness:');
    console.log(`   Never Checked: ${status.never_checked.toLocaleString()}`);
    console.log(`   Checked Today: ${status.checked_today.toLocaleString()}`);
    console.log(`   Checked This Week: ${status.checked_this_week.toLocaleString()}`);
    console.log(`   Stale (>1 week): ${status.stale_over_week.toLocaleString()}`);
    
    // Priority updates needed
    const urgent = this.getUrgentUpdates(5);
    if (urgent.length > 0) {
      console.log('\n🚨 Products Needing Updates (Top 5):');
      urgent.forEach((product, i) => {
        console.log(`   ${i + 1}. ${product.name}`);
        console.log(`      ID: ${product.product_id}`);
        console.log(`      Reason: ${product.urgency_reason}`);
        console.log(`      Current Price: ${product.current_price ? '$' + product.current_price : 'None'}`);
        console.log(`      Last Checked: ${product.last_checked_at || 'Never'}`);
        console.log('');
      });
    }
    
    // Recent updates
    const recent = this.getRecentUpdates(5);
    if (recent.length > 0) {
      console.log('\n✅ Recently Updated (Last 24h):');
      recent.forEach((product, i) => {
        console.log(`   ${i + 1}. ${product.name} - $${product.current_price} (${product.last_checked_at})`);
      });
    }
    
    // Price distribution
    console.log('\n💰 Price Distribution:');
    const distribution = this.getPriceDistribution();
    distribution.forEach(range => {
      const percentage = Math.round(range.product_count / status.total_products * 100);
      console.log(`   ${range.price_range.padEnd(10)}: ${range.product_count.toString().padStart(4)} products (${percentage}%)`);
    });
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (status.without_current_price > 0) {
      console.log(`   • Update ${status.without_current_price} products missing prices`);
    }
    if (status.stale_over_week > 0) {
      console.log(`   • Refresh ${status.stale_over_week} products with stale pricing (>1 week old)`);
    }
    if (status.never_checked > 0) {
      console.log(`   • Initial pricing check needed for ${status.never_checked} products`);
    }
    
    const totalNeedingUpdate = status.without_current_price + status.stale_over_week;
    if (totalNeedingUpdate > 0) {
      console.log(`\n🔄 Run: ./scripts/run-pricing-update.sh`);
      console.log(`   This will update approximately ${totalNeedingUpdate} products`);
    } else {
      console.log('\n✨ All products have recent pricing data!');
    }
  }

  close(): void {
    this.db.close();
  }
}

// Main execution
function main(): void {
  const checker = new PricingStatusChecker();
  
  try {
    checker.displayReport();
  } catch (error) {
    console.error('Error generating status report:', error);
    process.exit(1);
  } finally {
    checker.close();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PricingStatusChecker;