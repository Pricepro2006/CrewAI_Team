export const appConfig = {
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    host: process.env.API_HOST || 'localhost',
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    }
  },
  ui: {
    port: parseInt(process.env.UI_PORT || '5173'),
    host: process.env.UI_HOST || 'localhost'
  },
  database: {
    path: process.env.DATABASE_PATH || './data/app.db'
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10')
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './data/logs'
  },
  maestro: {
    queueConfig: {
      maxSize: 100,
      strategy: 'priority' as const
    },
    maxConcurrentTasks: 5,
    taskTimeout: 300000 // 5 minutes
  },
  agents: {
    maxAgents: 10,
    idleTimeout: 300000, // 5 minutes
    preloadAgents: ['ResearchAgent', 'CodeAgent']
  },
  features: {
    enableWebSearch: true,
    enableCodeGeneration: true,
    enableDataAnalysis: true,
    enableWriting: true,
    enableFileOperations: false // Disabled by default for security
  }
};

export default appConfig;
