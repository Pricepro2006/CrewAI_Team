#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = 3000;

// Create HTTP server
const httpServer = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      websocket: 'ready',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({
  noServer: true,
  path: '/ws'
});

// Handle WebSocket connections
wss.on('connection', (ws, request) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`✅ WebSocket connection established: ${clientId}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    connectionId: clientId,
    serverTime: Date.now(),
    message: 'Connected to simple WebSocket server'
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📥 Received message:`, message);
      
      // Echo the message back
      ws.send(JSON.stringify({
        type: 'echo',
        originalMessage: message,
        serverTimestamp: Date.now(),
        connectionId: clientId
      }));
    } catch (error) {
      console.log(`📥 Received raw data:`, data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 WebSocket connection closed: ${clientId}`);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${clientId}:`, error.message);
  });
});

// Handle HTTP upgrade for WebSocket
httpServer.on('upgrade', (request, socket, head) => {
  const pathname = request.url || '';
  
  console.log(`🔌 HTTP upgrade request for: ${pathname}`);
  
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    console.log(`❌ Rejecting unknown WebSocket path: ${pathname}`);
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Simple WebSocket server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  httpServer.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  httpServer.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});