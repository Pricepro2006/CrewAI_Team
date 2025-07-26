import { ResearchAgent } from "./src/core/agents/specialized/ResearchAgent.js";

async function testResearchAgent() {
  console.log("🧪 Testing ResearchAgent directly...");

  try {
    // Create and initialize agent
    const agent = new ResearchAgent();
    await agent.initialize();

    console.log(`✅ Agent initialized with ${agent.getTools().length} tools`);
    console.log(
      `🔧 Tools: ${agent
        .getTools()
        .map((t) => t.name)
        .join(", ")}`,
    );

    // Test basic execution
    const context = {
      conversationId: "test-123",
      sessionId: "test-session",
      userId: "test-user",
      ragDocuments: [],
    };

    console.log("🚀 Testing agent execution...");
    const result = await agent.execute(
      "Find irrigation specialists in Spartanburg, SC",
      context,
    );

    console.log("📊 Result:", {
      success: result.success,
      hasOutput: !!result.output,
      outputLength: result.output?.length || 0,
      hasData: !!result.data,
      error: result.error,
    });

    if (result.error) {
      console.error("❌ Error:", result.error);
    }

    if (result.output) {
      console.log(
        "📝 Output preview:",
        result.output.substring(0, 200) + "...",
      );
    }
  } catch (error) {
    console.error("💥 Test failed:", error.message);
    console.error(error.stack);
  }
}

testResearchAgent();
