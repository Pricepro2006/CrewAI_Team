#!/usr/bin/env node
import axios from 'axios';
import { performance } from 'perf_hooks';

const API_BASE_URL = 'http://localhost:3001';
const TIMEOUT = 30000; // 30 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

async function waitForServer() {
  console.log(`${colors.blue}⏳ Waiting for backend API server on port 3001...${colors.reset}`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < TIMEOUT) {
    try {
      await axios.get(`${API_BASE_URL}/health`, { timeout: 2000 });
      console.log(`${colors.green}✅ Backend API server is running!${colors.reset}\n`);
      return true;
    } catch (error) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`${colors.red}\n❌ Backend API server did not start within ${TIMEOUT/1000} seconds${colors.reset}`);
  return false;
}

async function testEndpoint(method, path, description, options = {}) {
  const startTime = performance.now();
  
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${path}`,
      validateStatus: () => true, // Don't throw on any status
      timeout: 5000,
      ...options
    });
    
    const duration = (performance.now() - startTime).toFixed(2);
    const status = response.status;
    const statusColor = status >= 200 && status < 300 ? colors.green : 
                       status >= 400 && status < 500 ? colors.yellow : colors.red;
    
    console.log(`${statusColor}${method.padEnd(6)} ${path.padEnd(35)} [${status}] ${duration}ms${colors.reset}`);
    
    // Log response details for debugging
    if (status >= 200 && status < 300 && response.data) {
      const preview = JSON.stringify(response.data).substring(0, 100);
      console.log(`${colors.gray}       Response: ${preview}${preview.length >= 100 ? '...' : ''}${colors.reset}`);
    }
    
    return { success: status >= 200 && status < 300, status, duration, data: response.data };
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`${colors.red}${method.padEnd(6)} ${path.padEnd(35)} [ERROR] ${duration}ms${colors.reset}`);
    console.log(`${colors.gray}       Error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message, duration };
  }
}

async function runTests() {
  console.log(`${colors.blue}🧪 Backend API Integration Tests${colors.reset}`);
  console.log(`${colors.blue}================================${colors.reset}\n`);
  
  const serverAvailable = await waitForServer();
  
  if (!serverAvailable) {
    console.log(`${colors.red}Cannot proceed with tests - server not available${colors.reset}`);
    process.exit(1);
  }
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0
  };
  
  // Test groups
  const testGroups = [
    {
      name: 'Core Health Endpoints',
      tests: [
        { method: 'GET', path: '/health', description: 'Basic health check' },
        { method: 'GET', path: '/api/health', description: 'Detailed health status' },
        { method: 'GET', path: '/api/metrics', description: 'System metrics' }
      ]
    },
    {
      name: 'Walmart Grocery Service',
      tests: [
        { method: 'GET', path: '/api/walmart-grocery/health', description: 'Service health' },
        { method: 'POST', path: '/api/walmart-grocery/search', description: 'Product search', 
          options: { data: { query: 'milk' } } },
        { method: 'GET', path: '/api/walmart-grocery/list', description: 'Get grocery list' }
      ]
    },
    {
      name: 'tRPC Endpoints',
      tests: [
        { method: 'GET', path: '/trpc', description: 'tRPC panel' },
        { method: 'GET', path: '/trpc/health.check', description: 'tRPC health check' },
        { method: 'GET', path: '/trpc/metrics.getSystemMetrics', description: 'tRPC metrics' }
      ]
    },
    {
      name: 'WebSocket Support',
      tests: [
        { method: 'GET', path: '/socket.io/', description: 'Socket.io endpoint',
          options: { headers: { 'Upgrade': 'websocket', 'Connection': 'Upgrade' } } }
      ]
    },
    {
      name: 'Error Handling',
      tests: [
        { method: 'GET', path: '/non-existent-route', description: '404 handling' },
        { method: 'POST', path: '/api/walmart-grocery/invalid', description: 'Invalid endpoint' }
      ]
    }
  ];
  
  // Run tests
  for (const group of testGroups) {
    console.log(`\n${colors.blue}📁 ${group.name}${colors.reset}`);
    console.log(`${colors.gray}${'─'.repeat(50)}${colors.reset}`);
    
    for (const test of group.tests) {
      const result = await testEndpoint(test.method, test.path, test.description, test.options);
      results.total++;
      
      if (result.success) {
        results.passed++;
      } else if (result.error) {
        results.errors++;
      } else {
        results.failed++;
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Summary
  console.log(`\n${colors.blue}${'═'.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}📊 Test Summary${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(50)}${colors.reset}`);
  console.log(`Total Tests:  ${results.total}`);
  console.log(`${colors.green}Passed:       ${results.passed}${colors.reset}`);
  console.log(`${colors.yellow}Failed:       ${results.failed}${colors.reset}`);
  console.log(`${colors.red}Errors:       ${results.errors}${colors.reset}`);
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  const rateColor = successRate >= 80 ? colors.green : 
                   successRate >= 60 ? colors.yellow : colors.red;
  console.log(`\n${rateColor}Success Rate: ${successRate}%${colors.reset}`);
  
  // Exit code based on results
  const exitCode = results.passed === results.total ? 0 : 1;
  process.exit(exitCode);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});