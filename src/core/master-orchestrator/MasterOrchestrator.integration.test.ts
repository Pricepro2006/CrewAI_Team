import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { MasterOrchestrator } from "./MasterOrchestrator.js";
import { createTestDatabase } from "../../test/utils/test-helpers.js";
import {
  isOllamaRunning,
  skipIfNoOllama,
  generateWithTimeout,
  setupOllamaForTesting,
  cleanupOllamaTests,
  getTestModel,
  createTestOllamaConfig,
  ensureModelAvailable,
} from "../../test/utils/ollama-test-helper.js";
import type { Plan } from "./types.js";

describe("MasterOrchestrator Integration Tests", () => {
  let orchestrator: MasterOrchestrator;
  let testDb: ReturnType<typeof createTestDatabase>;
  let isOllamaAvailable = false;

  beforeAll(async () => {
    // Setup real Ollama instance for testing
    try {
      await setupOllamaForTesting();
      isOllamaAvailable = await isOllamaRunning();
      
      if (isOllamaAvailable) {
        // Ensure the test model is available
        const testModel = getTestModel();
        const modelAvailable = await ensureModelAvailable(testModel);
        if (!modelAvailable) {
          console.warn(`Test model ${testModel} not available, some tests may fail`);
        }
      }
    } catch (error) {
      console.error("Failed to setup Ollama for testing:", error);
      isOllamaAvailable = false;
    }
  });

  afterAll(async () => {
    // Cleanup Ollama test environment
    await cleanupOllamaTests();
  });

  beforeEach(async () => {
    if (!isOllamaAvailable) {
      console.log("Skipping test: Ollama not available");
      return;
    }

    const testConfig = createTestOllamaConfig();
    testDb = createTestDatabase();
    
    orchestrator = new MasterOrchestrator({
      model: testConfig.model,
      ollamaUrl: testConfig.baseUrl,
      database: testDb,
      rag: {
        vectorStore: {
          type: "chromadb" as const,
          path: "./test-data/chroma-test",
          collectionName: "test-collection",
          dimension: 384,
        },
        chunking: {
          size: 500,
          overlap: 50,
          method: "sentence" as const,
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: false,
        },
      },
    });

    await orchestrator.initialize();
  });

  describe("Real Ollama Integration", () => {
    it("should verify Ollama is accessible", async () => {
      if (!isOllamaAvailable) {
        // Fail the test if Ollama is not available
        throw new Error("Ollama service is not available for integration testing");
      }
      expect(isOllamaAvailable).toBe(true);
      
      // Verify we can actually communicate with Ollama
      const testConfig = createTestOllamaConfig();
      const response = await fetch(`${testConfig.baseUrl}/api/tags`);
      expect(response.ok).toBe(true);
    });

    it("should initialize with real Ollama connection", async () => {
      if (!isOllamaAvailable) {
        throw new Error("Ollama service is not available for integration testing");
      }

      // Test that the LLM provider is properly initialized
      const provider = orchestrator["llm"];
      expect(provider).toBeDefined();

      // Test a simple generation to verify connection with real Ollama
      const response = await generateWithTimeout(
        provider.generate('Respond with exactly: "test successful"'),
        30000, // Increased timeout for real LLM responses
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
      
      // Real LLM responses may be more verbose, so check for key content
      const responseText = (response as string).toLowerCase();
      expect(
        responseText.includes("test") || responseText.includes("successful")
      ).toBe(true);
    });

    it("should create a real plan from user input", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator["createPlan"]({
            text: "Write a simple greeting message",
            conversationId: "test-conv-1",
          });
        }).rejects.toThrow();
        return;
      }

      const userInput = "Write a simple greeting message";
      const query = {
        text: userInput,
        conversationId: "test-conv-1",
      };

      const plan = await orchestrator["createPlan"](query);

      // Verify plan structure
      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^plan-/);
      expect(plan.metadata?.goal).toBe(userInput);
      expect(plan.steps).toBeInstanceOf(Array);
      expect(plan.steps.length).toBeGreaterThan(0);

      // Verify task structure
      const firstTask = plan.steps[0];
      expect(firstTask).toHaveProperty("id");
      expect(firstTask).toHaveProperty("task");
      expect(firstTask).toHaveProperty("description");
      expect(firstTask).toHaveProperty("agentType");
      expect(firstTask).toHaveProperty("ragQuery");
    });

    it("should handle simple research queries", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "What is TypeScript?",
            conversationId: "test-conv-2",
          });
        }).rejects.toThrow();
        return;
      }

      const query = "What is TypeScript?";
      const conversationId = "test-conv-2";

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();
      expect(response.summary.length).toBeGreaterThan(0);
      expect(response.plan).toBeDefined();

      // Should create a research-focused plan
      const researchTasks =
        response.plan?.steps.filter(
          (t: any) => t.agent === "research" || t.agentType === "research",
        ) || [];
      expect(researchTasks.length).toBeGreaterThan(0);
    });

    it("should handle code generation requests", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Write a function to add two numbers",
            conversationId: "test-conv-3",
          });
        }).rejects.toThrow();
        return;
      }

      const query = "Write a function to add two numbers";
      const conversationId = "test-conv-3";

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();

      // Should create a code-focused plan
      const codeTasks =
        response.plan?.steps.filter(
          (t: any) => t.agent === "code" || t.agentType === "code",
        ) || [];
      expect(codeTasks.length).toBeGreaterThan(0);
    });

    it("should execute a complete plan with real agents", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Generate a random number between 1 and 10",
            conversationId: "test-conv-4",
          });
        }).rejects.toThrow();
        return;
      }

      const query = "Generate a random number between 1 and 10";
      const conversationId = "test-conv-4";

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      expect(response.success).toBe(true);
      expect(response.plan?.metadata?.status).toBe("completed");

      // Verify all tasks completed
      const completedTasks =
        response.plan?.steps.filter(
          (t: any) => t.metadata?.status === "completed",
        ) || [];
      expect(completedTasks.length).toBe(response.plan?.steps.length || 0);

      // Verify output contains a number
      expect(response.summary).toMatch(/\d+/);
    });

    it("should handle multi-step plans", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "First calculate 5+3, then multiply the result by 2",
            conversationId: "test-conv-5",
          });
        }).rejects.toThrow();
        return;
      }

      const query = "First calculate 5+3, then multiply the result by 2";
      const conversationId = "test-conv-5";

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      expect(response.success).toBe(true);
      expect(response.plan?.steps.length || 0).toBeGreaterThanOrEqual(2);

      // Verify dependency chain
      const hasDependencies =
        response.plan?.steps.some((t: any) => t.dependencies?.length > 0) ||
        false;
      expect(hasDependencies).toBe(true);

      // Verify correct result (5+3)*2 = 16
      expect(response.summary).toContain("16");
    });

    it("should persist conversation history", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        const conversationId = "test-conv-6";
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Remember the number 42",
            conversationId,
          });
        }).rejects.toThrow();
        return;
      }

      const conversationId = "test-conv-6";

      // First query
      const response1 = await orchestrator.processQuery({
        text: "Remember the number 42",
        conversationId,
      });
      expect(response1.success).toBe(true);

      // Second query referencing first
      const response2 = await orchestrator.processQuery({
        text: "What number did I ask you to remember?",
        conversationId,
      });
      expect(response2.success).toBe(true);
      expect(response2.summary || "").toContain("42");
    });

    it("should handle errors gracefully", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Parse this invalid JSON: {invalid json}",
            conversationId: "test-conv-7",
          });
        }).rejects.toThrow();
        return;
      }

      const query = "Parse this invalid JSON: {invalid json}";
      const conversationId = "test-conv-7";

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      // Should still return a response even if task fails
      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();

      // Should acknowledge the error in response
      const containsErrorInfo =
        response.summary.toLowerCase().includes("error") ||
        response.summary.toLowerCase().includes("invalid") ||
        response.summary.toLowerCase().includes("parse");
      expect(containsErrorInfo).toBe(true);
    });

    it("should respect context window limits", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          const longText = "Lorem ipsum ".repeat(1000);
          await orchestrator.processQuery({
            text: `Summarize this text: ${longText}`,
            conversationId: "test-conv-8",
          });
        }).rejects.toThrow();
        return;
      }

      const conversationId = "test-conv-8";

      // Generate a very long query
      const longText = "Lorem ipsum ".repeat(1000);
      const query = `Summarize this text: ${longText}`;

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();

      // Should produce a summary much shorter than input
      expect(response.summary.length).toBeLessThan(longText.length / 10);
    });

    it("should handle concurrent requests", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await Promise.all([
            orchestrator.processQuery({
              text: "Calculate 2+2",
              conversationId: "test-conv-9",
            }),
            orchestrator.processQuery({
              text: "Calculate 3+3",
              conversationId: "test-conv-10",
            }),
            orchestrator.processQuery({
              text: "Calculate 4+4",
              conversationId: "test-conv-11",
            }),
          ]);
        }).rejects.toThrow();
        return;
      }

      // Launch multiple queries concurrently
      const queries = [
        orchestrator.processQuery({
          text: "Calculate 2+2",
          conversationId: "test-conv-9",
        }),
        orchestrator.processQuery({
          text: "Calculate 3+3",
          conversationId: "test-conv-10",
        }),
        orchestrator.processQuery({
          text: "Calculate 4+4",
          conversationId: "test-conv-11",
        }),
      ];

      const responses = await Promise.all(queries);

      // All should succeed
      responses.forEach((response) => {
        expect(response.success).toBe(true);
        expect(response.summary).toBeDefined();
      });

      // Verify correct results
      expect(responses[0]?.summary).toContain("4");
      expect(responses[1]?.summary).toContain("6");
      expect(responses[2]?.summary).toContain("8");
    });
  });

  describe("Plan Review and Replanning", () => {
    it("should handle plan review with real LLM", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Research TypeScript and write a tutorial",
            conversationId: "test-conv-12",
          });
        }).rejects.toThrow();
        return;
      }

      // Create a plan that might need revision
      const query = "Research TypeScript and write a tutorial";
      const conversationId = "test-conv-12";

      const response = await orchestrator.processQuery({
        text: query,
        conversationId,
      });

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
      if (!isOllamaAvailable) {
        // Even without Ollama, we can test database operations
        const conversationId = "test-conv-13";
        const query = "Hello, test message";

        // The query will fail but we can still check if initial setup worked
        try {
          await orchestrator.processQuery({
            text: query,
            conversationId,
          });
        } catch (error) {
          // Expected to fail without Ollama
          expect(error).toBeDefined();
        }
        return;
      }

      const conversationId = "test-conv-13";
      const query = "Hello, test message";

      await orchestrator.processQuery({
        text: query,
        conversationId,
      });

      // Verify conversation saved
      // Use query method since testDb mock doesn't have prepare
      const conversationResult = await testDb.query(
        "SELECT * FROM conversations WHERE id = ?",
        [conversationId],
      );
      const conversation = conversationResult.rows?.[0];

      expect(conversation).toBeDefined();
      expect((conversation as any)?.id).toBe(conversationId);

      // Verify message saved
      const messagesResult = await testDb.query(
        "SELECT * FROM messages WHERE conversation_id = ?",
        [conversationId],
      );
      const messages = messagesResult.rows || [];

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m: any) => m.content === query)).toBe(true);
    });
  });
});
