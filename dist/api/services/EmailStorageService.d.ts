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
    priority: "Critical" | "High" | "Medium" | "Low";
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
            type: "internal" | "external";
        }>;
    };
    actionItems: Array<{
        type: string;
        description: string;
        priority: string;
        slaHours: number;
        slaStatus: "on-track" | "at-risk" | "overdue";
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
        customerSatisfaction: "high" | "medium" | "low";
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
    private connectionPool?;
    private slaMonitoringInterval;
    private lazyLoader;
    private useConnectionPool;
    constructor(dbPath?: string, enableConnectionPool?: boolean);
    /**
     * Create a proxy database object that uses the connection pool
     * This provides compatibility with existing code that expects a db object
     */
    private createPooledDbProxy;
    /**
     * Initialize performance monitoring for database operations
     */
    private initializePerformanceMonitoring;
    /**
     * Execute optimized database query with performance monitoring
     */
    private executeOptimizedQuery;
    /**
     * Execute cached query with performance optimization
     */
    private executeCachedQuery;
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
    /**
     * Create email record from IEMS data
     */
    createEmail(emailData: {
        messageId: string;
        emailAlias: string;
        requestedBy: string;
        subject: string;
        summary: string;
        status: "red" | "yellow" | "green";
        statusText: string;
        workflowState: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
        workflowType?: string;
        priority?: "Critical" | "High" | "Medium" | "Low";
        receivedDate: Date;
        hasAttachments?: boolean;
        isRead?: boolean;
        body?: string;
        entities?: any[];
        recipients?: any[];
    }): Promise<string>;
    /**
     * Update email status with audit trail
     */
    updateEmailStatus(emailId: string, newStatus: "red" | "yellow" | "green", newStatusText?: string, performedBy?: string): Promise<void>;
    /**
     * Get recent emails for a specific user
     */
    getRecentEmailsForUser(userId: string, daysBack?: number): Promise<any[]>;
    /**
     * Create audit log entry
     */
    createAuditLog(auditData: {
        entityType: string;
        entityId: string;
        action: string;
        oldValues: Record<string, any>;
        newValues: Record<string, any>;
        performedBy: string;
    }): Promise<void>;
    /**
     * Batch load emails by IDs to avoid N+1 queries
     * This is a performance optimization method for loading multiple emails at once
     */
    batchLoadEmailsWithAnalysis(emailIds: string[]): Promise<Map<string, EmailWithAnalysis>>;
    /**
     * Get emails for table view with filtering, sorting, pagination (Performance Optimized)
     * Fixed SQL injection vulnerabilities
     */
    getEmailsForTableView(options: {
        page?: number;
        pageSize?: number;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        filters?: {
            status?: string[];
            emailAlias?: string[];
            workflowState?: string[];
            priority?: string[];
            dateRange?: {
                start: string;
                end: string;
            };
        };
        search?: string;
        refreshKey?: number;
    }): Promise<{
        emails: Array<{
            id: string;
            email_alias: string;
            requested_by: string;
            subject: string;
            summary: string;
            status: string;
            status_text: string;
            workflow_state: string;
            priority: string;
            received_date: string;
            is_read: boolean;
            has_attachments: boolean;
        }>;
        totalCount: number;
        totalPages: number;
        fromCache?: boolean;
        performanceMetrics?: {
            queryTime: number;
            cacheHit: boolean;
            optimizationGain: number;
        };
    }>;
    /**
     * Get emails for table view using lazy loading (Performance Optimized for Large Datasets)
     * Fixed SQL injection vulnerabilities
     */
    getEmailsForTableViewLazy(options: {
        startIndex?: number;
        chunkSize?: number;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        filters?: {
            status?: string[];
            emailAlias?: string[];
            workflowState?: string[];
            priority?: string[];
            dateRange?: {
                start: string;
                end: string;
            };
        };
        search?: string;
    }): Promise<{
        data: Array<{
            id: string;
            email_alias: string;
            requested_by: string;
            subject: string;
            summary: string;
            status: string;
            status_text: string;
            workflow_state: string;
            priority: string;
            received_date: string;
            is_read: boolean;
            has_attachments: boolean;
        }>;
        startIndex: number;
        endIndex: number;
        isFromCache: boolean;
        totalItems?: number;
    }>;
    /**
     * Get email dashboard statistics
     */
    getDashboardStats(): Promise<{
        totalEmails: number;
        criticalCount: number;
        inProgressCount: number;
        completedCount: number;
        statusDistribution: Record<string, number>;
    }>;
    private validateEmailData;
    /**
     * Enhanced column name sanitization to prevent SQL injection
     * Uses a whitelist approach with proper mapping
     */
    private getSortColumn;
    /**
     * @deprecated Use getSortColumn instead
     */
    private sanitizeColumnName;
    private extractIntent;
    private mapStatusToUrgency;
    private mapStatusToWorkflowState;
    private mapWorkflowToStatus;
    private getStatusText;
    private extractEntitiesOfType;
    /**
     * Get comprehensive performance statistics
     */
    getPerformanceMetrics(): Promise<{
        database: any;
        cache: any;
        lazyLoader: any;
        recommendations: string[];
    }>;
    /**
     * Get detailed performance report
     */
    getDetailedPerformanceReport(): Promise<any>;
    /**
     * Clear all performance caches
     */
    clearPerformanceCaches(): Promise<void>;
    /**
     * Preload adjacent chunks for smooth scrolling
     */
    preloadAdjacentChunks(currentIndex: number, options: {
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        filters?: any;
        search?: string;
    }): Promise<void>;
    /**
     * Optimize database queries and rebuild indexes if needed
     */
    optimizeDatabase(): Promise<{
        indexesRebuilt: number;
        vacuumCompleted: boolean;
        optimizationRecommendations: string[];
    }>;
    close(): Promise<void>;
    /**
     * Get connection pool statistics (if using pool)
     */
    getPoolStats(): any;
    /**
     * Get a single email by ID
     */
    getEmail(emailId: string): Promise<any | null>;
    /**
     * Update an email record
     */
    updateEmail(emailId: string, updates: Partial<any>): Promise<void>;
    /**
     * Log an activity related to email assignment
     */
    logActivity(activity: {
        emailId?: string;
        action: string;
        userId: string;
        details?: any;
        timestamp: string;
    }): Promise<void>;
    /**
     * Get assignment workload distribution
     */
    getAssignmentWorkload(): Promise<Record<string, number>>;
    /**
     * Get count of unassigned emails
     */
    getUnassignedCount(): Promise<number>;
    /**
     * Create singleton instance getter
     */
    private static instance;
    static getInstance(): EmailStorageService;
}
//# sourceMappingURL=EmailStorageService.d.ts.map