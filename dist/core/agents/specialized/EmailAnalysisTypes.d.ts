/**
 * Email Analysis Types
 * Shared types for email analysis functionality
 */
export interface Email {
    id: string;
    subject: string;
    body?: string;
    bodyPreview?: string;
    sender?: string;
    recipient?: string;
    content?: string;
    metadata?: Record<string, any>;
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
    prioritySource?: 'pattern-rule' | 'workflow-rule' | 'model';
}
export interface EmailEntities {
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
export interface EmailProcessingResult {
    analysis: EmailAnalysis;
    processingTime: number;
    confidence: number;
    warnings: string[];
}
export interface EmailBatchResult {
    results: EmailProcessingResult[];
    totalProcessed: number;
    averageConfidence: number;
    errors: string[];
}
//# sourceMappingURL=EmailAnalysisTypes.d.ts.map