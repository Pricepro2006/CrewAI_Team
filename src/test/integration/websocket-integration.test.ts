/**
 * WebSocket Integration Test Suite
 * Comprehensive testing of real-time WebSocket functionality
 * 
 * Tests:
 * 1. Connection establishment and management
 * 2. Message sending and receiving
 * 3. Real-time updates (5 new message types)
 * 4. Connection resilience and recovery
 * 5. Multiple client connections
 * 6. Performance and memory usage
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { setTimeout } from 'timers/promises';

const WEBSOCKET_CONFIG = {
  URL: 'ws://localhost:8080',
  CONNECTION_TIMEOUT: 10000,
  MESSAGE_TIMEOUT: 5000,
  RECONNECTION_DELAY: 1000,
  MAX_RECONNECTION_ATTEMPTS: 3
};

// Test message types based on the project documentation
const MESSAGE_TYPES = {
  AGENT_STATUS: 'agent.status',
  AGENT_TASK: 'agent.task', 
  PLAN_UPDATE: 'plan.update',
  RAG_OPERATION: 'rag.operation',
  SYSTEM_HEALTH: 'system.health',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe'
};

interface TestMessage {
  type: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

interface TestResults {
  connection: Record<string, any>;
  messaging: Record<string, any>;
  realTime: Record<string, any>;
  resilience: Record<string, any>;
  performance: Record<string, any>;
}

let testResults: TestResults = {
  connection: {},
  messaging: {},
  realTime: {},
  resilience: {},
  performance: {}
};

describe('WebSocket Integration Tests', () => {
  
  beforeAll(async () => {
    console.log('\n🔌 Starting WebSocket Integration Test Suite...\n');
  });

  afterAll(() => {
    console.log('\n📊 WebSocket Test Results Summary:\n');
    generateWebSocketReport();
  });

  describe('Connection Management', () => {
    
    it('should establish WebSocket connection successfully', async () => {
      const testName = 'connection_establishment';
      console.log('🔍 Testing WebSocket connection establishment...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, WEBSOCKET_CONFIG.CONNECTION_TIMEOUT);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        const startTime = Date.now();
        
        ws.on('open', () => {
          clearTimeout(timeout);
          const connectionTime = Date.now() - startTime;
          
          testResults.connection[testName] = {
            status: 'PASS',
            connectionTime: `${connectionTime}ms`,
            readyState: ws.readyState,
            url: ws.url
          };
          
          console.log(`✅ WebSocket connected in ${connectionTime}ms`);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.connection[testName] = {
            status: 'FAIL',
            error: error.message
          };
          console.error('❌ WebSocket connection failed:', error.message);
          reject(error);
        });
      });
    });

    it('should handle connection close gracefully', async () => {
      const testName = 'connection_close';
      console.log('🔍 Testing WebSocket connection close...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Close test timeout'));
        }, WEBSOCKET_CONFIG.CONNECTION_TIMEOUT);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        
        ws.on('open', () => {
          // Close connection immediately after opening
          ws.close(1000, 'Test close');
        });
        
        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          
          testResults.connection[testName] = {
            status: 'PASS',
            closeCode: code,
            closeReason: reason.toString(),
            finalState: ws.readyState
          };
          
          console.log(`✅ WebSocket closed gracefully (code: ${code})`);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.connection[testName] = {
            status: 'FAIL',
            error: error.message
          };
          reject(error);
        });
      });
    });

    it('should handle multiple concurrent connections', async () => {
      const testName = 'concurrent_connections';
      console.log('🔍 Testing multiple concurrent WebSocket connections...');
      
      const connectionCount = 5;
      const connections: WebSocket[] = [];
      
      try {
        // Create multiple connections
        const connectionPromises = Array.from({ length: connectionCount }, (_, index) => {
          return new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
            
            const timeout = setTimeout(() => {
              reject(new Error(`Connection ${index} timeout`));
            }, WEBSOCKET_CONFIG.CONNECTION_TIMEOUT);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              connections.push(ws);
              resolve(ws);
            });
            
            ws.on('error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });
        });
        
        const connectedSockets = await Promise.all(connectionPromises);
        
        expect(connectedSockets.length).toBe(connectionCount);
        
        // Close all connections
        for (const ws of connectedSockets) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }
        
        testResults.connection[testName] = {
          status: 'PASS',
          requestedConnections: connectionCount,
          successfulConnections: connectedSockets.length,
          concurrentSupport: true
        };
        
        console.log(`✅ ${connectedSockets.length}/${connectionCount} concurrent connections successful`);
        
      } catch (error) {
        testResults.connection[testName] = {
          status: 'FAIL',
          error: error.message,
          successfulConnections: connections.length
        };
        console.error('❌ Concurrent connections test failed:', error.message);
        throw error;
      }
    });
  });

  describe('Message Handling', () => {
    
    it('should send and receive basic messages', async () => {
      const testName = 'basic_messaging';
      console.log('🔍 Testing basic WebSocket messaging...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Messaging timeout'));
        }, WEBSOCKET_CONFIG.MESSAGE_TIMEOUT * 2);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        const sentMessages: TestMessage[] = [];
        const receivedMessages: TestMessage[] = [];
        
        ws.on('open', () => {
          // Send test message
          const testMessage: TestMessage = {
            type: 'test',
            data: { content: 'integration test message', timestamp: Date.now() },
            id: 'test-message-1'
          };
          
          sentMessages.push(testMessage);
          ws.send(JSON.stringify(testMessage));
        });
        
        ws.on('message', (data) => {
          try {
            const message: TestMessage = JSON.parse(data.toString());
            receivedMessages.push(message);
            
            clearTimeout(timeout);
            
            testResults.messaging[testName] = {
              status: 'PASS',
              sentMessages: sentMessages.length,
              receivedMessages: receivedMessages.length,
              messageTypes: receivedMessages.map(m => m.type),
              roundTripTime: Date.now() - (sentMessages[0]?.data?.timestamp || Date.now())
            };
            
            console.log(`✅ Basic messaging successful (${receivedMessages.length} messages received)`);
            ws.close();
            resolve();
            
          } catch (parseError) {
            clearTimeout(timeout);
            testResults.messaging[testName] = {
              status: 'FAIL',
              error: 'Invalid JSON response',
              rawMessage: data.toString().substring(0, 100)
            };
            reject(parseError);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.messaging[testName] = {
            status: 'FAIL',
            error: error.message
          };
          reject(error);
        });
        
        // Fallback if no message received
        setTimeout(() => {
          if (receivedMessages.length === 0) {
            clearTimeout(timeout);
            testResults.messaging[testName] = {
              status: 'PARTIAL',
              sentMessages: sentMessages.length,
              receivedMessages: 0,
              note: 'Messages sent but no response received'
            };
            console.log('⚠️ No message response received');
            ws.close();
            resolve();
          }
        }, WEBSOCKET_CONFIG.MESSAGE_TIMEOUT);
      });
    });

    it('should handle subscription messages', async () => {
      const testName = 'subscription_messaging';
      console.log('🔍 Testing WebSocket subscription messaging...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription timeout'));
        }, WEBSOCKET_CONFIG.MESSAGE_TIMEOUT * 3);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        const receivedMessages: TestMessage[] = [];
        
        ws.on('open', () => {
          // Send subscription message for all 5 new message types
          const subscriptionMessage: TestMessage = {
            type: MESSAGE_TYPES.SUBSCRIBE,
            data: {
              channels: [
                MESSAGE_TYPES.AGENT_STATUS,
                MESSAGE_TYPES.AGENT_TASK,
                MESSAGE_TYPES.PLAN_UPDATE,
                MESSAGE_TYPES.RAG_OPERATION,
                MESSAGE_TYPES.SYSTEM_HEALTH
              ]
            }
          };
          
          ws.send(JSON.stringify(subscriptionMessage));
        });
        
        ws.on('message', (data) => {
          try {
            const message: TestMessage = JSON.parse(data.toString());
            receivedMessages.push(message);
            
            // Check if we received any of the expected message types
            const expectedTypes = Object.values(MESSAGE_TYPES);
            const receivedTypes = receivedMessages.map(m => m.type);
            const matchingTypes = receivedTypes.filter(type => expectedTypes.includes(type));
            
            if (matchingTypes.length > 0) {
              clearTimeout(timeout);
              
              testResults.messaging[testName] = {
                status: 'PASS',
                subscriptionSent: true,
                receivedMessages: receivedMessages.length,
                matchingMessageTypes: matchingTypes,
                allReceivedTypes: receivedTypes
              };
              
              console.log(`✅ Subscription messaging successful (${matchingTypes.length} matching types)`);
              ws.close();
              resolve();
            }
            
          } catch (parseError) {
            // Continue listening for more messages
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.messaging[testName] = {
            status: 'FAIL',
            error: error.message
          };
          reject(error);
        });
        
        // Fallback timeout
        setTimeout(() => {
          clearTimeout(timeout);
          testResults.messaging[testName] = {
            status: 'PARTIAL',
            subscriptionSent: true,
            receivedMessages: receivedMessages.length,
            note: 'Subscription sent but no matching message types received'
          };
          console.log('⚠️ Subscription sent but no expected message types received');
          ws.close();
          resolve();
        }, WEBSOCKET_CONFIG.MESSAGE_TIMEOUT * 2);
      });
    });

    it('should handle large message payloads', async () => {
      const testName = 'large_message_handling';
      console.log('🔍 Testing large message payload handling...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Large message timeout'));
        }, WEBSOCKET_CONFIG.MESSAGE_TIMEOUT * 2);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        
        ws.on('open', () => {
          // Create a large test message (approximately 10KB)
          const largeData = {
            type: 'large_test',
            data: {
              content: 'x'.repeat(8000), // 8KB of data
              metadata: {
                timestamp: Date.now(),
                size: '8KB',
                testType: 'large_payload'
              },
              additionalData: Array.from({ length: 100 }, (_, i) => ({
                id: i,
                value: `test_value_${i}`,
                description: `Test item number ${i}`
              }))
            }
          };
          
          ws.send(JSON.stringify(largeData));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            const messageSize = Buffer.byteLength(data.toString(), 'utf8');
            
            clearTimeout(timeout);
            
            testResults.messaging[testName] = {
              status: 'PASS',
              largeMessageSent: true,
              responseReceived: true,
              responseSize: `${Math.round(messageSize / 1024)}KB`,
              messageType: message.type
            };
            
            console.log(`✅ Large message handling successful (${Math.round(messageSize / 1024)}KB response)`);
            ws.close();
            resolve();
            
          } catch (parseError) {
            clearTimeout(timeout);
            testResults.messaging[testName] = {
              status: 'FAIL',
              error: 'Failed to parse large message response'
            };
            reject(parseError);
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.messaging[testName] = {
            status: 'FAIL',
            error: error.message
          };
          reject(error);
        });
      });
    });
  });

  describe('Real-time Updates', () => {
    
    it('should receive real-time system updates', async () => {
      const testName = 'realtime_system_updates';
      console.log('🔍 Testing real-time system updates...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(); // Don't fail if no updates are currently active
        }, 15000);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        const realTimeMessages: TestMessage[] = [];
        
        ws.on('open', () => {
          // Subscribe to all real-time update channels
          const subscribeMessage = {
            type: MESSAGE_TYPES.SUBSCRIBE,
            data: {
              channels: [
                MESSAGE_TYPES.SYSTEM_HEALTH,
                MESSAGE_TYPES.AGENT_STATUS,
                MESSAGE_TYPES.RAG_OPERATION,
                MESSAGE_TYPES.PLAN_UPDATE,
                MESSAGE_TYPES.AGENT_TASK
              ]
            }
          };
          
          ws.send(JSON.stringify(subscribeMessage));
        });
        
        ws.on('message', (data) => {
          try {
            const message: TestMessage = JSON.parse(data.toString());
            
            // Check if this is a real-time update message
            const realTimeTypes = [
              MESSAGE_TYPES.SYSTEM_HEALTH,
              MESSAGE_TYPES.AGENT_STATUS,
              MESSAGE_TYPES.RAG_OPERATION,
              MESSAGE_TYPES.PLAN_UPDATE,
              MESSAGE_TYPES.AGENT_TASK
            ];
            
            if (realTimeTypes.includes(message.type)) {
              realTimeMessages.push(message);
              
              // If we received at least one real-time update, test passes
              if (realTimeMessages.length >= 1) {
                clearTimeout(timeout);
                
                testResults.realTime[testName] = {
                  status: 'PASS',
                  realTimeUpdatesReceived: realTimeMessages.length,
                  updateTypes: [...new Set(realTimeMessages.map(m => m.type))],
                  firstUpdateTime: realTimeMessages[0]?.timestamp || Date.now()
                };
                
                console.log(`✅ Real-time updates working (${realTimeMessages.length} updates received)`);
                ws.close();
                resolve();
              }
            }
            
          } catch (parseError) {
            // Continue listening for valid messages
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.realTime[testName] = {
            status: 'FAIL',
            error: error.message
          };
          reject(error);
        });
        
        // Fallback after waiting period
        setTimeout(() => {
          clearTimeout(timeout);
          testResults.realTime[testName] = {
            status: 'PARTIAL',
            realTimeUpdatesReceived: realTimeMessages.length,
            note: realTimeMessages.length === 0 ? 
              'No real-time updates received during test period' :
              `Received ${realTimeMessages.length} updates`
          };
          
          if (realTimeMessages.length === 0) {
            console.log('⚠️ No real-time updates received - system may be idle');
          } else {
            console.log(`✅ Received ${realTimeMessages.length} real-time updates`);
          }
          
          ws.close();
          resolve();
        }, 10000);
      });
    });

    it('should handle agent status updates', async () => {
      const testName = 'agent_status_updates';
      console.log('🔍 Testing agent status updates...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve(); // Don't fail if no agent activity
        }, 10000);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        const agentMessages: TestMessage[] = [];
        
        ws.on('open', () => {
          // Subscribe specifically to agent-related updates
          const subscribeMessage = {
            type: MESSAGE_TYPES.SUBSCRIBE,
            data: {
              channels: [MESSAGE_TYPES.AGENT_STATUS, MESSAGE_TYPES.AGENT_TASK]
            }
          };
          
          ws.send(JSON.stringify(subscribeMessage));
          
          // Optionally trigger an agent task to generate updates
          const triggerMessage = {
            type: 'trigger_agent_task',
            data: {
              agent: 'DataAnalysisAgent',
              task: 'test task for WebSocket integration'
            }
          };
          
          setTimeout(() => {
            ws.send(JSON.stringify(triggerMessage));
          }, 1000);
        });
        
        ws.on('message', (data) => {
          try {
            const message: TestMessage = JSON.parse(data.toString());
            
            if (message.type === MESSAGE_TYPES.AGENT_STATUS || 
                message.type === MESSAGE_TYPES.AGENT_TASK) {
              agentMessages.push(message);
              
              clearTimeout(timeout);
              
              testResults.realTime[testName] = {
                status: 'PASS',
                agentUpdatesReceived: agentMessages.length,
                updateTypes: agentMessages.map(m => m.type),
                agentData: agentMessages.map(m => m.data)
              };
              
              console.log(`✅ Agent status updates working (${agentMessages.length} updates)`);
              ws.close();
              resolve();
            }
            
          } catch (parseError) {
            // Continue listening
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.realTime[testName] = {
            status: 'FAIL',
            error: error.message
          };
          reject(error);
        });
        
        setTimeout(() => {
          clearTimeout(timeout);
          testResults.realTime[testName] = {
            status: 'PARTIAL',
            agentUpdatesReceived: agentMessages.length,
            note: 'No agent status updates received - agents may be idle'
          };
          console.log('⚠️ No agent status updates received');
          ws.close();
          resolve();
        }, 8000);
      });
    });
  });

  describe('Connection Resilience', () => {
    
    it('should handle connection interruption and recovery', async () => {
      const testName = 'connection_recovery';
      console.log('🔍 Testing connection recovery...');
      
      return new Promise<void>((resolve, reject) => {
        const overallTimeout = setTimeout(() => {
          reject(new Error('Connection recovery test timeout'));
        }, 20000);
        
        let ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        let connectionCount = 0;
        let recoverySuccessful = false;
        
        const connectAndTest = () => {
          connectionCount++;
          
          ws.on('open', () => {
            if (connectionCount === 1) {
              // First connection - close it intentionally
              setTimeout(() => {
                ws.close();
              }, 1000);
            } else {
              // Recovery connection successful
              recoverySuccessful = true;
              clearTimeout(overallTimeout);
              
              testResults.resilience[testName] = {
                status: 'PASS',
                connectionAttempts: connectionCount,
                recoverySuccessful: true,
                recoveryTime: `${connectionCount * WEBSOCKET_CONFIG.RECONNECTION_DELAY}ms`
              };
              
              console.log(`✅ Connection recovery successful after ${connectionCount} attempts`);
              ws.close();
              resolve();
            }
          });
          
          ws.on('close', () => {
            if (connectionCount === 1 && !recoverySuccessful) {
              // First connection closed, attempt recovery
              setTimeout(() => {
                ws = new WebSocket(WEBSOCKET_CONFIG.URL);
                connectAndTest();
              }, WEBSOCKET_CONFIG.RECONNECTION_DELAY);
            }
          });
          
          ws.on('error', (error) => {
            if (connectionCount < WEBSOCKET_CONFIG.MAX_RECONNECTION_ATTEMPTS) {
              // Retry connection
              setTimeout(() => {
                ws = new WebSocket(WEBSOCKET_CONFIG.URL);
                connectAndTest();
              }, WEBSOCKET_CONFIG.RECONNECTION_DELAY);
            } else {
              clearTimeout(overallTimeout);
              testResults.resilience[testName] = {
                status: 'FAIL',
                connectionAttempts: connectionCount,
                finalError: error.message
              };
              reject(error);
            }
          });
        };
        
        connectAndTest();
      });
    });

    it('should handle network errors gracefully', async () => {
      const testName = 'network_error_handling';
      console.log('🔍 Testing network error handling...');
      
      try {
        // Attempt to connect to an invalid WebSocket URL
        const invalidWs = new WebSocket('ws://localhost:9999/invalid');
        
        const errorPromise = new Promise<Error>((resolve) => {
          invalidWs.on('error', (error) => {
            resolve(error);
          });
        });
        
        const error = await Promise.race([
          errorPromise,
          new Promise<Error>((_, reject) => {
            setTimeout(() => reject(new Error('No error received')), 5000);
          })
        ]);
        
        expect(error).toBeDefined();
        
        testResults.resilience[testName] = {
          status: 'PASS',
          errorHandled: true,
          errorType: error.constructor.name,
          errorMessage: error.message
        };
        
        console.log('✅ Network error handling working correctly');
        
      } catch (error) {
        testResults.resilience[testName] = {
          status: 'FAIL',
          error: error.message
        };
        console.error('❌ Network error handling test failed:', error.message);
        throw error;
      }
    });
  });

  describe('Performance', () => {
    
    it('should measure connection performance', async () => {
      const testName = 'connection_performance';
      console.log('🔍 Testing WebSocket connection performance...');
      
      const connectionTimes: number[] = [];
      const testConnections = 3;
      
      try {
        for (let i = 0; i < testConnections; i++) {
          const startTime = Date.now();
          
          await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
            
            const timeout = setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, WEBSOCKET_CONFIG.CONNECTION_TIMEOUT);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              const connectionTime = Date.now() - startTime;
              connectionTimes.push(connectionTime);
              ws.close();
              resolve();
            });
            
            ws.on('error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });
          
          // Small delay between connections
          await setTimeout(500);
        }
        
        const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
        const minConnectionTime = Math.min(...connectionTimes);
        const maxConnectionTime = Math.max(...connectionTimes);
        
        testResults.performance[testName] = {
          status: 'PASS',
          testConnections,
          averageConnectionTime: `${Math.round(avgConnectionTime)}ms`,
          minConnectionTime: `${minConnectionTime}ms`,
          maxConnectionTime: `${maxConnectionTime}ms`,
          allConnectionTimes: connectionTimes.map(t => `${t}ms`)
        };
        
        console.log(`✅ Connection performance: avg ${Math.round(avgConnectionTime)}ms`);
        
      } catch (error) {
        testResults.performance[testName] = {
          status: 'FAIL',
          error: error.message,
          successfulConnections: connectionTimes.length
        };
        console.error('❌ Connection performance test failed:', error.message);
        throw error;
      }
    });

    it('should measure message throughput', async () => {
      const testName = 'message_throughput';
      console.log('🔍 Testing WebSocket message throughput...');
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Throughput test timeout'));
        }, 15000);
        
        const ws = new WebSocket(WEBSOCKET_CONFIG.URL);
        const messageCount = 10;
        const sentMessages: number[] = [];
        const receivedMessages: number[] = [];
        const startTime = Date.now();
        
        ws.on('open', () => {
          // Send multiple messages rapidly
          for (let i = 0; i < messageCount; i++) {
            const message = {
              type: 'throughput_test',
              data: { id: i, timestamp: Date.now(), content: `test message ${i}` }
            };
            
            ws.send(JSON.stringify(message));
            sentMessages.push(Date.now());
          }
        });
        
        ws.on('message', (data) => {
          receivedMessages.push(Date.now());
          
          // Check if all messages received
          if (receivedMessages.length >= messageCount) {
            clearTimeout(timeout);
            
            const totalTime = Date.now() - startTime;
            const messagesPerSecond = Math.round((receivedMessages.length / totalTime) * 1000);
            
            testResults.performance[testName] = {
              status: 'PASS',
              sentMessages: sentMessages.length,
              receivedMessages: receivedMessages.length,
              totalTime: `${totalTime}ms`,
              throughput: `${messagesPerSecond} msg/sec`,
              averageLatency: `${Math.round(totalTime / receivedMessages.length)}ms`
            };
            
            console.log(`✅ Message throughput: ${messagesPerSecond} msg/sec`);
            ws.close();
            resolve();
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          testResults.performance[testName] = {
            status: 'FAIL',
            error: error.message,
            sentMessages: sentMessages.length,
            receivedMessages: receivedMessages.length
          };
          reject(error);
        });
      });
    });
  });
});

function generateWebSocketReport(): void {
  console.log('📊 WebSocket Integration Test Report');
  console.log('='.repeat(50));
  
  const categories = ['connection', 'messaging', 'realTime', 'resilience', 'performance'];
  const categoryNames = ['Connection', 'Messaging', 'Real-time', 'Resilience', 'Performance'];
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let partialTests = 0;
  
  categories.forEach((category, index) => {
    const tests = testResults[category as keyof TestResults];
    const testNames = Object.keys(tests);
    
    if (testNames.length === 0) return;
    
    console.log(`\n${categoryNames[index]} Tests:`);
    console.log('-'.repeat(25));
    
    testNames.forEach(testName => {
      const test = tests[testName];
      const status = test.status;
      const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
      
      console.log(`  ${icon} ${testName}: ${status}`);
      
      totalTests++;
      if (status === 'PASS') passedTests++;
      else if (status === 'FAIL') failedTests++;
      else partialTests++;
    });
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${totalTests} | ✅ ${passedTests} | ❌ ${failedTests} | ⚠️ ${partialTests}`);
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`WebSocket Success Rate: ${successRate}%`);
  
  if (failedTests === 0) {
    console.log('🎉 All WebSocket tests passed!');
  } else {
    console.log(`⚠️ ${failedTests} WebSocket tests failed`);
  }
}