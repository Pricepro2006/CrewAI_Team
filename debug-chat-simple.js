import { chatRouter } from "./src/api/routes/chat.router.js";

async function debugChat() {
  console.log("🔍 Testing chat router directly...\n");

  const mockCtx = {
    sessionId: "test-session",
    userId: "test-user",
  };

  const input = {
    message: "Find irrigation specialists in Spartanburg, SC",
    conversationId: null,
  };

  console.log("📤 Input:", input);
  console.log("⏰ Start:", new Date().toISOString());

  try {
    // Call the create mutation directly
    const result = await chatRouter.create.resolve({
      ctx: mockCtx,
      input,
      type: "mutation",
    });

    console.log("\n✅ Result:", {
      conversationId: result.conversationId,
      responseLength: result.response?.length || 0,
      responsePreview: result.response?.substring(0, 200) || "EMPTY",
      agentName: result.agentName,
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }

  console.log("⏰ End:", new Date().toISOString());
}

debugChat();
