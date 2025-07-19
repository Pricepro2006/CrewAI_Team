import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import appConfig from '../../config/app.config';
import { logger } from '../../utils/logger';
import { wsService } from './WebSocketService';
export class EmailStorageService {
    db;
    slaMonitoringInterval = null;
    constructor() {
        this.db = new Database(appConfig.database.path);
        this.initializeDatabase();
    }
    initializeDatabase() {
        logger.info('Initializing email storage database', 'EMAIL_STORAGE');
        // Create emails table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        graph_id TEXT UNIQUE,
        subject TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        sender_name TEXT,
        to_addresses TEXT,
        received_at TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        has_attachments INTEGER NOT NULL DEFAULT 0,
        body_preview TEXT,
        body TEXT,
        importance TEXT,
        categories TEXT,
        raw_content TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create enhanced email analysis table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_analysis (
        id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        
        -- Quick analysis (Stage 1)
        quick_workflow TEXT,
        quick_priority TEXT,
        quick_intent TEXT,
        quick_urgency TEXT,
        quick_confidence REAL,
        quick_suggested_state TEXT,
        quick_model TEXT,
        quick_processing_time INTEGER,
        
        -- Deep analysis (Stage 2)
        deep_workflow_primary TEXT,
        deep_workflow_secondary TEXT,
        deep_workflow_related TEXT,
        deep_confidence REAL,
        
        -- Entity extraction
        entities_po_numbers TEXT,
        entities_quote_numbers TEXT,
        entities_case_numbers TEXT,
        entities_part_numbers TEXT,
        entities_order_references TEXT,
        entities_contacts TEXT,
        
        -- Action items
        action_summary TEXT,
        action_details TEXT,
        action_sla_status TEXT,
        
        -- Workflow state
        workflow_state TEXT DEFAULT 'New',
        workflow_state_updated_at TEXT,
        workflow_suggested_next TEXT,
        workflow_estimated_completion TEXT,
        workflow_blockers TEXT,
        
        -- Business impact
        business_impact_revenue REAL,
        business_impact_satisfaction TEXT,
        business_impact_urgency_reason TEXT,
        
        -- Context and relationships
        contextual_summary TEXT,
        suggested_response TEXT,
        related_emails TEXT,
        thread_position INTEGER,
        
        -- Processing metadata
        deep_model TEXT,
        deep_processing_time INTEGER,
        total_processing_time INTEGER,
        
        -- Timestamps
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
      );
    `);
        // Create workflow patterns table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_patterns (
        id TEXT PRIMARY KEY,
        pattern_name TEXT NOT NULL,
        workflow_category TEXT NOT NULL,
        trigger_keywords TEXT,
        typical_entities TEXT,
        average_completion_time INTEGER,
        success_rate REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create indexes for performance
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_graph_id ON emails(graph_id);
      CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
      CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
      CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_primary ON email_analysis(deep_workflow_primary);
      CREATE INDEX IF NOT EXISTS idx_workflow_state ON email_analysis(workflow_state);
      CREATE INDEX IF NOT EXISTS idx_sla_status ON email_analysis(action_sla_status);
      CREATE INDEX IF NOT EXISTS idx_workflow_patterns_category ON workflow_patterns(workflow_category);
    `);
        // Pre-populate TD SYNNEX workflow patterns
        this.seedWorkflowPatterns();
        logger.info('Email storage database initialized successfully', 'EMAIL_STORAGE');
    }
    seedWorkflowPatterns() {
        const patterns = [
            {
                pattern_name: 'Standard Order Processing',
                workflow_category: 'Order Management',
                success_rate: 0.973,
                average_completion_time: 2 * 60 * 60 * 1000, // 2 hours in ms
                trigger_keywords: 'order,purchase,PO,buy,procurement',
                typical_entities: 'po_numbers,order_references,part_numbers'
            },
            {
                pattern_name: 'Express Shipping Request',
                workflow_category: 'Shipping/Logistics',
                success_rate: 0.965,
                average_completion_time: 4 * 60 * 60 * 1000, // 4 hours in ms
                trigger_keywords: 'shipping,delivery,logistics,tracking,freight',
                typical_entities: 'tracking_numbers,order_references,contacts'
            },
            {
                pattern_name: 'Quote to Order Conversion',
                workflow_category: 'Quote Processing',
                success_rate: 0.892,
                average_completion_time: 24 * 60 * 60 * 1000, // 24 hours in ms
                trigger_keywords: 'quote,pricing,estimate,CAS,TS,WQ',
                typical_entities: 'quote_numbers,part_numbers,contacts'
            },
            {
                pattern_name: 'Technical Support Case',
                workflow_category: 'Customer Support',
                success_rate: 0.915,
                average_completion_time: 8 * 60 * 60 * 1000, // 8 hours in ms
                trigger_keywords: 'support,issue,problem,help,ticket',
                typical_entities: 'case_numbers,contacts,part_numbers'
            },
            {
                pattern_name: 'Partner Deal Registration',
                workflow_category: 'Deal Registration',
                success_rate: 0.883,
                average_completion_time: 72 * 60 * 60 * 1000, // 72 hours in ms
                trigger_keywords: 'deal,registration,partner,reseller',
                typical_entities: 'contacts,order_references'
            },
            {
                pattern_name: 'Manager Approval Request',
                workflow_category: 'Approval Workflows',
                success_rate: 0.947,
                average_completion_time: 12 * 60 * 60 * 1000, // 12 hours in ms
                trigger_keywords: 'approval,authorize,manager,escalate',
                typical_entities: 'contacts,order_references,po_numbers'
            },
            {
                pattern_name: 'Contract Renewal',
                workflow_category: 'Renewal Processing',
                success_rate: 0.871,
                average_completion_time: 168 * 60 * 60 * 1000, // 168 hours in ms
                trigger_keywords: 'renewal,contract,extend,expire',
                typical_entities: 'contacts,order_references'
            },
            {
                pattern_name: 'Vendor RMA Process',
                workflow_category: 'Vendor Management',
                success_rate: 0.824,
                average_completion_time: 96 * 60 * 60 * 1000, // 96 hours in ms
                trigger_keywords: 'RMA,return,vendor,defective',
                typical_entities: 'case_numbers,part_numbers,contacts'
            }
        ];
        const insertPattern = this.db.prepare(`
      INSERT OR IGNORE INTO workflow_patterns (
        id, pattern_name, workflow_category, success_rate, 
        average_completion_time, trigger_keywords, typical_entities
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (const pattern of patterns) {
            insertPattern.run(uuidv4(), pattern.pattern_name, pattern.workflow_category, pattern.success_rate, pattern.average_completion_time, pattern.trigger_keywords, pattern.typical_entities);
        }
        logger.info('Workflow patterns seeded successfully', 'EMAIL_STORAGE');
    }
    async storeEmail(email, analysis) {
        logger.info(`Storing email analysis: ${email.subject}`, 'EMAIL_STORAGE');
        const transaction = this.db.transaction(() => {
            // Store email
            const emailStmt = this.db.prepare(`
        INSERT OR REPLACE INTO emails (
          id, graph_id, subject, sender_email, sender_name, to_addresses,
          received_at, is_read, has_attachments, body_preview, body,
          importance, categories, raw_content, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            emailStmt.run(email.id, email.graphId, email.subject, email.from.emailAddress.address, email.from.emailAddress.name, JSON.stringify(email.to?.map(t => t.emailAddress) || []), email.receivedDateTime, email.isRead ? 1 : 0, email.hasAttachments ? 1 : 0, email.bodyPreview, email.body, email.importance, JSON.stringify(email.categories || []), JSON.stringify(email), new Date().toISOString());
            // Store enhanced analysis
            const analysisStmt = this.db.prepare(`
        INSERT OR REPLACE INTO email_analysis (
          id, email_id,
          quick_workflow, quick_priority, quick_intent, quick_urgency,
          quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
          deep_workflow_primary, deep_workflow_secondary, deep_workflow_related,
          deep_confidence,
          entities_po_numbers, entities_quote_numbers, entities_case_numbers,
          entities_part_numbers, entities_order_references, entities_contacts,
          action_summary, action_details, action_sla_status,
          workflow_state, workflow_suggested_next, workflow_blockers,
          business_impact_revenue, business_impact_satisfaction, business_impact_urgency_reason,
          contextual_summary, suggested_response, related_emails,
          deep_model, deep_processing_time, total_processing_time,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
            analysisStmt.run(uuidv4(), email.id, 
            // Quick analysis
            analysis.quick.workflow.primary, analysis.quick.priority, analysis.quick.intent, analysis.quick.urgency, analysis.quick.confidence, analysis.quick.suggestedState, analysis.processingMetadata.models.stage1, analysis.processingMetadata.stage1Time, 
            // Deep analysis
            analysis.deep.detailedWorkflow.primary, JSON.stringify(analysis.deep.detailedWorkflow.secondary || []), JSON.stringify(analysis.deep.detailedWorkflow.relatedCategories || []), analysis.deep.detailedWorkflow.confidence, 
            // Entities
            JSON.stringify(analysis.deep.entities.poNumbers), JSON.stringify(analysis.deep.entities.quoteNumbers), JSON.stringify(analysis.deep.entities.caseNumbers), JSON.stringify(analysis.deep.entities.partNumbers), JSON.stringify(analysis.deep.entities.orderReferences), JSON.stringify(analysis.deep.entities.contacts), 
            // Actions
            analysis.actionSummary, JSON.stringify(analysis.deep.actionItems), analysis.deep.actionItems[0]?.slaStatus || 'on-track', 
            // Workflow state
            analysis.deep.workflowState.current, analysis.deep.workflowState.suggestedNext, JSON.stringify(analysis.deep.workflowState.blockers || []), 
            // Business impact
            analysis.deep.businessImpact.revenue, analysis.deep.businessImpact.customerSatisfaction, analysis.deep.businessImpact.urgencyReason, 
            // Context
            analysis.deep.contextualSummary, analysis.deep.suggestedResponse, JSON.stringify(analysis.deep.relatedEmails || []), 
            // Metadata
            analysis.processingMetadata.models.stage2, analysis.processingMetadata.stage2Time, analysis.processingMetadata.totalTime, new Date().toISOString());
        });
        transaction();
        logger.info(`Email analysis stored successfully: ${email.id}`, 'EMAIL_STORAGE');
        // Broadcast real-time update for email analysis completion
        try {
            wsService.broadcastEmailAnalyzed(email.id, analysis.deep.detailedWorkflow.primary, analysis.quick.priority, analysis.actionSummary, analysis.deep.detailedWorkflow.confidence, analysis.deep.actionItems[0]?.slaStatus || 'on-track', analysis.deep.workflowState.current);
            logger.debug(`WebSocket broadcast sent for email analysis: ${email.id}`, 'EMAIL_STORAGE');
        }
        catch (error) {
            logger.error(`Failed to broadcast email analysis update: ${error}`, 'EMAIL_STORAGE');
        }
    }
    async getEmailWithAnalysis(emailId) {
        const stmt = this.db.prepare(`
      SELECT 
        e.*,
        a.quick_workflow, a.quick_priority, a.quick_intent, a.quick_urgency,
        a.quick_confidence, a.quick_suggested_state, a.quick_model, a.quick_processing_time,
        a.deep_workflow_primary, a.deep_workflow_secondary, a.deep_workflow_related,
        a.deep_confidence,
        a.entities_po_numbers, a.entities_quote_numbers, a.entities_case_numbers,
        a.entities_part_numbers, a.entities_order_references, a.entities_contacts,
        a.action_summary, a.action_details, a.action_sla_status,
        a.workflow_state, a.workflow_suggested_next, a.workflow_blockers,
        a.business_impact_revenue, a.business_impact_satisfaction, a.business_impact_urgency_reason,
        a.contextual_summary, a.suggested_response, a.related_emails,
        a.deep_model, a.deep_processing_time, a.total_processing_time
      FROM emails e
      LEFT JOIN email_analysis a ON e.id = a.email_id
      WHERE e.id = ?
    `);
        const result = stmt.get(emailId);
        if (!result) {
            return null;
        }
        // Reconstruct the email with analysis
        const email = {
            id: result.id,
            graphId: result.graph_id,
            subject: result.subject,
            from: {
                emailAddress: {
                    name: result.sender_name || '',
                    address: result.sender_email
                }
            },
            to: result.to_addresses ? JSON.parse(result.to_addresses) : [],
            receivedDateTime: result.received_at,
            isRead: result.is_read === 1,
            hasAttachments: result.has_attachments === 1,
            bodyPreview: result.body_preview,
            body: result.body,
            importance: result.importance,
            categories: result.categories ? JSON.parse(result.categories) : [],
            analysis: {
                quick: {
                    workflow: {
                        primary: result.quick_workflow,
                        secondary: result.deep_workflow_secondary ? JSON.parse(result.deep_workflow_secondary) : []
                    },
                    priority: result.quick_priority,
                    intent: result.quick_intent,
                    urgency: result.quick_urgency,
                    confidence: result.quick_confidence,
                    suggestedState: result.quick_suggested_state
                },
                deep: {
                    detailedWorkflow: {
                        primary: result.deep_workflow_primary,
                        secondary: result.deep_workflow_secondary ? JSON.parse(result.deep_workflow_secondary) : [],
                        relatedCategories: result.deep_workflow_related ? JSON.parse(result.deep_workflow_related) : [],
                        confidence: result.deep_confidence
                    },
                    entities: {
                        poNumbers: result.entities_po_numbers ? JSON.parse(result.entities_po_numbers) : [],
                        quoteNumbers: result.entities_quote_numbers ? JSON.parse(result.entities_quote_numbers) : [],
                        caseNumbers: result.entities_case_numbers ? JSON.parse(result.entities_case_numbers) : [],
                        partNumbers: result.entities_part_numbers ? JSON.parse(result.entities_part_numbers) : [],
                        orderReferences: result.entities_order_references ? JSON.parse(result.entities_order_references) : [],
                        contacts: result.entities_contacts ? JSON.parse(result.entities_contacts) : []
                    },
                    actionItems: result.action_details ? JSON.parse(result.action_details) : [],
                    workflowState: {
                        current: result.workflow_state,
                        suggestedNext: result.workflow_suggested_next,
                        blockers: result.workflow_blockers ? JSON.parse(result.workflow_blockers) : []
                    },
                    businessImpact: {
                        revenue: result.business_impact_revenue,
                        customerSatisfaction: result.business_impact_satisfaction,
                        urgencyReason: result.business_impact_urgency_reason
                    },
                    contextualSummary: result.contextual_summary,
                    suggestedResponse: result.suggested_response,
                    relatedEmails: result.related_emails ? JSON.parse(result.related_emails) : []
                },
                actionSummary: result.action_summary,
                processingMetadata: {
                    stage1Time: result.quick_processing_time,
                    stage2Time: result.deep_processing_time,
                    totalTime: result.total_processing_time,
                    models: {
                        stage1: result.quick_model,
                        stage2: result.deep_model
                    }
                }
            }
        };
        return email;
    }
    async getEmailsByWorkflow(workflow, limit = 50, offset = 0) {
        const stmt = this.db.prepare(`
      SELECT e.id
      FROM emails e
      JOIN email_analysis a ON e.id = a.email_id
      WHERE a.deep_workflow_primary = ?
      ORDER BY e.received_at DESC
      LIMIT ? OFFSET ?
    `);
        const results = stmt.all(workflow, limit, offset);
        const emails = [];
        for (const result of results) {
            const email = await this.getEmailWithAnalysis(result.id);
            if (email) {
                emails.push(email);
            }
        }
        return emails;
    }
    async getWorkflowAnalytics() {
        const totalEmails = this.db.prepare(`
      SELECT COUNT(*) as count FROM emails
    `).get().count;
        const workflowDistribution = this.db.prepare(`
      SELECT 
        deep_workflow_primary as workflow,
        COUNT(*) as count
      FROM email_analysis
      WHERE deep_workflow_primary IS NOT NULL
      GROUP BY deep_workflow_primary
    `).all();
        const slaCompliance = this.db.prepare(`
      SELECT 
        action_sla_status as status,
        COUNT(*) as count
      FROM email_analysis
      WHERE action_sla_status IS NOT NULL
      GROUP BY action_sla_status
    `).all();
        const avgProcessingTime = this.db.prepare(`
      SELECT AVG(total_processing_time) as avg_time
      FROM email_analysis
      WHERE total_processing_time IS NOT NULL
    `).get().avg_time || 0;
        return {
            totalEmails,
            workflowDistribution: workflowDistribution.reduce((acc, item) => {
                acc[item.workflow] = item.count;
                return acc;
            }, {}),
            slaCompliance: slaCompliance.reduce((acc, item) => {
                acc[item.status] = item.count;
                return acc;
            }, {}),
            averageProcessingTime: Math.round(avgProcessingTime)
        };
    }
    async updateWorkflowState(emailId, newState, changedBy) {
        // Get current state first
        const currentStateStmt = this.db.prepare(`
      SELECT workflow_state FROM email_analysis WHERE email_id = ?
    `);
        const currentResult = currentStateStmt.get(emailId);
        const oldState = currentResult?.workflow_state || 'unknown';
        // Update the state
        const updateStmt = this.db.prepare(`
      UPDATE email_analysis
      SET workflow_state = ?, workflow_state_updated_at = ?, updated_at = ?
      WHERE email_id = ?
    `);
        const now = new Date().toISOString();
        updateStmt.run(newState, now, now, emailId);
        logger.info(`Workflow state updated: ${emailId} -> ${newState}`, 'EMAIL_STORAGE');
        // Broadcast real-time update for workflow state change
        try {
            wsService.broadcastEmailStateChanged(emailId, oldState, newState, changedBy);
            logger.debug(`WebSocket broadcast sent for workflow state change: ${emailId}`, 'EMAIL_STORAGE');
        }
        catch (error) {
            logger.error(`Failed to broadcast workflow state change: ${error}`, 'EMAIL_STORAGE');
        }
    }
    async getWorkflowPatterns() {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_patterns
      ORDER BY success_rate DESC
    `);
        return stmt.all();
    }
    async checkSLAStatus() {
        const stmt = this.db.prepare(`
      SELECT 
        e.id,
        e.subject,
        e.received_at,
        a.deep_workflow_primary,
        a.quick_priority,
        a.action_sla_status,
        a.workflow_state
      FROM emails e
      JOIN email_analysis a ON e.id = a.email_id
      WHERE a.workflow_state NOT IN ('Completed', 'Archived')
      AND (
        a.action_sla_status = 'at-risk' OR
        a.action_sla_status = 'overdue' OR
        (
          a.action_sla_status = 'on-track' AND
          (
            (a.quick_priority = 'Critical' AND datetime(e.received_at, '+4 hours') < datetime('now')) OR
            (a.quick_priority = 'High' AND datetime(e.received_at, '+1 day') < datetime('now')) OR
            (a.quick_priority = 'Medium' AND datetime(e.received_at, '+3 days') < datetime('now')) OR
            (a.quick_priority = 'Low' AND datetime(e.received_at, '+7 days') < datetime('now'))
          )
        )
      )
    `);
        const slaViolations = stmt.all();
        for (const violation of slaViolations) {
            const receivedAt = new Date(violation.received_at);
            const now = new Date();
            const diffMs = now.getTime() - receivedAt.getTime();
            // Calculate SLA thresholds in milliseconds
            const slaThresholds = {
                Critical: 4 * 60 * 60 * 1000, // 4 hours
                High: 24 * 60 * 60 * 1000, // 24 hours
                Medium: 72 * 60 * 60 * 1000, // 72 hours
                Low: 168 * 60 * 60 * 1000, // 168 hours
            };
            const slaThreshold = slaThresholds[violation.quick_priority];
            const isOverdue = diffMs > slaThreshold;
            const isAtRisk = diffMs > (slaThreshold * 0.8); // 80% of SLA time
            let slaStatus;
            let timeRemaining;
            let overdueDuration;
            if (isOverdue) {
                slaStatus = 'overdue';
                overdueDuration = diffMs - slaThreshold;
            }
            else if (isAtRisk) {
                slaStatus = 'at-risk';
                timeRemaining = slaThreshold - diffMs;
            }
            else {
                continue; // Skip if not at risk or overdue
            }
            // Update SLA status in database
            const updateStmt = this.db.prepare(`
        UPDATE email_analysis 
        SET action_sla_status = ?
        WHERE email_id = ?
      `);
            updateStmt.run(slaStatus, violation.id);
            // Broadcast SLA alert
            try {
                wsService.broadcastEmailSLAAlert(violation.id, violation.deep_workflow_primary, violation.quick_priority, slaStatus, timeRemaining, overdueDuration);
                logger.info(`SLA alert broadcast for email ${violation.id}: ${slaStatus}`, 'EMAIL_STORAGE');
            }
            catch (error) {
                logger.error(`Failed to broadcast SLA alert for email ${violation.id}: ${error}`, 'EMAIL_STORAGE');
            }
        }
    }
    startSLAMonitoring(intervalMs = 300000) {
        if (this.slaMonitoringInterval) {
            clearInterval(this.slaMonitoringInterval);
        }
        this.slaMonitoringInterval = setInterval(() => {
            this.checkSLAStatus().catch(error => {
                logger.error(`SLA monitoring failed: ${error}`, 'EMAIL_STORAGE');
            });
        }, intervalMs);
        logger.info('SLA monitoring started', 'EMAIL_STORAGE');
    }
    stopSLAMonitoring() {
        if (this.slaMonitoringInterval) {
            clearInterval(this.slaMonitoringInterval);
            this.slaMonitoringInterval = null;
            logger.info('SLA monitoring stopped', 'EMAIL_STORAGE');
        }
    }
    async close() {
        this.stopSLAMonitoring();
        this.db.close();
    }
}
//# sourceMappingURL=EmailStorageService.js.map