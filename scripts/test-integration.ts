#!/usr/bin/env tsx
/**
 * Integration test script to verify the core system works with real components
 */

import { MasterOrchestrator } from '../src/core/master-orchestrator/MasterOrchestrator';
import { OllamaProvider } from '../src/core/llm/OllamaProvider';
import ollamaConfig from '../src/config/ollama.config';

async function testOllamaConnection() {
  console.log('🔄 Testing Ollama connection...');
  
  try {
    const llm = new OllamaProvider({
      model: 'qwen3:8b',
      baseUrl: ollamaConfig.main.baseUrl
    });

    await llm.initialize();
    const response = await llm.generate('Hello, this is a test message. Please respond with "System operational."');
    
    console.log('✅ Ollama connection successful');
    console.log('📝 Response:', response.substring(0, 100) + (response.length > 100 ? '...' : ''));
    return true;
  } catch (error) {
    console.error('❌ Ollama connection failed:', error);
    return false;
  }
}

async function testMasterOrchestrator() {
  console.log('🔄 Testing MasterOrchestrator...');
  
  try {
    const orchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.main.baseUrl!,
      rag: {
        vectorStore: {
          type: 'chromadb',
          path: './data/chroma-test',
          collectionName: 'test-collection',
          dimension: 384
        },
        chunking: {
          size: 500,
          overlap: 50,
          method: 'sentence'
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: true
        }
      }
    });

    // Test initialization
    await orchestrator.initialize();
    console.log('✅ MasterOrchestrator initialized successfully');

    // Test basic query processing
    const result = await orchestrator.processQuery({
      text: 'What is TypeScript?',
      conversationId: 'test-conversation'
    });

    console.log('✅ Query processing successful');
    console.log('📝 Result:', result.summary.substring(0, 200) + (result.summary.length > 200 ? '...' : ''));
    console.log('📊 Metadata:', result.metadata);

    return true;
  } catch (error) {
    console.error('❌ MasterOrchestrator test failed:', error);
    return false;
  }
}

async function testAgentRegistry() {
  console.log('🔄 Testing Agent Registry...');
  
  try {
    const orchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.main.baseUrl!,
      rag: {
        vectorStore: {
          type: 'chromadb',
          path: './data/chroma-test',
          collectionName: 'test-collection',
          dimension: 384
        },
        chunking: {
          size: 500,
          overlap: 50,
          method: 'sentence'
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: true
        }
      }
    });

    await orchestrator.initialize();

    // Test agent retrieval
    const agent = await orchestrator.agentRegistry.getAgent('ResearchAgent');
    console.log('✅ Agent retrieved:', agent.name);

    // Test agent capabilities
    const capabilities = agent.hasCapability('web_research');
    console.log('✅ Agent capabilities working:', capabilities);

    return true;
  } catch (error) {
    console.error('❌ Agent Registry test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting CrewAI Team Integration Tests\n');

  const results = {
    ollama: await testOllamaConnection(),
    orchestrator: await testMasterOrchestrator(),
    agentRegistry: await testAgentRegistry()
  };

  console.log('\n📊 Test Results:');
  console.log('='.repeat(40));
  
  for (const [test, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  }

  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + '='.repeat(40));
  console.log(`🎯 Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('🎉 System is ready for production use!');
  } else {
    console.log('🔧 Please fix the failing tests before proceeding.');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run the tests
main().catch(console.error);