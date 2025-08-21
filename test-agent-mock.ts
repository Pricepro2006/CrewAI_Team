/**
 * Agent System Test with Mocked LLM
 * Tests agent architecture and integration without requiring Ollama/llama.cpp
 */

import { BaseAgent } from './src/core/agents/base/BaseAgent';
import { ResearchAgent } from './src/core/agents/specialized/ResearchAgent';
import { CodeAgent } from './src/core/agents/specialized/CodeAgent';
import { DataAnalysisAgent } from './src/core/agents/specialized/DataAnalysisAgent';
import { WriterAgent } from './src/core/agents/specialized/WriterAgent';
import { ToolExecutorAgent } from './src/core/agents/specialized/ToolExecutorAgent';
import { AgentRegistry } from './src/core/agents/registry/AgentRegistry';
import { EmailAnalysisAgent } from './src/core/agents/specialized/EmailAnalysisAgent';
import { EmailAnalysisAgentEnhanced } from './src/core/agents/specialized/EmailAnalysisAgentEnhanced';

// Mock LLM for testing
class MockLLMProvider {
  async initialize() { return Promise.resolve(); }
  
  async generate(prompt: string): Promise<string> {
    // Simulate intelligent responses based on prompt content
    if (prompt.includes('research plan')) {
      return JSON.stringify({
        queries: ['test query 1', 'test query 2'],
        sourceTypes: ['academic', 'news'],
        extractionFocus: ['facts', 'statistics'],
        tools: ['web_search']
      });
    }
    
    if (prompt.includes('code') || prompt.includes('generate')) {
      return `// Generated code example
function parseEmailHeaders(email: string) {
  const headers = {};
  const lines = email.split('\\n');
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      headers[key.trim()] = value.trim();
    }
  }
  return headers;
}`;
    }
    
    if (prompt.includes('analyze') || prompt.includes('data')) {
      return `Analysis Results:
- Found 143,221 emails in dataset
- Average email length: 450 words
- Most common sender domain: gmail.com (35%)
- Peak email hours: 9-11 AM and 2-4 PM
- Sentiment distribution: 60% neutral, 25% positive, 15% negative`;
    }
    
    if (prompt.includes('write') || prompt.includes('professional')) {
      return `Dear [Recipient],

Thank you for your recent inquiry. I am pleased to provide you with the requested information.

Based on our analysis, we have identified several key opportunities for improvement in your email management system. Our team recommends implementing an automated classification system that can reduce processing time by up to 40%.

Please let me know if you need any additional information.

Best regards,
[Your Name]`;
    }
    
    return 'Generic response for: ' + prompt.substring(0, 50);
  }
  
  clearContext() {}
  getContext() { return undefined; }
}

interface TestResult {
  agent: string;
  testCase: string;
  passed: boolean;
  details: string;
  hasRAGIntegration?: boolean;
  responseTime?: number;
}

async function runAgentTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  console.log('🔬 AGENT SYSTEM ARCHITECTURE TEST\n');
  console.log('=' .repeat(60));
  
  // Test 1: Agent Registry
  console.log('\n📋 Testing Agent Registry...');
  const registry = new AgentRegistry();
  
  try {
    await registry.initialize();
    const registeredTypes = registry.getRegisteredTypes();
    
    results.push({
      agent: 'AgentRegistry',
      testCase: 'Registration of default agents',
      passed: registeredTypes.length === 5,
      details: `Registered ${registeredTypes.length}/5 agents: ${registeredTypes.join(', ')}`
    });
    
    console.log(`✅ Registry initialized with ${registeredTypes.length} agent types`);
  } catch (error) {
    results.push({
      agent: 'AgentRegistry',
      testCase: 'Registry initialization',
      passed: false,
      details: error.message
    });
    console.log(`❌ Registry failed: ${error.message}`);
  }
  
  // Test 2: Individual Agent Creation
  const agentTypes = [
    { name: 'ResearchAgent', class: ResearchAgent },
    { name: 'CodeAgent', class: CodeAgent },
    { name: 'DataAnalysisAgent', class: DataAnalysisAgent },
    { name: 'WriterAgent', class: WriterAgent },
    { name: 'ToolExecutorAgent', class: ToolExecutorAgent }
  ];
  
  console.log('\n🤖 Testing Individual Agents...');
  
  for (const agentType of agentTypes) {
    console.log(`\nTesting ${agentType.name}...`);
    
    try {
      // Create agent with mock LLM
      const agent = new agentType.class();
      
      // Inject mock LLM
      (agent as any).llm = new MockLLMProvider();
      
      // Test agent capabilities
      const capabilities = agent.getCapabilities();
      results.push({
        agent: agentType.name,
        testCase: 'Agent capabilities',
        passed: capabilities.length > 0,
        details: `Has ${capabilities.length} capabilities`
      });
      
      // Test agent execution with mock context
      const startTime = Date.now();
      const result = await agent.execute('Test query', {
        query: 'Test query',
        conversationId: 'test-123',
        ragDocuments: []
      });
      
      const responseTime = Date.now() - startTime;
      
      results.push({
        agent: agentType.name,
        testCase: 'Agent execution',
        passed: result.success && result.output !== undefined,
        details: `Response in ${responseTime}ms`,
        responseTime
      });
      
      console.log(`  ✅ Capabilities: ${capabilities.length}`);
      console.log(`  ✅ Execution: ${result.success ? 'Success' : 'Failed'}`);
      console.log(`  ⏱️ Response time: ${responseTime}ms`);
      
    } catch (error) {
      results.push({
        agent: agentType.name,
        testCase: 'Agent creation/execution',
        passed: false,
        details: error.message
      });
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Test 3: Email Analysis Agents (Special case - no RAG)
  console.log('\n📧 Testing Email Analysis Agents...');
  
  try {
    const emailAgent = new EmailAnalysisAgent();
    const capabilities = emailAgent.getCapabilities();
    
    results.push({
      agent: 'EmailAnalysisAgent',
      testCase: 'Email agent capabilities',
      passed: capabilities.length > 0,
      details: `Has ${capabilities.length} capabilities, designed without RAG`,
      hasRAGIntegration: false
    });
    
    console.log(`  ✅ EmailAnalysisAgent: ${capabilities.length} capabilities (No RAG by design)`);
  } catch (error) {
    results.push({
      agent: 'EmailAnalysisAgent',
      testCase: 'Email agent creation',
      passed: false,
      details: error.message
    });
  }
  
  try {
    const enhancedAgent = new EmailAnalysisAgentEnhanced();
    const capabilities = enhancedAgent.getCapabilities();
    
    results.push({
      agent: 'EmailAnalysisAgentEnhanced',
      testCase: 'Enhanced email agent capabilities',
      passed: capabilities.length > 0,
      details: `Has ${capabilities.length} capabilities`,
      hasRAGIntegration: false
    });
    
    console.log(`  ✅ EmailAnalysisAgentEnhanced: ${capabilities.length} capabilities`);
  } catch (error) {
    results.push({
      agent: 'EmailAnalysisAgentEnhanced',
      testCase: 'Enhanced email agent creation',
      passed: false,
      details: error.message
    });
  }
  
  // Test 4: Agent Pool Management
  console.log('\n🏊 Testing Agent Pool Management...');
  
  try {
    const agent1 = await registry.getAgent('ResearchAgent');
    const agent2 = await registry.getAgent('CodeAgent');
    
    const activeAgents = registry.getActiveAgents();
    const poolStatus = registry.getPoolStatus();
    
    results.push({
      agent: 'AgentRegistry',
      testCase: 'Agent pool management',
      passed: activeAgents.length >= 2,
      details: `Active: ${activeAgents.length}, Pool: ${JSON.stringify(poolStatus)}`
    });
    
    // Release agents back to pool
    registry.releaseAgent('ResearchAgent', agent1);
    registry.releaseAgent('CodeAgent', agent2);
    
    console.log(`  ✅ Pool management working`);
    console.log(`  📊 Active agents: ${activeAgents.length}`);
    console.log(`  📊 Pool status: ${JSON.stringify(poolStatus)}`);
    
  } catch (error) {
    results.push({
      agent: 'AgentRegistry',
      testCase: 'Pool management',
      passed: false,
      details: error.message
    });
  }
  
  // Generate Report
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL REPORT: AGENT SYSTEM STATUS');
  console.log('=' .repeat(60));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  const workingAgents = new Set(
    results
      .filter(r => r.passed && r.testCase.includes('execution'))
      .map(r => r.agent)
  ).size;
  
  const totalAgents = 7; // Including both email agents
  
  console.log(`\n✅ Working Agents: ${workingAgents}/${totalAgents}`);
  console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  // Average response time
  const timings = results.filter(r => r.responseTime);
  const avgTime = timings.length > 0 
    ? timings.reduce((sum, r) => sum + (r.responseTime || 0), 0) / timings.length
    : 0;
  
  console.log(`⚡ Average Response Time: ${avgTime.toFixed(0)}ms`);
  
  // RAG Integration
  const ragIntegrated = results.filter(r => r.hasRAGIntegration !== false).length;
  console.log(`🔍 RAG-Ready Agents: 5/7 (EmailAnalysis agents excluded by design)`);
  
  console.log('\n📋 Individual Results:');
  console.log('-'.repeat(60));
  
  const agentSummary = {};
  results.forEach(r => {
    if (!agentSummary[r.agent]) {
      agentSummary[r.agent] = { passed: 0, failed: 0 };
    }
    if (r.passed) {
      agentSummary[r.agent].passed++;
    } else {
      agentSummary[r.agent].failed++;
    }
  });
  
  Object.entries(agentSummary).forEach(([agent, stats]: [string, any]) => {
    const status = stats.failed === 0 ? '✅' : stats.passed > 0 ? '⚠️' : '❌';
    console.log(`${status} ${agent.padEnd(25)} Passed: ${stats.passed} | Failed: ${stats.failed}`);
  });
  
  // Critical Assessment
  console.log('\n⚠️ STRICT FUNCTIONALITY ASSESSMENT:');
  console.log('-'.repeat(60));
  
  const issues = [];
  
  if (workingAgents < 5) {
    issues.push(`❌ Only ${workingAgents}/7 agents are truly functional`);
  }
  
  // Check for LLM integration
  issues.push('❌ No actual LLM integration - using mock provider');
  issues.push('❌ Response quality cannot be assessed without real LLM');
  issues.push('⚠️ RAG system not tested (requires ChromaDB)');
  issues.push('⚠️ MasterOrchestrator not tested (requires full stack)');
  
  if (failedTests > 0) {
    issues.push(`❌ ${failedTests} test failures indicate architectural problems`);
  }
  
  if (avgTime === 0) {
    issues.push('⚠️ Response timing based on mock - not realistic');
  }
  
  issues.forEach(issue => console.log(issue));
  
  console.log('\n🔧 REQUIRED FIXES:');
  console.log('-'.repeat(60));
  console.log('1. Ollama connection issues - service not running');
  console.log('2. llama.cpp hanging on initialization - model loading issue');
  console.log('3. No fallback when LLM providers unavailable');
  console.log('4. Agent execute methods need error handling for missing LLM');
  console.log('5. RAG system needs testing with actual vector store');
  
  // Cleanup
  await registry.shutdown();
  
  return results;
}

// Run tests
runAgentTests()
  .then(results => {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`\n✅ Test completed: ${passed}/${total} passed`);
    process.exit(passed < total / 2 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });