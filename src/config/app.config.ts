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

interface AppConfig {
  database: DatabaseConfig;
  api: ApiConfig;
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
};

export default appConfig;