import { BaseAgent } from '../base/BaseAgent';
import type { AgentContext, AgentResult } from '../base/AgentTypes';
interface Email {
    id: string;
    subject: string;
    body?: string;
    bodyPreview?: string;
    from: {
        emailAddress: {
            name: string;
            address: string;
        };
    };
    to?: Array<{
        emailAddress: {
            name: string;
            address: string;
        };
    }>;
    receivedDateTime: string;
    isRead: boolean;
    categories: string[];
    importance?: string;
}
export interface EmailAnalysis {
    categories: {
        workflow: string[];
        priority: string;
        intent: string;
        urgency: string;
    };
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    entities: EmailEntities;
    workflowState: string;
    suggestedActions: string[];
    confidence: number;
    summary: string;
}
interface EmailEntities {
    poNumbers: string[];
    quoteNumbers: string[];
    orderNumbers: string[];
    trackingNumbers: string[];
    caseNumbers: string[];
    customers: string[];
    products: string[];
    amounts: Array<{
        value: number;
        currency: string;
    }>;
    dates: Array<{
        date: string;
        context: string;
    }>;
}
export declare class EmailAnalysisAgent extends BaseAgent {
    private ollamaProvider;
    private cache;
    private readonly categories;
    private readonly patterns;
    private readonly workflowStates;
    constructor();
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
export {};
//# sourceMappingURL=EmailAnalysisAgent.d.ts.map