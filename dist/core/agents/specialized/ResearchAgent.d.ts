import { BaseAgent } from "../base/BaseAgent";
import type { AgentCapability, AgentContext, AgentResult, ToolExecutionParams } from "../base/AgentTypes";
export declare class ResearchAgent extends BaseAgent {
    private searchKnowledgeService?;
    constructor();
    private initializeKnowledgeService;
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    executeWithTool(params: ToolExecutionParams): Promise<AgentResult>;
    private createResearchPlan;
    private parseResearchPlan;
    private executeResearchPlan;
    private calculateRelevance;
    private synthesizeFindings;
    private extractSources;
    protected getAgentSpecificCapabilities(): AgentCapability[];
    protected registerDefaultTools(): void;
}
//# sourceMappingURL=ResearchAgent.d.ts.map