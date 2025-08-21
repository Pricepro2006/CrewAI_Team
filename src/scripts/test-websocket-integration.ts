#!/usr/bin/env node
/**
 * WebSocket Integration Test Script
 * Tests frontend-backend WebSocket integration programmatically
 */

import WebSocket from 'ws';
import { getWebSocketEndpoints, getWebSocketDebugInfo } from '../config/websocket.config.js';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
}

class WebSocketTester {
  private results: TestResult[] = [];

  private addResult(test: string, status: TestResult['status'], message: string, duration: number) {
    this.results.push({ test, status, message, duration });
    const statusColor = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${statusColor}[${status}]\x1b[0m ${test}: ${message} (${duration}ms)`);
  }

  private async testConnection(url: string, testName: string): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        let connected = false;
        
        const timeout = setTimeout(() => {
          if (!connected) {
            ws.close();
            const duration = Date.now() - startTime;
            this.addResult(testName, 'FAIL', `Connection timeout after ${duration}ms`, duration);
            resolve(false);
          }
        }, 10000); // 10 second timeout

        ws.on('open', () => {
          connected = true;
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          this.addResult(testName, 'PASS', `Connected successfully`, duration);
          
          // Send a test message
          ws.send(JSON.stringify({
            type: 'ping',
            data: { test: true },
            timestamp: new Date().toISOString()
          }));
          
          // Close after brief delay
          setTimeout(() => {
            ws.close();
            resolve(true);
          }, 1000);
        });

        ws.on('message', (data: any) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`  📨 Received message: ${message.type}`);
          } catch (error) {
            console.log(`  📨 Received raw message: ${data.toString()}`);
          }
        });

        ws.on('error', (error: any) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          this.addResult(testName, 'FAIL', `Connection error: ${error.message}`, duration);
          resolve(false);
        });

        ws.on('close', (code, reason) => {
          if (!connected) {
            clearTimeout(timeout);
            const duration = Date.now() - startTime;
            this.addResult(testName, 'FAIL', `Connection closed: ${code} ${reason.toString()}`, duration);
            resolve(false);
          }
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        this.addResult(testName, 'FAIL', `Connection failed: ${(error as Error).message}`, duration);
        resolve(false);
      }
    });
  }

  private async testReconnection(url: string, testName: string): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let connectionCount = 0;
      let firstConnected = false;
      
      const connect = () => {
        const ws = new WebSocket(url);
        
        ws.on('open', () => {
          connectionCount++;
          console.log(`  🔄 Connection ${connectionCount} established`);
          
          if (!firstConnected) {
            firstConnected = true;
            // Close to test reconnection
            setTimeout(() => {
              ws.close();
            }, 500);
          } else {
            // Second connection successful
            const duration = Date.now() - startTime;
            this.addResult(testName, 'PASS', `Reconnection successful`, duration);
            ws.close();
            resolve(true);
          }
        });
        
        ws.on('close', () => {
          if (firstConnected && connectionCount === 1) {
            // Attempt reconnection
            setTimeout(connect, 1000);
          }
        });
        
        ws.on('error', (error: any) => {
          const duration = Date.now() - startTime;
          this.addResult(testName, 'FAIL', `Reconnection failed: ${error.message}`, duration);
          resolve(false);
        });
      };
      
      // Start initial connection
      connect();
      
      // Timeout after 15 seconds
      setTimeout(() => {
        const duration = Date.now() - startTime;
        this.addResult(testName, 'FAIL', `Reconnection test timeout`, duration);
        resolve(false);
      }, 15000);
    });
  }

  private async testMessageFlow(url: string, testName: string): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        let messagesSent = 0;
        let messagesReceived = 0;
        const expectedMessages = 3;
        
        ws.on('open', () => {
          // Send multiple test messages
          for (let i = 1; i <= expectedMessages; i++) {
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'test_message',
                data: { messageNumber: i, timestamp: Date.now() },
                timestamp: new Date().toISOString()
              }));
              messagesSent++;
              console.log(`  📤 Sent message ${i}/${expectedMessages}`);
            }, i * 500);
          }
          
          // Check results after all messages should be sent
          setTimeout(() => {
            const duration = Date.now() - startTime;
            if (messagesSent === expectedMessages) {
              this.addResult(testName, 'PASS', `All ${messagesSent} messages sent successfully`, duration);
            } else {
              this.addResult(testName, 'FAIL', `Only ${messagesSent}/${expectedMessages} messages sent`, duration);
            }
            ws.close();
            resolve(messagesSent === expectedMessages);
          }, (expectedMessages + 1) * 500);
        });

        ws.on('message', (data) => {
          messagesReceived++;
          console.log(`  📥 Received response ${messagesReceived}`);
        });

        ws.on('error', (error: any) => {
          const duration = Date.now() - startTime;
          this.addResult(testName, 'FAIL', `Message flow error: ${error.message}`, duration);
          resolve(false);
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        this.addResult(testName, 'FAIL', `Message flow failed: ${(error as Error).message}`, duration);
        resolve(false);
      }
    });
  }

  async runTests(): Promise<void> {
    console.log('🧪 Starting WebSocket Integration Tests...\n');
    
    // Get endpoint configuration
    const endpoints = getWebSocketEndpoints();
    const debugInfo = getWebSocketDebugInfo();
    
    console.log('📋 Configuration:');
    console.log(`  Environment: ${debugInfo.environment}`);
    console.log(`  API Port: ${debugInfo.ports.apiPort}`);
    console.log(`  WebSocket Port: ${debugInfo.ports.wsPort}`);
    console.log(`  Is Browser: ${debugInfo.isBrowser}\n`);
    
    console.log('🔗 Testing Endpoints:');
    Object.entries(endpoints).forEach(([name, url]) => {
      console.log(`  ${name}: ${url}`);
    });
    console.log('');

    // Test 1: Basic connection to native WebSocket
    console.log('🔌 Testing Basic Connections...');
    await this.testConnection(endpoints.native, 'Native WebSocket Connection');
    
    // Test 2: Basic connection to tRPC WebSocket
    await this.testConnection(endpoints.trpc, 'tRPC WebSocket Connection');
    
    // Test 3: Walmart-specific WebSocket
    await this.testConnection(endpoints.walmart, 'Walmart WebSocket Connection');
    
    // Test 4: Email WebSocket
    await this.testConnection(endpoints.email, 'Email WebSocket Connection');
    
    console.log('\\n🔄 Testing Reconnection Logic...');
    
    // Test 5: Reconnection test
    await this.testReconnection(endpoints.native, 'Native WebSocket Reconnection');
    
    console.log('\\n📨 Testing Message Flow...');
    
    // Test 6: Message flow test
    await this.testMessageFlow(endpoints.native, 'Native WebSocket Message Flow');
    
    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    console.log('\\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (failed > 0) {
      console.log('\\n🚨 Failed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`  • ${result.test}: ${result.message}`);
      });
    }
    
    console.log('\\n' + '='.repeat(60));
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run tests if this script is executed directly
// Check if this module is being run directly
if (require.main === module) {
  const tester = new WebSocketTester();
  tester.runTests().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { WebSocketTester };