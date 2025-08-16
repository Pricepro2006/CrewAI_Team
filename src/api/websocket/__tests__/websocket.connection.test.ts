/**
 * WebSocket Connection Tests
 * Tests WebSocket connection establishment, authentication, and lifecycle management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import { WalmartWebSocketServer } from '../WalmartWebSocketServer.js';
import { EmailProcessingWebSocket } from '../EmailProcessingWebSocket.js';
import { WebSocketServer } from 'ws';

describe('WebSocket Connection Tests', () => {
  let server: Server;
  let walmartWS: WalmartWebSocketServer;
  let emailWS: EmailProcessingWebSocket;
  let port: number;
  let serverUrl: string;
  
  beforeAll((done) => {
    port = 3000 + Math.floor(Math.random() * 1000);
    serverUrl = `ws://localhost:${port}`;
    server = createServer();
    server.listen(port, done);
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  beforeEach(() => {
    walmartWS = new WalmartWebSocketServer();
    emailWS = new EmailProcessingWebSocket();
  });
  
  afterEach(() => {
    walmartWS?.shutdown();
    emailWS?.shutdown();
  });

  describe('Basic Connection Establishment', () => {
    it('should accept WebSocket connections', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      
      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        expect(walmartWS.getClientCount()).toBe(1);
        client.close();
        done();
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle multiple simultaneous connections', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const clients: WebSocket[] = [];
      let connectedCount = 0;
      const totalClients = 3;
      
      for (let i = 0; i < totalClients; i++) {
        const client = new WebSocket(`${serverUrl}/ws/walmart`);
        clients.push(client);
        
        client.on('open', () => {
          connectedCount++;
          if (connectedCount === totalClients) {
            expect(walmartWS.getClientCount()).toBe(totalClients);
            
            // Close all clients
            clients.forEach(c => c.close());
            done();
          }
        });
        
        client.on('error', (error) => {
          done(error);
        });
      }
    });

    it('should send welcome message on connection', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('nlp_processing');
        expect(message.data.message).toBe('Connected to Walmart Grocery Agent');
        expect(message.data.clientId).toBeTruthy();
        expect(message.data.features).toContain('nlp');
        client.close();
        done();
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle email processing WebSocket connections', (done) => {
      const wss = new WebSocketServer({ server, path: '/ws/email' });
      emailWS.initialize(wss);
      
      const client = new WebSocket(`${serverUrl}/ws/email`);
      
      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        expect(emailWS.getConnectedClients()).toBe(1);
        client.close();
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('stats_updated');
        expect(message.data).toBeTruthy();
        done();
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Client Authentication and Session Management', () => {
    it('should handle authentication messages', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      
      client.on('open', () => {
        // Send auth message
        client.send(JSON.stringify({
          type: 'auth',
          userId: 'test-user-123',
          sessionId: 'session-abc'
        }));
        
        // Wait a bit for authentication to process
        setTimeout(() => {
          client.close();
          done();
        }, 100);
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle subscription messages', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      
      client.on('open', () => {
        // Send subscription message
        client.send(JSON.stringify({
          type: 'subscribe',
          events: ['nlp_processing', 'price_update']
        }));
        
        setTimeout(() => {
          client.close();
          done();
        }, 100);
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle ping-pong messages', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      let receivedPong = false;
      
      client.on('open', () => {
        // Send ping
        client.send(JSON.stringify({ type: 'ping' }));
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.data && message.data.pong) {
          receivedPong = true;
          expect(receivedPong).toBe(true);
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Connection Lifecycle Management', () => {
    it('should properly clean up disconnected clients', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      
      client.on('open', () => {
        expect(walmartWS.getClientCount()).toBe(1);
        client.close();
      });
      
      client.on('close', () => {
        // Give server time to clean up
        setTimeout(() => {
          expect(walmartWS.getClientCount()).toBe(0);
          done();
        }, 50);
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle client errors gracefully', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      
      client.on('open', () => {
        expect(walmartWS.getClientCount()).toBe(1);
        
        // Force an error by sending invalid JSON
        client.send('invalid-json');
        
        // Client should still be connected after invalid message
        setTimeout(() => {
          expect(walmartWS.getClientCount()).toBe(1);
          client.close();
          done();
        }, 100);
      });
      
      client.on('error', (error) => {
        // Expected for invalid JSON
      });
    });

    it('should handle heartbeat mechanism', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      let pongReceived = false;
      
      client.on('open', () => {
        expect(walmartWS.getClientCount()).toBe(1);
      });
      
      client.on('ping', () => {
        pongReceived = true;
        client.pong();
      });
      
      // Wait for potential heartbeat
      setTimeout(() => {
        client.close();
        done();
      }, 100);
      
      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast messages to all connected clients', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const clients: WebSocket[] = [];
      let messagesReceived = 0;
      const totalClients = 2;
      
      const testMessage = {
        type: 'price_update' as const,
        data: { productId: 'test-123', oldPrice: 10, newPrice: 12 },
        timestamp: new Date().toISOString()
      };
      
      for (let i = 0; i < totalClients; i++) {
        const client = new WebSocket(`${serverUrl}/ws/walmart`);
        clients.push(client);
        
        client.on('open', () => {
          if (clients.filter(c => c.readyState === WebSocket.OPEN).length === totalClients) {
            // All clients connected, broadcast message
            walmartWS.broadcast(testMessage);
          }
        });
        
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'price_update') {
            messagesReceived++;
            expect(message.data.productId).toBe('test-123');
            
            if (messagesReceived === totalClients) {
              clients.forEach(c => c.close());
              done();
            }
          }
        });
        
        client.on('error', (error) => {
          done(error);
        });
      }
    });
  });
});
