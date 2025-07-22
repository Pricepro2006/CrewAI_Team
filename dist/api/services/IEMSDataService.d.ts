/**
 * IEMS Data Service
 * Handles loading and processing of IEMS email data from JSON files
 */
import type { RawIEMSEmail, IEMSEmail, EmailCategory, EmailStatus, IEMSMailbox, IEMSDistributionList, CategorizedEmails } from '../../types/iems-email.types';
export declare class IEMSDataService {
    private static instance;
    private mailboxes;
    private distributionLists;
    private emailCache;
    private emailAnalysisAgent;
    private readonly IEMS_BASE_PATH;
    private readonly EMAIL_BATCHES_PATH;
    private readonly MAILBOXES_FILE;
    private readonly DISTRIBUTION_LIST_FILE;
    private constructor();
    static getInstance(): IEMSDataService;
    /**
     * Initialize the service by loading configuration files
     */
    initialize(): Promise<void>;
    /**
     * Load and process email batches
     */
    loadEmailBatches(batchNumbers?: number[]): Promise<RawIEMSEmail[]>;
    /**
     * Categorize email based on recipient
     */
    categorizeEmail(email: RawIEMSEmail): EmailCategory;
    /**
     * Determine email status based on various factors
     */
    determineEmailStatus(email: RawIEMSEmail): EmailStatus;
    /**
     * Generate summary from email content
     */
    generateSummary(email: RawIEMSEmail): Promise<string>;
    /**
     * Generate basic summary without AI
     */
    private generateBasicSummary;
    /**
     * Extract text content from HTML
     */
    private extractTextContent;
    /**
     * Parse recipients JSON string
     */
    private parseRecipients;
    /**
     * Process raw emails into UI-ready format
     */
    processEmails(rawEmails: RawIEMSEmail[]): Promise<IEMSEmail[]>;
    /**
     * Get email alias for display
     */
    private getEmailAlias;
    /**
     * Get status text for display
     */
    private getStatusText;
    /**
     * Get assigned team member for marketing emails
     */
    private getAssignedTo;
    /**
     * Get action button text for VMware emails
     */
    private getActionForEmail;
    /**
     * Get email priority
     */
    private getPriority;
    /**
     * Get categorized emails for dashboard display
     */
    getCategorizedEmails(limit?: number): Promise<CategorizedEmails>;
    /**
     * Get mailboxes configuration
     */
    getMailboxes(): IEMSMailbox[];
    /**
     * Get distribution lists configuration
     */
    getDistributionLists(): IEMSDistributionList[];
}
//# sourceMappingURL=IEMSDataService.d.ts.map