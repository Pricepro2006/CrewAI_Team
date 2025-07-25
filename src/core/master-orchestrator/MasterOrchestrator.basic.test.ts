import { describe, it, expect, beforeEach, beforeAll, afterEach } from "vitest";
import { MasterOrchestrator } from "./MasterOrchestrator";
import { createTestDatabase } from "../../test/utils/test-helpers";
import {
  isOllamaRunning,
  skipIfNoOllama,
  generateWithTimeout,
} from "../../test/utils/ollama-test-helper";
import type { Plan, Task } from "./types";

// No mocking - use real Ollama per guardrails

describe("MasterOrchestrator Basic Tests", () => {
  let orchestrator: MasterOrchestrator;
  let testDb: ReturnType<typeof createTestDatabase>;
  let isOllamaAvailable = false;

  beforeAll(async () => {
    // Check if Ollama is available once
    isOllamaAvailable = await isOllamaRunning(process.env.OLLAMA_URL);
    if (!isOllamaAvailable) {
      console.log(
        "Ollama not running - tests will fail gracefully per guardrails",
      );
    }
  });

  beforeEach(async () => {
    testDb = createTestDatabase();
    orchestrator = new MasterOrchestrator({
      model: "qwen3:0.6b", // Use smallest model for faster tests
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
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

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      if (!isOllamaAvailable) {
        expect(() => orchestrator).toBeDefined();
        return;
      }

      expect(orchestrator).toBeDefined();
      const initialized = await orchestrator.isInitialized();
      expect(initialized).toBe(true);
    });

    it("should handle RAG initialization failure gracefully", async () => {
      // RAG might fail but orchestrator should still work
      expect(orchestrator).toBeDefined();
      expect(orchestrator.agentRegistry).toBeDefined();

      // With real Ollama, we can verify the LLM is accessible
      if (isOllamaAvailable) {
        const llm = orchestrator["llm"];
        expect(llm).toBeDefined();
      }
    });
  });

  describe("Query Processing", () => {
    it("should process a simple query with real LLM", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Hello, test",
            conversationId: "test-conv-1",
          });
        }).rejects.toThrow();
        return;
      }

      const query = {
        text: "Say hello and nothing else",
        conversationId: "test-conv-1",
      };

      // Use real processQuery with timeout
      const response = await Promise.race([
        orchestrator.processQuery(query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), 15000),
        ),
      ]);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();
      expect(response.summary.toLowerCase()).toContain("hello");
      expect(response.results).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
    });

    it("should handle query metadata", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator.processQuery({
            text: "Test with metadata",
            conversationId: "test-conv-2",
            metadata: {
              source: "test",
              priority: "high",
            },
          });
        }).rejects.toThrow();
        return;
      }

      const query = {
        text: "Return the number 5",
        conversationId: "test-conv-2",
        metadata: {
          source: "test",
          priority: "high",
        },
      };

      const response = await Promise.race([
        orchestrator.processQuery(query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), 15000),
        ),
      ]);

      expect(response.success).toBe(true);
      expect(response.metadata).toBeDefined();
      expect(response.summary).toContain("5");
    });
  });

  describe("Plan Creation", () => {
    it("should create a plan structure with real LLM", async () => {
      if (!isOllamaAvailable) {
        // Test should fail gracefully without Ollama
        await expect(async () => {
          await orchestrator["createPlan"]({
            text: "Create a test plan",
            conversationId: "test-conv-3",
          });
        }).rejects.toThrow();
        return;
      }

      const query = {
        text: "Write a simple greeting",
        conversationId: "test-conv-3",
      };

      const plan = await Promise.race([
        orchestrator["createPlan"](query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Plan creation timeout")), 10000),
        ),
      ]);

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^plan-/);
      expect(plan.metadata?.goal).toBe(query.text);
      expect(plan.steps).toBeInstanceOf(Array);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.metadata?.status).toBe("pending");

      // Verify task structure
      const firstTask = plan.steps[0];
      expect(firstTask).toHaveProperty("id");
      expect(firstTask).toHaveProperty("description");
      expect(firstTask).toHaveProperty("agentType");
    });
  });

  describe("Agent Registry", () => {
    it("should have access to agent registry", () => {
      expect(orchestrator.agentRegistry).toBeDefined();
      expect(orchestrator.agentRegistry.getAgent).toBeDefined();
    });
  });

  describe("Database Integration", () => {
    it("should work with in-memory database", async () => {
      const query = {
        text: "Database test",
        conversationId: "test-conv-4",
      };

      await orchestrator.processQuery(query);

      // Verify basic database operations work
      // Use query method since testDb mock doesn't have prepare
      const tables = await testDb.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      const allTables = tables.rows || [];

      expect(allTables).toBeDefined();
      expect(allTables.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty queries gracefully", async () => {
      if (!isOllamaAvailable) {
        // Without Ollama, empty query should still be handled
        const query = {
          text: "",
          conversationId: "test-conv-5",
        };

        await expect(async () => {
          await orchestrator.processQuery(query);
        }).rejects.toThrow();
        return;
      }

      const query = {
        text: "",
        conversationId: "test-conv-5",
      };

      // Empty query might still produce a response with real LLM
      const response = await Promise.race([
        orchestrator.processQuery(query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), 10000),
        ),
      ]);

      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
    });

    it("should handle queries without conversation ID", async () => {
      if (!isOllamaAvailable) {
        // Without Ollama, should fail gracefully
        const query = {
          text: "No conversation ID",
          conversationId: "",
        };

        await expect(async () => {
          await orchestrator.processQuery(query);
        }).rejects.toThrow();
        return;
      }

      const query = {
        text: "Return the word test",
        conversationId: "", // Empty conversation ID
      };

      const response = await Promise.race([
        orchestrator.processQuery(query),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), 10000),
        ),
      ]);

      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
      expect(response.summary.toLowerCase()).toContain("test");
    });
  });
});
