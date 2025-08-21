import { config as dotenvConfig } from 'dotenv';
// Load environment variables
dotenvConfig();
export const config = {
    get(key) {
        return process.env[key];
    },
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    database: {
        main: process.env.DATABASE_PATH || './data/main.db',
        walmart: process.env.WALMART_DB_PATH || './data/walmart_grocery.db',
        basic: process.env.BASIC_DB_PATH || './data/basic.db'
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10)
    },
    llama: {
        url: process.env.LLAMA_CPP_URL || 'http://localhost:11434',
        model: process.env.LLAMA_MODEL || 'llama-3.2-3b-instruct'
    },
    websocket: {
        port: parseInt(process.env.WEBSOCKET_PORT || '8080', 10)
    }
};
export default config;
