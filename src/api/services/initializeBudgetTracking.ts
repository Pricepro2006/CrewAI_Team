/**
 * Budget Tracking Service Initialization
 * Initializes the budget tracking service at server startup
 */

import Database from "better-sqlite3";
import { initializeBudgetTrackingService, getBudgetTrackingService } from "./BudgetTrackingService.js";
import { logger } from "../../utils/logger.js";
import appConfig from "../../config/app.config.js";

let isInitialized = false;

/**
 * Initialize the Budget Tracking Service
 */
export async function initializeBudgetTracking(): Promise<void> {
  if (isInitialized) {
    logger.info("Budget Tracking Service already initialized", "BUDGET");
    return;
  }

  try {
    // Open database connection
    const dbPath = process.env['WALMART_DB_PATH'] || 
                   appConfig.database?.walmartDbPath || 
                   "./data/walmart_grocery.db";
    
    const db = new Database(dbPath);
    
    // Enable foreign keys and WAL mode for better performance
    db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);
    
    // Initialize the service
    const service = initializeBudgetTrackingService(db);
    
    // Set up event listeners
    service.on("budget:exceeded", (data: any) => {
      logger.warn(`Budget exceeded for user ${data.userId}`, "BUDGET", data.summary);
    });
    
    service.on("budget:warning", (data: any) => {
      logger.info(`Budget warning for user ${data.userId}`, "BUDGET", data.summary);
    });
    
    service.on("budget:threshold_exceeded", (data: any) => {
      logger.warn(
        `Budget threshold exceeded for user ${data.userId}: ${data.percentage}% (threshold: ${data.threshold}%)`,
        "BUDGET"
      );
    });
    
    service.on("budget:preferences_updated", (preferences: any) => {
      logger.info(`Budget preferences updated for user ${preferences.userId}`, "BUDGET");
    });
    
    isInitialized = true;
    logger.info("Budget Tracking Service initialized successfully", "BUDGET");
  } catch (error) {
    logger.error(`Failed to initialize Budget Tracking Service: ${error}`, "BUDGET");
    throw error;
  }
}

/**
 * Shutdown the Budget Tracking Service
 */
export async function shutdownBudgetTracking(): Promise<void> {
  const service = getBudgetTrackingService();
  
  if (service) {
    service.shutdown();
    isInitialized = false;
    logger.info("Budget Tracking Service shutdown complete", "BUDGET");
  }
}

export default {
  initialize: initializeBudgetTracking,
  shutdown: shutdownBudgetTracking,
};