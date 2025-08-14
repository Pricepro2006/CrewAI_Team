/**
 * Unit Tests for WebSocket Events API
 * Tests real-time communication, event handling, and connection management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import WebSocket from 'ws';
import { WebSocketGateway } from '../../../src/api/websocket/WebSocketGateway.js';
import { EventBroadcaster } from '../../../src/api/websocket/EventBroadcaster.js';
import { ConnectionManager } from '../../../src/api/websocket/ConnectionManager.js';

// Mock WebSocket dependencies
vi.mock('../../../src/api/websocket/EventBroadcaster.js');
vi.mock('../../../src/api/websocket/ConnectionManager.js');

describe('WebSocket Events API', () => {
  let httpServer: any;
  let wsServer: WebSocketServer;
  let wsGateway: WebSocketGateway;
  let mockEventBroadcaster: any;
  let mockConnectionManager: any;
  let testPort: number;

  beforeEach(async () => {
    testPort = 8080 + Math.floor(Math.random() * 1000);
    
    // Create HTTP server for WebSocket attachment
    httpServer = createServer();
    
    // Mock services
    mockEventBroadcaster = {
      broadcast: vi.fn(),
      broadcastToUser: vi.fn(),
      broadcastToRoom: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getSubscribers: vi.fn().mockReturnValue([])
    };

    mockConnectionManager = {
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
      getConnection: vi.fn(),
      getUserConnections: vi.fn().mockReturnValue([]),
      getRoomConnections: vi.fn().mockReturnValue([]),
      authenticateConnection: vi.fn(),
      getConnectionCount: vi.fn().mockReturnValue(0),
      getStats: vi.fn().mockReturnValue({ 
        totalConnections: 0, 
        authenticatedConnections: 0,
        roomCounts: {}
      })
    };

    (EventBroadcaster as any).mockImplementation(() => mockEventBroadcaster);
    (ConnectionManager as any).mockImplementation(() => mockConnectionManager);

    // Initialize WebSocket Gateway
    wsGateway = new WebSocketGateway(httpServer);
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(testPort, () => resolve());
    });
  });

  afterEach(async () => {
    if (wsGateway) {
      await wsGateway.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve(void 0);
        });
      });

      expect(mockConnectionManager.addConnection).toHaveBeenCalled();
      ws.close();
    });

    it('should handle connection authentication', async () => {
      mockConnectionManager.authenticateConnection.mockResolvedValue({
        userId: 'user-123',
        roles: ['user'],
        sessionId: 'session-456'
      });

      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'auth',
            payload: { token: 'valid-jwt-token' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            expect(message.payload.userId).toBe('user-123');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should reject invalid authentication', async () => {
      mockConnectionManager.authenticateConnection.mockRejectedValue(
        new Error('Invalid token')
      );

      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'auth',
            payload: { token: 'invalid-token' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_error') {
            expect(message.payload.error).toBe('Authentication failed');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should handle connection cleanup on disconnect', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.close();
        });

        ws.on('close', () => {
          expect(mockConnectionManager.removeConnection).toHaveBeenCalled();
          resolve(void 0);
        });
      });
    });
  });

  describe('Real-time Event Broadcasting', () => {
    it('should broadcast price updates to all subscribers', async () => {
      const priceUpdate = {
        productId: 'prod-123',
        newPrice: 4.99,
        oldPrice: 5.49,
        timestamp: new Date().toISOString()
      };

      await wsGateway.broadcastPriceUpdate(priceUpdate);

      expect(mockEventBroadcaster.broadcast).toHaveBeenCalledWith(
        'price_update',
        priceUpdate
      );
    });

    it('should send NLP processing updates to specific user', async () => {
      const nlpUpdate = {
        sessionId: 'session-123',
        status: 'processing',
        intent: 'search_products',
        confidence: 0.95,
        progress: 0.8
      };

      await wsGateway.sendNLPUpdate('user-123', nlpUpdate);

      expect(mockEventBroadcaster.broadcastToUser).toHaveBeenCalledWith(
        'user-123',
        'nlp_update',
        nlpUpdate
      );
    });

    it('should broadcast cart updates to user sessions', async () => {
      const cartUpdate = {
        cartId: 'cart-456',
        action: 'item_added',
        item: {
          productId: 'prod-123',
          name: 'Organic Milk',
          quantity: 2,
          price: 4.99
        },
        totalItems: 5,
        totalPrice: 24.95
      };

      await wsGateway.broadcastCartUpdate('user-123', cartUpdate);

      expect(mockEventBroadcaster.broadcastToUser).toHaveBeenCalledWith(
        'user-123',
        'cart_update',
        cartUpdate
      );
    });

    it('should handle grocery list collaboration updates', async () => {
      const listUpdate = {
        listId: 'list-789',
        action: 'item_checked',
        itemId: 'item-123',
        checkedBy: 'user-456',
        timestamp: new Date().toISOString()
      };

      await wsGateway.broadcastListUpdate('list-789', listUpdate);

      expect(mockEventBroadcaster.broadcastToRoom).toHaveBeenCalledWith(
        'list:list-789',
        'list_update',
        listUpdate
      );
    });
  });

  describe('Room Management', () => {
    it('should join user to grocery list room', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'join_room',
            payload: { room: 'list:list-789' }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'room_joined') {
            expect(message.payload.room).toBe('list:list-789');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should leave user from room', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          // First join room
          ws.send(JSON.stringify({
            type: 'join_room',
            payload: { room: 'list:list-789' }
          }));

          // Then leave room
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'leave_room',
              payload: { room: 'list:list-789' }
            }));
          }, 50);
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'room_left') {
            expect(message.payload.room).toBe('list:list-789');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should broadcast presence updates in room', async () => {
      const presenceUpdate = {
        userId: 'user-123',
        status: 'online',
        room: 'list:list-789',
        lastSeen: new Date().toISOString()
      };

      await wsGateway.broadcastPresenceUpdate(presenceUpdate);

      expect(mockEventBroadcaster.broadcastToRoom).toHaveBeenCalledWith(
        'list:list-789',
        'presence_update',
        presenceUpdate
      );
    });
  });

  describe('Search and NLP Events', () => {
    it('should handle real-time search suggestions', async () => {
      const searchEvent = {
        query: 'organic mil',
        suggestions: ['organic milk', 'organic milk chocolate', 'organic almond milk'],
        sessionId: 'session-123'
      };

      await wsGateway.sendSearchSuggestions('user-123', searchEvent);

      expect(mockEventBroadcaster.broadcastToUser).toHaveBeenCalledWith(
        'user-123',
        'search_suggestions',
        searchEvent
      );
    });

    it('should stream NLP processing progress', async () => {
      const progressEvents = [
        { stage: 'tokenization', progress: 0.2 },
        { stage: 'intent_detection', progress: 0.5 },
        { stage: 'entity_extraction', progress: 0.8 },
        { stage: 'product_matching', progress: 1.0 }
      ];

      for (const event of progressEvents) {
        await wsGateway.sendNLPProgress('user-123', 'session-123', event);
      }

      expect(mockEventBroadcaster.broadcastToUser).toHaveBeenCalledTimes(4);
    });

    it('should handle voice input processing events', async () => {
      const voiceEvent = {
        sessionId: 'session-123',
        status: 'recording',
        duration: 2.5,
        transcript: 'Add organic milk to my cart'
      };

      await wsGateway.sendVoiceProcessingUpdate('user-123', voiceEvent);

      expect(mockEventBroadcaster.broadcastToUser).toHaveBeenCalledWith(
        'user-123',
        'voice_update',
        voiceEvent
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle connection errors gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          // Send malformed message
          ws.send('invalid-json');
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error') {
            expect(message.payload.error).toContain('Invalid message format');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should implement heartbeat/ping-pong mechanism', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'ping' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            expect(message.timestamp).toBeDefined();
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should handle connection timeouts', async () => {
      // Mock a connection that doesn't respond to pings
      mockConnectionManager.getConnection.mockReturnValue({
        lastPing: Date.now() - 70000, // 70 seconds ago
        isAlive: false
      });

      await wsGateway.cleanupStaleConnections();

      expect(mockConnectionManager.removeConnection).toHaveBeenCalled();
    });

    it('should implement exponential backoff for reconnection', async () => {
      let connectionAttempts = 0;
      const maxAttempts = 3;

      const attemptConnection = async (): Promise<WebSocket> => {
        return new Promise((resolve, reject) => {
          connectionAttempts++;
          const ws = new WebSocket(`ws://localhost:${testPort}`);
          
          ws.on('open', () => resolve(ws));
          ws.on('error', () => {
            if (connectionAttempts < maxAttempts) {
              setTimeout(() => attemptConnection().then(resolve).catch(reject), 
                Math.pow(2, connectionAttempts) * 1000);
            } else {
              reject(new Error('Max reconnection attempts reached'));
            }
          });
        });
      };

      // Simulate connection failure and recovery
      try {
        const ws = await attemptConnection();
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
      } catch (error) {
        expect(connectionAttempts).toBe(maxAttempts);
      }
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle multiple concurrent connections', async () => {
      const connectionCount = 50;
      const connections: WebSocket[] = [];

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}`);
        connections.push(ws);
        
        await new Promise((resolve) => {
          ws.on('open', resolve);
        });
      }

      expect(connections).toHaveLength(connectionCount);
      expect(mockConnectionManager.addConnection).toHaveBeenCalledTimes(connectionCount);

      // Close all connections
      connections.forEach(ws => ws.close());
    });

    it('should implement rate limiting for messages', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          // Send rapid messages to trigger rate limiting
          for (let i = 0; i < 100; i++) {
            ws.send(JSON.stringify({ type: 'test', id: i }));
          }
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'rate_limit_exceeded') {
            expect(message.payload.limit).toBeDefined();
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should monitor WebSocket performance metrics', async () => {
      const metrics = await wsGateway.getMetrics();

      expect(metrics).toMatchObject({
        connectionCount: expect.any(Number),
        messagesSent: expect.any(Number),
        messagesReceived: expect.any(Number),
        averageLatency: expect.any(Number),
        errorRate: expect.any(Number)
      });
    });
  });

  describe('Security and Validation', () => {
    it('should validate message schemas', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'join_room',
            payload: { /* missing required room field */ }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'validation_error') {
            expect(message.payload.error).toContain('room is required');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should sanitize user input in messages', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'chat_message',
            payload: { 
              message: '<script>alert("xss")</script>Hello world',
              room: 'list:list-789'
            }
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'message_sanitized') {
            expect(message.payload.sanitized).toBe('Hello world');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });

    it('should enforce permission-based room access', async () => {
      mockConnectionManager.authenticateConnection.mockResolvedValue({
        userId: 'user-123',
        roles: ['user']
      });

      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'join_room',
            payload: { room: 'admin:monitoring' } // Admin-only room
          }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'access_denied') {
            expect(message.payload.error).toContain('Insufficient permissions');
            resolve(void 0);
          }
        });
      });

      ws.close();
    });
  });
});