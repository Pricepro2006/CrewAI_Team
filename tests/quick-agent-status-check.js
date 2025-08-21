#!/usr/bin/env node

/**
 * Quick Agent Status Check
 * 
 * This script performs a rapid verification of all 7 agents in the CrewAI system
 * and generates a simple status report.
 */

import http from 'http';
import { WebSocket } from 'ws';

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const AGENTS = [
  'MasterOrchestrator',
  'ResearchAgent', 
  'CodeAgent',
  'DataAnalysisAgent',
  'WriterAgent',
  'ToolExecutorAgent',
  'EmailAnalysisAgent'
];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Check server health
async function checkServerHealth() {
  try {
    const response = await makeRequest('/health');
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Check agent status
async function checkAgentStatus() {
  try {
    const response = await makeRequest('/api/agent/status');
    if (response.status === 200 && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Check agent list
async function getAgentList() {
  try {
    const response = await makeRequest('/api/agent/list');
    if (response.status === 200 && response.data) {
      return response.data.agents || [];
    }
    return [];
  } catch (error) {
    return [];
  }
}

// Test agent execution
async function testAgentExecution(agentId) {
  try {
    const response = await makeRequest('/api/agent/execute', 'POST', {
      agentId: agentId,
      task: 'status check',
      context: { test: true }
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     CrewAI Agent System Status Check       ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log();

  // Check server health
  process.stdout.write('Checking server health... ');
  const serverHealthy = await checkServerHealth();
  if (serverHealthy) {
    console.log(`${colors.green}✓ Server is running${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Server is not responding${colors.reset}`);
    console.log(`${colors.yellow}Please ensure the server is running on port 3001${colors.reset}`);
    process.exit(1);
  }

  // Get agent status
  console.log();
  console.log(`${colors.cyan}Agent Status:${colors.reset}`);
  console.log('─'.repeat(45));
  
  const agentStatus = await checkAgentStatus();
  const agentList = await getAgentList();
  
  const results = {
    operational: [],
    failed: [],
    missing: []
  };

  for (const agentName of AGENTS) {
    process.stdout.write(`  ${agentName.padEnd(20)} `);
    
    // Check if agent exists in the list
    const agentInfo = agentList.find(a => a.name === agentName || a.id === agentName);
    
    if (agentInfo) {
      // Test agent execution
      const canExecute = await testAgentExecution(agentName);
      
      if (canExecute) {
        console.log(`${colors.green}✓ Operational${colors.reset}`);
        results.operational.push(agentName);
      } else if (agentInfo.status === 'ready' || agentInfo.status === 'initialized') {
        console.log(`${colors.yellow}⚠ Ready (not tested)${colors.reset}`);
        results.operational.push(agentName);
      } else {
        console.log(`${colors.red}✗ Failed${colors.reset}`);
        results.failed.push(agentName);
      }
    } else {
      console.log(`${colors.red}✗ Not found${colors.reset}`);
      results.missing.push(agentName);
    }
  }

  // Summary
  console.log();
  console.log('─'.repeat(45));
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Operational: ${results.operational.length}/7${colors.reset}`);
  
  if (results.failed.length > 0) {
    console.log(`  ${colors.red}Failed: ${results.failed.length}/7${colors.reset}`);
    console.log(`    ${results.failed.join(', ')}`);
  }
  
  if (results.missing.length > 0) {
    console.log(`  ${colors.red}Missing: ${results.missing.length}/7${colors.reset}`);
    console.log(`    ${results.missing.join(', ')}`);
  }

  // Additional checks
  console.log();
  console.log(`${colors.cyan}Additional Services:${colors.reset}`);
  console.log('─'.repeat(45));

  // Check WebSocket
  process.stdout.write('  WebSocket (8080)'.padEnd(25));
  try {
    const ws = new WebSocket('ws://localhost:8080');
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('timeout')), 2000);
    });
    console.log(`${colors.green}✓ Connected${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}⚠ Not available${colors.reset}`);
  }

  // Check RAG system
  process.stdout.write('  RAG System'.padEnd(25));
  try {
    const response = await makeRequest('/api/rag/status');
    if (response.status === 200) {
      console.log(`${colors.green}✓ Operational${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Degraded${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Error${colors.reset}`);
  }

  // Performance metrics
  console.log();
  console.log(`${colors.cyan}Quick Performance Check:${colors.reset}`);
  console.log('─'.repeat(45));
  
  const testQuery = 'What is the system status?';
  process.stdout.write('  Simple query test... ');
  
  const startTime = Date.now();
  try {
    const response = await makeRequest('/api/agent/orchestrate', 'POST', {
      query: testQuery,
      context: { timeout: 5000 }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ ${responseTime}ms${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Failed (${response.status})${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Error${colors.reset}`);
  }

  // Final status
  console.log();
  console.log('═'.repeat(45));
  
  const allOperational = results.operational.length === 7;
  const mostlyOperational = results.operational.length >= 5;
  
  if (allOperational) {
    console.log(`${colors.green}✅ SYSTEM FULLY OPERATIONAL${colors.reset}`);
    console.log('All 7 agents are ready and responding');
  } else if (mostlyOperational) {
    console.log(`${colors.yellow}⚠️  SYSTEM PARTIALLY OPERATIONAL${colors.reset}`);
    console.log(`${results.operational.length} of 7 agents are operational`);
  } else {
    console.log(`${colors.red}❌ SYSTEM ISSUES DETECTED${colors.reset}`);
    console.log('Multiple agents are not responding');
  }
  
  console.log();
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Exit with appropriate code
  process.exit(allOperational ? 0 : 1);
}

// Run the check
main().catch(error => {
  console.error(`${colors.red}Error during status check:${colors.reset}`, error.message);
  process.exit(1);
});