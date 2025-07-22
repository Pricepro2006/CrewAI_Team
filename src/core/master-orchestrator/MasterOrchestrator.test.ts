import { describe, it, expect, beforeEach, vi } from "vitest";
import { MasterOrchestrator } from "./MasterOrchestrator";
import { createMockOllamaProvider } from "../../test/mocks/ollama.mock";
import { createTestDatabase } from "../../test/utils/test-helpers";
import { ResearchAgent } from "../agents/specialized/ResearchAgent";
import type { Plan, PlanStep, Query } from "./types";

vi.mock("../llm/OllamaProvider", () => ({
  OllamaProvider: vi.fn().mockImplementation(() => createMockOllamaProvider()),
}));

describe("MasterOrchestrator", () => {
  let orchestrator: MasterOrchestrator;
  let mockDatabase: ReturnType<typeof createTestDatabase>;

  beforeEach(async () => {
    mockDatabase = createTestDatabase();
    orchestrator = new MasterOrchestrator({
      model: "qwen3:14b",
      ollamaUrl: "http://localhost:11434",
      database: mockDatabase,
    });
    await orchestrator.initialize();
  });

  describe("initialization", () => {
    it("should initialize with default configuration", () => {
      expect(orchestrator).toBeDefined();
      expect((orchestrator as any)["config"].model).toBe("qwen3:14b");
    });

    it("should register default agents", async () => {
      const registry = orchestrator["agentRegistry"];
      expect(registry.getAgent("research")).toBeDefined();
      expect(registry.getAgent("code")).toBeDefined();
      expect(registry.getAgent("data-analysis")).toBeDefined();
      expect(registry.getAgent("writer")).toBeDefined();
      expect(registry.getAgent("tool-executor")).toBeDefined();
    });
  });

  describe("plan creation", () => {
    it("should create a plan from user input", async () => {
      const userInput =
        "Research the latest developments in AI and write a summary";
      const context = { conversationId: "test-conv-1" };

      const query: Query = {
        text: userInput,
        conversationId: context.conversationId,
      };
      const plan = await orchestrator["createPlan"](query);

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/^plan-/);
      expect(plan.metadata?.goal).toBe(userInput);
      expect(plan.steps).toBeInstanceOf(Array);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.metadata?.status).toBe("pending");
    });

    it("should create multi-step plans for complex queries", async () => {
      const userInput =
        "Analyze this dataset, create visualizations, and write a report";
      const context = { conversationId: "test-conv-1" };

      const query: Query = {
        text: userInput,
        conversationId: context.conversationId,
      };
      const plan = await orchestrator["createPlan"](query);

      expect(plan.steps.length).toBeGreaterThanOrEqual(3);
      const taskTypes = plan.steps.map((t: any) => t.type);
      expect(taskTypes).toContain("data-analysis");
      expect(taskTypes).toContain("visualization");
      expect(taskTypes).toContain("writing");
    });
  });

  describe("plan execution", () => {
    it("should execute a simple plan", async () => {
      const plan: Plan = {
        id: "plan-test-1",
        metadata: { goal: "Test goal", status: "pending" },
        steps: [
          {
            id: "task-1",
            type: "research",
            description: "Research test topic",
            agentType: "research",
            input: { query: "test topic" },
            dependencies: [],
            metadata: { status: "pending" },
          },
        ],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await (orchestrator as any)["executePlan"](plan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(plan.steps[0].metadata?.status).toBe("completed");
    });

    it("should handle task dependencies", async () => {
      const plan: Plan = {
        id: "plan-test-2",
        metadata: { goal: "Complex test", status: "pending" },
        steps: [
          {
            id: "task-1",
            type: "research",
            description: "Research phase",
            agentType: "research",
            input: { query: "test" },
            dependencies: [],
            metadata: { status: "pending" },
          },
          {
            id: "task-2",
            type: "writing",
            description: "Write summary",
            agentType: "writer",
            input: { content: "summary" },
            dependencies: ["task-1"],
            metadata: { status: "pending" },
          },
        ],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await (orchestrator as any)["executePlan"](plan);

      expect(result.success).toBe(true);
      expect(plan.steps[0].metadata?.status).toBe("completed");
      expect(plan.steps[1].metadata?.status).toBe("completed");
    });

    it("should handle task failures gracefully", async () => {
      // Mock agent to fail
      const failingAgent = new ResearchAgent();
      vi.spyOn(failingAgent, "execute").mockRejectedValue(
        new Error("Task failed"),
      );

      const registry = orchestrator["agentRegistry"];
      vi.spyOn(registry, "getAgent").mockResolvedValue(failingAgent);

      const plan: Plan = {
        id: "plan-test-3",
        metadata: { goal: "Failing test", status: "pending" },
        steps: [
          {
            id: "task-1",
            type: "research",
            description: "Failing task",
            agentType: "research",
            input: { query: "fail" },
            dependencies: [],
            metadata: { status: "pending" },
          },
        ],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await (orchestrator as any)["executePlan"](plan);

      expect(result.success).toBe(false);
      expect(plan.steps[0].metadata?.status).toBe("failed");
      expect(plan.steps[0].metadata?.error).toBeDefined();
    });
  });

  describe("plan review and replanning", () => {
    it("should review completed plans", async () => {
      const completedPlan: Plan = {
        id: "plan-test-4",
        metadata: { goal: "Completed test", status: "completed" },
        steps: [
          {
            id: "task-1",
            type: "research",
            description: "Completed task",
            agentType: "research",
            input: { query: "test" },
            dependencies: [],
            metadata: {
              status: "completed",
              output: { result: "Test result" },
            },
          },
        ],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const needsReplan = await (orchestrator as any)["reviewPlan"](
        completedPlan,
      );

      expect(needsReplan).toBe(false);
    });

    it("should suggest replanning for partial failures", async () => {
      const partiallyFailedPlan: Plan = {
        id: "plan-test-5",
        metadata: { goal: "Partial failure test", status: "failed" },
        steps: [
          {
            id: "task-1",
            type: "research",
            description: "Completed task",
            agentType: "research",
            input: { query: "test" },
            dependencies: [],
            metadata: {
              status: "completed",
              output: { result: "Success" },
            },
          },
          {
            id: "task-2",
            type: "writing",
            description: "Failed task",
            agentType: "writer",
            input: { content: "test" },
            dependencies: ["task-1"],
            metadata: {
              status: "failed",
              error: "Failed to write",
            },
          },
        ],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const needsReplan = await (orchestrator as any)["reviewPlan"](
        partiallyFailedPlan,
      );

      expect(needsReplan).toBe(true);
    });
  });

  describe("processQuery", () => {
    it("should process a complete user query", async () => {
      const query: Query = {
        text: "What is the weather today?",
        conversationId: "test-conv-1",
      };

      const response = await orchestrator.processQuery(query);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();
      expect(response.plan).toBeDefined();
      expect(response.results).toBeDefined();
    });

    it("should handle errors during processing", async () => {
      // Mock LLM to fail
      vi.spyOn(orchestrator["llm"], "generate").mockRejectedValue(
        new Error("LLM error"),
      );

      const query: Query = {
        text: "This will fail",
        conversationId: "test-conv-2",
      };

      const response = await orchestrator.processQuery(query);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it("should handle replanning when needed", async () => {
      const query: Query = {
        text: "Complex task that needs replanning",
        conversationId: "test-conv-3",
      };

      const response = await orchestrator.processQuery(query);

      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
    });
  });
});
