import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PlanExecutor } from "./PlanExecutor";
import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import { ChromaDBTestHelper } from "../../test/helpers/chromadb-test-helper";
import type {
  Plan,
  PlanStep,
  ExecutionResult,
  PlanExecutionResult,
  StepResult,
  Context,
} from "./types";
import type { AgentResult, AgentContext } from "../agents/base/AgentTypes";
import type { Document } from "../shared/types";

// Mock WebSocket service to avoid external dependencies
vi.mock("../../api/services/WebSocketService", () => ({
  wsService: {
    broadcastPlanUpdate: vi.fn(),
  },
}));

describe("PlanExecutor", () => {
  let executor: PlanExecutor;
  let agentRegistry: AgentRegistry;
  let ragSystem: RAGSystem;
  let chromaDBHelper: ChromaDBTestHelper;

  beforeEach(async () => {
    vi.clearAllMocks();
    chromaDBHelper = ChromaDBTestHelper.getInstance();

    // Use real AgentRegistry - agents are automatically registered via factories
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize(); // This preloads ResearchAgent and CodeAgent

    // Use real RAGSystem with test configuration (requires ChromaDB server)
    const testRAGSystem = await chromaDBHelper.createTestRAGSystem({
      skipIfUnavailable: true,
      collectionPrefix: "planexecutor",
    });

    if (!testRAGSystem) {
      // Skip tests if ChromaDB not available
      ragSystem = null as any;
      executor = null as any;
      return;
    }

    ragSystem = testRAGSystem;
    await ragSystem.initialize();

    executor = new PlanExecutor(agentRegistry, ragSystem);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("execute", () => {
    it("should execute a simple plan successfully", async () => {
      if (!executor) {
        console.log("SKIP: ChromaDB not available");
        return;
      }

      const plan: Plan = {
        id: "plan-1",
        steps: [
          {
            id: "step-1",
            agentType: "ResearchAgent",
            task: "Research latest AI developments",
            description: "Research current AI trends and developments",
            ragQuery: "artificial intelligence developments 2025",
            requiresTool: true,
            toolName: "web_search",
            parameters: { query: "AI developments 2025" },
            expectedOutput: "research results with current AI trends",
            dependencies: [],
          },
          {
            id: "step-2",
            agentType: "CodeAgent",
            task: "Generate code analysis",
            description: "Analyze code patterns based on research",
            ragQuery: "code analysis patterns",
            requiresTool: false,
            expectedOutput: "code analysis results",
            dependencies: ["step-1"],
          },
        ],
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.failedSteps).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].stepId).toBe("step-1");
    });

    it("should handle step failures gracefully", async () => {
      const plan: Plan = {
        id: "plan-2",
        steps: [
          {
            id: "step-1",
            agentType: "nonexistent", // This will cause a failure
            task: "Failing task",
            description: "Task that will fail due to missing agent",
            ragQuery: "test query",
            requiresTool: false,
            expectedOutput: "should fail",
            dependencies: [],
          },
          {
            id: "step-2",
            agentType: "ResearchAgent",
            task: "Should still execute after failure",
            description: "Research task that should succeed",
            ragQuery: "research query",
            requiresTool: false,
            expectedOutput: "research results",
            dependencies: [],
          },
        ],
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBeDefined();
    });

    it("should handle missing agents", async () => {
      const plan: Plan = {
        id: "plan-3",
        steps: [
          {
            id: "step-1",
            agentType: "non-existent-agent",
            task: "Task for missing agent",
            description: "Task that requires a non-existent agent",
            ragQuery: "test query",
            requiresTool: false,
            expectedOutput: "should fail",
            dependencies: [],
          },
        ],
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.failedSteps).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain("Agent type not registered");
    });

    it("should respect step dependencies", async () => {
      const plan: Plan = {
        id: "plan-4",
        steps: [
          {
            id: "step-1",
            agentType: "ResearchAgent",
            task: "First research task",
            description: "Initial research",
            ragQuery: "research query 1",
            requiresTool: false,
            expectedOutput: "research results 1",
            dependencies: [],
          },
          {
            id: "step-2",
            agentType: "CodeAgent",
            task: "Code analysis depending on research",
            description: "Code analysis based on research results",
            ragQuery: "code analysis query",
            requiresTool: false,
            expectedOutput: "code analysis results",
            dependencies: ["step-1"], // This step depends on step-1
          },
        ],
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].stepId).toBe("step-1");
      expect(result.results[1].stepId).toBe("step-2");
    });

    it("should handle circular dependencies", async () => {
      const plan: Plan = {
        id: "plan-5",
        steps: [
          {
            id: "step-1",
            agentType: "ResearchAgent",
            task: "Task 1",
            description: "Task that depends on step-2",
            ragQuery: "query 1",
            requiresTool: false,
            expectedOutput: "result 1",
            dependencies: ["step-2"], // Circular dependency
          },
          {
            id: "step-2",
            agentType: "CodeAgent",
            task: "Task 2",
            description: "Task that depends on step-1",
            ragQuery: "query 2",
            requiresTool: false,
            expectedOutput: "result 2",
            dependencies: ["step-1"], // Circular dependency
          },
        ],
      };

      const result = await executor.execute(plan);

      // Should handle circular dependencies gracefully
      expect(result.success).toBe(false);
    });
  });

  describe("executeWithProgress", () => {
    it("should report progress during execution", async () => {
      const progressUpdates: Array<{
        completedSteps: number;
        totalSteps: number;
        currentStep?: string;
      }> = [];

      const plan: Plan = {
        id: "plan-6",
        steps: [
          {
            id: "step-1",
            agentType: "ResearchAgent",
            task: "Task 1",
            description: "First task",
            ragQuery: "query 1",
            requiresTool: false,
            expectedOutput: "result 1",
            dependencies: [],
          },
          {
            id: "step-2",
            agentType: "CodeAgent",
            task: "Task 2",
            description: "Second task",
            ragQuery: "query 2",
            requiresTool: false,
            expectedOutput: "result 2",
            dependencies: [],
          },
        ],
      };

      const result = await executor.executeWithProgress(plan, (progress) => {
        progressUpdates.push(progress);
      });

      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].totalSteps).toBe(2);
      expect(progressUpdates[progressUpdates.length - 1].completedSteps).toBe(
        2,
      );
    });

    it("should report failures in progress", async () => {
      const progressUpdates: Array<{
        completedSteps: number;
        totalSteps: number;
        currentStep?: string;
      }> = [];

      const plan: Plan = {
        id: "plan-7",
        steps: [
          {
            id: "step-1",
            agentType: "nonexistent",
            task: "Failing task",
            description: "Task that will fail",
            ragQuery: "query",
            requiresTool: false,
            expectedOutput: "should fail",
            dependencies: [],
          },
        ],
      };

      const result = await executor.executeWithProgress(plan, (progress) => {
        progressUpdates.push(progress);
      });

      expect(result.success).toBe(false);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });

  describe("parallel execution", () => {
    it("should execute independent steps in parallel", async () => {
      const plan: Plan = {
        id: "plan-8",
        steps: [
          {
            id: "step-1",
            agentType: "ResearchAgent",
            task: "Independent research task",
            description: "Research task with no dependencies",
            ragQuery: "research query",
            requiresTool: false,
            expectedOutput: "research results",
            dependencies: [],
          },
          {
            id: "step-2",
            agentType: "CodeAgent",
            task: "Independent code task",
            description: "Code task with no dependencies",
            ragQuery: "code query",
            requiresTool: false,
            expectedOutput: "code results",
            dependencies: [],
          },
        ],
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.failedSteps).toBe(0);
    });
  });

  describe("context passing", () => {
    it("should pass context between dependent steps", async () => {
      const plan: Plan = {
        id: "plan-9",
        steps: [
          {
            id: "step-1",
            agentType: "ResearchAgent",
            task: "Research for context",
            description: "Generate context for next step",
            ragQuery: "context research",
            requiresTool: false,
            expectedOutput: "context data",
            dependencies: [],
          },
          {
            id: "step-2",
            agentType: "CodeAgent",
            task: "Use research context",
            description: "Use context from previous step",
            ragQuery: "code with context",
            requiresTool: false,
            expectedOutput: "code using context",
            dependencies: ["step-1"],
          },
        ],
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });
  });
});
