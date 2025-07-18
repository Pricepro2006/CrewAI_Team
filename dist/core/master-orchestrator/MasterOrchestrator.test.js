import { describe, it, expect, beforeEach, vi } from "vitest";
import { MasterOrchestrator } from "./MasterOrchestrator";
import { createMockOllamaProvider } from "../../test/mocks/ollama.mock";
import { createTestDatabase } from "../../test/utils/test-helpers";
import { AgentRegistry } from "../agents/AgentRegistry";
import { ResearchAgent } from "../agents/specialized/ResearchAgent";
vi.mock("../llm/OllamaProvider", () => ({
    OllamaProvider: vi.fn().mockImplementation(() => createMockOllamaProvider()),
}));
describe("MasterOrchestrator", () => {
    let orchestrator;
    let mockDatabase;
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
            expect(orchestrator["config"].model).toBe("qwen3:14b");
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
            const userInput = "Research the latest developments in AI and write a summary";
            const context = { conversationId: "test-conv-1" };
            const plan = await orchestrator["createPlan"](userInput, context);
            expect(plan).toBeDefined();
            expect(plan.id).toMatch(/^plan-/);
            expect(plan.goal).toBe(userInput);
            expect(plan.tasks).toBeInstanceOf(Array);
            expect(plan.tasks.length).toBeGreaterThan(0);
            expect(plan.status).toBe("pending");
        });
        it("should create multi-step plans for complex queries", async () => {
            const userInput = "Analyze this dataset, create visualizations, and write a report";
            const context = { conversationId: "test-conv-1" };
            const plan = await orchestrator["createPlan"](userInput, context);
            expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
            const taskTypes = plan.tasks.map((t) => t.type);
            expect(taskTypes).toContain("data-analysis");
            expect(taskTypes).toContain("visualization");
            expect(taskTypes).toContain("writing");
        });
    });
    describe("plan execution", () => {
        it("should execute a simple plan", async () => {
            const plan = {
                id: "plan-test-1",
                goal: "Test goal",
                tasks: [
                    {
                        id: "task-1",
                        type: "research",
                        description: "Research test topic",
                        agentType: "research",
                        input: { query: "test topic" },
                        dependencies: [],
                        status: "pending",
                    },
                ],
                context: {},
                status: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await orchestrator["executePlan"](plan);
            expect(result.status).toBe("completed");
            expect(result.tasks[0].status).toBe("completed");
            expect(result.tasks[0].output).toBeDefined();
        });
        it("should handle task dependencies", async () => {
            const plan = {
                id: "plan-test-2",
                goal: "Complex test",
                tasks: [
                    {
                        id: "task-1",
                        type: "research",
                        description: "Research phase",
                        agentType: "research",
                        input: { query: "test" },
                        dependencies: [],
                        status: "pending",
                    },
                    {
                        id: "task-2",
                        type: "writing",
                        description: "Write summary",
                        agentType: "writer",
                        input: { content: "summary" },
                        dependencies: ["task-1"],
                        status: "pending",
                    },
                ],
                context: {},
                status: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await orchestrator["executePlan"](plan);
            expect(result.status).toBe("completed");
            expect(result.tasks[0].status).toBe("completed");
            expect(result.tasks[1].status).toBe("completed");
        });
        it("should handle task failures gracefully", async () => {
            // Mock agent to fail
            const failingAgent = new ResearchAgent();
            vi.spyOn(failingAgent, "execute").mockRejectedValue(new Error("Task failed"));
            const registry = orchestrator["agentRegistry"];
            vi.spyOn(registry, "getAgent").mockReturnValue(failingAgent);
            const plan = {
                id: "plan-test-3",
                goal: "Failing test",
                tasks: [
                    {
                        id: "task-1",
                        type: "research",
                        description: "Failing task",
                        agentType: "research",
                        input: { query: "fail" },
                        dependencies: [],
                        status: "pending",
                    },
                ],
                context: {},
                status: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await orchestrator["executePlan"](plan);
            expect(result.status).toBe("failed");
            expect(result.tasks[0].status).toBe("failed");
            expect(result.tasks[0].error).toBeDefined();
        });
    });
    describe("plan review and replanning", () => {
        it("should review completed plans", async () => {
            const completedPlan = {
                id: "plan-test-4",
                goal: "Completed test",
                tasks: [
                    {
                        id: "task-1",
                        type: "research",
                        description: "Completed task",
                        agentType: "research",
                        input: { query: "test" },
                        dependencies: [],
                        status: "completed",
                        output: { result: "Test result" },
                    },
                ],
                context: {},
                status: "completed",
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const needsReplan = await orchestrator["reviewPlan"](completedPlan);
            expect(needsReplan).toBe(false);
        });
        it("should suggest replanning for partial failures", async () => {
            const partiallyFailedPlan = {
                id: "plan-test-5",
                goal: "Partial failure test",
                tasks: [
                    {
                        id: "task-1",
                        type: "research",
                        description: "Completed task",
                        agentType: "research",
                        input: { query: "test" },
                        dependencies: [],
                        status: "completed",
                        output: { result: "Success" },
                    },
                    {
                        id: "task-2",
                        type: "writing",
                        description: "Failed task",
                        agentType: "writer",
                        input: { content: "test" },
                        dependencies: ["task-1"],
                        status: "failed",
                        error: "Failed to write",
                    },
                ],
                context: {},
                status: "failed",
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const needsReplan = await orchestrator["reviewPlan"](partiallyFailedPlan);
            expect(needsReplan).toBe(true);
        });
    });
    describe("processUserQuery", () => {
        it("should process a complete user query", async () => {
            const query = "What is the weather today?";
            const conversationId = "test-conv-1";
            const response = await orchestrator.processUserQuery(query, conversationId);
            expect(response).toBeDefined();
            expect(response.success).toBe(true);
            expect(response.message).toBeDefined();
            expect(response.plan).toBeDefined();
        });
        it("should handle empty queries", async () => {
            const query = "";
            const conversationId = "test-conv-1";
            await expect(orchestrator.processUserQuery(query, conversationId)).rejects.toThrow("Query cannot be empty");
        });
        it("should respect max retries on replan", async () => {
            // Mock to always suggest replan
            vi.spyOn(orchestrator, "reviewPlan").mockResolvedValue(true);
            const query = "Complex query requiring replanning";
            const conversationId = "test-conv-1";
            const response = await orchestrator.processUserQuery(query, conversationId);
            expect(response.success).toBe(true);
            expect(response.metadata?.replanCount).toBeLessThanOrEqual(3);
        });
    });
});
//# sourceMappingURL=MasterOrchestrator.test.js.map