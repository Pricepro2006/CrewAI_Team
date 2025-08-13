#!/usr/bin/env tsx
/**
 * Standalone WebSocket Gateway Server
 * Runs on port 8080 for Walmart Grocery Agent real-time communication
 */

import { walmartWSServer } from './WalmartWebSocketServer.js';
import { logger } from '../../utils/logger.js';
import { createServer } from 'http';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '8080');
const HOST = process.env.WEBSOCKET_HOST || 'localhost';

async function startWebSocketServer() {
  try {
    logger.info('Starting Walmart WebSocket Server...', 'WEBSOCKET_SERVER');

    // Create HTTP server for WebSocket to attach to
    const httpServer = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          websocket: {
            port: PORT,
            connections: walmartWSServer.getClientCount()
          },
          timestamp: new Date().toISOString()
        }));
      } else if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Walmart WebSocket Server</title></head>
            <body>
              <h1>Walmart WebSocket Server</h1>
              <p>WebSocket endpoint: <code>ws://localhost:${PORT}/ws/walmart</code></p>
              <p>Active connections: ${walmartWSServer.getClientCount()}</p>
              <p>Health check: <a href="/health">/health</a></p>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // Initialize the Walmart WebSocket server
    walmartWSServer.initialize(httpServer, "/ws/walmart");

    // Start HTTP server on port 8080
    httpServer.listen(PORT, HOST, () => {
      logger.info(`🚀 Walmart WebSocket Server running on ws://${HOST}:${PORT}/ws/walmart`, 'WEBSOCKET_SERVER');
      logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`, 'WEBSOCKET_SERVER');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down WebSocket server...`, 'WEBSOCKET_SERVER');
      
      try {
        walmartWSServer.shutdown();
        httpServer.close(() => {
          logger.info('WebSocket server stopped successfully', 'WEBSOCKET_SERVER');
          process.exit(0);
        });
      } catch (error) {
        logger.error('Error during WebSocket server shutdown', 'WEBSOCKET_SERVER', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start WebSocket Gateway Server', 'WEBSOCKET_SERVER', error);
    process.exit(1);
  }
}

// Start the server
startWebSocketServer().catch((error) => {
  logger.error('Unhandled error starting WebSocket server', 'WEBSOCKET_SERVER', error);
  process.exit(1);
});