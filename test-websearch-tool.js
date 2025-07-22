import { WebSearchTool } from "./src/core/tools/web/WebSearchTool.js";

async function testWebSearchTool() {
  console.log("🔍 Testing WebSearchTool directly...");

  try {
    const tool = new WebSearchTool();
    console.log(`✅ Tool created: ${tool.name}`);
    console.log(`📝 Description: ${tool.description}`);

    // Test basic search
    console.log("🚀 Testing search execution...");
    const result = await tool.execute({
      query: "irrigation specialists Spartanburg SC",
      limit: 3,
    });

    console.log("📊 Result:", {
      success: result.success,
      hasData: !!result.data,
      resultCount: result.data?.results?.length || 0,
      error: result.error,
    });

    if (result.error) {
      console.error("❌ Error:", result.error);
    }

    if (result.data?.results) {
      console.log("🔗 First result:", {
        title: result.data.results[0]?.title?.substring(0, 50),
        url: result.data.results[0]?.url,
      });
    }
  } catch (error) {
    console.error("💥 Test failed:", error.message);
    console.error(error.stack);
  }
}

testWebSearchTool();
