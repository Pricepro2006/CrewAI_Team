#!/usr/bin/env tsx

/**
 * Deal Pipeline Initialization Script
 * Sets up and initializes the complete deal detection pipeline
 */

import { logger } from "../utils/logger";
import { getDealPipelineConfig, validateDealPipelineConfig } from "../config/deal-pipeline.config";
import { getDatabaseManager } from "../database/DatabaseManager";
import { DealPipelineIntegration } from "../api/services/DealPipelineIntegration";
import { DealPipelineMonitor } from "../api/services/DealPipelineMonitor";
import { DealReportingService } from "../api/services/DealReportingService";
import { readFileSync } from "fs";
import { join } from "path";

interface InitializationOptions {
  environment?: string;
  skipMigrations?: boolean;
  enableReporting?: boolean;
  runHealthCheck?: boolean;
  populateTestData?: boolean;
  configFile?: string;
}

class DealPipelineInitializer {
  private config: any;
  private integration!: DealPipelineIntegration;
  private monitor!: DealPipelineMonitor;
  private reporting!: DealReportingService;

  constructor(private options: InitializationOptions) {
    this.loadConfiguration();
  }

  /**
   * Initialize the complete deal detection pipeline
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Starting deal pipeline initialization", "PIPELINE_INIT", {
        environment: this?.options?.environment,
        options: this.options
      });

      // Step 1: Validate configuration
      await this.validateConfiguration();

      // Step 2: Initialize database
      await this.initializeDatabase();

      // Step 3: Run database migrations
      if (!this?.options?.skipMigrations) {
        await this.runDatabaseMigrations();
      }

      // Step 4: Initialize services
      await this.initializeServices();

      // Step 5: Start monitoring
      await this.startMonitoring();

      // Step 6: Start reporting (optional)
      if (this?.options?.enableReporting !== false) {
        await this.startReporting();
      }

      // Step 7: Initialize integration layer
      await this.initializeIntegration();

      // Step 8: Populate test data (if requested)
      if (this?.options?.populateTestData) {
        await this.populateTestData();
      }

      // Step 9: Run health check
      if (this?.options?.runHealthCheck !== false) {
        await this.performHealthCheck();
      }

      logger.info("Deal pipeline initialization completed successfully", "PIPELINE_INIT");

      // Print status summary
      this.printStatusSummary();

    } catch (error) {
      logger.error("Deal pipeline initialization failed", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  /**
   * Gracefully shutdown the pipeline
   */
  async shutdown(): Promise<void> {
    try {
      logger.info("Shutting down deal pipeline", "PIPELINE_INIT");

      if (this.monitor) {
        await this?.monitor?.stopMonitoring();
      }

      logger.info("Deal pipeline shutdown completed", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Error during pipeline shutdown", "PIPELINE_INIT", { error });
    }
  }

  private loadConfiguration(): void {
    try {
      if (this?.options?.configFile) {
        // Load configuration from file
        const configPath = join(process.cwd(), this?.options?.configFile);
        const configData = readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(configData);
        logger.info("Configuration loaded from file", "PIPELINE_INIT", { configFile: this?.options?.configFile });
      } else {
        // Load default configuration
        this.config = getDealPipelineConfig(this?.options?.environment);
        logger.info("Default configuration loaded", "PIPELINE_INIT", { environment: this?.options?.environment });
      }
    } catch (error) {
      logger.error("Failed to load configuration", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async validateConfiguration(): Promise<void> {
    try {
      logger.info("Validating pipeline configuration", "PIPELINE_INIT");

      const validationErrors = validateDealPipelineConfig(this.config);
      
      if (validationErrors?.length || 0 > 0) {
        logger.error("Configuration validation failed", "PIPELINE_INIT", { errors: validationErrors });
        throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
      }

      logger.info("Configuration validation passed", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Configuration validation error", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      logger.info("Initializing database connection", "PIPELINE_INIT");

      const dbManager = getDatabaseManager();
      
      // Test database connection
      const db = dbManager.connectionPool?.getConnection().getDatabase();
      if (!db) {
        throw new Error("Database connection not available");
      }

      // Test query
      db.prepare('SELECT 1').get();

      logger.info("Database connection established", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Database initialization failed", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async runDatabaseMigrations(): Promise<void> {
    try {
      logger.info("Running database migrations", "PIPELINE_INIT");

      const dbManager = getDatabaseManager();
      const db = dbManager.connectionPool?.getConnection().getDatabase();
      
      if (!db) {
        throw new Error("Database not available for migrations");
      }

      // Read and execute deal pipeline schema
      const schemaPath = join(process.cwd(), 'src/database/migrations/deal-detection-pipeline-schema.sql');
      const schemaSQL = readFileSync(schemaPath, 'utf-8');

      // Execute schema in transaction
      const transaction = db.transaction(() => {
        // Split by statement separator and execute each
        const statements = schemaSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt?.length || 0 > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));

        for (const statement of statements) {
          try {
            db.exec(statement);
          } catch (error) {
            // Ignore errors for CREATE IF NOT EXISTS, INSERT OR IGNORE, etc.
            if (!(error as any)?.message?.includes('already exists') && 
                !(error as any)?.message?.includes('UNIQUE constraint failed')) {
              throw error;
            }
          }
        }
      });

      transaction();

      logger.info("Database migrations completed", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Database migrations failed", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      logger.info("Initializing pipeline services", "PIPELINE_INIT");

      // Initialize monitoring service
      this.monitor = DealPipelineMonitor.getInstance();

      // Initialize reporting service  
      this.reporting = DealReportingService.getInstance();

      // Initialize integration service
      this.integration = DealPipelineIntegration.getInstance();

      logger.info("Pipeline services initialized", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Service initialization failed", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async startMonitoring(): Promise<void> {
    try {
      logger.info("Starting pipeline monitoring", "PIPELINE_INIT");

      await this?.monitor?.startMonitoring();

      logger.info("Pipeline monitoring started", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Failed to start monitoring", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async startReporting(): Promise<void> {
    try {
      logger.info("Starting pipeline reporting", "PIPELINE_INIT");

      // Reporting starts automatically when service is instantiated
      logger.info("Pipeline reporting started", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Failed to start reporting", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async initializeIntegration(): Promise<void> {
    try {
      logger.info("Initializing pipeline integration", "PIPELINE_INIT");

      await this?.integration?.initialize();

      logger.info("Pipeline integration initialized", "PIPELINE_INIT");

    } catch (error) {
      logger.error("Integration initialization failed", "PIPELINE_INIT", { error });
      throw error;
    }
  }

  private async populateTestData(): Promise<void> {
    try {
      logger.info("Populating test data", "PIPELINE_INIT");

      const dbManager = getDatabaseManager();
      const db = dbManager.connectionPool?.getConnection().getDatabase();
      
      if (!db) {
        throw new Error("Database not available");
      }

      // Insert sample user preferences
      db.prepare(`
        INSERT OR IGNORE INTO deal_user_preferences (
          user_id, categories, min_savings_percentage, notification_frequency, 
          deal_types, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'test-user-1',
        JSON.stringify(['grocery', 'electronics']),
        15,
        'instant',
        JSON.stringify(['price_drop', 'historical_low']),
        1,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Insert sample seasonal patterns
      db.prepare(`
        INSERT OR IGNORE INTO seasonal_price_patterns (
          id, category, product_pattern, month, season,
          typical_price_multiplier, demand_level, buying_recommendation,
          confidence_level, pattern_created_at, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'test-pattern-1',
        'grocery',
        'beverages',
        7,
        'summer',
        0.85,
        'high',
        'stock_up',
        0.8,
        new Date().toISOString(),
        new Date().toISOString()
      );

      logger.info("Test data populated successfully", "PIPELINE_INIT");

    } catch (error) {
      logger.warn("Failed to populate test data", "PIPELINE_INIT", { error });
      // Don't throw - test data is optional
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      logger.info("Performing initial health check", "PIPELINE_INIT");

      const healthStatus = await this?.monitor?.performHealthCheck();

      if (healthStatus.overall === 'healthy') {
        logger.info("Health check passed - all systems operational", "PIPELINE_INIT");
      } else {
        logger.warn("Health check completed with warnings", "PIPELINE_INIT", { 
          status: healthStatus.overall,
          issues: [...healthStatus.errors, ...healthStatus.warnings]
        });
      }

    } catch (error) {
      logger.error("Health check failed", "PIPELINE_INIT", { error });
      // Don't throw - health check failure shouldn't stop initialization
    }
  }

  private printStatusSummary(): void {
    const integrationStatus = this?.integration?.getIntegrationStatus();
    const healthStatus = this?.monitor?.getHealthStatus();
    const currentMetrics = this?.monitor?.getCurrentMetrics();

    console.log('\n' + '='.repeat(60));
    console.log('🎯 DEAL DETECTION PIPELINE - STATUS SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n📊 SYSTEM STATUS:');
    console.log(`   Overall Health: ${healthStatus?.overall?.toUpperCase()}`);
    console.log(`   Integration: ${integrationStatus.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`   Migration Progress: ${integrationStatus.migrationProgress}%`);
    console.log(`   Hybrid Mode: ${integrationStatus.hybridMode ? 'ENABLED' : 'DISABLED'}`);

    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`   Queue Size: ${currentMetrics.currentQueueSize}`);
    console.log(`   Success Rate: ${currentMetrics?.successRate?.toFixed(1)}%`);
    console.log(`   Error Rate: ${currentMetrics?.errorRate?.toFixed(1)}%`);
    console.log(`   Avg Response Time: ${currentMetrics?.avgPriceUpdateTimeMs?.toFixed(0)}ms`);

    console.log('\n🎯 DEAL METRICS (Last 24h):');
    console.log(`   Deals Detected: ${currentMetrics.dealsDetectedLast24h}`);
    console.log(`   Total Savings: $${currentMetrics?.totalSavingsOffered?.toFixed(2)}`);
    console.log(`   Avg Deal Score: ${currentMetrics?.avgDealScore?.toFixed(2)}`);
    console.log(`   Active Users: ${currentMetrics.activeWebSocketConnections}`);

    console.log('\n🔧 CONFIGURATION:');
    console.log(`   Environment: ${this?.config?.environment.name}`);
    console.log(`   Debug Mode: ${this?.config?.environment.debug}`);
    console.log(`   Log Level: ${this?.config?.environment.logLevel}`);
    console.log(`   Price Update Interval: ${this?.config?.pipeline.processingIntervals.priceUpdateMs / 1000 / 60} minutes`);
    console.log(`   Deal Detection Interval: ${this?.config?.pipeline.processingIntervals.dealDetectionMs / 1000 / 60} minutes`);

    console.log('\n🚀 READY TO DETECT DEALS!');
    console.log('='.repeat(60) + '\n');
  }
}

// CLI Interface
async function main() {
  const args = process?.argv?.slice(2);
  const options: InitializationOptions = {
    environment: process.env.NODE_ENV || 'development'
  };

  // Parse command line arguments
  for (let i = 0; i < args?.length || 0; i++) {
    switch (args[i]) {
      case '--env':
      case '--environment':
        options.environment = args[++i];
        break;
      case '--skip-migrations':
        options.skipMigrations = true;
        break;
      case '--no-reporting':
        options.enableReporting = false;
        break;
      case '--no-health-check':
        options.runHealthCheck = false;
        break;
      case '--test-data':
        options.populateTestData = true;
        break;
      case '--config':
        options.configFile = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  const initializer = new DealPipelineInitializer(options);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info("Received SIGTERM, shutting down gracefully", "PIPELINE_INIT");
    await initializer.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info("Received SIGINT, shutting down gracefully", "PIPELINE_INIT");
    await initializer.shutdown();
    process.exit(0);
  });

  try {
    await initializer.initialize();
    
    // Keep process running if this is the main process
    if (process.env.KEEP_ALIVE === 'true') {
      logger.info("Pipeline initialized and running. Press Ctrl+C to stop.", "PIPELINE_INIT");
      
      // Keep alive
      setInterval(() => {
        // Do nothing - just keep process alive
      }, 30000);
    }
    
  } catch (error) {
    logger.error("Pipeline initialization failed", "PIPELINE_INIT", { error });
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Deal Detection Pipeline Initializer

Usage: tsx initialize-deal-pipeline.ts [options]

Options:
  --env, --environment <env>    Set environment (development, staging, production)
  --skip-migrations            Skip database migrations
  --no-reporting               Disable reporting service
  --no-health-check           Skip initial health check
  --test-data                 Populate test data
  --config <file>             Load configuration from file
  --help                      Show this help message

Environment Variables:
  NODE_ENV                    Environment name
  KEEP_ALIVE                  Keep process running after initialization
  DEAL_PIPELINE_ENABLED       Enable/disable pipeline
  LOG_LEVEL                   Set log level (error, warn, info, debug)

Examples:
  tsx initialize-deal-pipeline.ts --env production
  tsx initialize-deal-pipeline.ts --test-data --env development
  tsx initialize-deal-pipeline.ts --config ./custom-config.json
`);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { DealPipelineInitializer, type InitializationOptions };