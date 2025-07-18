import { BaseAgent } from "../base/BaseAgent";
import type { AgentCapability, AgentContext, AgentResult } from "../base/AgentTypes";
export declare class ToolExecutorAgent extends BaseAgent {
    constructor();
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    private createToolExecutionPlan;
    private parseToolPlan;
    private resolveTools;
    private executeToolPlan;
    private executeTool;
    private enhanceParameters;
    private synthesizeResults;
    protected getAgentSpecificCapabilities(): AgentCapability[];
    protected registerDefaultTools(): void;
    executeSpecificTool(toolName: string, parameters: any, context?: AgentContext): Promise<AgentResult>;
}
//# sourceMappingURL=ToolExecutorAgent.d.ts.map