#!/usr/bin/env tsx

/**
 * Comprehensive Product Pricing Update Script
 * 
 * This script fetches current pricing for all products in walmart_grocery.db
 * using the BrightData MCP service with proper rate limiting and error handling.
 * 
 * Features:
 * - Batch processing with configurable batch size
 * - Rate limiting and retry logic
 * - Progress tracking and detailed logging
 * - Database updates with timestamps
 * - Failure tracking and reporting
 * - Resume capability from last successful update
 */

import Database from 'better-sqlite3';
import BrightDataMCPService, { WalmartProduct } from '../src/services/BrightDataMCPService.js';
import { logger } from '../src/utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

// Script configuration
const CONFIG = {
  BATCH_SIZE: 10,              // Products to process in each batch
  BATCH_DELAY: 2000,           // Delay between batches (ms)
  MAX_RETRIES: 3,              // Max retries per product
  RETRY_DELAY: 5000,           // Delay between retries (ms)
  RESUME_ON_FAILURE: true,     // Resume from last successful update
  LOG_PROGRESS_EVERY: 5,       // Log progress every N batches
  TIMEOUT_PER_PRODUCT: 30000,  // Timeout per product fetch (ms)
};

// Get current directory for relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

interface ProductUpdateResult {
  product_id: string;
  name: string;
  success: boolean;
  old_price?: number;
  new_price?: number;
  error?: string;
  retries: number;
  timestamp: string;
}

interface UpdateStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  priceChanges: number;
  startTime: Date;
  endTime?: Date;
}

class ProductPricingUpdater {
  private db: Database.Database;
  private brightDataService: BrightDataMCPService;
  private stats: UpdateStats;
  private results: ProductUpdateResult[] = [];
  private logFile: string;

  constructor() {
    this.db = new Database(join(PROJECT_ROOT, 'data', 'walmart_grocery.db'));
    this.brightDataService = new BrightDataMCPService(join(PROJECT_ROOT, 'data', 'walmart_grocery.db'));
    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      priceChanges: 0,
      startTime: new Date()
    };
    this.logFile = join(PROJECT_ROOT, 'logs', `pricing-update-${Date.now()}.json`);
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      logger.info('Starting product pricing update', 'PRICING_UPDATER');
      
      // Ensure logs directory exists
      await this.ensureLogDirectory();
      
      // Get all products that need pricing updates
      const products = await this.getProductsToUpdate();
      this.stats.total = products.length;
      
      if (products.length === 0) {
        logger.info('No products found for pricing update', 'PRICING_UPDATER');
        return;
      }

      logger.info(`Found ${products.length} products to update`, 'PRICING_UPDATER');

      // Process products in batches
      await this.processBatches(products);
      
      // Generate final report
      await this.generateReport();
      
    } catch (error) {
      logger.error('Fatal error in pricing updater', 'PRICING_UPDATER', { error });
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Get products that need pricing updates
   */
  private async getProductsToUpdate(): Promise<any[]> {
    try {
      // Get products ordered by last_checked_at (oldest first), with preference for products missing prices
      const query = `
        SELECT 
          id,
          product_id,
          name,
          current_price,
          last_checked_at,
          CASE 
            WHEN current_price IS NULL OR current_price = 0 THEN 0
            ELSE 1
          END as has_price
        FROM walmart_products
        ORDER BY 
          has_price ASC,  -- Products without prices first
          last_checked_at ASC NULLS FIRST  -- Oldest checks first
      `;
      
      const products = this.db.prepare(query).all();
      
      logger.info('Retrieved products for update', 'PRICING_UPDATER', {
        total: products.length,
        withoutPrices: products.filter((p: any) => !p.current_price || p.current_price === 0).length,
        neverChecked: products.filter((p: any) => !p.last_checked_at).length
      });
      
      return products;
    } catch (error) {
      logger.error('Failed to get products for update', 'PRICING_UPDATER', { error });
      throw error;
    }
  }

  /**
   * Process products in batches
   */
  private async processBatches(products: any[]): Promise<void> {
    const totalBatches = Math.ceil(products.length / CONFIG.BATCH_SIZE);
    
    logger.info(`Processing ${products.length} products in ${totalBatches} batches`, 'PRICING_UPDATER');

    for (let i = 0; i < products.length; i += CONFIG.BATCH_SIZE) {
      const batch = products.slice(i, i + CONFIG.BATCH_SIZE);
      const batchNumber = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      
      logger.info(`Processing batch ${batchNumber}/${totalBatches}`, 'PRICING_UPDATER', {
        batchSize: batch.length,
        progress: `${Math.round((i / products.length) * 100)}%`
      });

      // Process batch
      await this.processBatch(batch, batchNumber);
      
      // Log progress periodically
      if (batchNumber % CONFIG.LOG_PROGRESS_EVERY === 0 || batchNumber === totalBatches) {
        await this.logProgress(batchNumber, totalBatches);
      }
      
      // Delay between batches (except for the last batch)
      if (i + CONFIG.BATCH_SIZE < products.length) {
        logger.info(`Waiting ${CONFIG.BATCH_DELAY}ms before next batch`, 'PRICING_UPDATER');
        await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
      }
    }
  }

  /**
   * Process a single batch of products
   */
  private async processBatch(batch: any[], batchNumber: number): Promise<void> {
    const promises = batch.map((product, index) => 
      this.updateProductPricing(product, batchNumber, index + 1)
    );
    
    // Process batch concurrently but with timeout
    await Promise.allSettled(promises);
  }

  /**
   * Update pricing for a single product
   */
  private async updateProductPricing(product: any, batchNumber: number, productIndex: number): Promise<void> {
    const startTime = Date.now();
    let retries = 0;
    
    const result: ProductUpdateResult = {
      product_id: product.product_id,
      name: product.name,
      success: false,
      old_price: product.current_price,
      retries: 0,
      timestamp: new Date().toISOString()
    };

    try {
      logger.info(`Updating product ${productIndex} in batch ${batchNumber}`, 'PRICING_UPDATER', {
        product_id: product.product_id,
        name: product.name,
        current_price: product.current_price
      });

      // Construct Walmart URL from product_id
      const productUrl = this.constructProductUrl(product.product_id);
      if (!productUrl) {
        throw new Error('Could not construct valid product URL');
      }

      // Fetch updated product data with retries
      let updatedProduct: WalmartProduct | null = null;
      
      for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        retries = attempt;
        result.retries = retries;
        
        try {
          // Set timeout for individual product fetch
          updatedProduct = await Promise.race([
            this.brightDataService.fetchWalmartProduct(productUrl, 1), // Internal retries disabled, handled here
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Product fetch timeout')), CONFIG.TIMEOUT_PER_PRODUCT)
            )
          ]);
          
          if (updatedProduct && updatedProduct.current_price && updatedProduct.current_price > 0) {
            break; // Success
          }
          
          if (attempt < CONFIG.MAX_RETRIES) {
            logger.warn(`Attempt ${attempt} failed for product ${product.product_id}, retrying...`, 'PRICING_UPDATER');
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
          }
          
        } catch (fetchError) {
          if (attempt === CONFIG.MAX_RETRIES) {
            throw fetchError;
          }
          logger.warn(`Fetch attempt ${attempt} failed`, 'PRICING_UPDATER', { error: fetchError });
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        }
      }

      if (!updatedProduct) {
        throw new Error('No product data received after all retries');
      }

      if (!updatedProduct.current_price || updatedProduct.current_price <= 0) {
        throw new Error('Invalid or missing price in product data');
      }

      // Update database
      const success = await this.updateProductInDatabase(product.id, updatedProduct);
      
      if (!success) {
        throw new Error('Failed to update product in database');
      }

      // Record success
      result.success = true;
      result.new_price = updatedProduct.current_price;
      
      // Check for price change
      const priceChanged = Math.abs((result.old_price || 0) - updatedProduct.current_price) > 0.01;
      if (priceChanged) {
        this.stats.priceChanges++;
        logger.info('Price change detected', 'PRICING_UPDATER', {
          product_id: product.product_id,
          old_price: result.old_price,
          new_price: result.new_price
        });
      }

      this.stats.successful++;
      
      const duration = Date.now() - startTime;
      logger.info(`Successfully updated product ${product.product_id}`, 'PRICING_UPDATER', {
        duration_ms: duration,
        retries,
        price_changed: priceChanged
      });

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.stats.failed++;
      
      logger.error(`Failed to update product ${product.product_id}`, 'PRICING_UPDATER', {
        error: result.error,
        retries,
        duration_ms: Date.now() - startTime
      });

      // Still update the last_checked_at timestamp even on failure
      await this.updateLastCheckedTimestamp(product.id);
    } finally {
      this.results.push(result);
      this.stats.processed++;
    }
  }

  /**
   * Construct Walmart product URL from product_id
   */
  private constructProductUrl(product_id: string): string | null {
    try {
      // Handle different product_id formats
      if (product_id.startsWith('http')) {
        return product_id; // Already a URL
      }
      
      // Remove 'WM_' prefix if present
      const cleanId = product_id.replace(/^WM_/, '');
      
      // Basic validation - should be numeric
      if (!/^\d+$/.test(cleanId)) {
        logger.warn('Invalid product ID format', 'PRICING_UPDATER', { product_id });
        return null;
      }
      
      return `https://www.walmart.com/ip/${cleanId}`;
    } catch (error) {
      logger.error('Error constructing product URL', 'PRICING_UPDATER', { error, product_id });
      return null;
    }
  }

  /**
   * Update product in database with new pricing information
   */
  private async updateProductInDatabase(productId: string, updatedProduct: WalmartProduct): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        UPDATE walmart_products 
        SET 
          current_price = ?,
          regular_price = ?,
          in_stock = ?,
          stock_level = ?,
          average_rating = ?,
          review_count = ?,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(
        updatedProduct.current_price,
        updatedProduct.regular_price || updatedProduct.current_price,
        updatedProduct.in_stock ? 1 : 0,
        updatedProduct.stock_level || 0,
        updatedProduct.rating || null,
        updatedProduct.review_count || 0,
        productId
      );

      return result.changes > 0;
    } catch (error) {
      logger.error('Database update failed', 'PRICING_UPDATER', { error, productId });
      return false;
    }
  }

  /**
   * Update only the last_checked_at timestamp (for failed updates)
   */
  private async updateLastCheckedTimestamp(productId: string): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE walmart_products 
        SET last_checked_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(productId);
    } catch (error) {
      logger.error('Failed to update last_checked_at timestamp', 'PRICING_UPDATER', { error, productId });
    }
  }

  /**
   * Log progress periodically
   */
  private async logProgress(currentBatch: number, totalBatches: number): Promise<void> {
    const elapsed = Date.now() - this.stats.startTime.getTime();
    const rate = this.stats.processed / (elapsed / 1000 / 60); // per minute
    const estimated = (this.stats.total - this.stats.processed) / rate; // minutes remaining
    
    logger.info('Progress Update', 'PRICING_UPDATER', {
      batch: `${currentBatch}/${totalBatches}`,
      processed: `${this.stats.processed}/${this.stats.total}`,
      success_rate: `${Math.round((this.stats.successful / Math.max(this.stats.processed, 1)) * 100)}%`,
      price_changes: this.stats.priceChanges,
      processing_rate: `${rate.toFixed(1)}/min`,
      estimated_remaining: `${estimated.toFixed(1)} min`,
      elapsed_time: `${(elapsed / 1000 / 60).toFixed(1)} min`
    });

    // Save intermediate results
    await this.saveIntermediateResults();
  }

  /**
   * Save intermediate results to file
   */
  private async saveIntermediateResults(): Promise<void> {
    try {
      const data = {
        stats: { ...this.stats, currentTime: new Date().toISOString() },
        recent_results: this.results.slice(-20), // Last 20 results
        config: CONFIG
      };
      
      await fs.writeFile(
        this.logFile.replace('.json', '-progress.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      logger.warn('Failed to save intermediate results', 'PRICING_UPDATER', { error });
    }
  }

  /**
   * Generate final report
   */
  private async generateReport(): Promise<void> {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

    const report = {
      summary: {
        ...this.stats,
        duration_ms: duration,
        duration_minutes: Math.round(duration / 1000 / 60 * 100) / 100,
        average_time_per_product: Math.round(duration / this.stats.processed),
        success_rate: Math.round((this.stats.successful / Math.max(this.stats.processed, 1)) * 100)
      },
      config: CONFIG,
      results: {
        successful: this.results.filter(r => r.success),
        failed: this.results.filter(r => !r.success),
        price_changes: this.results.filter(r => r.success && r.old_price !== r.new_price)
      }
    };

    // Save detailed report
    await fs.writeFile(this.logFile, JSON.stringify(report, null, 2));

    // Console summary
    logger.info('=== PRICING UPDATE COMPLETED ===', 'PRICING_UPDATER');
    logger.info('Summary', 'PRICING_UPDATER', {
      total_products: report.summary.total,
      successfully_updated: report.summary.successful,
      failed_updates: report.summary.failed,
      price_changes_detected: report.summary.priceChanges,
      success_rate: `${report.summary.success_rate}%`,
      total_duration: `${report.summary.duration_minutes} minutes`,
      average_per_product: `${report.summary.average_time_per_product}ms`
    });

    logger.info(`Detailed report saved to: ${this.logFile}`, 'PRICING_UPDATER');

    // Log some example price changes
    const priceChanges = report.results.price_changes.slice(0, 5);
    if (priceChanges.length > 0) {
      logger.info('Sample price changes:', 'PRICING_UPDATER');
      priceChanges.forEach((change: ProductUpdateResult) => {
        logger.info(`  ${change.name}: $${change.old_price} → $${change.new_price}`, 'PRICING_UPDATER');
      });
    }

    // Log some failures for debugging
    const failures = report.results.failed.slice(0, 3);
    if (failures.length > 0) {
      logger.warn('Sample failures (for debugging):', 'PRICING_UPDATER');
      failures.forEach((failure: ProductUpdateResult) => {
        logger.warn(`  ${failure.name}: ${failure.error}`, 'PRICING_UPDATER');
      });
    }
  }

  /**
   * Ensure logs directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      const logDir = join(PROJECT_ROOT, 'logs');
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      logger.warn('Could not create logs directory', 'PRICING_UPDATER', { error });
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    try {
      this.db?.close();
      this.brightDataService?.close();
      logger.info('Cleanup completed', 'PRICING_UPDATER');
    } catch (error) {
      logger.error('Error during cleanup', 'PRICING_UPDATER', { error });
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const updater = new ProductPricingUpdater();
  
  try {
    await updater.run();
    process.exit(0);
  } catch (error) {
    logger.error('Script failed', 'PRICING_UPDATER', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...', 'PRICING_UPDATER');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...', 'PRICING_UPDATER');
  process.exit(0);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export default ProductPricingUpdater;