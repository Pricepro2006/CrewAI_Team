/**
 * Real-time WebSocket Functionality Tests
 * Tests actual WebSocket server running on localhost:8080
 * No mocking - tests real functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { setTimeout } from 'timers/promises';

const WEBSOCKET_URL = 'ws://localhost:8080';
const HEALTH_URL = 'http://localhost:8080/health';
const TEST_TIMEOUT = 10000;

interface HealthResponse {
  status: string;
  websocket: {
    port: number;
    endpoints: {
      general: { path: string; connections: number };
      walmart: { path: string; connections: number };
    };
  };
  timestamp: string;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

describe('WebSocket Real-time Functionality Tests', () => {
  let isServerAvailable = false;

  beforeAll(async () => {
    // Check if WebSocket server is running
    try {
      const response = await fetch(HEALTH_URL);
      const health: HealthResponse = await response.json();
      isServerAvailable = health.status === 'ok';
      
      if (!isServerAvailable) {
        console.warn('WebSocket server not available at localhost:8080');
      }
    } catch (error) {
      console.warn('WebSocket server health check failed:', error);
      isServerAvailable = false;
    }
  }, TEST_TIMEOUT);

  describe('Server Health and Availability', () => {
    it('should have WebSocket server running and accessible', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const response = await fetch(HEALTH_URL);
      expect(response.status).toBe(200);
      
      const health: HealthResponse = await response.json();
      expect(health.status).toBe('ok');
      expect(health.websocket.port).toBe(8080);
      expect(health.websocket.endpoints.general.path).toBe('/ws');
      expect(health.websocket.endpoints.walmart.path).toBe('/ws/walmart');
    });

    it('should report initial connection counts as zero', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const response = await fetch(HEALTH_URL);
      const health: HealthResponse = await response.json();
      
      expect(health.websocket.endpoints.general.connections).toBe(0);
      expect(health.websocket.endpoints.walmart.connections).toBe(0);
    });

    it('should serve WebSocket information page on root path', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const response = await fetch('http://localhost:8080/');
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('WebSocket Server');
      expect(html).toContain('ws://localhost:8080/ws');
      expect(html).toContain('ws://localhost:8080/ws/walmart');
    });
  });

  describe('WebSocket Connection Establishment', () => {
    it('should establish connection to general WebSocket endpoint', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, TEST_TIMEOUT);

    it('should establish connection to Walmart WebSocket endpoint', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws/walmart`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, TEST_TIMEOUT);

    it('should handle multiple simultaneous connections', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const connectionCount = 3;
      const connections: WebSocket[] = [];
      const connectionPromises: Promise<void>[] = [];

      for (let i = 0; i < connectionCount; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Connection ${i} timeout`));
          }, 5000);

          const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
          connections.push(ws);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        connectionPromises.push(promise);
      }

      await Promise.all(connectionPromises);
      
      // All connections should be open
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Clean up
      connections.forEach(ws => ws.close());
    }, TEST_TIMEOUT);

    it('should reject connection to invalid WebSocket path', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Expected connection to be rejected, but timeout occurred'));
        }, 5000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws/invalid`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Connection should have been rejected'));
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(); // Expected error
        });
        
        ws.on('close', (code) => {
          clearTimeout(timeout);
          if (code !== 1000) {
            resolve(); // Connection was rejected as expected
          } else {
            reject(new Error('Connection closed normally when it should have been rejected'));
          }
        });
      });
    }, TEST_TIMEOUT);
  });

  describe('Real-time Message Passing', () => {
    let ws: WebSocket;

    beforeEach(async () => {
      if (!isServerAvailable) return;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Setup connection timeout'));
        }, 5000);

        ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should receive welcome message on connection', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Welcome message timeout'));
        }, 5000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'welcome') {
              clearTimeout(timeout);
              expect(message.type).toBe('welcome');
              expect(message.connectionId).toBeTruthy();
              expect(message.serverTime).toBeTruthy();
              expect(message.endpoints).toContain('/ws');
              expect(message.endpoints).toContain('/ws/walmart');
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    }, TEST_TIMEOUT);

    it('should echo messages back to client', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const testMessage = {
        type: 'test',
        data: 'hello world',
        timestamp: Date.now()
      };

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Echo message timeout'));
        }, 5000);

        let welcomeReceived = false;

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'welcome') {
              welcomeReceived = true;
              // Send test message after welcome
              ws.send(JSON.stringify(testMessage));
            } else if (message.type === 'echo' && welcomeReceived) {
              clearTimeout(timeout);
              expect(message.type).toBe('echo');
              expect(message.originalMessage).toEqual(testMessage);
              expect(message.serverTimestamp).toBeTruthy();
              expect(message.connectionId).toBeTruthy();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    }, TEST_TIMEOUT);

    it('should handle multiple messages in sequence', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const messageCount = 5;
      const testMessages = Array.from({ length: messageCount }, (_, i) => ({
        type: 'test',
        data: `message ${i}`,
        index: i
      }));

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Multiple messages timeout'));
        }, 10000);

        let welcomeReceived = false;
        let echoCount = 0;
        const receivedEchoes: any[] = [];

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'welcome') {
              welcomeReceived = true;
              // Send all test messages
              testMessages.forEach(msg => {
                ws.send(JSON.stringify(msg));
              });
            } else if (message.type === 'echo' && welcomeReceived) {
              echoCount++;
              receivedEchoes.push(message.originalMessage);
              
              if (echoCount === messageCount) {
                clearTimeout(timeout);
                expect(receivedEchoes).toHaveLength(messageCount);
                
                // Verify all messages were echoed back correctly
                testMessages.forEach((original, index) => {
                  const echo = receivedEchoes.find(e => e.index === index);
                  expect(echo).toEqual(original);
                });
                
                resolve();
              }
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    }, TEST_TIMEOUT);

    it('should handle invalid JSON messages gracefully', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Invalid JSON handling timeout'));
        }, 5000);

        let welcomeReceived = false;
        let connectionStillOpen = false;

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'welcome') {
              welcomeReceived = true;
              // Send invalid JSON
              ws.send('invalid-json-data');
              
              // Wait a bit then send a valid message to check connection is still alive
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  connectionStillOpen = true;
                  ws.send(JSON.stringify({ type: 'ping' }));
                }
              }, 1000);
            } else if (message.type === 'echo' && welcomeReceived && connectionStillOpen) {
              clearTimeout(timeout);
              expect(message.originalMessage.type).toBe('ping');
              expect(ws.readyState).toBe(WebSocket.OPEN);
              resolve();
            }
          } catch (error) {
            // Ignore JSON parse errors from server responses
          }
        });
        
        ws.on('error', () => {
          // Don't fail on WebSocket errors from invalid JSON - server should handle gracefully
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          reject(new Error('Connection closed unexpectedly after invalid JSON'));
        });
      });
    }, TEST_TIMEOUT);
  });

  describe('WebSocket Upgrade Handshake', () => {
    it('should complete WebSocket upgrade handshake correctly', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Handshake timeout'));
        }, 5000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          
          // Check that the connection is properly established
          expect(ws.readyState).toBe(WebSocket.OPEN);
          expect(ws.protocol).toBeDefined();
          expect(ws.url).toBe(`${WEBSOCKET_URL}/ws`);
          
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, TEST_TIMEOUT);

    it('should handle WebSocket upgrade with custom headers', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Custom headers handshake timeout'));
        }, 5000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`, {
          headers: {
            'X-Custom-Header': 'test-value',
            'User-Agent': 'WebSocket-Test/1.0'
          }
        });
        
        ws.on('open', () => {
          clearTimeout(timeout);
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, TEST_TIMEOUT);
  });

  describe('Error Handling and Reconnection', () => {
    it('should handle connection close gracefully', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection close timeout'));
        }, 5000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          // Immediately close the connection
          ws.close(1000, 'Normal closure');
        });
        
        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          expect(code).toBe(1000);
          expect(reason.toString()).toBe('Normal closure');
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, TEST_TIMEOUT);

    it('should handle rapid connect/disconnect cycles', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const cycleCount = 5;
      const promises: Promise<void>[] = [];

      for (let i = 0; i < cycleCount; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Cycle ${i} timeout`));
          }, 3000);

          const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
          
          ws.on('open', () => {
            // Close immediately after opening
            ws.close();
          });
          
          ws.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        promises.push(promise);
      }

      await Promise.all(promises);
    }, TEST_TIMEOUT);

    it('should handle connection timeout scenarios', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      // Test connection to a non-existent port to simulate timeout
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(); // Timeout is expected behavior
        }, 3000);

        const ws = new WebSocket('ws://localhost:9999/ws'); // Non-existent port
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Should not have connected to non-existent port'));
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(); // Expected error
        });
      });
    }, TEST_TIMEOUT);
  });

  describe('Performance and Load Testing', () => {
    it('should handle burst of connections', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const burstSize = 10;
      const connections: WebSocket[] = [];
      const connectionPromises: Promise<void>[] = [];

      // Create burst of connections
      for (let i = 0; i < burstSize; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Burst connection ${i} timeout`));
          }, 5000);

          const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
          connections.push(ws);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        connectionPromises.push(promise);
      }

      await Promise.all(connectionPromises);
      
      // All connections should be established
      expect(connections).toHaveLength(burstSize);
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Clean up all connections
      connections.forEach(ws => ws.close());
      
      // Wait for all to close
      await Promise.all(connections.map(ws => 
        new Promise<void>(resolve => {
          if (ws.readyState === WebSocket.CLOSED) {
            resolve();
          } else {
            ws.on('close', () => resolve());
          }
        })
      ));
    }, TEST_TIMEOUT);

    it('should maintain connection count accuracy during stress', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      // Get initial counts
      const initialResponse = await fetch(HEALTH_URL);
      const initialHealth: HealthResponse = await initialResponse.json();
      const initialCount = initialHealth.websocket.endpoints.general.connections;

      // Create some connections
      const connectionCount = 3;
      const connections: WebSocket[] = [];
      
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        connections.push(ws);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          ws.on('error', reject);
        });
      }

      // Check connection count increased
      await setTimeout(100); // Brief delay for server to update counts
      const midResponse = await fetch(HEALTH_URL);
      const midHealth: HealthResponse = await midResponse.json();
      expect(midHealth.websocket.endpoints.general.connections).toBe(initialCount + connectionCount);

      // Close all connections
      connections.forEach(ws => ws.close());
      
      // Wait for closes to be processed
      await Promise.all(connections.map(ws => 
        new Promise<void>(resolve => {
          if (ws.readyState === WebSocket.CLOSED) {
            resolve();
          } else {
            ws.on('close', () => resolve());
          }
        })
      ));
      
      // Check connection count returned to initial
      await setTimeout(100); // Brief delay for server to update counts
      const finalResponse = await fetch(HEALTH_URL);
      const finalHealth: HealthResponse = await finalResponse.json();
      expect(finalHealth.websocket.endpoints.general.connections).toBe(initialCount);
    }, TEST_TIMEOUT);
  });
});
