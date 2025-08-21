/**
 * Deal Detection Pipeline Configuration
 * Central configuration for the entire deal detection system
 */

export interface DealPipelineConfiguration {
  // Pipeline settings
  pipeline: {
    enabled: boolean;
    autoStart: boolean;
    processingIntervals: {
      priceUpdateMs: number;
      dealDetectionMs: number;
      alertCheckMs: number;
      healthCheckMs: number;
      cleanupIntervalHours: number;
    };
    batchSettings: {
      maxProductsPerBatch: number;
      maxConcurrentRequests: number;
      delayBetweenRequestsMs: number;
      maxRetries: number;
      timeoutMs: number;
    };
    queue: {
      maxSize: number;
      priorityLevels: ('low' | 'normal' | 'high' | 'urgent')[];
      processingOrder: 'fifo' | 'priority' | 'lifo';
    };
  };

  // Deal detection settings
  dealDetection: {
    enabled: boolean;
    minSavingsPercentage: number;
    maxDealsPerRun: number;
    enableSeasonalDetection: boolean;
    enableBulkDetection: boolean;
    enableHistoricalLowDetection: boolean;
    thresholds: {
      minimal: { percentage: number; score: number };
      moderate: { percentage: number; score: number };
      good: { percentage: number; score: number };
      excellent: { percentage: number; score: number };
      exceptional: { percentage: number; score: number };
    };
    comparisonPeriods: ('7d' | '30d' | '60d' | '90d')[];
    confidenceThresholds: {
      priceData: number;
      dealQuality: number;
      userRelevance: number;
    };
  };

  // Price tracking settings
  priceTracking: {
    enabled: boolean;
    sources: ('api' | 'scraper' | 'cache')[];
    fallbackEnabled: boolean;
    cacheDurationMs: number;
    updateFrequency: {
      high: number; // Popular products
      normal: number; // Regular products
      low: number; // Rarely searched products
    };
    staleThresholdHours: number;
    qualityFiltering: {
      minConfidenceScore: number;
      requireMultipleSources: boolean;
      priceChangeValidation: boolean;
    };
  };

  // User notification settings
  notifications: {
    enabled: boolean;
    realTimeWebSocket: boolean;
    batchNotifications: boolean;
    rateLimiting: {
      maxPerHour: number;
      maxPerDay: number;
      cooldownPeriodMs: number;
    };
    channels: {
      websocket: boolean;
      email: boolean;
      push: boolean;
    };
    priority: {
      urgent: { deliveryTimeMs: number; retryCount: number };
      high: { deliveryTimeMs: number; retryCount: number };
      normal: { deliveryTimeMs: number; retryCount: number };
      low: { deliveryTimeMs: number; retryCount: number };
    };
  };

  // Data retention policies
  dataRetention: {
    priceHistoryDays: number;
    dealHistoryDays: number;
    metricsRetentionDays: number;
    reportRetentionDays: number;
    logRetentionDays: number;
    cleanupSchedule: {
      enabled: boolean;
      cronExpression: string;
      batchSize: number;
    };
  };

  // Monitoring and alerting
  monitoring: {
    enabled: boolean;
    healthChecks: {
      intervalMs: number;
      timeoutMs: number;
      failureThreshold: number;
    };
    performance: {
      trackResponseTimes: boolean;
      trackThroughput: boolean;
      trackErrorRates: boolean;
      metricsAggregationIntervalMs: number;
    };
    alerting: {
      enabled: boolean;
      thresholds: {
        errorRatePercent: number;
        queueSizeWarning: number;
        queueSizeCritical: number;
        responseTimeWarningMs: number;
        responseTimeCriticalMs: number;
        memoryUsagePercent: number;
        cpuUsagePercent: number;
      };
      escalation: {
        warningAfterMinutes: number;
        criticalAfterMinutes: number;
        autoRestart: boolean;
      };
    };
  };

  // Reporting configuration
  reporting: {
    enabled: boolean;
    schedules: {
      daily: { enabled: boolean; time: string };
      weekly: { enabled: boolean; dayOfWeek: number; time: string };
      monthly: { enabled: boolean; dayOfMonth: number; time: string };
    };
    formats: ('json' | 'html' | 'pdf')[];
    distribution: {
      webhook: string;
      email: string[];
      storage: string;
    };
    metrics: {
      includeComparisons: boolean;
      includeInsights: boolean;
      includeRecommendations: boolean;
    };
  };

  // Integration settings
  integration: {
    legacyEngine: {
      enabled: boolean;
      fallbackMode: boolean;
      comparisonMode: boolean;
      migrationProgress: number; // 0-100%
    };
    walmartAPI: {
      enabled: boolean;
      rateLimitPerSecond: number;
      timeout: number;
      retryPolicy: {
        maxRetries: number;
        backoffMs: number;
        backoffMultiplier: number;
      };
    };
    database: {
      connectionPool: {
        min: number;
        max: number;
        idleTimeoutMs: number;
      };
      queryTimeout: number;
      enableWAL: boolean;
      enableForeignKeys: boolean;
    };
  };

  // Security settings
  security: {
    encryption: {
      enabled: boolean;
      algorithm: string;
      keyRotationDays: number;
    };
    authentication: {
      required: boolean;
      tokenExpirationHours: number;
      refreshTokenEnabled: boolean;
    };
    authorization: {
      roleBasedAccess: boolean;
      permissions: string[];
    };
    rateLimit: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
      skipSuccessfulRequests: boolean;
    };
    audit: {
      enabled: boolean;
      logLevel: 'error' | 'warn' | 'info' | 'debug';
      sensitiveDataMasking: boolean;
    };
  };

  // Environment-specific settings
  environment: {
    name: 'development' | 'staging' | 'production';
    debug: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    enableDevTools: boolean;
    mockData: boolean;
    testMode: boolean;
  };
}

// Default configuration - optimized for production use
export const DEFAULT_DEAL_PIPELINE_CONFIG: DealPipelineConfiguration = {
  pipeline: {
    enabled: true,
    autoStart: true,
    processingIntervals: {
      priceUpdateMs: 30 * 60 * 1000, // 30 minutes
      dealDetectionMs: 15 * 60 * 1000, // 15 minutes
      alertCheckMs: 5 * 60 * 1000, // 5 minutes
      healthCheckMs: 5 * 60 * 1000, // 5 minutes
      cleanupIntervalHours: 24, // Daily cleanup
    },
    batchSettings: {
      maxProductsPerBatch: 10,
      maxConcurrentRequests: 3,
      delayBetweenRequestsMs: 2000,
      maxRetries: 3,
      timeoutMs: 30000,
    },
    queue: {
      maxSize: 10000,
      priorityLevels: ['low', 'normal', 'high', 'urgent'],
      processingOrder: 'priority',
    },
  },

  dealDetection: {
    enabled: true,
    minSavingsPercentage: 10,
    maxDealsPerRun: 100,
    enableSeasonalDetection: true,
    enableBulkDetection: true,
    enableHistoricalLowDetection: true,
    thresholds: {
      minimal: { percentage: 5, score: 0.3 },
      moderate: { percentage: 10, score: 0.5 },
      good: { percentage: 20, score: 0.7 },
      excellent: { percentage: 30, score: 0.9 },
      exceptional: { percentage: 50, score: 1.0 },
    },
    comparisonPeriods: ['30d', '60d', '90d'],
    confidenceThresholds: {
      priceData: 0.7,
      dealQuality: 0.6,
      userRelevance: 0.5,
    },
  },

  priceTracking: {
    enabled: true,
    sources: ['api', 'scraper', 'cache'],
    fallbackEnabled: true,
    cacheDurationMs: 30 * 60 * 1000, // 30 minutes
    updateFrequency: {
      high: 15 * 60 * 1000, // 15 minutes for popular products
      normal: 30 * 60 * 1000, // 30 minutes for regular products
      low: 60 * 60 * 1000, // 1 hour for rarely searched
    },
    staleThresholdHours: 24,
    qualityFiltering: {
      minConfidenceScore: 0.7,
      requireMultipleSources: false,
      priceChangeValidation: true,
    },
  },

  notifications: {
    enabled: true,
    realTimeWebSocket: true,
    batchNotifications: false,
    rateLimiting: {
      maxPerHour: 20,
      maxPerDay: 100,
      cooldownPeriodMs: 5 * 60 * 1000, // 5 minutes
    },
    channels: {
      websocket: true,
      email: false, // Disabled by default
      push: false, // Disabled by default
    },
    priority: {
      urgent: { deliveryTimeMs: 1000, retryCount: 3 },
      high: { deliveryTimeMs: 5000, retryCount: 2 },
      normal: { deliveryTimeMs: 15000, retryCount: 1 },
      low: { deliveryTimeMs: 60000, retryCount: 1 },
    },
  },

  dataRetention: {
    priceHistoryDays: 180,
    dealHistoryDays: 30,
    metricsRetentionDays: 7,
    reportRetentionDays: 90,
    logRetentionDays: 30,
    cleanupSchedule: {
      enabled: true,
      cronExpression: '0 2 * * *', // 2 AM daily
      batchSize: 1000,
    },
  },

  monitoring: {
    enabled: true,
    healthChecks: {
      intervalMs: 5 * 60 * 1000, // 5 minutes
      timeoutMs: 30000,
      failureThreshold: 3,
    },
    performance: {
      trackResponseTimes: true,
      trackThroughput: true,
      trackErrorRates: true,
      metricsAggregationIntervalMs: 15 * 60 * 1000, // 15 minutes
    },
    alerting: {
      enabled: true,
      thresholds: {
        errorRatePercent: 5,
        queueSizeWarning: 100,
        queueSizeCritical: 500,
        responseTimeWarningMs: 5000,
        responseTimeCriticalMs: 15000,
        memoryUsagePercent: 85,
        cpuUsagePercent: 80,
      },
      escalation: {
        warningAfterMinutes: 15,
        criticalAfterMinutes: 5,
        autoRestart: false, // Safety measure
      },
    },
  },

  reporting: {
    enabled: true,
    schedules: {
      daily: { enabled: true, time: '01:00' },
      weekly: { enabled: true, dayOfWeek: 1, time: '02:00' }, // Monday
      monthly: { enabled: true, dayOfMonth: 1, time: '03:00' }, // 1st of month
    },
    formats: ['json', 'html'],
    distribution: {
      webhook: '',
      email: [],
      storage: './reports',
    },
    metrics: {
      includeComparisons: true,
      includeInsights: true,
      includeRecommendations: true,
    },
  },

  integration: {
    legacyEngine: {
      enabled: true,
      fallbackMode: true,
      comparisonMode: true, // Run both engines for comparison
      migrationProgress: 25, // 25% migrated
    },
    walmartAPI: {
      enabled: true,
      rateLimitPerSecond: 2,
      timeout: 15000,
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
      },
    },
    database: {
      connectionPool: {
        min: 2,
        max: 10,
        idleTimeoutMs: 30000,
      },
      queryTimeout: 5000,
      enableWAL: true,
      enableForeignKeys: true,
    },
  },

  security: {
    encryption: {
      enabled: false, // Disabled for development
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    },
    authentication: {
      required: false, // Disabled for development
      tokenExpirationHours: 24,
      refreshTokenEnabled: true,
    },
    authorization: {
      roleBasedAccess: false, // Simplified for development
      permissions: ['read', 'write', 'admin'],
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false,
    },
    audit: {
      enabled: true,
      logLevel: 'info',
      sensitiveDataMasking: true,
    },
  },

  environment: {
    name: 'development',
    debug: true,
    logLevel: 'info',
    enableDevTools: true,
    mockData: false,
    testMode: false,
  },
};

// Environment-specific configurations
export const PRODUCTION_CONFIG: Partial<DealPipelineConfiguration> = {
  environment: {
    name: 'production',
    debug: false,
    logLevel: 'warn',
    enableDevTools: false,
    mockData: false,
    testMode: false,
  },
  security: {
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyRotationDays: 30,
    },
    authentication: {
      required: true,
      tokenExpirationHours: 8,
      refreshTokenEnabled: true,
    },
    authorization: {
      roleBasedAccess: true,
      permissions: ['read', 'write', 'admin'],
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
      skipSuccessfulRequests: false,
    },
    audit: {
      enabled: true,
      logLevel: 'warn',
      sensitiveDataMasking: true,
    },
  },
  pipeline: {
    enabled: true,
    autoStart: true,
    processingIntervals: {
      priceUpdateMs: 30 * 60 * 1000,
      dealDetectionMs: 15 * 60 * 1000,
      alertCheckMs: 5 * 60 * 1000,
      healthCheckMs: 5 * 60 * 1000,
      cleanupIntervalHours: 24,
    },
    batchSettings: {
      maxProductsPerBatch: 20, // Higher throughput in production
      maxConcurrentRequests: 5,
      delayBetweenRequestsMs: 1000, // Faster processing
      maxRetries: 5,
      timeoutMs: 20000,
    },
    queue: {
      maxSize: 10000,
      priorityLevels: ['low', 'normal', 'high', 'urgent'],
      processingOrder: 'priority',
    },
  },
  monitoring: {
    enabled: true,
    healthChecks: {
      intervalMs: 5 * 60 * 1000,
      timeoutMs: 30000,
      failureThreshold: 3,
    },
    performance: {
      trackResponseTimes: true,
      trackThroughput: true,
      trackErrorRates: true,
      metricsAggregationIntervalMs: 15 * 60 * 1000,
    },
    alerting: {
      enabled: true,
      thresholds: {
        errorRatePercent: 5,
        queueSizeWarning: 100,
        queueSizeCritical: 500,
        responseTimeWarningMs: 5000,
        responseTimeCriticalMs: 15000,
        memoryUsagePercent: 85,
        cpuUsagePercent: 80,
      },
      escalation: {
        warningAfterMinutes: 5,
        criticalAfterMinutes: 2,
        autoRestart: true, // Enable auto-restart in production
      },
    },
  },
};

export const STAGING_CONFIG: Partial<DealPipelineConfiguration> = {
  environment: {
    name: 'staging',
    debug: true,
    logLevel: 'info',
    enableDevTools: true,
    mockData: false,
    testMode: true,
  },
  pipeline: {
    enabled: true,
    autoStart: true,
    processingIntervals: {
      priceUpdateMs: 60 * 60 * 1000, // Slower in staging
      dealDetectionMs: 30 * 60 * 1000,
      alertCheckMs: 10 * 60 * 1000,
      healthCheckMs: 10 * 60 * 1000,
      cleanupIntervalHours: 48,
    },
    batchSettings: {
      maxProductsPerBatch: 10,
      maxConcurrentRequests: 3,
      delayBetweenRequestsMs: 2000,
      maxRetries: 3,
      timeoutMs: 30000,
    },
    queue: {
      maxSize: 10000,
      priorityLevels: ['low', 'normal', 'high', 'urgent'],
      processingOrder: 'priority',
    },
  },
  dataRetention: {
    priceHistoryDays: 30, // Shorter retention in staging
    dealHistoryDays: 7,
    metricsRetentionDays: 3,
    reportRetentionDays: 14,
    logRetentionDays: 7,
    cleanupSchedule: {
      enabled: true,
      cronExpression: '0 2 * * *', // 2 AM daily
      batchSize: 1000,
    },
  },
};

/**
 * Get configuration for specific environment
 */
export function getDealPipelineConfig(environment?: string): DealPipelineConfiguration {
  const env = environment || process.env.NODE_ENV || 'development';
  let config = { ...DEFAULT_DEAL_PIPELINE_CONFIG };

  switch (env) {
    case 'production':
      config = { ...config, ...PRODUCTION_CONFIG };
      break;
    case 'staging':
      config = { ...config, ...STAGING_CONFIG };
      break;
    default:
      // Use default configuration for development
      break;
  }

  // Override with environment variables if available
  if (process.env.DEAL_PIPELINE_ENABLED !== undefined) {
    config.pipeline.enabled = process.env.DEAL_PIPELINE_ENABLED === 'true';
  }

  if (process.env.DEAL_DETECTION_MIN_SAVINGS !== undefined) {
    config.dealDetection.minSavingsPercentage = parseInt(process.env.DEAL_DETECTION_MIN_SAVINGS);
  }

  if (process.env.PRICE_UPDATE_INTERVAL_MS !== undefined) {
    config.pipeline.processingIntervals.priceUpdateMs = parseInt(process.env.PRICE_UPDATE_INTERVAL_MS);
  }

  if (process.env.LOG_LEVEL !== undefined) {
    config.environment.logLevel = process.env.LOG_LEVEL as any;
  }

  return config;
}

/**
 * Validate configuration
 */
export function validateDealPipelineConfig(config: DealPipelineConfiguration): string[] {
  const errors: string[] = [];

  // Validate required settings
  if (config.pipeline.processingIntervals.priceUpdateMs < 60000) {
    errors.push('Price update interval must be at least 1 minute');
  }

  if (config.dealDetection.minSavingsPercentage < 0 || config.dealDetection.minSavingsPercentage > 100) {
    errors.push('Minimum savings percentage must be between 0 and 100');
  }

  if (config.pipeline.batchSettings.maxProductsPerBatch < 1) {
    errors.push('Max products per batch must be at least 1');
  }

  if (config.dataRetention.priceHistoryDays < 1) {
    errors.push('Price history retention must be at least 1 day');
  }

  // Validate thresholds
  const thresholds = config.dealDetection.thresholds;
  if (thresholds.minimal.percentage >= thresholds.moderate.percentage ||
      thresholds.moderate.percentage >= thresholds.good.percentage ||
      thresholds.good.percentage >= thresholds.excellent.percentage ||
      thresholds.excellent.percentage >= thresholds.exceptional.percentage) {
    errors.push('Deal thresholds must be in ascending order');
  }

  // Validate monitoring settings
  if (config.monitoring.alerting.thresholds.queueSizeWarning >= config.monitoring.alerting.thresholds.queueSizeCritical) {
    errors.push('Queue warning threshold must be less than critical threshold');
  }

  return errors;
}