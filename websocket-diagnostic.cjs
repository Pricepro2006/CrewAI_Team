#!/usr/bin/env node
/**
 * WebSocket Connectivity Diagnostic Tool
 * Validates Issue 5: WebSocket URL configuration and real-time data flow
 */

const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');

// Configuration URLs to validate against the React hooks
const EXPECTED_URLS = {
  useGroceryWebSocket: {
    development: 'ws://localhost:3001/trpc-ws',
    production: 'wss://${window?.location?.hostname}:3001/trpc-ws'
  },
  useTRPCWithCSRF: {
    apiUrl: 'http://localhost:3001/trpc',
    wsUrl: 'ws://localhost:3001/trpc-ws'
  }
};

class WebSocketDiagnostic {
  constructor() {
    this.results = {
      codeAnalysis: {},
      connectivityTests: [],
      realTimeFlow: [],
      issues: []
    };
  }

  async analyzeCodeConfigurations() {
    console.log('🔍 Analyzing WebSocket URL configurations in React hooks...\n');
    
    // Analyze useGroceryWebSocket.ts
    try {
      const groceryHookPath = 'src/ui/hooks/useGroceryWebSocket.ts';
      const groceryContent = await fs.readFile(groceryHookPath, 'utf8');
      
      const wsUrlMatch = groceryContent.match(/const WS_URL = (.+);/);
      if (wsUrlMatch) {
        this.results.codeAnalysis.useGroceryWebSocket = {
          file: groceryHookPath,
          configLine: wsUrlMatch[0],
          isCorrect: wsUrlMatch[0].includes('ws://localhost:3001/trpc-ws')
        };
        console.log(`✅ useGroceryWebSocket config found: ${wsUrlMatch[0]}`);
      }
    } catch (error) {
      this.results.issues.push(`Failed to analyze useGroceryWebSocket: ${error.message}`);
      console.log(`❌ Failed to analyze useGroceryWebSocket: ${error.message}`);
    }

    // Analyze useTRPCWithCSRF.ts  
    try {
      const trpcHookPath = 'src/ui/hooks/useTRPCWithCSRF.ts';
      const trpcContent = await fs.readFile(trpcHookPath, 'utf8');
      
      const defaultConfigMatch = trpcContent.match(/const DEFAULT_CONFIG: TRPCClientConfig = \{[\s\S]*?\};/);
      if (defaultConfigMatch) {
        this.results.codeAnalysis.useTRPCWithCSRF = {
          file: trpcHookPath,
          configBlock: defaultConfigMatch[0],
          isCorrect: defaultConfigMatch[0].includes('ws://localhost:3001/trpc-ws')
        };
        console.log(`✅ useTRPCWithCSRF config found`);
      }
    } catch (error) {
      this.results.issues.push(`Failed to analyze useTRPCWithCSRF: ${error.message}`);
      console.log(`❌ Failed to analyze useTRPCWithCSRF: ${error.message}`);
    }
  }

  async testConnectivity() {
    console.log('\n🔌 Testing WebSocket connectivity...\n');
    
    const testUrls = [
      { url: 'ws://localhost:3001/trpc-ws', name: 'tRPC WebSocket (from hooks)' },
      { url: 'ws://localhost:8080/ws', name: 'General WebSocket Gateway' },
      { url: 'ws://localhost:8080/ws/walmart', name: 'Walmart WebSocket' }
    ];

    for (const testUrl of testUrls) {
      const result = await this.testSingleConnection(testUrl);
      this.results.connectivityTests.push(result);
    }
  }

  async testSingleConnection({ url, name }) {
    return new Promise((resolve) => {
      console.log(`  🔗 Testing ${name} at ${url}`);
      
      const startTime = Date.now();
      const ws = new WebSocket(url);
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          const result = { name, url, status: 'timeout', latency: null, error: 'Connection timeout' };
          console.log(`    ⏰ Timeout: ${name}`);
          resolve(result);
        }
      }, 5000);

      ws.on('open', () => {
        if (!resolved) {
          const latency = Date.now() - startTime;
          console.log(`    ✅ Connected: ${name} (${latency}ms)`);
          
          // Send test message and wait for response
          ws.send(JSON.stringify({
            type: 'diagnostic_test',
            timestamp: Date.now(),
            source: 'websocket-diagnostic-tool'
          }));
        }
      });

      ws.on('message', (data) => {
        if (!resolved) {
          const latency = Date.now() - startTime;
          const message = data.toString();
          console.log(`    📨 Response: ${message.substring(0, 100)}...`);
          
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          
          resolve({ 
            name, 
            url, 
            status: 'success', 
            latency, 
            responseReceived: true,
            response: message
          });
        }
      });

      ws.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const result = { name, url, status: 'error', latency: null, error: error.message };
          console.log(`    ❌ Error: ${name} - ${error.message}`);
          resolve(result);
        }
      });

      ws.on('close', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const result = { name, url, status: 'closed', latency: null, error: 'Connection closed without message' };
          console.log(`    🔌 Closed: ${name}`);
          resolve(result);
        }
      });
    });
  }

  async monitorRealTimeFlow() {
    console.log('\n📡 Monitoring real-time data flow...\n');
    
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:3001/trpc-ws');
      const messages = [];
      const duration = 10000; // 10 seconds
      
      ws.on('open', () => {
        console.log('  📊 Monitoring started for 10 seconds...');
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push({
            timestamp: new Date().toISOString(),
            type: message.type || 'unknown',
            size: data.length,
            content: message
          });
          console.log(`    📨 [${messages.length}] ${message.type || 'unknown'}: ${data.length} bytes`);
        } catch (error) {
          messages.push({
            timestamp: new Date().toISOString(),
            type: 'raw',
            size: data.length,
            content: data.toString()
          });
          console.log(`    📨 [${messages.length}] Raw data: ${data.length} bytes`);
        }
      });

      setTimeout(() => {
        ws.close();
        this.results.realTimeFlow = messages;
        console.log(`  ✅ Monitoring complete: ${messages.length} messages received`);
        resolve();
      }, duration);
    });
  }

  generateReport() {
    console.log('\n📋 WEBSOCKET CONNECTIVITY DIAGNOSTIC REPORT');
    console.log('='.repeat(60));
    
    // Code Analysis Results
    console.log('\n🔍 Code Configuration Analysis:');
    Object.entries(this.results.codeAnalysis).forEach(([hook, analysis]) => {
      const status = analysis.isCorrect ? '✅' : '❌';
      console.log(`  ${status} ${hook}: ${analysis.isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    });

    // Connectivity Test Results  
    console.log('\n🔌 Connectivity Test Results:');
    this.results.connectivityTests.forEach(test => {
      const status = test.status === 'success' ? '✅' : '❌';
      const latency = test.latency ? `(${test.latency}ms)` : '';
      console.log(`  ${status} ${test.name}: ${test.status.toUpperCase()} ${latency}`);
      if (test.error) {
        console.log(`      Error: ${test.error}`);
      }
    });

    // Real-time Data Flow
    console.log(`\n📡 Real-time Data Flow: ${this.results.realTimeFlow.length} messages`);
    if (this.results.realTimeFlow.length > 0) {
      const types = [...new Set(this.results.realTimeFlow.map(m => m.type))];
      console.log(`  Message types: ${types.join(', ')}`);
    }

    // Issues and Recommendations
    console.log('\n⚠️  Issues Found:');
    if (this.results.issues.length === 0) {
      console.log('  No critical issues detected');
    } else {
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    // Summary
    const successfulConnections = this.results.connectivityTests.filter(t => t.status === 'success').length;
    const totalConnections = this.results.connectivityTests.length;
    
    console.log('\n🎯 SUMMARY:');
    console.log(`  Connectivity: ${successfulConnections}/${totalConnections} successful`);
    console.log(`  Real-time flow: ${this.results.realTimeFlow.length > 0 ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`  Configuration: ${Object.values(this.results.codeAnalysis).every(c => c.isCorrect) ? 'CORRECT' : 'NEEDS REVIEW'}`);
    
    if (successfulConnections === totalConnections && this.results.realTimeFlow.length > 0) {
      console.log('  🎉 WebSocket connectivity is FULLY OPERATIONAL');
    } else {
      console.log('  🔧 WebSocket connectivity needs INVESTIGATION');
    }
  }
}

async function main() {
  const diagnostic = new WebSocketDiagnostic();
  
  try {
    await diagnostic.analyzeCodeConfigurations();
    await diagnostic.testConnectivity();
    await diagnostic.monitorRealTimeFlow();
    diagnostic.generateReport();
  } catch (error) {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { WebSocketDiagnostic };