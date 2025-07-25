/**
 * Data Flow Configuration
 * Settings for IEMS to Email Dashboard data synchronization
 */

export interface DataFlowConfig {
  // Directories and paths
  iemsAnalysisDir: string;
  iemsDatabase: string;
  dashboardDatabase: string;
  
  // Sync settings
  syncIntervalMinutes: number;
  batchSize: number;
  enableRealTimeSync: boolean;
  watchNewFiles: boolean;
  
  // Performance settings
  maxConcurrentProcessing: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // Monitoring
  enableMetrics: boolean;
  metricsInterval: number;
}

// Default configuration
export const defaultDataFlowConfig: DataFlowConfig = {
  // Directories and paths
  iemsAnalysisDir: process.env.IEMS_ANALYSIS_DIR || '/home/pricepro2006/iems_project/analysis_results',
  iemsDatabase: process.env.IEMS_DATABASE || '/home/pricepro2006/iems_project/iems.db',
  dashboardDatabase: process.env.DASHBOARD_DATABASE || '/home/pricepro2006/CrewAI_Team/data/email_dashboard.db',
  
  // Sync settings
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '30', 10),
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '100', 10),
  enableRealTimeSync: process.env.ENABLE_REALTIME_SYNC !== 'false',
  watchNewFiles: process.env.WATCH_NEW_FILES !== 'false',
  
  // Performance settings
  maxConcurrentProcessing: parseInt(process.env.MAX_CONCURRENT_PROCESSING || '5', 10),
  processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000', 10), // 5 minutes
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10), // 5 seconds
  
  // Monitoring
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000', 10) // 1 minute
};

// Environment-specific configurations
const envConfigs: Record<string, Partial<DataFlowConfig>> = {
  development: {
    syncIntervalMinutes: 5, // More frequent in dev
    enableMetrics: true,
    watchNewFiles: true
  },
  test: {
    syncIntervalMinutes: 0, // Disabled in tests
    enableRealTimeSync: false,
    watchNewFiles: false,
    enableMetrics: false
  },
  production: {
    syncIntervalMinutes: 30,
    batchSize: 500,
    maxConcurrentProcessing: 10,
    enableMetrics: true
  }
};

/**
 * Get configuration for current environment
 */
export function getDataFlowConfig(env?: string): DataFlowConfig {
  const environment = env || process.env.NODE_ENV || 'development';
  const envConfig = envConfigs[environment] || {};
  
  return {
    ...defaultDataFlowConfig,
    ...envConfig
  };
}

/**
 * Validate data flow configuration
 */
export function validateDataFlowConfig(config: DataFlowConfig): string[] {
  const errors: string[] = [];
  
  // Validate paths exist
  if (!config.iemsAnalysisDir) {
    errors.push('IEMS analysis directory is required');
  }
  
  if (!config.iemsDatabase) {
    errors.push('IEMS database path is required');
  }
  
  if (!config.dashboardDatabase) {
    errors.push('Dashboard database path is required');
  }
  
  // Validate numeric values
  if (config.syncIntervalMinutes < 0) {
    errors.push('Sync interval must be non-negative');
  }
  
  if (config.batchSize < 1) {
    errors.push('Batch size must be at least 1');
  }
  
  if (config.maxConcurrentProcessing < 1) {
    errors.push('Max concurrent processing must be at least 1');
  }
  
  return errors;
}