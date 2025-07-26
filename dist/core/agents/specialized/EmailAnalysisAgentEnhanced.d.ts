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
    hasAttachments?: boolean;
}
export interface QuickAnalysis {
    workflow: {
        primary: string;
        confidence: number;
    };
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    intent: 'Action Required' | 'FYI' | 'Request' | 'Update';
    urgency: 'Immediate' | '24 Hours' | '72 Hours' | 'No Rush';
    suggestedState: 'New' | 'In Review' | 'In Progress' | 'Pending External' | 'Completed' | 'Archived';
    confidence: number;
}
export interface DeepWorkflowAnalysis extends QuickAnalysis {
    detailedWorkflow: {
        primary: string;
        secondary: string[];
        relatedCategories: string[];
        confidence: number;
    };
    entities: EnhancedEmailEntities;
    actionItems: ActionItem[];
    workflowState: WorkflowState;
    businessImpact: BusinessImpact;
    contextualSummary: string;
    suggestedResponse?: string;
    relatedEmails?: string[];
}
interface EnhancedEmailEntities {
    poNumbers: Array<{
        value: string;
        format: '8-digit' | '10-digit' | '11-digit' | 'alphanumeric';
        context: string;
    }>;
    quoteNumbers: Array<{
        value: string;
        type: 'CAS' | 'TS' | 'WQ' | 'other';
        context: string;
    }>;
    caseNumbers: Array<{
        value: string;
        type: 'INC' | 'order' | 'tracking' | 'other';
        context: string;
    }>;
    partNumbers: string[];
    orderReferences: string[];
    contacts: {
        internal: Array<{
            name: string;
            role: string;
            email?: string;
        }>;
        external: Array<{
            name: string;
            company: string;
            email?: string;
        }>;
    };
    amounts: Array<{
        value: number;
        currency: string;
        context: string;
    }>;
    dates: Array<{
        date: string;
        type: string;
        context: string;
    }>;
}
interface ActionItem {
    action: string;
    type: 'reply' | 'forward' | 'task' | 'approval' | 'follow-up';
    deadline?: string;
    assignee?: string;
    priority: number;
    slaStatus?: 'on-track' | 'at-risk' | 'overdue';
}
interface WorkflowState {
    current: string;
    suggestedNext: string;
    estimatedCompletion?: string;
    blockers?: string[];
}
interface BusinessImpact {
    revenue?: number;
    customerSatisfaction: 'positive' | 'neutral' | 'negative';
    urgencyReason?: string;
}
export interface EmailAnalysisResult {
    quick: QuickAnalysis;
    deep: DeepWorkflowAnalysis;
    actionSummary: string;
    processingMetadata: {
        stage1Time: number;
        stage2Time: number;
        totalTime: number;
        models: {
            stage1: string;
            stage2: string;
        };
    };
}
export declare class EmailAnalysisAgentEnhanced extends BaseAgent {
    private quickProvider;
    private deepProvider;
    private cache;
    private readonly workflowDistribution;
    private readonly patterns;
    private readonly workflowStates;
    private readonly slaDefinitions;
    constructor();
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    analyzeEmail(email: Email): Promise<EmailAnalysisResult>;
    private quickCategorize;
    private deepWorkflowAnalysis;
    private extractEnhancedEntities;
    private extractMatchesWithContext;
    private extractMatches;
    private detectPOFormat;
    private detectDateType;
    private extractAndClassifyContacts;
    private extractCompanyFromEmail;
    private extractNameNearEmail;
    private calculateSLAStatus;
    private parseDeepAnalysis;
    private detectActionType;
    private mapPriorityToNumber;
    private getNextState;
    private generateContextualSummary;
    private extractActionSummary;
    private fallbackQuickCategorization;
    private enhanceQuickAnalysis;
    private inferSecondaryWorkflows;
    private inferActionItems;
    private trackWorkflowPattern;
    private formatAnalysisOutput;
}
export {};
//# sourceMappingURL=EmailAnalysisAgentEnhanced.d.ts.map