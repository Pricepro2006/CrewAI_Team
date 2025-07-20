import { MasterOrchestrator } from "../core/master-orchestrator/MasterOrchestrator";
import config from "../config/app.config";

async function testOrchestratorConnection() {
  console.log("Testing MasterOrchestrator connection to Ollama...\n");

  try {
    // Create orchestrator instance
    const orchestrator = new MasterOrchestrator({
      ollamaUrl: config.ollama?.url || "http://localhost:11434",
      rag: {
        vectorStore: {
          type: "chromadb" as const,
          path: "./data/vectordb",
          collectionName: "test-collection",
          dimension: 384,
        },
        chunking: {
          size: 1000,
          overlap: 200,
          method: "sentence" as const,
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: false,
        },
      },
    });

    // Test initialization
    console.log("1. Initializing MasterOrchestrator...");
    await orchestrator.initialize();
    console.log("✅ Initialization successful!\n");

    // Test basic query processing
    console.log("2. Testing query processing...");
    const testQuery = {
      id: "test-1",
      text: "What is the weather like today?",
      context: {},
      timestamp: new Date(),
    };

    const result = await orchestrator.processQuery(testQuery);
    console.log("✅ Query processed successfully!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the test
testOrchestratorConnection()
  .then(() => {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
