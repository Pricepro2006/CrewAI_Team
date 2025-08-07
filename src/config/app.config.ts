import { config } from 'dotenv';
import CredentialManager from './CredentialManager.js';

config();

interface DatabaseConfig {
  path: string;
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
          'http://localhost:5175'
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
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000', 
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175'
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