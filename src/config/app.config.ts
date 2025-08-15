import { config } from 'dotenv';
import CredentialManager from './CredentialManager.js';

config();

interface DatabaseConfig {
  path: string;
  pool?: {
    maxConnections: number;
    idleTimeout: number; // milliseconds
    acquireTimeout: number; // milliseconds
    enableWAL: boolean;
    enableForeignKeys: boolean;
    cacheSize: number; // KB
    memoryMap: number; // bytes
    busyTimeout: number; // milliseconds
    checkpointInterval: number; // milliseconds
    enableMonitoring: boolean;
  };
  walmart?: {
    path: string;
    pool?: {
      maxConnections: number;
      idleTimeout: number;
      acquireTimeout: number;
      enableWAL: boolean;
      enableForeignKeys: boolean;
      cacheSize: number;
      memoryMap: number;
      busyTimeout: number;
      checkpointInterval: number;
      enableMonitoring: boolean;
    };
  };
}

interface ApiConfig {
  port: number;
  cors: {
    origin: string[];
    credentials: boolean;
    optionsSuccessStatus?: number;
    methods?: string[];
    allowedHeaders?: string[];
  };
}

interface OllamaConfig {
  url: string;
  baseUrl: string;
  model?: string;
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenExpiration: string;
}

interface VectorStoreConfig {
  baseUrl: string;
  collection?: string;
}

interface RAGConfig {
  vectorStore: VectorStoreConfig;
  embeddingModel?: string;
}

interface AppConfig {
  database: DatabaseConfig;
  api: ApiConfig;
  ollama?: OllamaConfig;
  rag?: RAGConfig;
  security: SecurityConfig;
}

// Lazy-loaded configuration function - called after credential manager is initialized
function createAppConfig(): AppConfig {
  const credentialManager = CredentialManager.getInstance();
  
  return {
    database: {
      path: credentialManager.get('DATABASE_PATH') || './data/crewai_enhanced.db',
    },
    api: {
      port: parseInt(credentialManager.get('API_PORT') || '3000', 10),
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:3000', 
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:5178',
          'http://localhost:5179',
          'http://localhost:5180'
        ],
        credentials: true,
        optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token', 'X-Request-ID'],
      },
    },
    ollama: credentialManager.get('OLLAMA_BASE_URL') ? {
      url: credentialManager.get('OLLAMA_BASE_URL')!,
      baseUrl: credentialManager.get('OLLAMA_BASE_URL')!,
      model: process.env.OLLAMA_MODEL,
    } : undefined,
    rag: credentialManager.get('CHROMA_BASE_URL') ? {
      vectorStore: {
        baseUrl: credentialManager.get('CHROMA_BASE_URL')!,
        collection: credentialManager.get('CHROMA_COLLECTION_NAME') || 'crewai_documents',
      },
      embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
    } : undefined,
    security: {
      jwtSecret: credentialManager.getRequired('JWT_SECRET'),
      jwtExpiration: credentialManager.get('JWT_EXPIRES_IN') || '7d',
      refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
    },
  };
}

// Default configuration using environment variables for compatibility
const appConfig: AppConfig = {
  database: {
    path: process.env.DATABASE_PATH || './data/crewai_enhanced.db',
    pool: {
      maxConnections: parseInt(process.env.DB_POOL_SIZE || '10', 10),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000', 10), // 5 minutes
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000', 10), // 30 seconds
      enableWAL: process.env.DB_ENABLE_WAL !== 'false',
      enableForeignKeys: process.env.DB_ENABLE_FOREIGN_KEYS !== 'false',
      cacheSize: parseInt(process.env.DB_CACHE_SIZE || '10000', 10), // 10MB
      memoryMap: parseInt(process.env.DB_MEMORY_MAP || '268435456', 10), // 256MB
      busyTimeout: parseInt(process.env.DB_BUSY_TIMEOUT || '30000', 10), // 30 seconds
      checkpointInterval: parseInt(process.env.DB_CHECKPOINT_INTERVAL || '60000', 10), // 1 minute
      enableMonitoring: process.env.DB_ENABLE_MONITORING !== 'false',
    },
    walmart: {
      path: process.env.WALMART_DATABASE_PATH || './data/walmart_grocery.db',
      pool: {
        maxConnections: parseInt(process.env.WALMART_DB_POOL_SIZE || '5', 10),
        idleTimeout: parseInt(process.env.WALMART_DB_IDLE_TIMEOUT || '300000', 10),
        acquireTimeout: parseInt(process.env.WALMART_DB_ACQUIRE_TIMEOUT || '30000', 10),
        enableWAL: process.env.WALMART_DB_ENABLE_WAL !== 'false',
        enableForeignKeys: process.env.WALMART_DB_ENABLE_FOREIGN_KEYS !== 'false',
        cacheSize: parseInt(process.env.WALMART_DB_CACHE_SIZE || '5000', 10), // 5MB
        memoryMap: parseInt(process.env.WALMART_DB_MEMORY_MAP || '134217728', 10), // 128MB
        busyTimeout: parseInt(process.env.WALMART_DB_BUSY_TIMEOUT || '30000', 10),
        checkpointInterval: parseInt(process.env.WALMART_DB_CHECKPOINT_INTERVAL || '60000', 10),
        enableMonitoring: process.env.WALMART_DB_ENABLE_MONITORING !== 'false',
      },
    },
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000', 
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5178',
        'http://localhost:5179',
        'http://localhost:5180'
      ],
      credentials: true,
      optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token', 'X-Request-ID'],
    },
  },
  ollama: process.env.OLLAMA_BASE_URL ? {
    url: process.env.OLLAMA_BASE_URL,
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
  } : undefined,
  rag: process.env.CHROMA_BASE_URL ? {
    vectorStore: {
      baseUrl: process.env.CHROMA_BASE_URL,
      collection: process.env.CHROMA_COLLECTION_NAME || 'crewai_documents',
    },
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
  } : undefined,
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    jwtExpiration: process.env.JWT_EXPIRES_IN || '7d',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },
};

export default appConfig;
export { createAppConfig };