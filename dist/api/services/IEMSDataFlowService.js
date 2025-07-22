import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../../utils/logger';
import { z } from 'zod';
const execAsync = promisify(exec);
// Data flow configuration schema
const DataFlowConfigSchema = z.object({
    iemsAnalysisDir: z.string().default('/home/pricepro2006/iems_project/analysis_results'),
    iemsDatabase: z.string().default('/home/pricepro2006/iems_project/iems.db'),
    dashboardDatabase: z.string().default('/home/pricepro2006/CrewAI_Team/data/email_dashboard.db'),
    syncIntervalMinutes: z.number().default(30),
    batchSize: z.number().default(100),
    enableRealTimeSync: z.boolean().default(true),
    watchNewFiles: z.boolean().default(true)
});
/**
 * Service for managing data flow between IEMS and Email Dashboard
 */
export class IEMSDataFlowService extends EventEmitter {
    config;
    emailService;
    wsService;
    syncInterval;
    fileWatcher;
    status;
    isSyncing = false;
    constructor(config = {}, emailService, wsService) {
        super();
        this.config = DataFlowConfigSchema.parse(config);
        this.emailService = emailService;
        this.wsService = wsService;
        this.status = {
            isRunning: false,
            totalSyncs: 0,
            totalRecordsProcessed: 0
        };
    }
    /**
     * Start the data flow service
     */
    async start() {
        if (this.status.isRunning) {
            logger.warn('Data flow service is already running');
            return;
        }
        logger.info('Starting IEMS data flow service');
        this.status.isRunning = true;
        // Perform initial sync
        await this.performSync();
        // Set up scheduled sync
        if (this.config.syncIntervalMinutes > 0) {
            this.setupScheduledSync();
        }
        // Set up file watcher for new analysis files
        if (this.config.watchNewFiles) {
            await this.setupFileWatcher();
        }
        // Set up real-time event listeners
        if (this.config.enableRealTimeSync) {
            this.setupRealTimeSync();
        }
        this.emit('started');
        logger.info('IEMS data flow service started successfully');
    }
    /**
     * Stop the data flow service
     */
    async stop() {
        logger.info('Stopping IEMS data flow service');
        this.status.isRunning = false;
        // Clear scheduled sync
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
        }
        // Stop file watcher
        if (this.fileWatcher) {
            await this.fileWatcher.close();
            this.fileWatcher = undefined;
        }
        this.emit('stopped');
        logger.info('IEMS data flow service stopped');
    }
    /**
     * Perform a manual sync
     */
    async performSync() {
        if (this.isSyncing) {
            logger.warn('Sync already in progress, skipping');
            return {
                success: false,
                recordsProcessed: 0,
                recordsFailed: 0,
                duration: 0,
                errors: ['Sync already in progress']
            };
        }
        this.isSyncing = true;
        const startTime = Date.now();
        const result = {
            success: false,
            recordsProcessed: 0,
            recordsFailed: 0,
            duration: 0,
            errors: []
        };
        try {
            logger.info('Starting IEMS data sync');
            this.emit('sync:start');
            // Run the migration pipeline
            const migrationScript = path.join(__dirname, '..', '..', 'scripts', 'migration', 'data_pipeline.py');
            const { stdout, stderr } = await execAsync(`python3 "${migrationScript}"`, {
                timeout: 300000 // 5 minute timeout
            });
            if (stderr && !stderr.includes('INFO')) {
                result.errors?.push(stderr);
            }
            // Parse results from stdout
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes('Transformed') && line.includes('emails')) {
                    const match = line.match(/Transformed (\d+) emails/);
                    if (match && match[1]) {
                        result.recordsProcessed = parseInt(match[1], 10);
                    }
                }
            }
            result.success = true;
            this.status.lastSync = new Date();
            this.status.totalSyncs++;
            this.status.totalRecordsProcessed += result.recordsProcessed;
            // Notify via WebSocket
            this.wsService.broadcastEmailBulkUpdate('sync_complete', [], {
                successful: result.recordsProcessed || 0,
                failed: 0,
                total: result.recordsProcessed || 0
            });
            logger.info(`Sync completed: ${result.recordsProcessed} records processed`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors?.push(errorMessage);
            this.status.lastError = errorMessage;
            logger.error('Sync failed:', error instanceof Error ? error.message : String(error));
            // Notify error via WebSocket
            this.wsService.broadcastEmailBulkUpdate('sync_error', [], {
                successful: 0,
                failed: 1,
                total: 1
            });
        }
        finally {
            result.duration = Date.now() - startTime;
            this.isSyncing = false;
            this.emit('sync:complete', result);
        }
        return result;
    }
    /**
     * Process a single new analysis file
     */
    async processNewAnalysisFile(filePath) {
        try {
            logger.info(`Processing new analysis file: ${filePath}`);
            // Extract batch info from filename
            const filename = path.basename(filePath);
            const match = filename.match(/analysis_batch_(\d+)_(\d{8})_(\d{6})\.txt/);
            if (!match) {
                logger.warn(`Invalid filename format: ${filename}`);
                return;
            }
            const batchNumber = parseInt(match[1] || '0', 10);
            const dateStr = match[2] || '';
            const timeStr = match[3] || '';
            // Read and parse the file
            const content = await fs.readFile(filePath, 'utf-8');
            const jsonMatch = content.match(/```json\s*(.*?)\s*```/s);
            if (!jsonMatch) {
                logger.warn(`No JSON found in ${filename}`);
                return;
            }
            const analysisData = JSON.parse(jsonMatch[1] || '{}');
            // Create email record from analysis
            const emailData = this.transformAnalysisToEmail(analysisData, {
                batchNumber,
                dateStr,
                timeStr
            });
            // Save to database
            await this.emailService.createEmail(emailData);
            // Broadcast update
            this.wsService.broadcastEmailBulkUpdate('new_email', [emailData.id], {
                successful: 1,
                failed: 0,
                total: 1
            });
            logger.info(`Successfully processed ${filename}`);
        }
        catch (error) {
            logger.error(`Failed to process file ${filePath}:`, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Transform analysis data to email format
     */
    transformAnalysisToEmail(analysis, metadata) {
        const workflowAnalysis = analysis.workflow_analysis || {};
        const entityExtraction = analysis.entity_extraction || {};
        const priorityAssessment = analysis.priority_assessment || {};
        const participants = entityExtraction.participants || {};
        const customer = participants.customer || {};
        // Determine email alias based on workflow type
        let emailAlias = 'Team4401@tdsynnex.com';
        const primaryFocus = workflowAnalysis.primary_focus || '';
        if (primaryFocus.includes('Quote')) {
            emailAlias = 'InsightHPI@tdsynnex.com';
        }
        else if (primaryFocus.includes('Order')) {
            emailAlias = 'InsightOrderSupport@tdsynnex.com';
        }
        else if (primaryFocus.includes('Surface')) {
            emailAlias = 'US.InsightSurface@tdsynnex.com';
        }
        else if (primaryFocus.includes('Renewal')) {
            emailAlias = 'Insight3@tdsynnex.com';
        }
        // Map workflow state to status
        const workflowState = workflowAnalysis.overall_state || '';
        let status = 'yellow';
        let statusText = 'In Progress';
        if (workflowState.includes('🔴') || workflowState.includes('Started')) {
            status = 'red';
            statusText = 'Critical';
        }
        else if (workflowState.includes('🟢') || workflowState.includes('Completed')) {
            status = 'green';
            statusText = 'Completed';
        }
        // Create email record
        return {
            messageId: `MSG_batch_${metadata.batchNumber}_${metadata.dateStr}_${metadata.timeStr}`,
            emailAlias,
            requestedBy: customer.name || 'Unknown Requester',
            subject: primaryFocus || `Email Batch ${metadata.batchNumber}`,
            summary: this.generateSummary(workflowAnalysis, priorityAssessment),
            status,
            statusText,
            workflowState: this.mapWorkflowState(workflowState),
            workflowType: this.mapWorkflowType(primaryFocus),
            priority: this.mapPriority(priorityAssessment.urgency_level),
            receivedDate: this.parseDate(metadata.dateStr, metadata.timeStr),
            hasAttachments: false,
            isRead: false,
            body: JSON.stringify(analysis, null, 2),
            entities: this.extractEntities(entityExtraction),
            recipients: this.extractRecipients(participants)
        };
    }
    /**
     * Generate email summary
     */
    generateSummary(workflow, priority) {
        const parts = [
            `Workflow: ${workflow.overall_state || 'Unknown'}`,
            workflow.primary_focus || 'Processing',
            `Priority: ${priority.urgency_level || 'Medium'}`,
            `Impact: ${priority.business_impact || 'Normal'}`
        ];
        return parts.join(' - ').substring(0, 500);
    }
    /**
     * Map workflow state
     */
    mapWorkflowState(state) {
        if (state.includes('Started'))
            return 'START_POINT';
        if (state.includes('Completed') || state.includes('Resolved'))
            return 'COMPLETION';
        return 'IN_PROGRESS';
    }
    /**
     * Map workflow type
     */
    mapWorkflowType(primaryFocus) {
        const mappings = [
            { pattern: /Quote/i, type: 'Quote Processing' },
            { pattern: /Order/i, type: 'Order Management' },
            { pattern: /Invoice/i, type: 'Billing Support' },
            { pattern: /Technical/i, type: 'Technical Support' },
            { pattern: /Return|RMA/i, type: 'RMA Processing' },
            { pattern: /Shipping/i, type: 'Shipping Management' },
            { pattern: /Account/i, type: 'Account Management' }
        ];
        for (const mapping of mappings) {
            if (mapping.pattern.test(primaryFocus)) {
                return mapping.type;
            }
        }
        return 'General Support';
    }
    /**
     * Map priority level
     */
    mapPriority(urgencyLevel) {
        if (!urgencyLevel)
            return 'Medium';
        switch (urgencyLevel.toLowerCase()) {
            case 'critical':
            case 'urgent':
                return 'Critical';
            case 'high':
                return 'High';
            case 'low':
                return 'Low';
            default:
                return 'Medium';
        }
    }
    /**
     * Parse date from components
     */
    parseDate(dateStr, timeStr) {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const month = parseInt(dateStr.substring(4, 6), 10) - 1;
        const day = parseInt(dateStr.substring(6, 8), 10);
        const hour = parseInt(timeStr.substring(0, 2), 10);
        const minute = parseInt(timeStr.substring(2, 4), 10);
        const second = parseInt(timeStr.substring(4, 6), 10);
        return new Date(year, month, day, hour, minute, second);
    }
    /**
     * Extract entities from analysis
     */
    extractEntities(entityData) {
        const entities = [];
        const refNumbers = entityData.reference_numbers || {};
        // PO Numbers
        for (const po of refNumbers.po_numbers || []) {
            entities.push({
                type: 'po_number',
                value: po,
                context: 'Purchase Order'
            });
        }
        // Products
        for (const product of refNumbers.products || []) {
            if (typeof product === 'object') {
                entities.push({
                    type: 'product',
                    value: product.name || '',
                    context: product.type || ''
                });
            }
        }
        return entities;
    }
    /**
     * Extract recipients from participants
     */
    extractRecipients(participants) {
        const recipients = [];
        // Customer
        const customer = participants.customer || {};
        if (customer.name) {
            recipients.push({
                type: 'to',
                name: customer.name,
                email: customer.email || `${customer.name.replace(/\s+/g, '.')}@unknown.com`
            });
        }
        // Internal team
        for (const member of participants.internal_team || []) {
            recipients.push({
                type: 'cc',
                name: member.name || '',
                email: member.email || ''
            });
        }
        return recipients;
    }
    /**
     * Set up scheduled sync
     */
    setupScheduledSync() {
        const intervalMs = this.config.syncIntervalMinutes * 60 * 1000;
        this.syncInterval = setInterval(async () => {
            logger.info('Running scheduled sync');
            await this.performSync();
        }, intervalMs);
        // Calculate next sync time
        this.status.nextSync = new Date(Date.now() + intervalMs);
        logger.info(`Scheduled sync every ${this.config.syncIntervalMinutes} minutes`);
    }
    /**
     * Set up file watcher for new analysis files
     */
    async setupFileWatcher() {
        // TODO: Install chokidar package and types
        logger.warn('File watching disabled - chokidar not available', 'IEMS_DATAFLOW');
        /* TODO: Uncomment when chokidar is installed
        const chokidar = await import('chokidar');
        
        this.fileWatcher = chokidar.watch(
          path.join(this.config.iemsAnalysisDir, 'analysis_batch_*.txt'),
          {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
          }
        );
    
        this.fileWatcher.on('add', async (filePath: string) => {
          logger.info(`New analysis file detected: ${filePath}`);
          
          // Wait a bit to ensure file is fully written
          setTimeout(async () => {
            await this.processNewAnalysisFile(filePath);
          }, 1000);
        });
    
        logger.info(`Watching for new files in ${this.config.iemsAnalysisDir}`);
        */
    }
    /**
     * Set up real-time sync event listeners
     */
    setupRealTimeSync() {
        // Listen for manual sync requests
        this.wsService.on('sync:request', async () => {
            logger.info('Manual sync requested via WebSocket');
            await this.performSync();
        });
        // Listen for status requests
        this.wsService.on('status:request', () => {
            this.wsService.broadcastEmailBulkUpdate('status_update', [], {
                successful: 0,
                failed: 0,
                total: 0
            });
        });
        logger.info('Real-time sync listeners configured');
    }
    /**
     * Get service status
     */
    getStatus() {
        return { ...this.status };
    }
    /**
     * Get sync statistics
     */
    async getStatistics() {
        const stats = {
            ...this.status,
            config: {
                syncInterval: this.config.syncIntervalMinutes,
                batchSize: this.config.batchSize,
                realTimeSync: this.config.enableRealTimeSync,
                fileWatching: this.config.watchNewFiles
            },
            analysisFileCount: 0,
            lastAnalysisFile: null
        };
        try {
            // Count analysis files
            const files = await fs.readdir(this.config.iemsAnalysisDir);
            const analysisFiles = files.filter(f => f.match(/analysis_batch_.*\.txt$/));
            stats.analysisFileCount = analysisFiles.length;
            // Find most recent file
            if (analysisFiles.length > 0) {
                analysisFiles.sort().reverse();
                stats.lastAnalysisFile = analysisFiles[0] || null;
            }
        }
        catch (error) {
            logger.error('Failed to get analysis file stats:', error instanceof Error ? error.message : String(error));
        }
        return stats;
    }
}
//# sourceMappingURL=IEMSDataFlowService.js.map