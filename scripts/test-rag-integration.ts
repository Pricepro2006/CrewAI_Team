#!/usr/bin/env tsx

import { RAGSystem } from "../src/core/rag/RAGSystem.js";
import { MasterOrchestrator } from "../src/core/master-orchestrator/MasterOrchestrator.js";
import type { RAGConfig } from "../src/core/rag/types.js";
import { logger } from "../src/utils/logger.js";

class RAGIntegrationTester {
  private ragSystem: RAGSystem;
  private orchestrator: MasterOrchestrator | null = null;

  constructor() {
    const config: RAGConfig = {
      vectorStore: {
        type: "chromadb",
        baseUrl: "http://localhost:8000",
        collectionName: "master_knowledge_base",
        dimension: 768,
      },
      chunking: {
        size: 1000,
        overlap: 200,
        method: "sentence",
        trimWhitespace: true,
        preserveFormatting: true,
      },
      retrieval: {
        topK: 5,
        minScore: 0.7,
        reranking: true,
        diversityFactor: 0.3,
        boostRecent: true,
      },
    };

    this.ragSystem = new RAGSystem(config);
  }

  async initialize(): Promise<void> {
    logger.info("Initializing RAG Integration Test...", "TEST");
    
    try {
      await this.ragSystem.initialize();
      logger.info("RAG System initialized successfully", "TEST");
      
      // Initialize MasterOrchestrator with RAG
      this.orchestrator = new MasterOrchestrator({
        llm: {
          type: "auto",
        },
        rag: {
          vectorStore: {
            type: "chromadb",
            baseUrl: "http://localhost:8000",
            collectionName: "master_knowledge_base",
            dimension: 768,
          },
          chunking: {
            size: 1000,
            overlap: 200,
            method: "sentence",
          },
          retrieval: {
            topK: 5,
            minScore: 0.7,
            reranking: true,
          },
        },
      });
      
      await this.orchestrator.initialize();
      logger.info("MasterOrchestrator initialized with RAG", "TEST");
      
    } catch (error) {
      logger.error(
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "TEST"
      );
      throw error;
    }
  }

  async testBasicRetrieval(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("TEST: Basic Retrieval");
    console.log("=".repeat(60));

    const queries = [
      "How does the CrewAI agent architecture work?",
      "What is ChromaDB and how to integrate it?",
      "TypeScript best practices for agent development",
      "Email pipeline processing workflow",
      "RAG system implementation details",
    ];

    for (const query of queries) {
      console.log(`\nQuery: "${query}"`);
      console.log("-".repeat(40));
      
      try {
        const results = await this.ragSystem.search(query, 3);
        
        if (results.length > 0) {
          console.log(`Found ${results.length} results:`);
          results.forEach((result, index) => {
            console.log(`\n${index + 1}. Score: ${result.score.toFixed(3)}`);
            console.log(`   Source: ${result.metadata?.fileName || 'Unknown'}`);
            console.log(`   Category: ${result.metadata?.category || 'Unknown'}`);
            console.log(`   Preview: ${result.content.substring(0, 150)}...`);
          });
        } else {
          console.log("No results found");
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async testContextGeneration(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("TEST: Context Generation for LLM");
    console.log("=".repeat(60));

    const testCases = [
      {
        query: "Explain the email processing pipeline",
        filter: undefined,
      },
      {
        query: "What are the TypeScript configuration best practices?",
        filter: { category: "agents" },
      },
      {
        query: "How to implement WebSocket real-time updates?",
        filter: undefined,
      },
    ];

    for (const testCase of testCases) {
      console.log(`\nQuery: "${testCase.query}"`);
      if (testCase.filter) {
        console.log(`Filter: ${JSON.stringify(testCase.filter)}`);
      }
      console.log("-".repeat(40));

      try {
        const context = await this.ragSystem.getContextForPrompt(
          testCase.query,
          {
            limit: 3,
            filter: testCase.filter,
            includeMetadata: true,
            formatForLLM: true,
          }
        );

        if (context) {
          console.log("Generated Context:");
          console.log(context.substring(0, 500) + "...");
        } else {
          console.log("No context generated");
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async testAgentKnowledge(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("TEST: Agent-Specific Knowledge");
    console.log("=".repeat(60));

    // Index some test agent knowledge
    const testAgentId = "test-agent-001";
    const testDocuments = [
      {
        content: "Test Agent specializes in email analysis and processing. It uses advanced NLP techniques to extract entities and understand email context.",
        metadata: {
          title: "Test Agent Overview",
          type: "documentation",
        },
      },
      {
        content: "The Test Agent can process up to 100 emails per minute using parallel processing and efficient chunking strategies.",
        metadata: {
          title: "Test Agent Performance",
          type: "specification",
        },
      },
    ];

    try {
      // Index agent knowledge
      console.log(`\nIndexing knowledge for agent: ${testAgentId}`);
      await this.ragSystem.indexAgentKnowledge(testAgentId, testDocuments);
      console.log("Agent knowledge indexed successfully");

      // Search agent-specific knowledge
      console.log("\nSearching agent-specific knowledge...");
      const results = await this.ragSystem.getAgentKnowledge(
        testAgentId,
        "email processing performance",
        2
      );

      if (results.length > 0) {
        console.log(`Found ${results.length} agent-specific results:`);
        results.forEach((result, index) => {
          console.log(`\n${index + 1}. Score: ${result.score.toFixed(3)}`);
          console.log(`   Content: ${result.content}`);
        });
      } else {
        console.log("No agent-specific results found");
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testOrchestratorIntegration(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("TEST: MasterOrchestrator RAG Integration");
    console.log("=".repeat(60));

    if (!this.orchestrator) {
      console.log("Orchestrator not initialized, skipping test");
      return;
    }

    const queries = [
      "What agents are available in the system?",
      "How does the email processing work?",
      "Explain the CrewAI architecture",
    ];

    for (const query of queries) {
      console.log(`\nProcessing query through orchestrator: "${query}"`);
      console.log("-".repeat(40));

      try {
        // The orchestrator should use RAG context internally
        const result = await this.orchestrator.processQuery({
          text: query,
          sessionId: "test-session",
          userId: "test-user",
          metadata: {},
        });

        console.log("Orchestrator Result:");
        console.log(`Success: ${result.success}`);
        if (result.plan) {
          console.log(`Plan Steps: ${result.plan.steps.length}`);
        }
        if (result.results && result.results.length > 0) {
          console.log(`Results: ${JSON.stringify(result.results[0], null, 2).substring(0, 300)}...`);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async testHealthCheck(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("TEST: System Health Check");
    console.log("=".repeat(60));

    try {
      const health = await this.ragSystem.getHealthStatus();
      
      console.log("\nRAG System Health:");
      console.log(`  Overall Status: ${health.status}`);
      console.log(`  Vector Store: ${health.vectorStore.status} (${health.vectorStore.type})`);
      console.log(`  Fallback Mode: ${health.vectorStore.fallbackUsed ? 'Active' : 'Inactive'}`);
      console.log(`  Embedding Service: ${health.embeddingService.status}`);
      
      const stats = await this.ragSystem.getStats();
      console.log("\nRAG System Statistics:");
      console.log(`  Total Documents: ${stats.totalDocuments}`);
      console.log(`  Total Chunks: ${stats.totalChunks}`);
      console.log(`  Collections: ${stats.collections.join(', ') || 'None'}`);
      console.log(`  Vector Store Type: ${stats.vectorStoreType}`);
      console.log(`  Embedding Model: ${stats.embeddingModel}`);
      
    } catch (error) {
      console.error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async runAllTests(): Promise<void> {
    logger.info("Starting RAG Integration Tests", "TEST");
    
    try {
      await this.initialize();
      await this.testHealthCheck();
      await this.testBasicRetrieval();
      await this.testContextGeneration();
      await this.testAgentKnowledge();
      await this.testOrchestratorIntegration();
      
      console.log("\n" + "=".repeat(60));
      console.log("ALL TESTS COMPLETED");
      console.log("=".repeat(60));
      
    } catch (error) {
      logger.error(
        `Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "TEST"
      );
      throw error;
    }
  }
}

// Main execution
async function main() {
  const tester = new RAGIntegrationTester();
  
  try {
    await tester.runAllTests();
    logger.info("RAG Integration tests completed successfully!", "TEST");
    process.exit(0);
  } catch (error) {
    logger.error(
      `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      "TEST"
    );
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info("Tests interrupted by user", "TEST");
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, "TEST");
  process.exit(1);
});

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to run tests:", error);
    process.exit(1);
  });
}

export { RAGIntegrationTester };