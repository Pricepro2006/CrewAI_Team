import { BaseAgent } from '../base/BaseAgent';
import type { AgentCapability, AgentContext, AgentResult } from '../base/AgentTypes';
export declare class DataAnalysisAgent extends BaseAgent {
    constructor();
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    private analyzeDataTask;
    private parseDataTaskAnalysis;
    private performStatisticalAnalysis;
    private createVisualization;
    private transformData;
    private exploreData;
    private generalDataAnalysis;
    private extractInsights;
    private parseVisualizationConfig;
    private formatAnalysisOutput;
    protected getAgentSpecificCapabilities(): AgentCapability[];
    protected registerDefaultTools(): void;
}
//# sourceMappingURL=DataAnalysisAgent.d.ts.map