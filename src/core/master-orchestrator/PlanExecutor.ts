import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import type {
  Plan,
  PlanStep,
  ExecutionResult,
  StepResult,
  Context,
} from "./types";
import { wsService } from "../../api/services/WebSocketService";

export class PlanExecutor {
  constructor(
    private agentRegistry: AgentRegistry,
    private ragSystem: RAGSystem,
  ) {}

  async execute(plan: Plan): Promise<ExecutionResult> {
    const results: StepResult[] = [];
    const executedSteps = new Set<string>();

    // Execute steps in dependency order
    const sortedSteps = this.topologicalSort(plan.steps);

    // Broadcast plan execution start
    wsService.broadcastPlanUpdate(plan.id, "executing", {
      completed: 0,
      total: sortedSteps.length,
    });

    for (const step of sortedSteps) {
      // Check if dependencies are satisfied
      if (!this.areDependenciesSatisfied(step, executedSteps)) {
        results.push({
          stepId: step.id,
          success: false,
          error: "Dependencies not satisfied",
          metadata: { skipped: true },
        });
        continue;
      }

      try {
        // Broadcast step start
        wsService.broadcastPlanUpdate(plan.id, "executing", {
          completed: executedSteps.size,
          total: sortedSteps.length,
          currentStep: step.task,
        });
        // Step 1: Gather context from RAG
        const context = await this.gatherContext(step);

        // Step 2: Execute based on whether tool is required
        const result = step.requiresTool
          ? await this.executeWithTool(step, context)
          : await this.executeInformationQuery(step, context);

        results.push(result);
        executedSteps.add(step.id);

        // Step 3: Check if we should continue
        if (!this.shouldContinue(results)) {
          break;
        }
      } catch (error) {
        results.push({
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          metadata: {
            errorType: error instanceof Error ? error.name : "UnknownError",
          },
        });
      }
    }

    // Broadcast plan completion
    const success = results.every((r) => r.success);
    wsService.broadcastPlanUpdate(plan.id, success ? "completed" : "failed", {
      completed: executedSteps.size,
      total: sortedSteps.length,
    });

    return {
      success,
      results,
      summary: this.summarizeResults(results),
    };
  }

  private async gatherContext(step: PlanStep): Promise<Context> {
    const documents = await this.ragSystem.search(step.ragQuery, 5);

    return {
      documents: documents,
      relevance: this.calculateRelevance(documents, step),
      metadata: {
        stepId: step.id,
        query: step.ragQuery,
      },
    };
  }

  private async executeWithTool(
    step: PlanStep,
    context: Context,
  ): Promise<StepResult> {
    if (!step.toolName) {
      throw new Error(
        `Step ${step.id} requires tool but no tool name specified`,
      );
    }

    const agent = await this.agentRegistry.getAgent(step.agentType);
    const tool = agent.getTool(step.toolName);

    if (!tool) {
      throw new Error(
        `Tool ${step.toolName} not found for agent ${step.agentType}`,
      );
    }

    const result = await agent.executeWithTool({
      tool,
      context: {
        task: step.description,
        ragDocuments: context.documents,
        tool: step.toolName,
      },
      parameters: step.parameters || {},
    });

    return {
      stepId: step.id,
      success: result.success,
      ...(result.output && { output: result.output }),
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
      metadata: {
        ...result.metadata,
        toolUsed: step.toolName,
        contextRelevance: context.relevance,
      },
    };
  }

  private async executeInformationQuery(
    step: PlanStep,
    context: Context,
  ): Promise<StepResult> {
    const agent = await this.agentRegistry.getAgent(step.agentType);

    const result = await agent.execute(step.description, {
      task: step.description,
      ragDocuments: context.documents,
    });

    return {
      stepId: step.id,
      success: result.success,
      ...(result.output && { output: result.output }),
      ...(result.data && { data: result.data }),
      ...(result.error && { error: result.error }),
      metadata: {
        ...result.metadata,
        contextRelevance: context.relevance,
      },
    };
  }

  private calculateRelevance(documents: any[], _step: PlanStep): number {
    if (documents.length === 0) return 0;

    // Average relevance score of top documents
    const scores = documents.slice(0, 3).map((doc) => doc.score || 0);

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private shouldContinue(results: StepResult[]): boolean {
    // Stop if too many failures
    const failures = results.filter((r) => !r.success).length;
    const total = results.length;

    if (total > 0 && failures / total > 0.5) {
      return false;
    }

    // Stop if critical error
    const hasCriticalError = results.some(
      (r) => r.metadata?.["errorType"] === "CriticalError",
    );

    return !hasCriticalError;
  }

  private summarizeResults(results: StepResult[]): string {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    const parts: string[] = [];

    if (successful.length > 0) {
      parts.push("Completed Steps:");
      successful.forEach((r) => {
        if (r.output) {
          parts.push(r.output);
        }
      });
    }

    if (failed.length > 0) {
      parts.push("\nFailed Steps:");
      failed.forEach((r) => {
        parts.push(`- ${r.stepId}: ${r.error || "Unknown error"}`);
      });
    }

    return parts.join("\n");
  }

  private topologicalSort(steps: PlanStep[]): PlanStep[] {
    const graph = new Map<string, PlanStep>();
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Build graph
    steps.forEach((step) => {
      graph.set(step.id, step);
      inDegree.set(step.id, 0);
      adjList.set(step.id, []);
    });

    // Calculate in-degrees and adjacency list
    steps.forEach((step) => {
      step.dependencies.forEach((dep) => {
        if (graph.has(dep)) {
          inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
          adjList.get(dep)?.push(step.id);
        }
      });
    });

    // Find nodes with no dependencies
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    const sorted: PlanStep[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const step = graph.get(current)!;
      sorted.push(step);

      // Update neighbors
      adjList.get(current)?.forEach((neighbor) => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check for cycles
    if (sorted.length !== steps.length) {
      console.warn("Circular dependencies detected in plan");
      // Return original order as fallback
      return steps;
    }

    return sorted;
  }

  private areDependenciesSatisfied(
    step: PlanStep,
    executedSteps: Set<string>,
  ): boolean {
    return step.dependencies.every((dep) => executedSteps.has(dep));
  }

  buildRAGQuery(step: PlanStep): string {
    // Enhance the RAG query with context
    const parts = [step.ragQuery];

    if (step.expectedOutput) {
      parts.push(`Expected output: ${step.expectedOutput}`);
    }

    if (step.toolName) {
      parts.push(`Tool context: ${step.toolName}`);
    }

    return parts.join(" ");
  }
}
