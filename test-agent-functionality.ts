/**
 * Comprehensive Agent System Test
 * Tests all 7 agents with real-world queries
 */

import { MasterOrchestrator } from './src/core/master-orchestrator/MasterOrchestrator';
import { AgentRegistry } from './src/core/agents/registry/AgentRegistry';
import { RAGSystem } from './src/core/rag/RAGSystem';
import { safeLlamaCppProvider } from './src/core/llm/SafeLlamaCppProvider';
import { OllamaProvider } from './src/core/llm/OllamaProvider';
import appConfig from './src/config/app.config';
import ollamaConfig from './src/config/ollama.config';
import ragConfig from './src/config/rag.config';

// Test queries for each agent type
const testQueries = {
  masterOrchestrator: "Create a plan to analyze my email patterns",
  research: "Research email security best practices",
  dataAnalysis: "Analyze trends in my 143K emails",
  code: "Generate code to parse email headers",
  writer: "Write a professional email response",
  toolExecutor: "Search for email productivity tips",
  emailAnalysis: "Analyze sentiment of recent emails"
};

interface TestResult {
  agent: string;
  query: string;
  success: boolean;
  responseQuality: number; // 0-10
  responseTime: number; // ms
  hasRelevantContent: boolean;
  error?: string;
  response?: string;
  usedRAG: boolean;
  tokensUsed?: number;
}

async function testAgentFunctionality(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  console.log('🔬 Starting Comprehensive Agent System Test\n');
  console.log('=' .repeat(60));

  try {
    // Initialize services
    console.log('📦 Initializing Core Services...');
    
    // Check if Ollama is available
    let llmProvider: any;
    let usingOllama = false;
    
    try {
      llmProvider = new OllamaProvider({
        model: 'qwen3:14b',
        baseUrl: ollamaConfig.main.baseUrl
      });
      await llmProvider.initialize();
      usingOllama = true;
      console.log('✅ Ollama connected successfully');
    } catch (ollamaError) {
      console.log('⚠️ Ollama not available, trying llama.cpp...');
      try {
        await safeLlamaCppProvider.initialize();
        llmProvider = safeLlamaCppProvider;
        console.log('✅ llama.cpp initialized successfully');
      } catch (llamaError) {
        console.log('❌ No LLM backend available');
        throw new Error('Neither Ollama nor llama.cpp is available');
      }
    }

    // Initialize MasterOrchestrator
    const masterOrchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.main.baseUrl!,
      rag: ragConfig
    });
    
    const agentRegistry = new AgentRegistry(appConfig.agents);
    const ragSystem = new RAGSystem(ragConfig);

    console.log('📚 Initializing components...');
    await Promise.all([
      masterOrchestrator.initialize(),
      agentRegistry.initialize(),
      ragSystem.initialize()
    ]);

    console.log('✅ All services initialized\n');
    console.log('=' .repeat(60));

    // Test 1: MasterOrchestrator
    console.log('\n🤖 Testing MasterOrchestrator...');
    const orchestratorStart = Date.now();
    try {
      const result = await masterOrchestrator.processQuery({
        text: testQueries.masterOrchestrator,
        conversationId: 'test-session'
      });
      
      const responseTime = Date.now() - orchestratorStart;
      const hasContent = result.summary && result.summary.length > 50;
      const hasSteps = result.results && result.results.length > 0;
      
      results.push({
        agent: 'MasterOrchestrator',
        query: testQueries.masterOrchestrator,
        success: true,
        responseQuality: hasContent && hasSteps ? 8 : 4,
        responseTime,
        hasRelevantContent: hasContent,
        response: result.summary?.substring(0, 200),
        usedRAG: false,
        tokensUsed: result.summary?.split(' ').length
      });
      
      console.log(`✅ Response: ${result.summary?.substring(0, 100)}...`);
      console.log(`   Steps executed: ${result.results?.length || 0}`);
      console.log(`   Time: ${responseTime}ms`);
    } catch (error) {
      results.push({
        agent: 'MasterOrchestrator',
        query: testQueries.masterOrchestrator,
        success: false,
        responseQuality: 0,
        responseTime: Date.now() - orchestratorStart,
        hasRelevantContent: false,
        error: error.message,
        usedRAG: false
      });
      console.log(`❌ Error: ${error.message}`);
    }

    // Test individual agents through registry
    const agentTests = [
      { type: 'ResearchAgent', query: testQueries.research },
      { type: 'DataAnalysisAgent', query: testQueries.dataAnalysis },
      { type: 'CodeAgent', query: testQueries.code },
      { type: 'WriterAgent', query: testQueries.writer },
      { type: 'ToolExecutorAgent', query: testQueries.toolExecutor }
    ];

    for (const test of agentTests) {
      console.log(`\n🤖 Testing ${test.type}...`);
      const startTime = Date.now();
      
      try {
        const agent = await agentRegistry.getAgent(test.type);
        
        // Check if agent has RAG integration
        const ragDocs = await ragSystem.retrieve(test.query, 3);
        const context = {
          query: test.query,
          ragDocuments: ragDocs,
          conversationId: 'test-session'
        };
        
        const result = await agent.execute(test.query, context);
        const responseTime = Date.now() - startTime;
        
        const hasContent = result.output && result.output.length > 20;
        const isRelevant = result.output && 
          result.output.toLowerCase().includes(test.query.split(' ')[0].toLowerCase());
        
        results.push({
          agent: test.type,
          query: test.query,
          success: result.success,
          responseQuality: hasContent && isRelevant ? 7 : 3,
          responseTime,
          hasRelevantContent: hasContent,
          response: result.output?.substring(0, 200),
          usedRAG: ragDocs.length > 0,
          tokensUsed: result.output?.split(' ').length
        });
        
        console.log(`✅ Success: ${result.success}`);
        console.log(`   Response: ${result.output?.substring(0, 100)}...`);
        console.log(`   RAG docs used: ${ragDocs.length}`);
        console.log(`   Time: ${responseTime}ms`);
        
        // Release agent back to pool
        agentRegistry.releaseAgent(test.type, agent);
      } catch (error) {
        results.push({
          agent: test.type,
          query: test.query,
          success: false,
          responseQuality: 0,
          responseTime: Date.now() - startTime,
          hasRelevantContent: false,
          error: error.message,
          usedRAG: false
        });
        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Generate summary report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AGENT SYSTEM TEST REPORT');
    console.log('=' .repeat(60));
    
    const workingAgents = results.filter(r => r.success).length;
    const avgQuality = results.reduce((sum, r) => sum + r.responseQuality, 0) / results.length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    const ragIntegrated = results.filter(r => r.usedRAG).length;
    
    console.log(`\n✅ Working Agents: ${workingAgents}/7`);
    console.log(`📈 Average Response Quality: ${avgQuality.toFixed(1)}/10`);
    console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`🔍 RAG-Integrated Agents: ${ragIntegrated}/${results.length}`);
    console.log(`🖥️ LLM Backend: ${usingOllama ? 'Ollama' : 'llama.cpp'}`);
    
    console.log('\n📋 Individual Agent Results:');
    console.log('-'.repeat(60));
    
    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      const quality = '⭐'.repeat(Math.round(result.responseQuality / 2));
      console.log(`${status} ${result.agent.padEnd(20)} Quality: ${quality} (${result.responseQuality}/10)`);
      console.log(`   Response Time: ${result.responseTime}ms | RAG: ${result.usedRAG ? 'Yes' : 'No'}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    
    // Critical issues found
    console.log('\n⚠️ CRITICAL ISSUES FOUND:');
    console.log('-'.repeat(60));
    
    const issues = [];
    
    if (workingAgents < 5) {
      issues.push(`Only ${workingAgents}/7 agents are functional`);
    }
    
    if (avgQuality < 5) {
      issues.push(`Response quality is poor (${avgQuality.toFixed(1)}/10)`);
    }
    
    if (avgResponseTime > 5000) {
      issues.push(`Response time is too slow (${avgResponseTime.toFixed(0)}ms)`);
    }
    
    if (ragIntegrated < 3) {
      issues.push(`RAG integration is limited (${ragIntegrated} agents)`);
    }
    
    const failedAgents = results.filter(r => !r.success);
    if (failedAgents.length > 0) {
      issues.push(`Failed agents: ${failedAgents.map(a => a.agent).join(', ')}`);
    }
    
    if (issues.length === 0) {
      console.log('✅ No critical issues found!');
    } else {
      issues.forEach(issue => console.log(`• ${issue}`));
    }
    
    // Cleanup
    await agentRegistry.shutdown();
    if (safeLlamaCppProvider.isReady()) {
      await safeLlamaCppProvider.cleanup();
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    return results;
  }
}

// Run the test
testAgentFunctionality()
  .then(results => {
    console.log('\n✅ Test completed');
    process.exit(results.filter(r => r.success).length >= 5 ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });