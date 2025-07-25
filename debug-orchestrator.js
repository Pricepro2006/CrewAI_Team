import { MasterOrchestrator } from "./src/core/master-orchestrator/MasterOrchestrator.js";
import { ChromaVectorStore } from "./src/core/rag/ChromaVectorStore.js";
import { AgentRegistry } from "./src/core/agents/registry/AgentRegistry.js";

async function debugOrchestrator() {
  console.log("🔍 Debugging MasterOrchestrator execution...\n");

  try {
    // Initialize dependencies
    const vectorStore = new ChromaVectorStore({
      collectionName: "crewai-knowledge",
      dimension: 384,
    });

    const agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();

    // Create orchestrator
    const orchestrator = new MasterOrchestrator({
      ollamaUrl: "http://localhost:11434",
      rag: {
        vectorStore: {
          type: "chromadb",
          path: "./data/chroma",
          collectionName: "crewai-knowledge",
          dimension: 384,
        },
        chunking: {
          size: 500,
          overlap: 50,
          method: "sentence",
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: true,
        },
      },
    });

    // Initialize orchestrator
    await orchestrator.initialize(agentRegistry);

    // Test query
    const query = {
      text: "Find irrigation specialists in Spartanburg, SC",
      conversationId: "debug-test-123",
      sessionId: "debug-session",
      userId: "debug-user",
    };

    console.log("📤 Sending query:", query.text);
    console.log("⏰ Starting at:", new Date().toISOString());

    // Hook into the plan executor to log steps
    const originalExecutor = orchestrator.planExecutor;
    orchestrator.planExecutor = {
      execute: async (plan) => {
        console.log("\n📋 Plan to execute:", {
          id: plan.id,
          steps: plan.steps.map((s) => ({
            id: s.id,
            task: s.task,
            agentType: s.agentType,
            requiresTool: s.requiresTool,
            toolName: s.toolName,
          })),
        });

        const result = await originalExecutor.execute(plan);

        console.log("\n📊 Execution result:", {
          success: result.success,
          completedSteps: result.completedSteps,
          failedSteps: result.failedSteps,
          summary: result.summary?.substring(0, 100) + "...",
          results: result.results.map((r) => ({
            stepId: r.stepId,
            success: r.success,
            hasOutput: !!r.output,
            outputLength: r.output?.length || 0,
            error: r.error,
          })),
        });

        return result;
      },
    };

    // Process query
    const result = await orchestrator.processQuery(query);

    console.log("\n✅ Final result:", {
      success: result.success,
      summaryLength: result.summary?.length || 0,
      summaryPreview: result.summary?.substring(0, 200) || "EMPTY",
      metadata: result.metadata,
    });

    console.log("⏰ Finished at:", new Date().toISOString());
  } catch (error) {
    console.error("❌ Debug failed:", error);
  }
}

debugOrchestrator();
