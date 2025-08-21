/**
 * Walmart Grocery Agent Database Configuration
 * Separate database configuration for Walmart-specific data
 */

import { config } from 'dotenv';
import { join } from 'path';

config();

export interface WalmartDatabaseConfig {
  sqlite: {
    path: string;
    enableWAL: boolean;
    enableForeignKeys: boolean;
    cacheSize: number;
    memoryMap: number;
    maxConnections: number;
    minConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    busyTimeout: number;
  };
  nlp: {
    model: string;
    host: string;
    port: number;
    timeout: number;
  };
}

export const walmartConfig: WalmartDatabaseConfig = {
  sqlite: {
    // Use dedicated walmart_grocery.db instead of shared crewai_enhanced.db
    path: process.env.WALMART_DB_PATH || './data/walmart_grocery.db',
    enableWAL: true,
    enableForeignKeys: true,
    cacheSize: 10000, // Smaller cache for dedicated database
    memoryMap: 268435456, // 256MB for Walmart-specific data
    maxConnections: 10, // Fewer connections needed
    minConnections: 2, // Keep minimum connections warm
    connectionTimeout: 5000,
    idleTimeout: 30000,
    busyTimeout: 3000,
  },
  nlp: {
    // Use Qwen3:0.6b for NLP services as requested by user
    model: process.env.WALMART_NLP_MODEL || 'qwen3:0.6b',
    host: process.env.OLLAMA_HOST || 'http://localhost',
    port: parseInt(process.env.OLLAMA_PORT || '11434', 10),
    timeout: parseInt(process.env.NLP_TIMEOUT || '10000', 10),
  },
};

export default walmartConfig;