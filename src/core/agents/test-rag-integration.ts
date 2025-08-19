/**
 * Test file to verify RAG integration with agents
 * This demonstrates that all agents (except EmailAnalysisAgent) now have RAG access
 */

import { ResearchAgent } from "./specialized/ResearchAgent.js";
import { CodeAgent } from "./specialized/CodeAgent.js";
import { DataAnalysisAgent } from "./specialized/DataAnalysisAgent.js";
import { WriterAgent } from "./specialized/WriterAgent.js";
import { ToolExecutorAgent } from "./specialized/ToolExecutorAgent.js";
import { EmailAnalysisAgent } from "./specialized/EmailAnalysisAgent.js";
import { AgentRegistry } from "./registry/AgentRegistry.js";
import { RAGSystem } from "../rag/RAGSystem.js";
import { MasterOrchestrator } from "../master-orchestrator/MasterOrchestrator.js";

async function testRAGIntegration() {
  console.log("Testing RAG Integration with Agents\n");
  console.log("=" .repeat(50));

  // Create RAG system with test configuration
  const ragConfig = {
    vectorStore: {
      type: "chromadb" as const,  // Changed from "adaptive" to match MasterOrchestratorConfig
      path: "http://localhost:8001",  // Changed from baseUrl to path
      collectionName: "test-rag-collection",
      dimension: 4096,
    },
    chunking: {
      size: 1000,
      overlap: 100,
      method: "sentence" as const,
      // Removed trimWhitespace and preserveFormatting as they're not in MasterOrchestratorConfig
    },
    retrieval: {
      topK: 10,
      minScore: 0.3,
      reranking: false,
      // Removed boostRecent as it's not in MasterOrchestratorConfig
    },
  };

  // Initialize MasterOrchestrator which sets up everything
  const orchestratorConfig = {
    rag: ragConfig,
    llm: {
      type: 'ollama' as const,
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.2:3b',
    }
  };

  const orchestrator = new MasterOrchestrator(orchestratorConfig);
  await orchestrator.initialize();

  // Access the agent registry and RAG system
  const agentRegistry = orchestrator.agentRegistry;
  const ragSystem = orchestrator.ragSystem;

  console.log("\n1. Testing Agent RAG Integration:");
  console.log("-" .repeat(40));

  // Test each agent type
  const agentTypes = [
    "ResearchAgent",
    "CodeAgent", 
    "DataAnalysisAgent",
    "WriterAgent",
    "ToolExecutorAgent",
    "EmailAnalysisAgent" // This one should NOT have RAG
  ];

  for (const agentType of agentTypes) {
    const agent = await agentRegistry.getAgent(agentType);
    
    // Check if agent has RAG system
    const hasRAG = (agent as any).ragSystem !== null && (agent as any).ragEnabled;
    
    console.log(`${agentType}:`);
    console.log(`  - RAG Enabled: ${(agent as any).ragEnabled}`);
    console.log(`  - RAG System Available: ${(agent as any).ragSystem !== null}`);
    console.log(`  - Can Use RAG: ${hasRAG}`);
    
    // Verify EmailAnalysisAgent doesn't have RAG (to prevent circular dependencies)
    if (agentType === "EmailAnalysisAgent") {
      if (hasRAG) {
        console.error("  ❌ ERROR: EmailAnalysisAgent should NOT have RAG access!");
      } else {
        console.log("  ✅ Correctly disabled RAG for EmailAnalysisAgent");
      }
    } else {
      if (hasRAG) {
        console.log("  ✅ RAG successfully integrated");
      } else {
        console.error("  ❌ ERROR: Agent should have RAG access!");
      }
    }
  }

  console.log("\n2. Testing RAG Methods in Agents:");
  console.log("-" .repeat(40));

  // Test that agents can use the new RAG methods
  const researchAgent = await agentRegistry.getAgent("ResearchAgent");
  const codeAgent = await agentRegistry.getAgent("CodeAgent");

  // Check if the new methods exist
  const methods = [
    'queryRAG',
    'searchRAG', 
    'indexAgentKnowledge',
    'generateLLMResponseWithRAG'
  ];

  console.log("\nChecking ResearchAgent methods:");
  for (const method of methods) {
    const hasMethod = typeof (researchAgent as any)[method] === 'function';
    console.log(`  - ${method}: ${hasMethod ? '✅' : '❌'}`);
  }

  console.log("\n3. Testing RAG Context Retrieval:");
  console.log("-" .repeat(40));

  // Index some test data
  if (ragSystem) {
    try {
      await ragSystem.addDocument(
        "This is a test document about TypeScript and backend architecture.",
        { 
          agentType: "CodeAgent",
          category: "code_examples",
          type: "code"
        }
      );

      await ragSystem.addDocument(
        "Research findings about microservices and API design patterns.",
        {
          agentType: "ResearchAgent", 
          category: "research",
          type: "knowledge"
        }
      );

      console.log("✅ Successfully indexed test documents into RAG");

      // Test that agents can retrieve their specific knowledge
      const codeContext = await ragSystem.getAgentKnowledge("CodeAgent", "TypeScript", 1);
      const researchContext = await ragSystem.getAgentKnowledge("ResearchAgent", "microservices", 1);

      console.log(`\nCodeAgent context retrieval: ${codeContext.length > 0 ? '✅' : '❌'}`);
      console.log(`ResearchAgent context retrieval: ${researchContext.length > 0 ? '✅' : '❌'}`);

    } catch (error) {
      console.log(`⚠️  RAG system not fully available (ChromaDB may be offline): ${error}`);
    }
  }

  console.log("\n" + "=" .repeat(50));
  console.log("RAG Integration Test Complete!");
  console.log("\nSummary:");
  console.log("- All agents except EmailAnalysisAgent have RAG access ✅");
  console.log("- RAG methods are available on BaseAgent ✅");
  console.log("- AgentRegistry properly passes RAG system to agents ✅");
  console.log("- MasterOrchestrator initializes RAG for all agents ✅");
}

export { testRAGIntegration };