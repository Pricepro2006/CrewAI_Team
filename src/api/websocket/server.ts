#!/usr/bin/env tsx
/**
 * Standalone WebSocket Gateway Server
 * Runs on port 8080 for real-time communication
 * Supports both general WebSocket (/ws) and Walmart-specific (/ws/walmart)
 */

import { walmartWSServer } from './WalmartWebSocketServer.js';
import { wsService } from '../services/WebSocketService.js';
import { logger } from '../../utils/logger.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { parse } from 'url';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '8080');
const HOST = process.env.WEBSOCKET_HOST || 'localhost';

// Create general WebSocket server for /ws endpoint
let generalWSS: WebSocketServer;

async function startWebSocketServer() {
  try {
    logger.info('Starting WebSocket Server...', 'WEBSOCKET_SERVER');

    // Create HTTP server for WebSocket to attach to
    const httpServer = createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const generalConnections = generalWSS ? Array.from(generalWSS.clients).length : 0;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          websocket: {
            port: PORT,
            endpoints: {
              general: {
                path: '/ws',
                connections: generalConnections
              },
              walmart: {
                path: '/ws/walmart',
                connections: walmartWSServer.getClientCount()
              }
            }
          },
          timestamp: new Date().toISOString()
        }));
      } else if (req.url === '/' && req.method === 'GET') {
        const generalConnections = generalWSS ? Array.from(generalWSS.clients).length : 0;
        const walmartConnections = walmartWSServer.getClientCount();
        
        // Sanitize port to prevent XSS
        const safePort = String(PORT).replace(/[^0-9]/g, '');
        
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Content-Security-Policy': "default-src 'self'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        });
        res.end(`
          <html>
            <head><title>WebSocket Server</title></head>
            <body>
              <h1>WebSocket Server</h1>
              <h2>Available Endpoints:</h2>
              <ul>
                <li><strong>General WebSocket:</strong> <code>ws://localhost:${safePort}/ws</code> (${generalConnections} connections)</li>
                <li><strong>Walmart WebSocket:</strong> <code>ws://localhost:${safePort}/ws/walmart</code> (${walmartConnections} connections)</li>
              </ul>
              <p>Health check: <a href="/health">/health</a></p>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // Create general WebSocket server for /ws endpoint
    generalWSS = new WebSocketServer({
      noServer: true,
      path: '/ws',
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        threshold: 1024 // Only compress messages > 1KB
      },
      maxPayload: 1024 * 1024, // 1MB
      clientTracking: true,
      verifyClient: (info) => {
        // Basic origin verification
        const origin = info.origin;
        if (process.env.NODE_ENV === 'production' && origin) {
          const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
          if (!allowedOrigins.includes(origin)) {
            logger.warn(`WebSocket connection rejected from origin: ${origin}`, 'WEBSOCKET_SERVER');
            return false;
          }
        }
        return true;
      }
    });

    // Initialize the Walmart WebSocket server
    walmartWSServer.initialize(httpServer, "/ws/walmart");

    // Setup HTTP upgrade handling for both endpoints with error handling
    httpServer.on('upgrade', (request, socket, head) => {
      const pathname = parse(request.url || '').pathname;
      
      // Add socket error handling to prevent crashes
      socket.on('error', (err) => {
        logger.error('Socket error during upgrade:', 'WEBSOCKET_SERVER', { error: err.message });
        socket.destroy();
      });
      
      // Set socket timeout to prevent hanging connections
      socket.setTimeout(30000); // 30 seconds
      socket.on('timeout', () => {
        logger.warn('Socket timeout during upgrade', 'WEBSOCKET_SERVER');
        socket.destroy();
      });
      
      logger.info(`WebSocket upgrade request for: ${pathname}`, 'WEBSOCKET_SERVER', { 
        headers: request.headers,
        method: request.method,
        generalWSSReady: !!generalWSS 
      });
      
      if (pathname === '/ws') {
        // Handle general WebSocket connections
        try {
          logger.info('Attempting WebSocket upgrade for /ws', 'WEBSOCKET_SERVER');
          generalWSS.handleUpgrade(request, socket, head, (ws) => {
          try {
            generalWSS.emit('connection', ws, request);
            
            // Cast to AuthenticatedWebSocket and set guest defaults
            const authenticatedWs = ws as any;
            authenticatedWs.isAuthenticated = false;
            authenticatedWs.userId = undefined;
            authenticatedWs.userRole = 'guest';
            authenticatedWs.permissions = ['read'];
            authenticatedWs.lastActivity = new Date();
            
            // Register with WebSocket service
            const clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            authenticatedWs.clientId = clientId;
            
            try {
              wsService.registerClient(clientId, authenticatedWs);
              
              // Subscribe to all message types for testing
              wsService.subscribe(clientId, ['*']);
            } catch (serviceError) {
              logger.warn(`WebSocket service registration failed for ${clientId}:`, 'WEBSOCKET_SERVER', serviceError);
              // Continue without service registration - basic WebSocket will still work
            }
          
          logger.info(`General WebSocket connection established: ${clientId}`, 'WEBSOCKET_SERVER');
          
          // Send welcome message
          ws.send(JSON.stringify({
            type: 'welcome',
            connectionId: clientId,
            serverTime: Date.now(),
            endpoints: ['/ws', '/ws/walmart'],
            isAuthenticated: false,
            permissions: ['read']
          }));
          
          // Handle incoming messages
          // Add ping-pong for connection health
          const pingInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
              ws.ping();
            } else {
              clearInterval(pingInterval);
            }
          }, 30000); // Ping every 30 seconds
          
          ws.on('pong', () => {
            authenticatedWs.lastActivity = new Date();
          });
          
          ws.on('message', (data) => {
            try {
              // Update activity timestamp
              authenticatedWs.lastActivity = new Date();
              
              const message = JSON.parse(data.toString());
              logger.info(`WebSocket message received:`, 'WEBSOCKET_SERVER', message);
              
              // Handle subscription requests
              if (message.type === 'subscribe' && message.topics) {
                wsService.subscribe(clientId, message.topics);
                ws.send(JSON.stringify({
                  type: 'subscription_confirmed',
                  topics: message.topics,
                  timestamp: Date.now()
                }));
                return;
              }
              
              // Echo the message back with timestamp
              ws.send(JSON.stringify({
                type: 'echo',
                originalMessage: message,
                serverTimestamp: Date.now(),
                connectionId: clientId
              }));
            } catch (error) {
              logger.error('Error processing WebSocket message:', 'WEBSOCKET_SERVER', { error: error instanceof Error ? error.message : String(error) });
            }
          });
          
          ws.on('close', (code, reason) => {
            clearInterval(pingInterval);
            logger.info(`General WebSocket connection closed: ${clientId}`, 'WEBSOCKET_SERVER', {
              code,
              reason: reason?.toString()
            });
            try {
              wsService.unregisterClient(clientId, authenticatedWs);
            } catch (serviceError) {
              logger.warn(`WebSocket service unregister failed for ${clientId}:`, 'WEBSOCKET_SERVER', serviceError);
            }
          });
          
          ws.on('error', (error) => {
            logger.error(`WebSocket error for ${clientId}:`, 'WEBSOCKET_SERVER', { error: error instanceof Error ? error.message : String(error) });
          });
          
          } catch (connectionError) {
            logger.error('WebSocket connection setup failed:', 'WEBSOCKET_SERVER', connectionError);
            ws.close();
          }
          });
        } catch (upgradeError) {
          logger.error('WebSocket upgrade failed:', 'WEBSOCKET_SERVER', upgradeError);
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        }
      } else if (pathname === '/ws/walmart') {
        // Handle Walmart WebSocket connections
        if (walmartWSServer && 'handleUpgrade' in walmartWSServer && typeof walmartWSServer.handleUpgrade === 'function') {
          walmartWSServer.handleUpgrade(request, socket, head);
        } else {
          logger.warn('Walmart WebSocket server handleUpgrade not available', 'WEBSOCKET_SERVER');
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
        }
      } else {
        // Reject unknown WebSocket requests
        logger.warn(`Unknown WebSocket path: ${pathname}`, 'WEBSOCKET_SERVER');
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    });

    // Start HTTP server on port 8080
    httpServer.listen(PORT, HOST, () => {
      logger.info(`🚀 WebSocket Server running on ws://${HOST}:${PORT}`, 'WEBSOCKET_SERVER');
      logger.info(`📡 General WebSocket: ws://${HOST}:${PORT}/ws`, 'WEBSOCKET_SERVER');
      logger.info(`🛒 Walmart WebSocket: ws://${HOST}:${PORT}/ws/walmart`, 'WEBSOCKET_SERVER');
      logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`, 'WEBSOCKET_SERVER');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down WebSocket server...`, 'WEBSOCKET_SERVER');
      
      try {
        // Shutdown WebSocket services
        wsService.shutdown();
        walmartWSServer.shutdown();
        
        // Close general WebSocket server
        if (generalWSS) {
          generalWSS.close();
        }
        
        logger.info('Stopping WebSocket services...', 'WEBSOCKET_SERVER');
        
        httpServer.close(() => {
          logger.info('WebSocket server stopped successfully', 'WEBSOCKET_SERVER');
          process.exit(0);
        });
      } catch (error) {
        logger.error('Error during WebSocket server shutdown', 'WEBSOCKET_SERVER', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start WebSocket Gateway Server', 'WEBSOCKET_SERVER', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Start the server
startWebSocketServer().catch((error: any) => {
  logger.error('Unhandled error starting WebSocket server', 'WEBSOCKET_SERVER', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});