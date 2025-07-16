import { config } from 'dotenv';
config(); // Load environment variables

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createContext } from './trpc/context';
import { appRouter } from './trpc/router';
import { WebSocketServer } from 'ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import appConfig from '../config/app.config';

const app = express();
const PORT = appConfig.api.port;

// Middleware
app.use(helmet());
app.use(cors(appConfig.api.cors));
app.use(express.json());

// Health check endpoint
app.get('/health', async (_req, res) => {
  const services = {
    api: 'running',
    ollama: 'unknown',
    chromadb: 'unknown',
    database: 'unknown'
  };

  try {
    // Check Ollama connection
    const ollamaResponse = await fetch(`${appConfig.ollama?.baseUrl || 'http://localhost:11434'}/api/tags`);
    services.ollama = ollamaResponse.ok ? 'connected' : 'disconnected';
  } catch (error) {
    services.ollama = 'error';
  }

  try {
    // Check ChromaDB connection (if configured)
    if (appConfig.rag?.vectorStore?.baseUrl) {
      const chromaResponse = await fetch(`${appConfig.rag.vectorStore.baseUrl}/api/v1/heartbeat`);
      services.chromadb = chromaResponse.ok ? 'connected' : 'disconnected';
    } else {
      services.chromadb = 'not_configured';
    }
  } catch (error) {
    services.chromadb = 'error';
  }

  try {
    // Check database connection
    const { Database } = await import('better-sqlite3');
    const db = new Database(appConfig.database?.path || './data/app.db', { readonly: true });
    db.prepare('SELECT 1').get();
    db.close();
    services.database = 'connected';
  } catch (error) {
    services.database = 'error';
  }

  const overallStatus = Object.values(services).every(s => 
    s === 'running' || s === 'connected' || s === 'not_configured'
  ) ? 'healthy' : 'degraded';

  res.json({ 
    status: overallStatus, 
    timestamp: new Date().toISOString(),
    services
  });
});

// tRPC middleware
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, type, path, input, ctx, req }) {
      console.error('tRPC Error:', {
        type,
        path,
        error: error.message,
        input
      });
    }
  })
);

// Static file serving for UI in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/client'));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'dist/client' });
  });
}

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// WebSocket server for subscriptions
const wss = new WebSocketServer({
  port: PORT + 1,
  path: '/trpc-ws'
});

const wsHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext
});

console.log(`🔌 WebSocket server running on ws://localhost:${PORT + 1}/trpc-ws`);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  wsHandler.broadcastReconnectNotification();
  
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  wss.close(() => {
    console.log('WebSocket server closed');
  });
});

export { app, server, wss };
