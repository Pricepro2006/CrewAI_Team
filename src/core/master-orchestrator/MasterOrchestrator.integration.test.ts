import { describe, it, expect, beforeEach } from "vitest";
import { MasterOrchestrator } from "./MasterOrchestrator";
import { createTestDatabase } from "../../test/utils/test-helpers";
import {
  isOllamaRunning,
  skipIfNoOllama,
  generateWithTimeout,
} from "../../test/utils/ollama-test-helper";
import type { Plan } from "./types";

describe("MasterOrchestrator Integration Tests", () => {
  let orchestrator: MasterOrchestrator;
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeEach(async () => {
    // Skip if Ollama not available
    const skip = await skipIfNoOllama().skip();
    if (skip) {
      console.log("Skipping integration tests:", skipIfNoOllama().reason);
      return;
    }

    testDb = createTestDatabase();
    orchestrator = new MasterOrchestrator({
      model: "phi3:mini", // Use smallest available model for tests
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      database: testDb,
    });

    await orchestrator.initialize();
  });

  describe("Real Ollama Integration", () => {
    it("should verify Ollama is accessible", async () => {
      const running = await isOllamaRunning(process.env.OLLAMA_URL);
      expect(running).toBe(true);
    });

    it("should initialize with real Ollama connection", async () => {
      // Test that the LLM provider is properly initialized
      const provider = orchestrator["llmProvider"];
      expect(provider).toBeDefined();

      // Test a simple generation to verify connection
      const response = await generateWithTimeout(
        provider,
        'Say "test successful" and nothing else.',
        10000,
      );

      expect(response.toLowerCase()).toContain("test");
      expect(response.toLowerCase()).toContain("successful");
    });

    it("should create a real plan from user input", async () => {
      const userInput = "Write a simple greeting message";
      const context = { conversationId: "test-conv-1" };

      const plan = await orchestrator["createPlan"](userInput, context);

      // Verify plan structure
      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^plan-/);
      expect(plan.goal).toBe(userInput);
      expect(plan.tasks).toBeInstanceOf(Array);
      expect(plan.tasks.length).toBeGreaterThan(0);

      // Verify task structure
      const firstTask = plan.tasks[0];
      expect(firstTask).toHaveProperty("id");
      expect(firstTask).toHaveProperty("type");
      expect(firstTask).toHaveProperty("description");
      expect(firstTask).toHaveProperty("agentType");
      expect(firstTask.status).toBe("pending");
    });

    it("should handle simple research queries", async () => {
      const query = "What is TypeScript?";
      const conversationId = "test-conv-2";

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();
      expect(response.message.length).toBeGreaterThan(0);
      expect(response.plan).toBeDefined();

      // Should create a research-focused plan
      const researchTasks = response.plan.tasks.filter(
        (t) => t.type === "research" || t.agentType === "research",
      );
      expect(researchTasks.length).toBeGreaterThan(0);
    });

    it("should handle code generation requests", async () => {
      const query = "Write a function to add two numbers";
      const conversationId = "test-conv-3";

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();

      // Should create a code-focused plan
      const codeTasks = response.plan.tasks.filter(
        (t) => t.type === "code-generation" || t.agentType === "code",
      );
      expect(codeTasks.length).toBeGreaterThan(0);
    });

    it("should execute a complete plan with real agents", async () => {
      const query = "Generate a random number between 1 and 10";
      const conversationId = "test-conv-4";

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      expect(response.success).toBe(true);
      expect(response.plan.status).toBe("completed");

      // Verify all tasks completed
      const completedTasks = response.plan.tasks.filter(
        (t) => t.status === "completed",
      );
      expect(completedTasks.length).toBe(response.plan.tasks.length);

      // Verify output contains a number
      expect(response.message).toMatch(/\d+/);
    });

    it("should handle multi-step plans", async () => {
      const query = "First calculate 5+3, then multiply the result by 2";
      const conversationId = "test-conv-5";

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      expect(response.success).toBe(true);
      expect(response.plan.tasks.length).toBeGreaterThanOrEqual(2);

      // Verify dependency chain
      const hasDependencies = response.plan.tasks.some(
        (t) => t.dependencies.length > 0,
      );
      expect(hasDependencies).toBe(true);

      // Verify correct result (5+3)*2 = 16
      expect(response.message).toContain("16");
    });

    it("should persist conversation history", async () => {
      const conversationId = "test-conv-6";

      // First query
      const response1 = await orchestrator.processUserQuery(
        "Remember the number 42",
        conversationId,
      );
      expect(response1.success).toBe(true);

      // Second query referencing first
      const response2 = await orchestrator.processUserQuery(
        "What number did I ask you to remember?",
        conversationId,
      );
      expect(response2.success).toBe(true);
      expect(response2.message).toContain("42");
    });

    it("should handle errors gracefully", async () => {
      const query = "Parse this invalid JSON: {invalid json}";
      const conversationId = "test-conv-7";

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      // Should still return a response even if task fails
      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();

      // Should acknowledge the error in response
      const containsErrorInfo =
        response.message.toLowerCase().includes("error") ||
        response.message.toLowerCase().includes("invalid") ||
        response.message.toLowerCase().includes("parse");
      expect(containsErrorInfo).toBe(true);
    });

    it("should respect context window limits", async () => {
      const conversationId = "test-conv-8";

      // Generate a very long query
      const longText = "Lorem ipsum ".repeat(1000);
      const query = `Summarize this text: ${longText}`;

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();

      // Should produce a summary much shorter than input
      expect(response.message.length).toBeLessThan(longText.length / 10);
    });

    it("should handle concurrent requests", async () => {
      // Launch multiple queries concurrently
      const queries = [
        orchestrator.processUserQuery("Calculate 2+2", "test-conv-9"),
        orchestrator.processUserQuery("Calculate 3+3", "test-conv-10"),
        orchestrator.processUserQuery("Calculate 4+4", "test-conv-11"),
      ];

      const responses = await Promise.all(queries);

      // All should succeed
      responses.forEach((response) => {
        expect(response.success).toBe(true);
        expect(response.message).toBeDefined();
      });

      // Verify correct results
      expect(responses[0].message).toContain("4");
      expect(responses[1].message).toContain("6");
      expect(responses[2].message).toContain("8");
    });
  });

  describe("Plan Review and Replanning", () => {
    it("should handle plan review with real LLM", async () => {
      // Create a plan that might need revision
      const query = "Research TypeScript and write a tutorial";
      const conversationId = "test-conv-12";

      const response = await orchestrator.processUserQuery(
        query,
        conversationId,
      );

      expect(response.success).toBe(true);

      // Check if replanning occurred
      if (response.metadata?.replanCount) {
        expect(response.metadata.replanCount).toBeGreaterThanOrEqual(0);
        expect(response.metadata.replanCount).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("Database Integration", () => {
    it("should save conversation to database", async () => {
      const conversationId = "test-conv-13";
      const query = "Hello, test message";

      await orchestrator.processUserQuery(query, conversationId);

      // Verify conversation saved
      const conversation = testDb
        .prepare("SELECT * FROM conversations WHERE id = ?")
        .get(conversationId);

      expect(conversation).toBeDefined();
      expect(conversation.id).toBe(conversationId);

      // Verify message saved
      const messages = testDb
        .prepare("SELECT * FROM messages WHERE conversation_id = ?")
        .all(conversationId);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.content === query)).toBe(true);
    });
  });
});
