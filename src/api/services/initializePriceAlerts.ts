/**
 * Initialize Price Alert Service
 * This file ensures the Price Alert Service is properly initialized with the Walmart database
 */

import { initializePriceAlertService } from "./PriceAlertService.js";
import { getWalmartDatabaseManager } from "../../database/WalmartDatabaseManager.js";
import { logger } from "../../utils/logger.js";

let initialized = false;

/**
 * Initialize the Price Alert Service with the Walmart database
 * This should be called during server startup
 */
export async function initializePriceAlerts() {
  if (initialized) {
    logger.debug("Price Alert Service already initialized", "PRICE_ALERTS");
    return;
  }

  try {
    logger.info("Initializing Price Alert Service...", "PRICE_ALERTS");
    
    // Get the Walmart database instance
    const walmartDbManager = getWalmartDatabaseManager();
    const db = walmartDbManager.getDatabase();
    
    // Initialize the Price Alert Service with configuration
    const config = {
      checkIntervalMinutes: 5,  // Check prices every 5 minutes
      batchSize: 100,           // Process 100 products at a time
      maxRetries: 3,            // Retry failed notifications 3 times
      notificationDelay: 1000,  // 1 second between notifications
      enableWebSocket: true,    // Enable WebSocket notifications
      enableEmail: false,       // Email service not configured yet
      enableSMS: false,         // SMS service not configured yet
      enablePush: true          // Enable push notifications via WebSocket
    };
    
    const service = initializePriceAlertService(db, config);
    
    // Run migrations to ensure tables exist
    await runPriceAlertMigrations(db);
    
    initialized = true;
    logger.info("Price Alert Service initialized successfully", "PRICE_ALERTS");
    
    return service;
  } catch (error) {
    logger.error(`Failed to initialize Price Alert Service: ${error}`, "PRICE_ALERTS");
    throw error;
  }
}

/**
 * Run migrations to create price alert tables if they don't exist
 */
async function runPriceAlertMigrations(db: any) {
  try {
    // Check if tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('deal_alerts', 'deal_notifications', 'deal_sources', 'tracked_deals')
    `).all();
    
    if (tables?.length || 0 === 4) {
      logger.debug("Price alert tables already exist", "PRICE_ALERTS");
      return;
    }
    
    logger.info("Running price alert migrations...", "PRICE_ALERTS");
    
    // Import and run the migration
    const migration = await import("../../database/migrations/013_create_deal_alerts_table.js");
    migration.up(db);
    
    logger.info("Price alert migrations completed", "PRICE_ALERTS");
  } catch (error) {
    logger.error(`Failed to run price alert migrations: ${error}`, "PRICE_ALERTS");
    throw error;
  }
}

/**
 * Shutdown the Price Alert Service gracefully
 */
export async function shutdownPriceAlerts() {
  try {
    const { getPriceAlertService } = await import("./PriceAlertService.js");
    const service = getPriceAlertService();
    
    if (service) {
      service.shutdown();
      logger.info("Price Alert Service shutdown complete", "PRICE_ALERTS");
    }
  } catch (error) {
    logger.error(`Error during Price Alert Service shutdown: ${error}`, "PRICE_ALERTS");
  }
}