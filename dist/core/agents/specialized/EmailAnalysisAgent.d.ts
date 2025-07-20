import { BaseAgent } from '../base/BaseAgent';
import type { AgentContext, AgentResult } from '../base/AgentTypes';
export * from './EmailAnalysisTypes';
import type { Email, EmailAnalysis } from './EmailAnalysisTypes';
export declare class EmailAnalysisAgent extends BaseAgent {
    private ollamaProvider;
    private cache;
    private readonly categories;
    private readonly patterns;
    private readonly workflowStates;
    constructor();
    private initializeCache;
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    analyzeEmail(email: Email): Promise<EmailAnalysis>;
    private quickCategorize;
    private deepAnalyze;
    private extractEntities;
    private extractMatches;
    private getDateContext;
    private extractNEREntities;
    private determineWorkflowState;
    private generateActions;
    private generateSummary;
    private mergeAnalyses;
    private fallbackCategorization;
    private parseDeepAnalysis;
    private emptyEntities;
    private formatAnalysisOutput;
}
//# sourceMappingURL=EmailAnalysisAgent.d.ts.map