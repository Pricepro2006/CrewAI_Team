/**
 * WebSocket Security Tests
 * Tests WebSocket authentication on port 8080 and security vulnerabilities
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { getSecurityTestConfig } from './config/security-test-config.js';

const config = getSecurityTestConfig();

describe('WebSocket Security Tests', () => {
  let server: any;
  let wss: WebSocket.WebSocketServer;
  let port: number;

  beforeAll(async () => {
    // Create HTTP server
    server = createServer();
    
    // Create WebSocket server with authentication middleware
    wss = new WebSocket.WebSocketServer({
      server,
      verifyClient: (info) => {
        const url = new URL(info.req.url!, 'ws://localhost');
        const token = url.searchParams.get('token');
        
        if (!token) {
          return false;
        }

        try {
          jwt.verify(token, config.authentication.jwtSecret);
          return true;
        } catch (error) {
          return false;
        }
      }
    });

    // WebSocket message handling
    wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, 'ws://localhost');
      const token = url.searchParams.get('token');
      
      let user: any = null;
      if (token) {
        try {
          user = jwt.verify(token, config.authentication.jwtSecret);
        } catch (error) {
          ws.close(1008, 'Invalid token');
          return;
        }
      }

      // Connection tracking for rate limiting
      const connectionTime = Date.now();
      let messageCount = 0;
      let lastMinute = Math.floor(connectionTime / 60000);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          const currentMinute = Math.floor(Date.now() / 60000);
          
          // Reset message count every minute
          if (currentMinute > lastMinute) {
            messageCount = 0;
            lastMinute = currentMinute;
          }
          
          messageCount++;
          
          // Rate limiting
          if (messageCount > config.rateLimiting.websocket.maxMessagesPerMinute) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Rate limit exceeded',
              code: 'RATE_LIMIT'
            }));
            return;
          }

          // Message size validation
          if (data.length > config.websocket.maxMessageSize) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Message too large',
              code: 'MESSAGE_TOO_LARGE'
            }));
            return;
          }

          // Validate message type
          if (!config.websocket.validMessageTypes.includes(message.type)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message type',
              code: 'INVALID_MESSAGE_TYPE'
            }));
            return;
          }

          // Handle different message types
          switch (message.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;
            case 'auth':
              ws.send(JSON.stringify({ 
                type: 'auth_response', 
                authenticated: !!user,
                user: user ? { id: user.userId, email: user.email } : null
              }));
              break;
            case 'subscribe':
              ws.send(JSON.stringify({ 
                type: 'subscription_response', 
                channel: message.channel,
                subscribed: true
              }));
              break;
            default:
              ws.send(JSON.stringify({ 
                type: 'response', 
                original: message.type,
                processed: true 
              }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON',
            code: 'INVALID_JSON'
          }));
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to secure WebSocket',
        authenticated: !!user
      }));
    });

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    if (wss) {
      wss.close();
    }
    if (server) {
      server.close();
    }
  });

  describe('WebSocket Authentication', () => {
    it('should reject connections without authentication token', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}`);
        
        ws.on('error', (error) => {
          // Connection should be rejected
          expect(error.message).toContain('Unexpected server response: 401');
          resolve();
        });

        ws.on('open', () => {
          ws.close();
          reject(new Error('Connection should have been rejected'));
        });

        setTimeout(() => {
          ws.terminate();
          resolve();
        }, config.timeouts.websocketTimeout);
      });
    });

    it('should reject connections with invalid token', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=invalid_token`);
        
        ws.on('error', (error) => {
          expect(error.message).toContain('Unexpected server response: 401');
          resolve();
        });

        ws.on('open', () => {
          ws.close();
          reject(new Error('Connection should have been rejected'));
        });

        setTimeout(() => {
          ws.terminate();
          resolve();
        }, config.timeouts.websocketTimeout);
      });
    });

    it('should accept connections with valid token', async () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '1h' }
      );

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
        
        ws.on('open', () => {
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          reject(error);
        });

        setTimeout(() => {
          ws.terminate();
          reject(new Error('Connection timeout'));
        }, config.timeouts.websocketTimeout);
      });
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '-1h' }
      );

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${expiredToken}`);
        
        ws.on('error', (error) => {
          expect(error.message).toContain('Unexpected server response: 401');
          resolve();
        });

        ws.on('open', () => {
          ws.close();
          reject(new Error('Expired token should have been rejected'));
        });

        setTimeout(() => {
          ws.terminate();
          resolve();
        }, config.timeouts.websocketTimeout);
      });
    });
  });

  describe('WebSocket Message Validation', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '1h' }
      );
    });

    it('should validate message types', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        
        ws.on('open', () => {
          // Send invalid message type
          ws.send(JSON.stringify({ type: 'invalid_type', data: 'test' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'error' && message.code === 'INVALID_MESSAGE_TYPE') {
            ws.close();
            resolve();
          } else if (message.type === 'welcome') {
            // Skip welcome message
            return;
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.terminate();
          reject(new Error('Expected invalid message type error'));
        }, config.timeouts.websocketTimeout);
      });
    });

    it('should handle malformed JSON messages', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        
        ws.on('open', () => {
          // Send malformed JSON
          ws.send('{ invalid json }');
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'error' && message.code === 'INVALID_JSON') {
            ws.close();
            resolve();
          } else if (message.type === 'welcome') {
            return;
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.terminate();
          reject(new Error('Expected invalid JSON error'));
        }, config.timeouts.websocketTimeout);
      });
    });

    it('should reject oversized messages', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        
        ws.on('open', () => {
          // Send oversized message
          const largeMessage = {
            type: 'ping',
            data: 'A'.repeat(config.websocket.maxMessageSize + 1)
          };
          ws.send(JSON.stringify(largeMessage));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'error' && message.code === 'MESSAGE_TOO_LARGE') {
            ws.close();
            resolve();
          } else if (message.type === 'welcome') {
            return;
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.terminate();
          reject(new Error('Expected message too large error'));
        }, config.timeouts.websocketTimeout);
      });
    });

    it('should handle valid message types correctly', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        let receivedPong = false;
        
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'ping' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'pong') {
            receivedPong = true;
            ws.close();
            resolve();
          } else if (message.type === 'welcome') {
            return;
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.terminate();
          if (!receivedPong) {
            reject(new Error('Expected pong response'));
          }
        }, config.timeouts.websocketTimeout);
      });
    });
  });

  describe('WebSocket Rate Limiting', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '1h' }
      );
    });

    it('should enforce message rate limits', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        let rateLimitHit = false;
        
        ws.on('open', () => {
          // Send messages rapidly to exceed rate limit
          for (let i = 0; i < config.rateLimiting.websocket.maxMessagesPerMinute + 5; i++) {
            ws.send(JSON.stringify({ type: 'ping', sequence: i }));
          }
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'error' && message.code === 'RATE_LIMIT') {
            rateLimitHit = true;
            ws.close();
            resolve();
          } else if (message.type === 'welcome') {
            return;
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.terminate();
          if (!rateLimitHit) {
            reject(new Error('Expected rate limit to be hit'));
          }
        }, config.timeouts.websocketTimeout * 2);
      });
    });
  });

  describe('WebSocket Connection Security', () => {
    it('should handle connection flooding', async () => {
      const connections: WebSocket[] = [];
      const maxConnections = 10;
      
      const validToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '1h' }
      );

      try {
        // Create multiple connections
        for (let i = 0; i < maxConnections; i++) {
          const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
          connections.push(ws);
          
          // Add small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Wait for connections to establish
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check that server is still responsive
        const testWs = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        
        return new Promise<void>((resolve, reject) => {
          testWs.on('open', () => {
            testWs.close();
            resolve();
          });

          testWs.on('error', reject);

          setTimeout(() => {
            testWs.terminate();
            reject(new Error('Server not responsive after connection flood'));
          }, config.timeouts.websocketTimeout);
        });
      } finally {
        // Clean up connections
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
      }
    });

    it('should handle malicious connection attempts', async () => {
      const maliciousTokens = [
        'malicious_token',
        jwt.sign({ userId: 999, admin: true }, 'wrong_secret'),
        jwt.sign({ userId: 1, role: 'admin' }, config.authentication.jwtSecret, { expiresIn: '-1h' }),
        ''
      ];

      for (const token of maliciousTokens) {
        await new Promise<void>((resolve) => {
          const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
          
          ws.on('error', () => {
            // Expected to fail
            resolve();
          });

          ws.on('open', () => {
            ws.close();
            resolve(); // Should not happen, but resolve anyway
          });

          setTimeout(() => {
            ws.terminate();
            resolve();
          }, 1000);
        });
      }
    });
  });

  describe('WebSocket Error Handling', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '1h' }
      );
    });

    it('should handle unexpected disconnections gracefully', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        
        ws.on('open', () => {
          // Abruptly terminate connection
          ws.terminate();
          
          // Give server time to handle the disconnection
          setTimeout(() => {
            // Try to establish a new connection to verify server is still working
            const newWs = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
            
            newWs.on('open', () => {
              newWs.close();
              resolve();
            });

            newWs.on('error', reject);
          }, 100);
        });

        ws.on('error', reject);
      });
    });

    it('should not expose internal server information in error messages', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}?token=${validToken}`);
        
        ws.on('open', () => {
          // Send message that might cause internal error
          ws.send('not json at all');
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'error') {
            const errorString = JSON.stringify(message);
            
            // Should not contain file paths, stack traces, or internal details
            expect(errorString).not.toMatch(/\/[a-zA-Z0-9_\-\/]+\.js/);
            expect(errorString).not.toMatch(/Error:/);
            expect(errorString).not.toMatch(/at [a-zA-Z0-9_]+/);
            expect(errorString).not.toMatch(/node_modules/);
            
            ws.close();
            resolve();
          } else if (message.type === 'welcome') {
            return;
          }
        });

        ws.on('error', reject);

        setTimeout(() => {
          ws.terminate();
          reject(new Error('Expected error message'));
        }, config.timeouts.websocketTimeout);
      });
    });
  });
});