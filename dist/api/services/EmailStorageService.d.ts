export interface EmailAnalysisResult {
    quick: QuickAnalysis;
    deep: DeepWorkflowAnalysis;
    actionSummary: string;
    processingMetadata: ProcessingMetadata;
}
export interface QuickAnalysis {
    workflow: {
        primary: string;
        secondary?: string[];
    };
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    intent: string;
    urgency: string;
    confidence: number;
    suggestedState: string;
}
export interface DeepWorkflowAnalysis {
    detailedWorkflow: {
        primary: string;
        secondary?: string[];
        relatedCategories?: string[];
        confidence: number;
    };
    entities: {
        poNumbers: Array<{
            value: string;
            format: string;
            confidence: number;
        }>;
        quoteNumbers: Array<{
            value: string;
            type: string;
            confidence: number;
        }>;
        caseNumbers: Array<{
            value: string;
            type: string;
            confidence: number;
        }>;
        partNumbers: Array<{
            value: string;
            confidence: number;
        }>;
        orderReferences: Array<{
            value: string;
            confidence: number;
        }>;
        contacts: Array<{
            name: string;
            email?: string;
            type: 'internal' | 'external';
        }>;
    };
    actionItems: Array<{
        type: string;
        description: string;
        priority: string;
        slaHours: number;
        slaStatus: 'on-track' | 'at-risk' | 'overdue';
        estimatedCompletion?: string;
    }>;
    workflowState: {
        current: string;
        suggestedNext: string;
        blockers?: string[];
        estimatedCompletion?: string;
    };
    businessImpact: {
        revenue?: number;
        customerSatisfaction: 'high' | 'medium' | 'low';
        urgencyReason?: string;
    };
    contextualSummary: string;
    suggestedResponse?: string;
    relatedEmails?: string[];
}
export interface ProcessingMetadata {
    stage1Time: number;
    stage2Time: number;
    totalTime: number;
    models: {
        stage1: string;
        stage2: string;
    };
}
export interface Email {
    id: string;
    graphId?: string;
    subject: string;
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
    hasAttachments: boolean;
    bodyPreview?: string;
    body?: string;
    importance?: string;
    categories?: string[];
}
export interface EmailWithAnalysis extends Email {
    analysis: EmailAnalysisResult;
}
export declare class EmailStorageService {
    private db;
    private slaMonitoringInterval;
    constructor();
    private initializeDatabase;
    private seedWorkflowPatterns;
    storeEmail(email: Email, analysis: EmailAnalysisResult): Promise<void>;
    getEmailWithAnalysis(emailId: string): Promise<EmailWithAnalysis | null>;
    getEmailsByWorkflow(workflow: string, limit?: number, offset?: number): Promise<EmailWithAnalysis[]>;
    getWorkflowAnalytics(): Promise<{
        totalEmails: number;
        workflowDistribution: Record<string, number>;
        slaCompliance: Record<string, number>;
        averageProcessingTime: number;
    }>;
    updateWorkflowState(emailId: string, newState: string, changedBy?: string): Promise<void>;
    getWorkflowPatterns(): Promise<any[]>;
    checkSLAStatus(): Promise<void>;
    startSLAMonitoring(intervalMs?: number): void;
    stopSLAMonitoring(): void;
    close(): void;
}
//# sourceMappingURL=EmailStorageService.d.ts.map