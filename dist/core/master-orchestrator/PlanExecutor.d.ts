import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import type { Plan, PlanStep, PlanExecutionResult } from "./types";
export declare class PlanExecutor {
    private agentRegistry;
    private ragSystem;
    constructor(agentRegistry: AgentRegistry, ragSystem: RAGSystem);
    execute(plan: Plan): Promise<PlanExecutionResult>;
    executeWithProgress(plan: Plan, progressCallback: (progress: {
        completedSteps: number;
        totalSteps: number;
        currentStep?: string;
    }) => void): Promise<PlanExecutionResult>;
    private gatherContext;
    private executeWithTool;
    private executeInformationQuery;
    private calculateRelevance;
    private shouldContinue;
    private summarizeResults;
    private topologicalSort;
    private areDependenciesSatisfied;
    buildRAGQuery(step: PlanStep): string;
}
//# sourceMappingURL=PlanExecutor.d.ts.map