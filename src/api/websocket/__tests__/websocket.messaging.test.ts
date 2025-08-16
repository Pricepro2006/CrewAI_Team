/**
 * WebSocket Real-Time Messaging Tests
 * Tests message passing, broadcasting, and real-time communication features
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import { WalmartWebSocketServer, WSMessage } from '../WalmartWebSocketServer.js';
import { EmailProcessingWebSocket, EmailProcessingEvent } from '../EmailProcessingWebSocket.js';
import { WebSocketServer } from 'ws';

describe('WebSocket Real-Time Messaging Tests', () => {
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

  describe('Walmart WebSocket Message Types', () => {
    it('should handle NLP processing notifications', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      const sessionId = 'test-session-123';
      let messagesReceived = 0;
      
      client.on('open', () => {
        // Authenticate first
        client.send(JSON.stringify({
          type: 'auth',
          sessionId
        }));
        
        // Trigger NLP processing
        setTimeout(() => {
          walmartWS.notifyNLPProcessingStart(sessionId, 'find organic bananas');
        }, 50);
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messagesReceived++;
        
        if (message.type === 'nlp_processing' && message.data.status === 'started') {
          expect(message.sessionId).toBe(sessionId);
          expect(message.data.query).toBe('find organic bananas');
          expect(message.data.message).toBe('Understanding your request...');
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle NLP result notifications', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      const sessionId = 'test-session-456';
      
      const nlpResult = {
        intent: 'search_product',
        entities: { product: 'bananas', modifier: 'organic' },
        confidence: 0.95
      };
      
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'auth', sessionId }));
        
        setTimeout(() => {
          walmartWS.notifyNLPResult(sessionId, nlpResult);
        }, 50);
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'nlp_result') {
          expect(message.sessionId).toBe(sessionId);
          expect(message.data.intent).toBe('search_product');
          expect(message.data.confidence).toBe(0.95);
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle product match notifications', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      const sessionId = 'test-session-789';
      
      const products = [
        { id: '1', name: 'Organic Bananas', price: 2.99 },
        { id: '2', name: 'Fresh Organic Bananas', price: 3.49 }
      ];
      
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'auth', sessionId }));
        
        setTimeout(() => {
          walmartWS.notifyProductMatches(sessionId, products);
        }, 50);
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'product_match') {
          expect(message.sessionId).toBe(sessionId);
          expect(message.data.products).toHaveLength(2);
          expect(message.data.count).toBe(2);
          expect(message.data.products[0].name).toBe('Organic Bananas');
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle cart update notifications', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      const userId = 'test-user-123';
      
      const cartData = {
        items: [{ productId: '1', quantity: 2 }],
        total: 5.98
      };
      
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'auth', userId }));
        
        setTimeout(() => {
          walmartWS.notifyCartUpdate(userId, cartData);
        }, 50);
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'cart_update') {
          expect(message.userId).toBe(userId);
          expect(message.data.total).toBe(5.98);
          expect(message.data.items).toHaveLength(1);
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle price update broadcasts', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const clients: WebSocket[] = [];
      let priceUpdatesReceived = 0;
      const totalClients = 2;
      
      for (let i = 0; i < totalClients; i++) {
        const client = new WebSocket(`${serverUrl}/ws/walmart`);
        clients.push(client);
        
        client.on('open', () => {
          if (clients.filter(c => c.readyState === WebSocket.OPEN).length === totalClients) {
            // All clients connected, broadcast price update
            walmartWS.notifyPriceUpdate('product-123', 9.99, 7.99);
          }
        });
        
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'price_update') {
            priceUpdatesReceived++;
            expect(message.data.productId).toBe('product-123');
            expect(message.data.oldPrice).toBe(9.99);
            expect(message.data.newPrice).toBe(7.99);
            expect(message.data.change).toBe(-2);
            expect(message.data.changePercent).toBe('-20.02');
            
            if (priceUpdatesReceived === totalClients) {
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

  describe('Email Processing WebSocket Events', () => {
    it('should broadcast email processing events', (done) => {
      const wss = new WebSocketServer({ server, path: '/ws/email' });
      emailWS.initialize(wss);
      
      const client = new WebSocket(`${serverUrl}/ws/email`);
      let eventsReceived = 0;
      
      client.on('open', () => {
        // Trigger processing events
        setTimeout(() => {
          emailWS.emailProcessingStarted('email-123', 1);
          emailWS.emailProcessingCompleted('email-123', 1, 1500);
        }, 50);
      });
      
      client.on('message', (data) => {
        const event = JSON.parse(data.toString());
        eventsReceived++;
        
        if (event.type === 'phase_started') {
          expect(event.emailId).toBe('email-123');
          expect(event.phase).toBe(1);
        } else if (event.type === 'phase_completed') {
          expect(event.emailId).toBe('email-123');
          expect(event.phase).toBe(1);
          expect(event.processingTime).toBe(1500);
        } else if (event.type === 'email_processed') {
          expect(event.emailId).toBe('email-123');
          expect(event.data.phase).toBe(1);
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should broadcast processing statistics updates', (done) => {
      const wss = new WebSocketServer({ server, path: '/ws/email' });
      emailWS.initialize(wss);
      
      const client = new WebSocket(`${serverUrl}/ws/email`);
      let statsUpdatesReceived = 0;
      
      client.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event.type === 'stats_updated') {
          statsUpdatesReceived++;
          expect(event.data).toBeTruthy();
          expect(typeof event.data.totalEmails).toBe('number');
          expect(typeof event.data.processedEmails).toBe('number');
          
          if (statsUpdatesReceived >= 1) {
            client.close();
            done();
          }
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle processing error events', (done) => {
      const wss = new WebSocketServer({ server, path: '/ws/email' });
      emailWS.initialize(wss);
      
      const client = new WebSocket(`${serverUrl}/ws/email`);
      
      client.on('open', () => {
        setTimeout(() => {
          emailWS.emailProcessingError('email-error', 2, 'Test processing error');
        }, 50);
      });
      
      client.on('message', (data) => {
        const event = JSON.parse(data.toString());
        
        if (event.type === 'error') {
          expect(event.emailId).toBe('email-error');
          expect(event.phase).toBe(2);
          expect(event.error).toBe('Test processing error');
          client.close();
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Message Targeting and Broadcasting', () => {
    it('should send messages to specific users only', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const targetUser = 'user-123';
      const otherUser = 'user-456';
      
      const targetClient = new WebSocket(`${serverUrl}/ws/walmart`);
      const otherClient = new WebSocket(`${serverUrl}/ws/walmart`);
      
      let targetReceived = false;
      let otherReceived = false;
      
      targetClient.on('open', () => {
        targetClient.send(JSON.stringify({ type: 'auth', userId: targetUser }));
      });
      
      otherClient.on('open', () => {
        otherClient.send(JSON.stringify({ type: 'auth', userId: otherUser }));
        
        // Wait for both to authenticate, then send targeted message
        setTimeout(() => {
          walmartWS.sendToUser(targetUser, {
            type: 'cart_update',
            data: { message: 'This is for target user only' },
            timestamp: new Date().toISOString(),
            userId: targetUser
          });
        }, 100);
      });
      
      targetClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'cart_update') {
          targetReceived = true;
          expect(message.data.message).toBe('This is for target user only');
        }
      });
      
      otherClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'cart_update') {
          otherReceived = true;
        }
      });
      
      // Check results after some time
      setTimeout(() => {
        expect(targetReceived).toBe(true);
        expect(otherReceived).toBe(false);
        targetClient.close();
        otherClient.close();
        done();
      }, 200);
    });

    it('should send messages to specific sessions only', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const targetSession = 'session-abc';
      const otherSession = 'session-xyz';
      
      const targetClient = new WebSocket(`${serverUrl}/ws/walmart`);
      const otherClient = new WebSocket(`${serverUrl}/ws/walmart`);
      
      let targetReceived = false;
      let otherReceived = false;
      
      targetClient.on('open', () => {
        targetClient.send(JSON.stringify({ type: 'auth', sessionId: targetSession }));
      });
      
      otherClient.on('open', () => {
        otherClient.send(JSON.stringify({ type: 'auth', sessionId: otherSession }));
        
        setTimeout(() => {
          walmartWS.sendToSession(targetSession, {
            type: 'nlp_processing',
            data: { message: 'This is for target session only' },
            timestamp: new Date().toISOString(),
            sessionId: targetSession
          });
        }, 100);
      });
      
      targetClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.data && message.data.message === 'This is for target session only') {
          targetReceived = true;
        }
      });
      
      otherClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.data && message.data.message === 'This is for target session only') {
          otherReceived = true;
        }
      });
      
      setTimeout(() => {
        expect(targetReceived).toBe(true);
        expect(otherReceived).toBe(false);
        targetClient.close();
        otherClient.close();
        done();
      }, 200);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid message broadcasting', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const client = new WebSocket(`${serverUrl}/ws/walmart`);
      let messagesReceived = 0;
      const totalMessages = 10;
      
      client.on('open', () => {
        // Send multiple messages rapidly
        for (let i = 0; i < totalMessages; i++) {
          setTimeout(() => {
            walmartWS.broadcast({
              type: 'nlp_processing',
              data: { messageNumber: i },
              timestamp: new Date().toISOString()
            });
          }, i * 10); // 10ms apart
        }
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.data && typeof message.data.messageNumber === 'number') {
          messagesReceived++;
          
          if (messagesReceived === totalMessages) {
            expect(messagesReceived).toBe(totalMessages);
            client.close();
            done();
          }
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle concurrent client message processing', (done) => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const clients: WebSocket[] = [];
      let responsesReceived = 0;
      const totalClients = 5;
      
      for (let i = 0; i < totalClients; i++) {
        const client = new WebSocket(`${serverUrl}/ws/walmart`);
        clients.push(client);
        
        client.on('open', () => {
          // Send ping from each client
          client.send(JSON.stringify({ type: 'ping' }));
        });
        
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.data && message.data.pong) {
            responsesReceived++;
            
            if (responsesReceived === totalClients) {
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
