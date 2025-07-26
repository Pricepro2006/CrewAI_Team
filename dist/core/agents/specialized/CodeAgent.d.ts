import { BaseAgent } from '../base/BaseAgent';
import type { AgentCapability, AgentContext, AgentResult } from '../base/AgentTypes';
export declare class CodeAgent extends BaseAgent {
    constructor();
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    private analyzeTask;
    private parseTaskAnalysis;
    private generateCode;
    private analyzeCode;
    private refactorCode;
    private debugCode;
    private generalCodeTask;
    private extractCode;
    private extractSuggestions;
    private formatCodeOutput;
    protected getAgentSpecificCapabilities(): AgentCapability[];
    protected registerDefaultTools(): void;
}
//# sourceMappingURL=CodeAgent.d.ts.map