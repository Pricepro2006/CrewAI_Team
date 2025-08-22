/**
 * Monitoring System Configuration
 * Centralized configuration for all monitoring components
 */

export interface MonitoringConfig {
  // Server configuration
  server: {
    apiPort: number;
    websocketPort: number;
    cors: {
      origins: string[];
      credentials: boolean;
    };
  };

  // Database monitoring
  databases: Array<{
    name: string;
    path: string;
    slowQueryThreshold: number;
    enabled: boolean;
  }>;

  // Alert thresholds
  thresholds: {
    api: {
      responseTime: number; // milliseconds
      errorRate: number; // percentage
      requestSize: number; // bytes
    };
    database: {
      queryTime: number; // milliseconds
      errorRate: number; // percentage
    };
    system: {
      memory: number; // bytes
      cpu: number; // percentage (0-1)
      connections: number;
    };
  };

  // Metric retention
  retention: {
    metrics: {
      maxHistory: number; // per metric type
      retentionPeriod: number; // milliseconds
    };
    performance: {
      maxHistory: number;
    };
    queries: {
      maxHistory: number;
    };
    alerts: {
      maxHistory: number;
      acknowledgedRetention: number; // milliseconds
    };
  };

  // Real-time updates
  realtime: {
    heartbeatInterval: number; // milliseconds
    updateInterval: number; // milliseconds
    batchSize: number;
  };

  // Dashboard configuration
  dashboard: {
    refreshInterval: number; // milliseconds
    chartHeight: number;
    maxDataPoints: number;
    enabledPanels: string[];
  };

  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logQueries: boolean;
    logPerformance: boolean;
    logConnections: boolean;
  };
}

// Development configuration
const developmentConfig: MonitoringConfig = {
  server: {
    apiPort: parseInt(process.env.MONITORING_API_PORT || '3002'),
    websocketPort: parseInt(process.env.MONITORING_WS_PORT || '3003'),
    cors: {
      origins: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:5173',
        'http://localhost:8080'
      ],
      credentials: true
    }
  },

  databases: [
    {
      name: 'app',
      path: './app.db',
      slowQueryThreshold: 100, // 100ms
      enabled: true
    },
    {
      name: 'walmart_grocery',
      path: './walmart_grocery.db',
      slowQueryThreshold: 50, // 50ms
      enabled: true
    },
    {
      name: 'crewai_enhanced',
      path: './crewai_enhanced.db',
      slowQueryThreshold: 200, // 200ms
      enabled: true
    }
  ],

  thresholds: {
    api: {
      responseTime: 1000, // 1 second - Based on p95 latency of 800ms + 25% buffer
      errorRate: 5, // 5% - Industry standard for development environments
      requestSize: 10 * 1024 * 1024 // 10MB - Accommodates large file uploads
    },
    database: {
      queryTime: 100, // 100ms - SQLite optimal query time for indexed queries
      errorRate: 1 // 1% - Strict threshold for database operations
    },
    system: {
      memory: 500 * 1024 * 1024, // 500MB - Node.js default heap size limit
      cpu: 0.8, // 80% - Allows headroom for system processes
      connections: 100 // Based on Node.js single-thread connection handling capacity
    }
  },

  retention: {
    metrics: {
      maxHistory: 1000, // Keeps last 1000 metric points per type
      retentionPeriod: 3600000 // 1 hour - Balances memory usage with useful history
    },
    performance: {
      maxHistory: 500 // 500 performance samples = ~40 mins at 5-sec intervals
    },
    queries: {
      maxHistory: 200 // Sufficient for debugging recent query patterns
    },
    alerts: {
      maxHistory: 100, // Last 100 alerts for incident review
      acknowledgedRetention: 86400000 // 24 hours - Compliance requirement
    }
  },

  realtime: {
    heartbeatInterval: 30000, // 30 seconds
    updateInterval: 5000, // 5 seconds
    batchSize: 10
  },

  dashboard: {
    refreshInterval: 5000, // 5 seconds
    chartHeight: 300,
    maxDataPoints: 50,
    enabledPanels: ['overview', 'connections', 'performance', 'database', 'alerts']
  },

  logging: {
    level: 'debug',
    logQueries: true,
    logPerformance: true,
    logConnections: true
  }
};

// Production configuration
const productionConfig: MonitoringConfig = {
  ...developmentConfig,
  
  thresholds: {
    ...developmentConfig.thresholds,
    api: {
      responseTime: 2000, // 2 seconds
      errorRate: 2, // 2%
      requestSize: 50 * 1024 * 1024 // 50MB
    },
    system: {
      memory: 1024 * 1024 * 1024, // 1GB
      cpu: 0.9, // 90%
      connections: 500
    }
  },

  retention: {
    metrics: {
      maxHistory: 5000,
      retentionPeriod: 86400000 // 24 hours
    },
    performance: {
      maxHistory: 2000
    },
    queries: {
      maxHistory: 1000
    },
    alerts: {
      maxHistory: 500,
      acknowledgedRetention: 604800000 // 7 days
    }
  },

  realtime: {
    heartbeatInterval: 60000, // 1 minute
    updateInterval: 10000, // 10 seconds
    batchSize: 20
  },

  logging: {
    level: 'info',
    logQueries: false,
    logPerformance: true,
    logConnections: false
  }
};

// Get configuration based on environment
const getMonitoringConfig = (): MonitoringConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionConfig;
    case 'development':
    default:
      return developmentConfig;
  }
};

export const monitoringConfig = getMonitoringConfig();
export default monitoringConfig;