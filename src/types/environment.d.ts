/// <reference types="node" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Build and runtime environment
      NODE_ENV: 'development' | 'production' | 'test';
      CI?: string;
      
      // Vite configuration
      VITE_PORT?: string;
      VITE_USE_POLLING?: string;
      VITEST?: string;
      
      // Database configuration
      DATABASE_URL?: string;
      DATABASE_HOST?: string;
      DATABASE_PORT?: string;
      DATABASE_NAME?: string;
      DATABASE_USER?: string;
      DATABASE_PASSWORD?: string;
      
      // Redis configuration
      REDIS_HOST?: string;
      REDIS_PORT?: string;
      REDIS_PASSWORD?: string;
      REDIS_DB?: string;
      REDIS_TLS_ENABLED?: string;
      REDIS_ENABLE_READY_CHECK?: string;
      
      // API configuration
      API_PORT?: string;
      API_HOST?: string;
      DISABLE_EXTERNAL_APIS?: string;
      
      // LLM configuration (llama.cpp)
      OLLAMA_HOST?: string;
      OLLAMA_PORT?: string;
      OLLAMA_API_URL?: string;
      OLLAMA_BASE_URL?: string;
      
      // Walmart API configuration
      WALMART_API_KEY?: string;
      WALMART_API_SECRET?: string;
      WALMART_BASE_URL?: string;
      
      // WebSocket configuration
      WEBSOCKET_PORT?: string;
      WEBSOCKET_HOST?: string;
      
      // Logging configuration
      LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
      LOG_FORMAT?: 'json' | 'pretty';
      
      // Memory optimization
      NODE_OPTIONS?: string;
      
      // Microsoft Graph API
      MICROSOFT_CLIENT_ID?: string;
      MICROSOFT_CLIENT_SECRET?: string;
      MICROSOFT_TENANT_ID?: string;
      
      // Gmail API
      GMAIL_CLIENT_ID?: string;
      GMAIL_CLIENT_SECRET?: string;
      GMAIL_REFRESH_TOKEN?: string;
      
      // ChromaDB configuration
      CHROMA_HOST?: string;
      CHROMA_PORT?: string;
      
      // LLama configuration
      LLAMA_MODEL_PATH?: string;
      LLAMA_N_GPU_LAYERS?: string;
      LLAMA_N_CTX?: string;
      LLAMA_N_BATCH?: string;
      LLAMA_N_THREADS?: string;
      
      // Feature flags
      ENABLE_LLM_PROCESSING?: string;
      ENABLE_WEBSOCKET?: string;
      ENABLE_CACHING?: string;
      ENABLE_MONITORING?: string;
      
      // Security
      JWT_SECRET?: string;
      SESSION_SECRET?: string;
      CORS_ORIGIN?: string;
      
      // Email configuration
      EMAIL_BATCH_SIZE?: string;
      EMAIL_PROCESSING_INTERVAL?: string;
      EMAIL_RETRY_ATTEMPTS?: string;
      
      // Performance tuning
      MAX_CONCURRENT_REQUESTS?: string;
      REQUEST_TIMEOUT?: string;
      CACHE_TTL?: string;
      
      // Deployment
      DEPLOY_ENV?: string;
      DEPLOY_URL?: string;
      CDN_URL?: string;
    }
  }
}

// Ensure this file is treated as a module
export {};