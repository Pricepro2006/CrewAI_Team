import { describe, it, expect, beforeEach, vi } from "vitest";
import { MasterOrchestrator } from "./MasterOrchestrator.js";
import type { Plan, Query, PlanStep } from "./types.js";

// Mock Ollama provider
const mockOllamaProvider = {
  generate: vi.fn().mockResolvedValue("mock response"),
  client: {},
  config: { model: "test-model", ollamaUrl: "http://localhost:11434" },
  isInitialized: true,
  generateFallbackResponse: vi.fn(),
  buildPrompt: vi.fn(),
} as any;

// Mock the logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock VectorStore
vi.mock("../rag/VectorStore", () => ({
  VectorStore: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    store: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock agents
vi.mock("../agents/BaseAgent", () => ({
  BaseAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: "Task completed",
    }),
  })),
}));

describe("MasterOrchestrator", () => {
  let orchestrator: MasterOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    orchestrator = new MasterOrchestrator({
      ollamaUrl: "http://localhost:11434",
      rag: {
        vectorStore: {
          type: "chromadb",
          collectionName: "test-collection",
        },
        chunking: {
          size: 500,
          overlap: 50,
        },
        retrieval: {
          topK: 5,
          minScore: 0.7,
        },
      },
    });

    // Mock the LLM provider
    (orchestrator as any)["llm"] = mockOllamaProvider;
  });

  it("should create and execute plans", async () => {
    const plan: Plan = {
      id: "plan-test",
      steps: [
        {
          id: "task-1",
          task: "Research topic",
          description: "Research test topic",
          agentType: "ResearchAgent",
          requiresTool: false,
          ragQuery: "test topic",
          expectedOutput: "Research results",
          dependencies: [],
        },
      ],
    };

    const result = await (orchestrator as any)["executePlan"](plan);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
  });

  it("should handle task dependencies", async () => {
    const plan: Plan = {
      id: "plan-test-2",
      steps: [
        {
          id: "task-1",
          task: "Research phase",
          description: "Research phase",
          agentType: "ResearchAgent",
          requiresTool: false,
          ragQuery: "test",
          expectedOutput: "Research results",
          dependencies: [],
        },
        {
          id: "task-2",
          task: "Write summary",
          description: "Write summary",
          agentType: "WriterAgent",
          requiresTool: false,
          ragQuery: "summary",
          expectedOutput: "Written summary",
          dependencies: ["task-1"],
        },
      ],
    };

    const result = await (orchestrator as any)["executePlan"](plan);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  it("should handle plan execution failures", async () => {
    // Mock a failing agent
    const failingAgent = {
      execute: vi.fn().mockRejectedValue(new Error("Task failed")),
    };

    const plan: Plan = {
      id: "plan-test-fail",
      steps: [
        {
          id: "task-1",
          task: "Failing task",
          description: "This will fail",
          agentType: "ResearchAgent",
          requiresTool: false,
          ragQuery: "fail",
          expectedOutput: "Should not get here",
          dependencies: [],
        },
      ],
    };

    // Override the agent getter to return failing agent
    vi.spyOn(orchestrator as any, "getAgent").mockReturnValue(failingAgent);

    const result = await (orchestrator as any)["executePlan"](plan);

    expect(result.success).toBe(false);
  });

  it("should process queries end-to-end", async () => {
    const query: Query = {
      text: "Research artificial intelligence",
      conversationId: "test-conv",
    };

    mockOllamaProvider.generate.mockResolvedValueOnce(
      JSON.stringify({
        goal: "Research AI",
        steps: [
          {
            id: "1",
            task: "ResearchAgent",
            description: "Research AI topics",
            agentType: "ResearchAgent",
            requiresTool: false,
            ragQuery: "artificial intelligence",
            expectedOutput: "Comprehensive AI research",
            dependencies: [],
          },
          {
            id: "2",
            task: "WriterAgent",
            description: "Write summary",
            agentType: "WriterAgent",
            requiresTool: false,
            ragQuery: "AI summary",
            expectedOutput: "Written summary",
            dependencies: ["1"],
          },
        ],
      }),
    );

    const result = await orchestrator.processQuery(query);
    expect(result.plan?.steps[0]?.agentType).toBe("ResearchAgent");
    expect(result.plan?.steps[0]?.task).toBe("ResearchAgent");
    expect(result.plan?.steps[1]?.agentType).toBe("WriterAgent");
  });

  it("should generate comprehensive summaries", async () => {
    const mockResults = [
      { stepId: "1", success: true, output: "Research findings" },
      { stepId: "2", success: true, output: "Written content" },
    ];

    const mockPlan: Plan = {
      id: "plan-summary",
      steps: [
        {
          id: "1",
          task: "ResearchAgent",
          description: "Research",
          agentType: "ResearchAgent",
          requiresTool: false,
          ragQuery: "test",
          expectedOutput: "Research output",
          dependencies: [],
        },
        {
          id: "2",
          task: "WriterAgent",
          description: "Write",
          agentType: "WriterAgent",
          requiresTool: false,
          ragQuery: "test",
          expectedOutput: "Written output",
          dependencies: ["1"],
        },
      ],
    };

    mockOllamaProvider.generate.mockResolvedValueOnce(
      "This is a comprehensive summary of the research and writing tasks.",
    );

    const summary = await (orchestrator as any)["generateSummary"](
      mockResults,
      mockPlan,
    );

    expect(summary).toContain("comprehensive summary");
  });

  it("should handle network errors gracefully", async () => {
    const query: Query = {
      text: "Test network failure",
      conversationId: "test-conv",
    };

    mockOllamaProvider.generate.mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await orchestrator.processQuery(query);

    // Should return a fallback response
    expect(result.summary).toContain("unable to process");
    // Test that error property exists on result
    expect("error" in result).toBe(false); // ExecutionResult doesn't have error property
  });
});
