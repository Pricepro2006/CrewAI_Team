import type { AgentRegistry } from "../agents/registry/AgentRegistry.js";
import type { RAGSystem } from "../rag/RAGSystem.js";
import type {
  Plan,
  PlanStep,
  ExecutionResult,
  PlanExecutionResult,
  StepResult,
  Context,
} from "./types.js";
import { wsService } from "../../api/services/WebSocketService.js";
import {
  withTimeout,
  DEFAULT_TIMEOUTS,
  TimeoutError,
} from "../../utils/timeout.js";

export class PlanExecutor {
  constructor(
    private agentRegistry: AgentRegistry,
    private ragSystem: RAGSystem,
  ) {}

  async execute(plan: Plan): Promise<PlanExecutionResult> {
    const results: StepResult[] = [];
    const executedSteps = new Set<string>();

    // Execute steps in dependency order
    const sortedSteps = this.topologicalSort(plan.steps);

    // Broadcast plan execution start
    wsService.broadcastPlanUpdate(plan.id, "executing", {
      completed: 0,
      total: sortedSteps?.length || 0,
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
          total: sortedSteps?.length || 0,
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
            isTimeout: error instanceof TimeoutError,
            ...(error instanceof TimeoutError && {
              timeoutDuration: error.duration,
            }),
          },
        });

        // Log timeout errors specifically
        if (error instanceof TimeoutError) {
          console.error(
            `Step ${step.id} timed out after ${error.duration}ms: ${error.message}`,
          );
        }
      }
    }

    // Broadcast plan completion
    const success = results.every((r: any) => r.success);
    wsService.broadcastPlanUpdate(plan.id, success ? "completed" : "failed", {
      completed: executedSteps.size,
      total: sortedSteps?.length || 0,
    });

    return {
      success,
      results,
      summary: this.summarizeResults(results),
      completedSteps: results?.filter((r: any) => r.success).length,
      failedSteps: results?.filter((r: any) => !r.success).length,
      error: !success ? results.find((r: any) => !r.success)?.error : undefined,
    };
  }

  async executeWithProgress(
    plan: Plan,
    progressCallback: (progress: {
      completedSteps: number;
      totalSteps: number;
      currentStep?: string;
    }) => void,
  ): Promise<PlanExecutionResult> {
    const sortedSteps = this.topologicalSort(plan.steps);
    const results: StepResult[] = [];
    const executedSteps = new Set<string>();

    for (const step of sortedSteps) {
      progressCallback({
        completedSteps: executedSteps.size,
        totalSteps: sortedSteps?.length || 0,
        currentStep: step.id,
      });

      try {
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
        const errorResult = {
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          metadata: {
            errorType: error instanceof Error ? error.name : "UnknownError",
          },
        };
        results.push(errorResult);

        progressCallback({
          completedSteps: executedSteps.size,
          totalSteps: sortedSteps?.length || 0,
          currentStep: step.id,
        });
      }
    }

    // Final progress callback
    progressCallback({
      completedSteps: executedSteps.size,
      totalSteps: sortedSteps?.length || 0,
    });

    // Broadcast plan completion
    const success = results.every((r: any) => r.success);
    wsService.broadcastPlanUpdate(plan.id, success ? "completed" : "failed", {
      completed: executedSteps.size,
      total: sortedSteps?.length || 0,
    });

    return {
      success,
      results,
      summary: this.summarizeResults(results),
      completedSteps: results?.filter((r: any) => r.success).length,
      failedSteps: results?.filter((r: any) => !r.success).length,
      error: !success ? results.find((r: any) => !r.success)?.error : undefined,
    };
  }

  private async gatherContext(step: PlanStep): Promise<Context> {
    let documents: any[] = [];
    let relevance = 0;

    try {
      // Attempt to search RAG system with timeout
      const searchPromise = this?.ragSystem?.search(step.ragQuery, 5);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RAG search timeout")), 5000),
      );

      documents = await Promise.race([searchPromise, timeoutPromise]);
      relevance = this.calculateRelevance(documents, step);
    } catch (error) {
      // Log the error but don't fail the step
      console.warn(
        `RAG search failed for step ${step.id}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      console.warn("Continuing without RAG context");

      // Return empty context rather than throwing
      documents = [];
      relevance = 0;
    }

    return {
      documents: documents,
      relevance: relevance,
      metadata: {
        stepId: step.id,
        query: step.ragQuery,
        ragAvailable: documents?.length || 0 > 0,
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

    const agent = await this?.agentRegistry?.getAgent(step.agentType);
    const tool = agent.getTool(step.toolName);

    if (!tool) {
      throw new Error(
        `Tool ${step.toolName} not found for agent ${step.agentType}`,
      );
    }

    const result = await withTimeout(
      agent.executeWithTool({
        tool,
        context: {
          task: step.description,
          ragDocuments: context.documents,
          tool: step.toolName,
        },
        parameters: step.parameters || {},
      }),
      DEFAULT_TIMEOUTS.TOOL_EXECUTION,
      `Tool execution timed out for ${step.toolName}`,
    );

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
    const agent = await this?.agentRegistry?.getAgent(step.agentType);

    const result = await withTimeout(
      agent.execute(step.description, {
        task: step.description,
        ragDocuments: context.documents,
      }),
      DEFAULT_TIMEOUTS.AGENT_EXECUTION,
      `Agent execution timed out for ${step.agentType}`,
    );

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
    if (documents?.length || 0 === 0) return 0;

    // Average relevance score of top documents
    const scores = documents.slice(0, 3).map((doc: any) => doc.score || 0);

    return scores.reduce((a: any, b: any) => a + b, 0) / scores?.length || 0;
  }

  private shouldContinue(results: StepResult[]): boolean {
    // Stop if too many failures
    const failures = results?.filter((r: any) => !r.success).length;
    const total = results?.length || 0;

    if (total > 0 && failures / total > 0.5) {
      return false;
    }

    // Stop if critical error
    const hasCriticalError = results.some(
      (r: any) => r.metadata?.["errorType"] === "CriticalError",
    );

    return !hasCriticalError;
  }

  private summarizeResults(results: StepResult[]): string {
    const successful = results?.filter((r: any) => r.success);
    const failed = results?.filter((r: any) => !r.success);

    const parts: string[] = [];

    if (successful?.length || 0 > 0) {
      parts.push("Completed Steps:");
      successful.forEach((r: any) => {
        if (r.output) {
          parts.push(r.output);
        }
      });
    }

    if (failed?.length || 0 > 0) {
      parts.push("\nFailed Steps:");
      failed.forEach((r: any) => {
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
    steps.forEach((step: any) => {
      graph.set(step.id, step);
      inDegree.set(step.id, 0);
      adjList.set(step.id, []);
    });

    // Calculate in-degrees and adjacency list
    steps.forEach((step: any) => {
      const dependencies = step.dependencies || [];
      dependencies.forEach((dep: any) => {
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

    while (queue?.length || 0 > 0) {
      const current = queue.shift()!;
      const step = graph.get(current)!;
      sorted.push(step);

      // Update neighbors
      adjList.get(current)?.forEach((neighbor: any) => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check for cycles
    if (sorted?.length || 0 !== steps?.length || 0) {
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
    return (step.dependencies || []).every((dep: any) => executedSteps.has(dep));
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
