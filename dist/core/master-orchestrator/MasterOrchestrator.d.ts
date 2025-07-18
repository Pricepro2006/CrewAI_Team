import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import type { ExecutionResult, Query, MasterOrchestratorConfig } from "./types";
export declare class MasterOrchestrator {
    private llm;
    agentRegistry: AgentRegistry;
    ragSystem: RAGSystem;
    private planExecutor;
    private planReviewer;
    private enhancedParser;
    private agentRouter;
    private perfMonitor;
    constructor(config: MasterOrchestratorConfig);
    initialize(): Promise<void>;
    isInitialized(): Promise<boolean>;
    processQuery(query: Query): Promise<ExecutionResult>;
    private createPlan;
    private replan;
    private parsePlan;
    private formatResponse;
}
//# sourceMappingURL=MasterOrchestrator.d.ts.map