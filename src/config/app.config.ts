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
  };
}

interface OllamaConfig {
  url: string;
  model?: string;
}

interface AppConfig {
  database: DatabaseConfig;
  api: ApiConfig;
  ollama?: OllamaConfig;
}

const appConfig: AppConfig = {
  database: {
    path: process.env.DATABASE_PATH || './data/app.db',
  },
  api: {
    port: parseInt(process.env.PORT || '3001', 10),
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  },
  ollama: process.env.OLLAMA_URL ? {
    url: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
  } : undefined,
};

export default appConfig;