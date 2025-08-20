#!/usr/bin/env node

/**
 * System Verification Script
 * Validates all claimed functionality
 */

const baseUrl = 'http://localhost:3001';

async function testEndpoint(name, method, path, body = null, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const start = Date.now();
    const response = await fetch(`${baseUrl}${path}`, options);
    const duration = Date.now() - start;
    
    clearTimeout(timeoutId);
    
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    return {
      name,
      status: response.status,
      success: response.status >= 200 && response.status < 300,
      duration,
      hasData: !!data,
      error: response.status >= 400 ? (data?.error?.json?.message || data?.error?.message || data?.error || 'Unknown error') : null
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      name,
      status: 0,
      success: false,
      duration: timeout,
      error: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

async function runTests() {
  console.log('🔍 CrewAI System Verification Report');
  console.log('=====================================\n');
  
  const tests = [
    // Basic connectivity
    { name: 'Health Check', method: 'GET', path: '/health' },
    
    // CSRF bypass verification (should NOT return 403)
    { name: 'CSRF Bypass Test', method: 'POST', path: '/trpc/agent.execute', 
      body: { json: { agentType: 'invalid', task: 'test' } } },
    
    // Agent endpoints
    { name: 'Agent List', method: 'GET', path: '/trpc/agent.list' },
    { name: 'Agent Status', method: 'GET', path: '/trpc/agent.status' },
    { name: 'Agent Pool Status', method: 'GET', path: '/trpc/agent.poolStatus' },
    
    // Agent execution (with short timeout to avoid hanging)
    { name: 'Agent Execute Test', method: 'POST', path: '/trpc/agent.execute',
      body: { json: { agentType: 'ResearchAgent', task: 'Return OK' } }, timeout: 10000 },
    
    // Chat/Orchestrator
    { name: 'Chat Create (Orchestrator)', method: 'POST', path: '/trpc/chat.create',
      body: { json: { message: 'test' } }, timeout: 5000 },
    
    // Walmart endpoints
    { name: 'Walmart Search', method: 'POST', path: '/trpc/walmartGrocery.searchProducts',
      body: { json: { query: 'test', limit: 1 } } },
    { name: 'Walmart List Create', method: 'POST', path: '/trpc/walmartGroceryTRPC.createList',
      body: { json: { userId: 'test', name: 'Test', budget: 10 } } },
  ];
  
  const results = [];
  
  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name}... `);
    const result = await testEndpoint(
      test.name, 
      test.method, 
      test.path, 
      test.body, 
      test.timeout || 5000
    );
    results.push(result);
    
    if (result.success) {
      console.log(`✅ (${result.status}, ${result.duration}ms)`);
    } else {
      console.log(`❌ (${result.status || 'FAIL'}, ${result.error})`);
    }
  }
  
  console.log('\n📊 Summary Report');
  console.log('=================\n');
  
  // Analyze results
  const working = results.filter(r => r.success);
  const notWorking = results.filter(r => !r.success);
  
  console.log(`✅ Working: ${working.length}/${results.length}`);
  working.forEach(r => console.log(`  - ${r.name} (${r.duration}ms)`));
  
  console.log(`\n❌ Not Working: ${notWorking.length}/${results.length}`);
  notWorking.forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  
  // Check specific claims
  console.log('\n🎯 Verification of Claims:');
  console.log('==========================\n');
  
  const claims = {
    'CSRF Protection Bypassed': !results.find(r => r.error && typeof r.error === 'string' && r.error.includes('CSRF')),
    'Agents List Available': results.find(r => r.name === 'Agent List')?.success,
    'Agent Execution Works': results.find(r => r.name === 'Agent Execute Test')?.success,
    'MasterOrchestrator Accessible': results.find(r => r.name === 'Chat Create (Orchestrator)')?.status !== 404,
    'Walmart Search Works': results.find(r => r.name === 'Walmart Search')?.success,
    'Walmart List Creation Works': results.find(r => r.name === 'Walmart List Create')?.success,
    'Server Stable': results.find(r => r.name === 'Health Check')?.success,
  };
  
  Object.entries(claims).forEach(([claim, verified]) => {
    console.log(`${verified ? '✅' : '❌'} ${claim}`);
  });
  
  // Calculate success criteria
  console.log('\n📈 Success Criteria Status:');
  console.log('============================\n');
  
  const criteria = {
    'SC1: At least one agent responding': claims['Agent Execution Works'],
    'SC2: MasterOrchestrator routing': claims['MasterOrchestrator Accessible'] && results.find(r => r.name === 'Chat Create (Orchestrator)')?.error !== 'Timeout',
    'SC3: Walmart grocery functional': claims['Walmart Search Works'] && claims['Walmart List Creation Works'],
    'SC4: No server crashes': claims['Server Stable'],
    'SC5: Integration test passing': false // Not tested yet
  };
  
  let metCount = 0;
  Object.entries(criteria).forEach(([criterion, met]) => {
    console.log(`${met ? '✅' : '❌'} ${criterion}`);
    if (met) metCount++;
  });
  
  console.log(`\n🏁 Final Score: ${metCount}/5 Success Criteria Met`);
  
  // Accuracy check
  console.log('\n⚠️  Truth vs Claims Analysis:');
  console.log('===============================\n');
  
  const discrepancies = [];
  
  if (claims['CSRF Protection Bypassed'] && results.some(r => typeof r.error === 'string' && r.error.includes('403'))) {
    discrepancies.push('CSRF may not be fully bypassed');
  }
  
  if (!claims['Agent Execution Works']) {
    discrepancies.push('Agent execution is NOT working as claimed');
  }
  
  if (!claims['Walmart List Creation Works']) {
    discrepancies.push('Walmart list creation has errors (as noted)');
  }
  
  if (results.find(r => r.name === 'Chat Create (Orchestrator)')?.error === 'Timeout') {
    discrepancies.push('MasterOrchestrator times out (as noted)');
  }
  
  if (discrepancies.length === 0) {
    console.log('✅ All claims appear to be accurate');
  } else {
    console.log('Found discrepancies:');
    discrepancies.forEach(d => console.log(`  ⚠️  ${d}`));
  }
  
  console.log('\n=====================================');
  console.log('Verification Complete');
  console.log(`Timestamp: ${new Date().toISOString()}`);
}

runTests().catch(console.error);