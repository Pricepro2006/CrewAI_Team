import { config } from 'dotenv';

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
  model?: string;
}

interface SecurityConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenExpiration: string;
}

interface AppConfig {
  database: DatabaseConfig;
  api: ApiConfig;
  ollama?: OllamaConfig;
  security: SecurityConfig;
}

const appConfig: AppConfig = {
  database: {
    path: process.env.DATABASE_PATH || './data/app.db',
  },
  api: {
    port: parseInt(process.env.PORT || '3001', 10),
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
  ollama: process.env.OLLAMA_URL ? {
    url: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
  } : undefined,
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    jwtExpiration: process.env.JWT_EXPIRATION || '1h',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },
};

export default appConfig;