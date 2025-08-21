#!/usr/bin/env tsx
/**
 * Test script for Knowledge-Backed LLM integration
 * Tests both direct generation and RAG-enhanced generation
 */

import { KnowledgeBackedLLM, createKnowledgeBackedLLM } from '../src/core/llm/KnowledgeBackedLLM.js';
import { RAGSystem } from '../src/core/rag/RAGSystem.js';
import { LLMProviderFactory } from '../src/core/llm/LLMProviderFactory.js';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const TEST_MODELS = {
  mistral: '/home/pricepro2006/CrewAI_Team/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
  llama: '/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
};

async function testDirectGeneration() {
  console.log('\n📝 Testing Direct Generation (without RAG)...\n');
  
  try {
    // Check if model exists
    const modelPath = TEST_MODELS.mistral;
    const fallbackPath = TEST_MODELS.llama;
    
    let actualModelPath = modelPath;
    if (!fs.existsSync(modelPath)) {
      console.log(`⚠️ Primary model not found at ${modelPath}`);
      if (fs.existsSync(fallbackPath)) {
        console.log(`✅ Using fallback model at ${fallbackPath}`);
        actualModelPath = fallbackPath;
      } else {
        console.log(`❌ No models found. Please run: ./scripts/download-models.sh`);
        return false;
      }
    }

    // Create LLM without RAG
    const llm = new KnowledgeBackedLLM({
      modelPath: actualModelPath,
      fallbackModelPath: fallbackPath,
      contextSize: 4096,
      threads: 8,
      temperature: 0.7,
      ragConfig: {
        enabled: false,
      },
    });

    await llm.initialize();
    console.log('✅ LLM initialized successfully');

    // Test generation
    const prompt = "What are the key components of a RAG (Retrieval-Augmented Generation) system?";
    console.log(`\n📌 Prompt: ${prompt}`);
    
    const response = await llm.generateWithContext(prompt, {
      maxTokens: 512,
      temperature: 0.7,
    });

    console.log(`\n🤖 Response:\n${response.response}`);
    console.log(`\n📊 Metadata:`, response.metadata);

    // Cleanup
    await llm.cleanup();
    console.log('✅ Direct generation test completed');
    return true;
  } catch (error) {
    console.error('❌ Direct generation test failed:', error);
    return false;
  }
}

async function testRAGEnhancedGeneration() {
  console.log('\n🔍 Testing RAG-Enhanced Generation...\n');
  
  try {
    // Initialize RAG system
    const ragConfig = {
      vectorStore: {
        type: 'adaptive' as const,
        baseUrl: 'http://localhost:8001',
        collectionName: 'test-knowledge-base',
      },
      chunking: {
        chunkSize: 500,
        chunkOverlap: 50,
      },
      retrieval: {
        topK: 3,
        minScore: 0.5,
      },
    };

    const ragSystem = new RAGSystem(ragConfig);
    
    // Try to initialize RAG (will fallback to in-memory if ChromaDB unavailable)
    try {
      await ragSystem.initialize();
      console.log('✅ RAG system initialized');
    } catch (error) {
      console.log('⚠️ RAG initialization failed, continuing without it');
    }

    // Add some test documents to knowledge base
    const testDocuments = [
      {
        content: `CrewAI Team is an enterprise AI agent framework with adaptive email analysis.
        It uses a three-phase processing pipeline: Rule-based extraction, Llama 3.2 analysis, and Phi-4 for critical emails.
        The system can process 60+ emails per minute and maintains a knowledge base for context-aware responses.`,
        metadata: { source: 'system-overview', type: 'documentation' },
      },
      {
        content: `The email pipeline supports three operational modes:
        1. Manual Load Mode - Batch import from JSON files or databases
        2. Auto-Pull Mode - Scheduled pulling from Microsoft Graph/Gmail APIs  
        3. Hybrid Mode - Concurrent manual and auto operations
        Each mode is optimized for different use cases and workloads.`,
        metadata: { source: 'email-pipeline', type: 'architecture' },
      },
      {
        content: `Business Intelligence features include:
        - Revenue extraction from emails ($1M+ identified)
        - Action item identification and tracking
        - Risk assessment and opportunity detection
        - Strategic insights extraction
        - Pattern recognition across email chains`,
        metadata: { source: 'business-intelligence', type: 'features' },
      },
    ];

    // Add documents to RAG system
    for (const doc of testDocuments) {
      await ragSystem.addDocument(doc.content, doc.metadata);
    }
    console.log(`✅ Added ${testDocuments.length} documents to knowledge base`);

    // Create Knowledge-Backed LLM with RAG
    const modelPath = TEST_MODELS.mistral;
    const fallbackPath = TEST_MODELS.llama;
    
    let actualModelPath = modelPath;
    if (!fs.existsSync(modelPath)) {
      if (fs.existsSync(fallbackPath)) {
        actualModelPath = fallbackPath;
      } else {
        console.log(`❌ No models found. Please run: ./scripts/download-models.sh`);
        return false;
      }
    }

    const llm = new KnowledgeBackedLLM(
      {
        modelPath: actualModelPath,
        fallbackModelPath: fallbackPath,
        contextSize: 8192,
        threads: 8,
        temperature: 0.7,
        ragConfig: {
          enabled: true,
          topK: 3,
          minScore: 0.3,
        },
      },
      ragSystem
    );

    await llm.initialize();
    console.log('✅ Knowledge-Backed LLM initialized with RAG');

    // Test RAG-enhanced generation
    const queries = [
      "What are the three phases of email processing in CrewAI?",
      "How much revenue has been identified through business intelligence?",
      "What operational modes does the email pipeline support?",
    ];

    for (const query of queries) {
      console.log(`\n📌 Query: ${query}`);
      
      const response = await llm.generateWithContext(query, {
        maxTokens: 512,
        temperature: 0.5,
        useRAG: true,
      });

      console.log(`\n🤖 Response:\n${response.response}`);
      
      if (response.context && response.context.length > 0) {
        console.log(`\n📚 Context used (${response.context.length} documents):`);
        response.context.forEach((doc, idx) => {
          console.log(`  ${idx + 1}. Score: ${doc.score?.toFixed(3)} | Source: ${doc.metadata?.source}`);
        });
      }
    }

    // Cleanup
    await llm.cleanup();
    console.log('\n✅ RAG-enhanced generation test completed');
    return true;
  } catch (error) {
    console.error('❌ RAG-enhanced generation test failed:', error);
    return false;
  }
}

async function testLLMProviderFactory() {
  console.log('\n🏭 Testing LLMProviderFactory Integration...\n');
  
  try {
    // Get default configuration
    const config = LLMProviderFactory.getDefaultConfig();
    console.log('📋 Default configuration loaded');

    // Create provider using factory
    const provider = await LLMProviderFactory.createProvider({
      ...config,
      type: 'knowledge-backed',
    });

    console.log('✅ Provider created via factory');

    // Test generation through factory interface
    const prompt = "Explain the benefits of using a factory pattern for LLM providers.";
    const response = await provider.generate(prompt, {
      maxTokens: 256,
      temperature: 0.7,
    });

    console.log(`\n📌 Prompt: ${prompt}`);
    console.log(`\n🤖 Response:\n${response.response}`);

    console.log('✅ Factory integration test completed');
    return true;
  } catch (error) {
    console.error('❌ Factory integration test failed:', error);
    return false;
  }
}

async function testStreamGeneration() {
  console.log('\n🌊 Testing Stream Generation...\n');
  
  try {
    const modelPath = TEST_MODELS.mistral;
    const fallbackPath = TEST_MODELS.llama;
    
    let actualModelPath = modelPath;
    if (!fs.existsSync(modelPath)) {
      if (fs.existsSync(fallbackPath)) {
        actualModelPath = fallbackPath;
      } else {
        console.log(`❌ No models found. Please run: ./scripts/download-models.sh`);
        return false;
      }
    }

    const llm = new KnowledgeBackedLLM({
      modelPath: actualModelPath,
      fallbackModelPath: fallbackPath,
      contextSize: 4096,
      threads: 8,
    });

    await llm.initialize();

    const prompt = "Write a short story about an AI assistant helping developers.";
    console.log(`📌 Prompt: ${prompt}\n`);
    console.log('🤖 Streaming response:\n');

    // Stream the response
    for await (const chunk of llm.streamGenerateWithContext(prompt, {
      maxTokens: 256,
      temperature: 0.8,
    })) {
      process.stdout.write(chunk);
    }

    console.log('\n\n✅ Stream generation test completed');
    await llm.cleanup();
    return true;
  } catch (error) {
    console.error('❌ Stream generation test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Knowledge-Backed LLM Test Suite\n');
  console.log('=' .repeat(50));
  
  let allTestsPassed = true;

  // Check if models exist
  const modelsExist = fs.existsSync(TEST_MODELS.mistral) || fs.existsSync(TEST_MODELS.llama);
  if (!modelsExist) {
    console.log('\n⚠️ No models found. Downloading models...\n');
    console.log('Please run: ./scripts/download-models.sh');
    console.log('\nAlternatively, you can download manually:');
    console.log('1. Mistral 7B: https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF');
    console.log('2. Llama 3.2: https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF');
    console.log(`\nPlace the .gguf files in: ${path.dirname(TEST_MODELS.mistral)}`);
    process.exit(1);
  }

  // Run tests
  const tests = [
    { name: 'Direct Generation', fn: testDirectGeneration },
    { name: 'Stream Generation', fn: testStreamGeneration },
    { name: 'RAG-Enhanced Generation', fn: testRAGEnhancedGeneration },
    { name: 'LLMProviderFactory Integration', fn: testLLMProviderFactory },
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(50)}`);
    const success = await test.fn();
    if (!success) {
      allTestsPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('✅ All tests passed successfully!');
  } else {
    console.log('⚠️ Some tests failed. Please check the output above.');
  }
  console.log('=' .repeat(50));
}

// Run tests
main().catch(console.error);