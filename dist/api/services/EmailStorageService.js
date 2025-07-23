import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import appConfig from "../../config/app.config";
import { logger } from "../../utils/logger";
import { wsService } from "./WebSocketService";
import { performanceOptimizer } from "./PerformanceOptimizer";
import { queryPerformanceMonitor } from "./QueryPerformanceMonitor";
import { LazyLoader } from "../../utils/LazyLoader";
import { ConnectionPool } from "../../core/database/ConnectionPool";
export class EmailStorageService {
    db;
    connectionPool;
    slaMonitoringInterval = null;
    lazyLoader;
    useConnectionPool;
    constructor(dbPath, enableConnectionPool = false) {
        const databasePath = dbPath || appConfig.database.path;
        this.useConnectionPool = enableConnectionPool;
        if (this.useConnectionPool) {
            // Initialize connection pool for high-concurrency scenarios
            this.connectionPool = new ConnectionPool({
                filename: databasePath,
                poolSize: 5,
                enableWAL: true,
                checkpointInterval: 60000, // 1 minute
                walSizeLimit: 10 * 1024 * 1024, // 10MB
                verbose: process.env.NODE_ENV === "development",
            });
            // Create a proxy db object for compatibility
            this.db = this.createPooledDbProxy();
            logger.info("EmailStorageService initialized with connection pool", "EMAIL_STORAGE");
        }
        else {
            // Use single connection for better performance in single-threaded scenarios
            this.db = new Database(databasePath);
            logger.info("EmailStorageService initialized with single connection", "EMAIL_STORAGE");
        }
        this.lazyLoader = new LazyLoader(50, 20, 5 * 60 * 1000); // 50 items per chunk, 20 chunks cache, 5min TTL
        this.initializeDatabase();
        this.initializePerformanceMonitoring();
    }
    /**
     * Create a proxy database object that uses the connection pool
     * This provides compatibility with existing code that expects a db object
     */
    createPooledDbProxy() {
        const pool = this.connectionPool;
        // Create a proxy that intercepts database method calls
        const handler = {
            get: (target, prop) => {
                // For prepare method, return a function that uses the pool
                if (prop === "prepare") {
                    return (sql) => {
                        // Return a statement-like object that uses the pool
                        return {
                            run: (...params) => {
                                return pool.execute((db) => db.prepare(sql).run(...params));
                            },
                            get: (...params) => {
                                return pool.execute((db) => db.prepare(sql).get(...params));
                            },
                            all: (...params) => {
                                return pool.execute((db) => db.prepare(sql).all(...params));
                            },
                            iterate: (...params) => {
                                // For iterate, we need special handling as it returns an iterator
                                return pool.execute((db) => db.prepare(sql).iterate(...params));
                            },
                        };
                    };
                }
                // For transaction method
                if (prop === "transaction") {
                    return (fn) => {
                        return (...args) => {
                            return pool.execute((db) => {
                                const transaction = db.transaction(fn);
                                return transaction(...args);
                            });
                        };
                    };
                }
                // For pragma method
                if (prop === "pragma") {
                    return (pragma) => {
                        return pool.execute((db) => db.pragma(pragma));
                    };
                }
                // For exec method
                if (prop === "exec") {
                    return (sql) => {
                        return pool.execute((db) => db.exec(sql));
                    };
                }
                // For close method (no-op as pool manages connections)
                if (prop === "close") {
                    return () => {
                        logger.debug("Close called on pooled db proxy (no-op)", "EMAIL_STORAGE");
                    };
                }
                // Default: return property as-is
                return target[prop];
            },
        };
        // Create and return the proxy
        return new Proxy({}, handler);
    }
    /**
     * Initialize performance monitoring for database operations
     */
    initializePerformanceMonitoring() {
        try {
            // Start query performance monitoring
            queryPerformanceMonitor.startMonitoring();
            // Register monitors for common query patterns
            queryPerformanceMonitor.registerQueryMonitor("email_table_view", {
                alertOnSlow: true,
                alertOnError: true,
                trackStatistics: true,
            });
            queryPerformanceMonitor.registerQueryMonitor("workflow_analytics", {
                alertOnSlow: true,
                alertOnError: true,
                trackStatistics: true,
            });
            logger.info("Performance monitoring initialized for EmailStorageService", "EMAIL_STORAGE");
        }
        catch (error) {
            logger.warn(`Failed to initialize performance monitoring: ${error}`, "EMAIL_STORAGE");
        }
    }
    /**
     * Execute optimized database query with performance monitoring
     */
    async executeOptimizedQuery(queryDescription, query, params = [], method = "all") {
        const startTime = Date.now();
        let result;
        let error;
        try {
            // Optimize the query using 2025 best practices
            const optimizedQuery = performanceOptimizer.optimizeQuery(query, params);
            logger.debug(`Query optimized: ${optimizedQuery.estimatedPerformanceGain}% improvement`, "EMAIL_STORAGE");
            // Execute the optimized query with prepared statement
            const stmt = this.db.prepare(optimizedQuery.optimizedQuery);
            result =
                method === "get"
                    ? stmt.get(...params)
                    : stmt.all(...params);
        }
        catch (queryError) {
            error =
                queryError instanceof Error ? queryError.message : String(queryError);
            logger.error(`Database query failed: ${error}`, "EMAIL_STORAGE");
            throw queryError;
        }
        finally {
            // Record performance metrics
            const executionTime = Date.now() - startTime;
            queryPerformanceMonitor.recordQuery({
                query: queryDescription,
                executionTime,
                params: params.slice(0, 5), // Limit params for privacy
                error,
                cacheHit: false, // TODO: Implement cache hit detection
            });
        }
        return result;
    }
    /**
     * Execute cached query with performance optimization
     */
    async executeCachedQuery(cacheKey, queryDescription, query, params = [], method = "all") {
        return performanceOptimizer.cacheQuery(cacheKey, async () => {
            return this.executeOptimizedQuery(queryDescription, query, params, method);
        });
    }
    initializeDatabase() {
        logger.info("Initializing email storage database", "EMAIL_STORAGE");
        // Enable WAL mode for better concurrency if not using connection pool
        // (Connection pool handles this internally)
        if (!this.useConnectionPool) {
            try {
                this.db.pragma("journal_mode = WAL");
                this.db.pragma("synchronous = NORMAL");
                this.db.pragma("cache_size = 10000"); // 10MB cache
                this.db.pragma("temp_store = MEMORY");
                this.db.pragma("mmap_size = 268435456"); // 256MB memory map
                this.db.pragma("foreign_keys = ON");
                this.db.pragma("busy_timeout = 30000"); // 30 seconds
                logger.info("WAL mode enabled with performance optimizations", "EMAIL_STORAGE");
            }
            catch (error) {
                logger.warn(`Failed to set database pragmas: ${error}`, "EMAIL_STORAGE");
            }
        }
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
        logger.info("Email storage database initialized successfully", "EMAIL_STORAGE");
    }
    seedWorkflowPatterns() {
        const patterns = [
            {
                pattern_name: "Standard Order Processing",
                workflow_category: "Order Management",
                success_rate: 0.973,
                average_completion_time: 2 * 60 * 60 * 1000, // 2 hours in ms
                trigger_keywords: "order,purchase,PO,buy,procurement",
                typical_entities: "po_numbers,order_references,part_numbers",
            },
            {
                pattern_name: "Express Shipping Request",
                workflow_category: "Shipping/Logistics",
                success_rate: 0.965,
                average_completion_time: 4 * 60 * 60 * 1000, // 4 hours in ms
                trigger_keywords: "shipping,delivery,logistics,tracking,freight",
                typical_entities: "tracking_numbers,order_references,contacts",
            },
            {
                pattern_name: "Quote to Order Conversion",
                workflow_category: "Quote Processing",
                success_rate: 0.892,
                average_completion_time: 24 * 60 * 60 * 1000, // 24 hours in ms
                trigger_keywords: "quote,pricing,estimate,CAS,TS,WQ",
                typical_entities: "quote_numbers,part_numbers,contacts",
            },
            {
                pattern_name: "Technical Support Case",
                workflow_category: "Customer Support",
                success_rate: 0.915,
                average_completion_time: 8 * 60 * 60 * 1000, // 8 hours in ms
                trigger_keywords: "support,issue,problem,help,ticket",
                typical_entities: "case_numbers,contacts,part_numbers",
            },
            {
                pattern_name: "Partner Deal Registration",
                workflow_category: "Deal Registration",
                success_rate: 0.883,
                average_completion_time: 72 * 60 * 60 * 1000, // 72 hours in ms
                trigger_keywords: "deal,registration,partner,reseller",
                typical_entities: "contacts,order_references",
            },
            {
                pattern_name: "Manager Approval Request",
                workflow_category: "Approval Workflows",
                success_rate: 0.947,
                average_completion_time: 12 * 60 * 60 * 1000, // 12 hours in ms
                trigger_keywords: "approval,authorize,manager,escalate",
                typical_entities: "contacts,order_references,po_numbers",
            },
            {
                pattern_name: "Contract Renewal",
                workflow_category: "Renewal Processing",
                success_rate: 0.871,
                average_completion_time: 168 * 60 * 60 * 1000, // 168 hours in ms
                trigger_keywords: "renewal,contract,extend,expire",
                typical_entities: "contacts,order_references",
            },
            {
                pattern_name: "Vendor RMA Process",
                workflow_category: "Vendor Management",
                success_rate: 0.824,
                average_completion_time: 96 * 60 * 60 * 1000, // 96 hours in ms
                trigger_keywords: "RMA,return,vendor,defective",
                typical_entities: "case_numbers,part_numbers,contacts",
            },
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
        logger.info("Workflow patterns seeded successfully", "EMAIL_STORAGE");
    }
    async storeEmail(email, analysis) {
        logger.info(`Storing email analysis: ${email.subject}`, "EMAIL_STORAGE");
        const transaction = this.db.transaction(() => {
            // Store email
            const emailStmt = this.db.prepare(`
        INSERT OR REPLACE INTO emails (
          id, graph_id, subject, sender_email, sender_name, to_addresses,
          received_at, is_read, has_attachments, body_preview, body,
          importance, categories, raw_content, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            emailStmt.run(email.id, email.graphId, email.subject, email.from.emailAddress.address, email.from.emailAddress.name, JSON.stringify(email.to?.map((t) => t.emailAddress) || []), email.receivedDateTime, email.isRead ? 1 : 0, email.hasAttachments ? 1 : 0, email.bodyPreview, email.body, email.importance, JSON.stringify(email.categories || []), JSON.stringify(email), new Date().toISOString());
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
            analysis.actionSummary, JSON.stringify(analysis.deep.actionItems), analysis.deep.actionItems[0]?.slaStatus || "on-track", 
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
        logger.info(`Email analysis stored successfully: ${email.id}`, "EMAIL_STORAGE");
        // Broadcast real-time update for email analysis completion
        try {
            wsService.broadcastEmailAnalyzed(email.id, analysis.deep.detailedWorkflow.primary, analysis.quick.priority, analysis.actionSummary, analysis.deep.detailedWorkflow.confidence, analysis.deep.actionItems[0]?.slaStatus || "on-track", analysis.deep.workflowState.current);
            logger.debug(`WebSocket broadcast sent for email analysis: ${email.id}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to broadcast email analysis update: ${error}`, "EMAIL_STORAGE");
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
                    name: result.sender_name || "",
                    address: result.sender_email,
                },
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
                        secondary: result.deep_workflow_secondary
                            ? JSON.parse(result.deep_workflow_secondary)
                            : [],
                    },
                    priority: result.quick_priority,
                    intent: result.quick_intent,
                    urgency: result.quick_urgency,
                    confidence: result.quick_confidence,
                    suggestedState: result.quick_suggested_state,
                },
                deep: {
                    detailedWorkflow: {
                        primary: result.deep_workflow_primary,
                        secondary: result.deep_workflow_secondary
                            ? JSON.parse(result.deep_workflow_secondary)
                            : [],
                        relatedCategories: result.deep_workflow_related
                            ? JSON.parse(result.deep_workflow_related)
                            : [],
                        confidence: result.deep_confidence,
                    },
                    entities: {
                        poNumbers: result.entities_po_numbers
                            ? JSON.parse(result.entities_po_numbers)
                            : [],
                        quoteNumbers: result.entities_quote_numbers
                            ? JSON.parse(result.entities_quote_numbers)
                            : [],
                        caseNumbers: result.entities_case_numbers
                            ? JSON.parse(result.entities_case_numbers)
                            : [],
                        partNumbers: result.entities_part_numbers
                            ? JSON.parse(result.entities_part_numbers)
                            : [],
                        orderReferences: result.entities_order_references
                            ? JSON.parse(result.entities_order_references)
                            : [],
                        contacts: result.entities_contacts
                            ? JSON.parse(result.entities_contacts)
                            : [],
                    },
                    actionItems: result.action_details
                        ? JSON.parse(result.action_details)
                        : [],
                    workflowState: {
                        current: result.workflow_state,
                        suggestedNext: result.workflow_suggested_next,
                        blockers: result.workflow_blockers
                            ? JSON.parse(result.workflow_blockers)
                            : [],
                    },
                    businessImpact: {
                        revenue: result.business_impact_revenue,
                        customerSatisfaction: result.business_impact_satisfaction,
                        urgencyReason: result.business_impact_urgency_reason,
                    },
                    contextualSummary: result.contextual_summary,
                    suggestedResponse: result.suggested_response,
                    relatedEmails: result.related_emails
                        ? JSON.parse(result.related_emails)
                        : [],
                },
                actionSummary: result.action_summary,
                processingMetadata: {
                    stage1Time: result.quick_processing_time,
                    stage2Time: result.deep_processing_time,
                    totalTime: result.total_processing_time,
                    models: {
                        stage1: result.quick_model,
                        stage2: result.deep_model,
                    },
                },
            },
        };
        return email;
    }
    async getEmailsByWorkflow(workflow, limit = 50, offset = 0) {
        // Use a single optimized query with all necessary joins to avoid N+1 queries
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
      JOIN email_analysis a ON e.id = a.email_id
      WHERE a.deep_workflow_primary = ?
      ORDER BY e.received_at DESC
      LIMIT ? OFFSET ?
    `);
        const results = stmt.all(workflow, limit, offset);
        // Process all results in memory without additional queries
        const emails = results.map((result) => ({
            id: result.id,
            graphId: result.graph_id,
            subject: result.subject,
            from: {
                emailAddress: {
                    name: result.sender_name || "",
                    address: result.sender_email,
                },
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
                        secondary: result.deep_workflow_secondary
                            ? JSON.parse(result.deep_workflow_secondary)
                            : [],
                    },
                    priority: result.quick_priority,
                    intent: result.quick_intent,
                    urgency: result.quick_urgency,
                    confidence: result.quick_confidence,
                    suggestedState: result.quick_suggested_state,
                },
                deep: {
                    detailedWorkflow: {
                        primary: result.deep_workflow_primary,
                        secondary: result.deep_workflow_secondary
                            ? JSON.parse(result.deep_workflow_secondary)
                            : [],
                        relatedCategories: result.deep_workflow_related
                            ? JSON.parse(result.deep_workflow_related)
                            : [],
                        confidence: result.deep_confidence,
                    },
                    entities: {
                        poNumbers: result.entities_po_numbers
                            ? JSON.parse(result.entities_po_numbers)
                            : [],
                        quoteNumbers: result.entities_quote_numbers
                            ? JSON.parse(result.entities_quote_numbers)
                            : [],
                        caseNumbers: result.entities_case_numbers
                            ? JSON.parse(result.entities_case_numbers)
                            : [],
                        partNumbers: result.entities_part_numbers
                            ? JSON.parse(result.entities_part_numbers)
                            : [],
                        orderReferences: result.entities_order_references
                            ? JSON.parse(result.entities_order_references)
                            : [],
                        contacts: result.entities_contacts
                            ? JSON.parse(result.entities_contacts)
                            : [],
                    },
                    actionItems: result.action_details
                        ? JSON.parse(result.action_details)
                        : [],
                    workflowState: {
                        current: result.workflow_state,
                        suggestedNext: result.workflow_suggested_next,
                        blockers: result.workflow_blockers
                            ? JSON.parse(result.workflow_blockers)
                            : [],
                    },
                    businessImpact: {
                        revenue: result.business_impact_revenue,
                        customerSatisfaction: result.business_impact_satisfaction,
                        urgencyReason: result.business_impact_urgency_reason,
                    },
                    contextualSummary: result.contextual_summary,
                    suggestedResponse: result.suggested_response,
                    relatedEmails: result.related_emails
                        ? JSON.parse(result.related_emails)
                        : [],
                },
                actionSummary: result.action_summary,
                processingMetadata: {
                    stage1Time: result.quick_processing_time,
                    stage2Time: result.deep_processing_time,
                    totalTime: result.total_processing_time,
                    models: {
                        stage1: result.quick_model,
                        stage2: result.deep_model,
                    },
                },
            },
        }));
        return emails;
    }
    async getWorkflowAnalytics() {
        const totalEmails = this.db
            .prepare(`
      SELECT COUNT(*) as count FROM emails
    `)
            .get().count;
        const workflowDistribution = this.db
            .prepare(`
      SELECT 
        deep_workflow_primary as workflow,
        COUNT(*) as count
      FROM email_analysis
      WHERE deep_workflow_primary IS NOT NULL
      GROUP BY deep_workflow_primary
    `)
            .all();
        const slaCompliance = this.db
            .prepare(`
      SELECT 
        action_sla_status as status,
        COUNT(*) as count
      FROM email_analysis
      WHERE action_sla_status IS NOT NULL
      GROUP BY action_sla_status
    `)
            .all();
        const avgProcessingTime = this.db
            .prepare(`
      SELECT AVG(total_processing_time) as avg_time
      FROM email_analysis
      WHERE total_processing_time IS NOT NULL
    `)
            .get().avg_time || 0;
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
            averageProcessingTime: Math.round(avgProcessingTime),
        };
    }
    async updateWorkflowState(emailId, newState, changedBy) {
        // Get current state first
        const currentStateStmt = this.db.prepare(`
      SELECT workflow_state FROM email_analysis WHERE email_id = ?
    `);
        const currentResult = currentStateStmt.get(emailId);
        const oldState = currentResult?.workflow_state || "unknown";
        // Update the state
        const updateStmt = this.db.prepare(`
      UPDATE email_analysis
      SET workflow_state = ?, workflow_state_updated_at = ?, updated_at = ?
      WHERE email_id = ?
    `);
        const now = new Date().toISOString();
        updateStmt.run(newState, now, now, emailId);
        logger.info(`Workflow state updated: ${emailId} -> ${newState}`, "EMAIL_STORAGE");
        // Broadcast real-time update for workflow state change
        try {
            wsService.broadcastEmailStateChanged(emailId, oldState, newState, changedBy);
            logger.debug(`WebSocket broadcast sent for workflow state change: ${emailId}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to broadcast workflow state change: ${error}`, "EMAIL_STORAGE");
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
        // Process SLA violations in batches to avoid N+1 updates
        const updates = [];
        const broadcasts = [];
        const now = new Date();
        const slaThresholds = {
            Critical: 4 * 60 * 60 * 1000, // 4 hours
            High: 24 * 60 * 60 * 1000, // 24 hours
            Medium: 72 * 60 * 60 * 1000, // 72 hours
            Low: 168 * 60 * 60 * 1000, // 168 hours
        };
        // Process violations in memory first
        for (const violation of slaViolations) {
            const receivedAt = new Date(violation.received_at);
            const diffMs = now.getTime() - receivedAt.getTime();
            const slaThreshold = slaThresholds[violation.quick_priority];
            const isOverdue = diffMs > slaThreshold;
            const isAtRisk = diffMs > slaThreshold * 0.8; // 80% of SLA time
            let slaStatus;
            let timeRemaining;
            let overdueDuration;
            if (isOverdue) {
                slaStatus = "overdue";
                overdueDuration = diffMs - slaThreshold;
            }
            else if (isAtRisk) {
                slaStatus = "at-risk";
                timeRemaining = slaThreshold - diffMs;
            }
            else {
                continue; // Skip if not at risk or overdue
            }
            updates.push({ status: slaStatus, emailId: violation.id });
            broadcasts.push({
                emailId: violation.id,
                workflow: violation.deep_workflow_primary,
                priority: violation.quick_priority,
                status: slaStatus,
                timeRemaining,
                overdueDuration,
            });
        }
        // Perform batch updates using a transaction for better performance
        if (updates.length > 0) {
            const updateStmt = this.db.prepare(`
        UPDATE email_analysis 
        SET action_sla_status = ?
        WHERE email_id = ?
      `);
            const transaction = this.db.transaction((updates) => {
                for (const update of updates) {
                    updateStmt.run(update.status, update.emailId);
                }
            });
            transaction(updates);
            // Broadcast all SLA alerts
            for (const broadcast of broadcasts) {
                try {
                    wsService.broadcastEmailSLAAlert(broadcast.emailId, broadcast.workflow, broadcast.priority, broadcast.status, broadcast.timeRemaining, broadcast.overdueDuration);
                    logger.info(`SLA alert broadcast for email ${broadcast.emailId}: ${broadcast.status}`, "EMAIL_STORAGE");
                }
                catch (error) {
                    logger.error(`Failed to broadcast SLA alert for email ${broadcast.emailId}: ${error}`, "EMAIL_STORAGE");
                }
            }
        }
    }
    startSLAMonitoring(intervalMs = 300000) {
        // Default 5 minutes
        if (this.slaMonitoringInterval) {
            clearInterval(this.slaMonitoringInterval);
        }
        this.slaMonitoringInterval = setInterval(() => {
            this.checkSLAStatus().catch((error) => {
                logger.error(`SLA monitoring failed: ${error}`, "EMAIL_STORAGE");
            });
        }, intervalMs);
        logger.info("SLA monitoring started", "EMAIL_STORAGE");
    }
    stopSLAMonitoring() {
        if (this.slaMonitoringInterval) {
            clearInterval(this.slaMonitoringInterval);
            this.slaMonitoringInterval = null;
            logger.info("SLA monitoring stopped", "EMAIL_STORAGE");
        }
    }
    // =====================================================
    // IEMS INTEGRATION METHODS (Agent 9)
    // =====================================================
    /**
     * Create email record from IEMS data
     */
    async createEmail(emailData) {
        try {
            // Validate input data
            this.validateEmailData(emailData);
            const emailId = uuidv4();
            const receivedAt = emailData.receivedDate.toISOString();
            // Insert email record
            const insertEmailStmt = this.db.prepare(`
        INSERT INTO emails (
          id, graph_id, subject, sender_email, sender_name, to_addresses,
          received_at, is_read, has_attachments, body_preview, body,
          raw_content, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            insertEmailStmt.run(emailId, emailData.messageId, emailData.subject, emailData.emailAlias, emailData.requestedBy, JSON.stringify(emailData.recipients || []), receivedAt, emailData.isRead ? 1 : 0, emailData.hasAttachments ? 1 : 0, emailData.summary, emailData.body || "", JSON.stringify(emailData), new Date().toISOString(), new Date().toISOString());
            // Insert analysis record with IEMS data
            const insertAnalysisStmt = this.db.prepare(`
        INSERT INTO email_analysis (
          id, email_id, quick_workflow, quick_priority, quick_intent,
          quick_urgency, quick_confidence, quick_suggested_state,
          deep_workflow_primary, workflow_state, contextual_summary,
          entities_po_numbers, entities_quote_numbers, entities_case_numbers,
          entities_part_numbers, entities_order_references, entities_contacts,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const analysisId = uuidv4();
            insertAnalysisStmt.run(analysisId, emailId, emailData.workflowType || "General Support", emailData.priority || "Medium", this.extractIntent(emailData.subject, emailData.summary), this.mapStatusToUrgency(emailData.status), 0.85, // Default confidence for IEMS data
            emailData.workflowState, emailData.workflowType || "General Support", emailData.workflowState, emailData.summary, this.extractEntitiesOfType(emailData.entities, "po_number"), this.extractEntitiesOfType(emailData.entities, "quote_number"), this.extractEntitiesOfType(emailData.entities, "case_number"), this.extractEntitiesOfType(emailData.entities, "part_number"), this.extractEntitiesOfType(emailData.entities, "order_reference"), JSON.stringify(emailData.recipients || []), new Date().toISOString(), new Date().toISOString());
            // Create audit log entry
            await this.createAuditLog({
                entityType: "email",
                entityId: emailId,
                action: "created",
                oldValues: {},
                newValues: {
                    subject: emailData.subject,
                    status: emailData.status,
                    workflow_state: emailData.workflowState,
                },
                performedBy: "IEMS-system",
            });
            logger.info(`Email created from IEMS data: ${emailId}`, "EMAIL_STORAGE");
            return emailId;
        }
        catch (error) {
            logger.error(`Failed to create email from IEMS data: ${error}`, "EMAIL_STORAGE");
            throw new Error(`Email creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update email status with audit trail
     */
    async updateEmailStatus(emailId, newStatus, newStatusText, performedBy) {
        try {
            // Get current status
            const currentEmail = this.db
                .prepare("SELECT * FROM email_analysis WHERE email_id = ?")
                .get(emailId);
            if (!currentEmail) {
                throw new Error(`Email not found: ${emailId}`);
            }
            const oldStatus = this.mapWorkflowToStatus(currentEmail.workflow_state);
            // Update status in email_analysis table
            const updateStmt = this.db.prepare(`
        UPDATE email_analysis 
        SET workflow_state = ?, updated_at = ?
        WHERE email_id = ?
      `);
            const newWorkflowState = this.mapStatusToWorkflowState(newStatus);
            updateStmt.run(newWorkflowState, new Date().toISOString(), emailId);
            // Create audit log
            await this.createAuditLog({
                entityType: "email",
                entityId: emailId,
                action: "status_update",
                oldValues: {
                    status: oldStatus,
                    workflow_state: currentEmail.workflow_state,
                },
                newValues: { status: newStatus, workflow_state: newWorkflowState },
                performedBy: performedBy || "system",
            });
            // Broadcast status change via WebSocket
            try {
                wsService.broadcastEmailStateChanged(emailId, currentEmail.workflow_state, newWorkflowState, performedBy);
            }
            catch (wsError) {
                logger.warn(`WebSocket broadcast failed for status update: ${wsError}`, "EMAIL_STORAGE");
            }
            logger.info(`Email status updated: ${emailId} -> ${newStatus}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to update email status: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Create audit log entry
     */
    async createAuditLog(auditData) {
        try {
            // Create audit_logs table if it doesn't exist
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          old_values TEXT,
          new_values TEXT,
          performed_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
            const insertStmt = this.db.prepare(`
        INSERT INTO audit_logs (
          id, entity_type, entity_id, action, old_values, new_values, performed_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
            insertStmt.run(uuidv4(), auditData.entityType, auditData.entityId, auditData.action, JSON.stringify(auditData.oldValues), JSON.stringify(auditData.newValues), auditData.performedBy, new Date().toISOString());
            logger.debug(`Audit log created: ${auditData.action} on ${auditData.entityType}:${auditData.entityId}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to create audit log: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Batch load emails by IDs to avoid N+1 queries
     * This is a performance optimization method for loading multiple emails at once
     */
    async batchLoadEmailsWithAnalysis(emailIds) {
        if (emailIds.length === 0) {
            return new Map();
        }
        // Create placeholders for the IN clause
        const placeholders = emailIds.map(() => "?").join(",");
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
      WHERE e.id IN (${placeholders})
    `);
        const results = stmt.all(...emailIds);
        const emailMap = new Map();
        for (const result of results) {
            const email = {
                id: result.id,
                graphId: result.graph_id,
                subject: result.subject,
                from: {
                    emailAddress: {
                        name: result.sender_name || "",
                        address: result.sender_email,
                    },
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
                            secondary: result.deep_workflow_secondary
                                ? JSON.parse(result.deep_workflow_secondary)
                                : [],
                        },
                        priority: result.quick_priority,
                        intent: result.quick_intent,
                        urgency: result.quick_urgency,
                        confidence: result.quick_confidence,
                        suggestedState: result.quick_suggested_state,
                    },
                    deep: {
                        detailedWorkflow: {
                            primary: result.deep_workflow_primary,
                            secondary: result.deep_workflow_secondary
                                ? JSON.parse(result.deep_workflow_secondary)
                                : [],
                            relatedCategories: result.deep_workflow_related
                                ? JSON.parse(result.deep_workflow_related)
                                : [],
                            confidence: result.deep_confidence,
                        },
                        entities: {
                            poNumbers: result.entities_po_numbers
                                ? JSON.parse(result.entities_po_numbers)
                                : [],
                            quoteNumbers: result.entities_quote_numbers
                                ? JSON.parse(result.entities_quote_numbers)
                                : [],
                            caseNumbers: result.entities_case_numbers
                                ? JSON.parse(result.entities_case_numbers)
                                : [],
                            partNumbers: result.entities_part_numbers
                                ? JSON.parse(result.entities_part_numbers)
                                : [],
                            orderReferences: result.entities_order_references
                                ? JSON.parse(result.entities_order_references)
                                : [],
                            contacts: result.entities_contacts
                                ? JSON.parse(result.entities_contacts)
                                : [],
                        },
                        actionItems: result.action_details
                            ? JSON.parse(result.action_details)
                            : [],
                        workflowState: {
                            current: result.workflow_state,
                            suggestedNext: result.workflow_suggested_next,
                            blockers: result.workflow_blockers
                                ? JSON.parse(result.workflow_blockers)
                                : [],
                        },
                        businessImpact: {
                            revenue: result.business_impact_revenue,
                            customerSatisfaction: result.business_impact_satisfaction,
                            urgencyReason: result.business_impact_urgency_reason,
                        },
                        contextualSummary: result.contextual_summary,
                        suggestedResponse: result.suggested_response,
                        relatedEmails: result.related_emails
                            ? JSON.parse(result.related_emails)
                            : [],
                    },
                    actionSummary: result.action_summary,
                    processingMetadata: {
                        stage1Time: result.quick_processing_time,
                        stage2Time: result.deep_processing_time,
                        totalTime: result.total_processing_time,
                        models: {
                            stage1: result.quick_model,
                            stage2: result.deep_model,
                        },
                    },
                },
            };
            emailMap.set(email.id, email);
        }
        return emailMap;
    }
    /**
     * Get emails for table view with filtering, sorting, pagination (Performance Optimized)
     * Fixed SQL injection vulnerabilities
     */
    async getEmailsForTableView(options) {
        try {
            const page = options.page || 1;
            const pageSize = Math.min(options.pageSize || 50, 100); // Max 100 per page
            const offset = (page - 1) * pageSize;
            // Build query with parameterized queries (no string concatenation)
            const whereClauses = [];
            const params = [];
            // Search filter
            if (options.search) {
                whereClauses.push("(e.subject LIKE ? OR ea.contextual_summary LIKE ? OR e.sender_name LIKE ?)");
                const searchParam = `%${options.search}%`;
                params.push(searchParam, searchParam, searchParam);
            }
            // Status filter - using parameterized placeholders
            if (options.filters?.status?.length) {
                const statusPlaceholders = options.filters.status
                    .map(() => "?")
                    .join(",");
                whereClauses.push(`ea.workflow_state IN (${statusPlaceholders})`);
                params.push(...options.filters.status.map((s) => this.mapStatusToWorkflowState(s)));
            }
            // Email alias filter - using parameterized placeholders
            if (options.filters?.emailAlias?.length) {
                const aliasPlaceholders = options.filters.emailAlias
                    .map(() => "?")
                    .join(",");
                whereClauses.push(`e.sender_email IN (${aliasPlaceholders})`);
                params.push(...options.filters.emailAlias);
            }
            // Priority filter - using parameterized placeholders
            if (options.filters?.priority?.length) {
                const priorityPlaceholders = options.filters.priority
                    .map(() => "?")
                    .join(",");
                whereClauses.push(`ea.quick_priority IN (${priorityPlaceholders})`);
                params.push(...options.filters.priority);
            }
            // Date range filter
            if (options.filters?.dateRange) {
                whereClauses.push("e.received_at BETWEEN ? AND ?");
                params.push(options.filters.dateRange.start, options.filters.dateRange.end);
            }
            // Build WHERE clause
            const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
            // Sanitize and validate sort column
            const sortColumn = this.getSortColumn(options.sortBy);
            const sortDirection = options.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";
            // Generate cache key based on all parameters
            const cacheKey = `email_table_${JSON.stringify(options)}`;
            // Build the main query
            const dataQuery = `
        SELECT 
          e.id,
          e.sender_email as email_alias,
          e.sender_name as requested_by,
          e.subject,
          ea.contextual_summary as summary,
          ea.workflow_state,
          ea.quick_priority as priority,
          e.received_at as received_date,
          e.is_read,
          e.has_attachments
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `;
            // Build the count query
            const countQuery = `
        SELECT COUNT(*) as total
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        ${whereClause}
      `;
            // Add pagination params to data query
            const dataParams = [...params, pageSize, offset];
            // Execute optimized queries with performance monitoring
            const startTime = Date.now();
            const [emails, countResult] = await Promise.all([
                this.executeCachedQuery(`${cacheKey}_data`, "email_table_view_data", dataQuery, dataParams),
                this.executeCachedQuery(`${cacheKey}_count`, "email_table_view_count", countQuery, params, "get"),
            ]);
            const queryTime = Date.now() - startTime;
            const totalCount = countResult?.total || 0;
            const totalPages = Math.ceil(totalCount / pageSize);
            // Ensure emails is always an array
            const emailsArray = Array.isArray(emails) ? emails : [];
            // Transform emails to include proper status mapping
            const transformedEmails = emailsArray.map((email) => ({
                ...email,
                status: this.mapWorkflowToStatus(email.workflow_state),
                status_text: this.getStatusText(email.workflow_state),
                is_read: Boolean(email.is_read),
                has_attachments: Boolean(email.has_attachments),
            }));
            return {
                emails: transformedEmails,
                totalCount,
                totalPages,
                performanceMetrics: {
                    queryTime,
                    cacheHit: false, // This would be set by the cache implementation
                    optimizationGain: 0, // This would be calculated by the optimizer
                },
            };
        }
        catch (error) {
            logger.error(`Failed to get emails for table view: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Get emails for table view using lazy loading (Performance Optimized for Large Datasets)
     * Fixed SQL injection vulnerabilities
     */
    async getEmailsForTableViewLazy(options) {
        try {
            const startIndex = options.startIndex || 0;
            const chunkSize = options.chunkSize || 50;
            // Create the load function for lazy loader
            const loadFn = async (offset, limit) => {
                // Build base query with parameterized queries
                const whereClauses = [];
                const params = [];
                // Apply filters (same logic as getEmailsForTableView)
                if (options.search) {
                    whereClauses.push("(e.subject LIKE ? OR ea.contextual_summary LIKE ? OR e.sender_name LIKE ?)");
                    const searchParam = `%${options.search}%`;
                    params.push(searchParam, searchParam, searchParam);
                }
                if (options.filters?.status?.length) {
                    const statusPlaceholders = options.filters.status
                        .map(() => "?")
                        .join(",");
                    whereClauses.push(`ea.workflow_state IN (${statusPlaceholders})`);
                    params.push(...options.filters.status.map((s) => this.mapStatusToWorkflowState(s)));
                }
                if (options.filters?.emailAlias?.length) {
                    const aliasPlaceholders = options.filters.emailAlias
                        .map(() => "?")
                        .join(",");
                    whereClauses.push(`e.sender_email IN (${aliasPlaceholders})`);
                    params.push(...options.filters.emailAlias);
                }
                if (options.filters?.priority?.length) {
                    const priorityPlaceholders = options.filters.priority
                        .map(() => "?")
                        .join(",");
                    whereClauses.push(`ea.quick_priority IN (${priorityPlaceholders})`);
                    params.push(...options.filters.priority);
                }
                if (options.filters?.dateRange) {
                    whereClauses.push("e.received_at BETWEEN ? AND ?");
                    params.push(options.filters.dateRange.start, options.filters.dateRange.end);
                }
                // Build WHERE clause
                const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
                // Sanitize sort column and direction
                const sortColumn = this.getSortColumn(options.sortBy);
                const sortDirection = options.sortOrder?.toUpperCase() === "DESC" ? "DESC" : "ASC";
                const query = `
          SELECT 
            e.id,
            e.sender_email as email_alias,
            e.sender_name as requested_by,
            e.subject,
            ea.contextual_summary as summary,
            ea.workflow_state,
            ea.quick_priority as priority,
            e.received_at as received_date,
            e.is_read,
            e.has_attachments
          FROM emails e
          LEFT JOIN email_analysis ea ON e.id = ea.email_id
          ${whereClause}
          ORDER BY ${sortColumn} ${sortDirection}
          LIMIT ? OFFSET ?
        `;
                // Add pagination params
                params.push(limit, offset);
                const emails = await this.executeOptimizedQuery("email_table_lazy_load", query, params);
                // Ensure emails is always an array
                const emailsArray = Array.isArray(emails) ? emails : [];
                // Transform emails
                return emailsArray.map((email) => ({
                    ...email,
                    status: this.mapWorkflowToStatus(email.workflow_state),
                    status_text: this.getStatusText(email.workflow_state),
                    is_read: Boolean(email.is_read),
                    has_attachments: Boolean(email.has_attachments),
                }));
            };
            // Use lazy loader to get chunk
            const result = await this.lazyLoader.loadChunk(startIndex, loadFn);
            return result;
        }
        catch (error) {
            logger.error(`Failed to get emails for lazy table view: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Get email dashboard statistics
     */
    async getDashboardStats() {
        try {
            const statsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN ea.workflow_state = 'START_POINT' THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN ea.workflow_state = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN ea.workflow_state = 'COMPLETION' THEN 1 ELSE 0 END) as completed
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
      `;
            const stats = this.db.prepare(statsQuery).get();
            return {
                totalEmails: stats.total,
                criticalCount: stats.critical,
                inProgressCount: stats.in_progress,
                completedCount: stats.completed,
                statusDistribution: {
                    red: stats.critical,
                    yellow: stats.in_progress,
                    green: stats.completed,
                },
            };
        }
        catch (error) {
            logger.error(`Failed to get dashboard stats: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    // =====================================================
    // VALIDATION AND UTILITY METHODS
    // =====================================================
    validateEmailData(emailData) {
        if (!emailData.messageId)
            throw new Error("Message ID is required");
        if (!emailData.emailAlias)
            throw new Error("Email alias is required");
        if (!emailData.requestedBy)
            throw new Error("Requested by is required");
        if (!emailData.subject)
            throw new Error("Subject is required");
        if (!emailData.summary)
            throw new Error("Summary is required");
        if (!["red", "yellow", "green"].includes(emailData.status)) {
            throw new Error("Invalid status. Must be red, yellow, or green");
        }
        if (!["START_POINT", "IN_PROGRESS", "COMPLETION"].includes(emailData.workflowState)) {
            throw new Error("Invalid workflow state");
        }
    }
    /**
     * Enhanced column name sanitization to prevent SQL injection
     * Uses a whitelist approach with proper mapping
     */
    getSortColumn(columnName) {
        const columnMap = {
            received_date: "e.received_at",
            received_at: "e.received_at",
            subject: "e.subject",
            sender_name: "e.sender_name",
            email_alias: "e.sender_email",
            workflow_state: "ea.workflow_state",
            priority: "ea.quick_priority",
            quick_priority: "ea.quick_priority",
            status: "ea.workflow_state",
            summary: "ea.contextual_summary",
        };
        const column = columnName?.toLowerCase();
        return columnMap[column || "received_date"] || "e.received_at";
    }
    /**
     * @deprecated Use getSortColumn instead
     */
    sanitizeColumnName(columnName) {
        const allowedColumns = [
            "received_at",
            "subject",
            "sender_name",
            "workflow_state",
            "quick_priority",
        ];
        return allowedColumns.includes(columnName) ? columnName : "received_at";
    }
    extractIntent(subject, summary) {
        const text = `${subject} ${summary}`.toLowerCase();
        if (text.includes("urgent") || text.includes("critical"))
            return "urgent_action";
        if (text.includes("quote") || text.includes("pricing"))
            return "quote_request";
        if (text.includes("order") || text.includes("purchase"))
            return "order_processing";
        if (text.includes("support") || text.includes("help"))
            return "support_request";
        return "general_inquiry";
    }
    mapStatusToUrgency(status) {
        switch (status) {
            case "red":
                return "critical";
            case "yellow":
                return "medium";
            case "green":
                return "low";
            default:
                return "medium";
        }
    }
    mapStatusToWorkflowState(status) {
        switch (status) {
            case "red":
                return "START_POINT";
            case "yellow":
                return "IN_PROGRESS";
            case "green":
                return "COMPLETION";
            default:
                return "IN_PROGRESS";
        }
    }
    mapWorkflowToStatus(workflowState) {
        switch (workflowState) {
            case "START_POINT":
                return "red";
            case "IN_PROGRESS":
                return "yellow";
            case "COMPLETION":
                return "green";
            default:
                return "yellow";
        }
    }
    getStatusText(workflowState) {
        switch (workflowState) {
            case "START_POINT":
                return "Critical";
            case "IN_PROGRESS":
                return "In Progress";
            case "COMPLETION":
                return "Completed";
            default:
                return "In Progress";
        }
    }
    extractEntitiesOfType(entities = [], type) {
        const filtered = entities.filter((e) => e.type === type);
        return JSON.stringify(filtered.map((e) => e.value));
    }
    // =====================================================
    // PERFORMANCE MONITORING METHODS (Agent 12)
    // =====================================================
    /**
     * Get comprehensive performance statistics
     */
    async getPerformanceMetrics() {
        try {
            const [dbMetrics, lazyLoaderStats] = await Promise.all([
                queryPerformanceMonitor.getPerformanceStatistics(),
                Promise.resolve(this.lazyLoader.getStats()),
            ]);
            const cacheMetrics = performanceOptimizer.getPerformanceMetrics();
            return {
                database: dbMetrics,
                cache: cacheMetrics,
                lazyLoader: lazyLoaderStats,
                recommendations: [
                    ...cacheMetrics.recommendations,
                    ...(dbMetrics.alerts?.map((alert) => alert.message) || []),
                ],
            };
        }
        catch (error) {
            logger.error(`Failed to get performance metrics: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Get detailed performance report
     */
    async getDetailedPerformanceReport() {
        try {
            return await queryPerformanceMonitor.getDetailedReport();
        }
        catch (error) {
            logger.error(`Failed to get detailed performance report: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Clear all performance caches
     */
    async clearPerformanceCaches() {
        try {
            performanceOptimizer.clearCache();
            this.lazyLoader.clearCache();
            queryPerformanceMonitor.clearHistory();
            logger.info("All performance caches cleared", "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to clear performance caches: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Preload adjacent chunks for smooth scrolling
     */
    async preloadAdjacentChunks(currentIndex, options) {
        try {
            const loadFn = async (offset, limit) => {
                return this.getEmailsForTableViewLazy({
                    startIndex: offset,
                    chunkSize: limit,
                    ...options,
                }).then((result) => result.data);
            };
            await this.lazyLoader.preloadAdjacentChunks(currentIndex, loadFn);
            logger.debug(`Preloaded adjacent chunks for index ${currentIndex}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.warn(`Failed to preload adjacent chunks: ${error}`, "EMAIL_STORAGE");
        }
    }
    /**
     * Optimize database queries and rebuild indexes if needed
     */
    async optimizeDatabase() {
        try {
            logger.info("Starting database optimization", "EMAIL_STORAGE");
            // Rebuild indexes for better performance
            const indexQueries = [
                "REINDEX idx_emails_received_at",
                "REINDEX idx_emails_sender",
                "REINDEX idx_workflow_state",
                "REINDEX idx_sla_status",
            ];
            let indexesRebuilt = 0;
            for (const indexQuery of indexQueries) {
                try {
                    this.db.exec(indexQuery);
                    indexesRebuilt++;
                }
                catch (indexError) {
                    logger.warn(`Failed to rebuild index: ${indexQuery}`, "EMAIL_STORAGE");
                }
            }
            // Run VACUUM to optimize database file
            let vacuumCompleted = false;
            try {
                this.db.exec("VACUUM");
                vacuumCompleted = true;
            }
            catch (vacuumError) {
                logger.warn(`Database VACUUM failed: ${vacuumError}`, "EMAIL_STORAGE");
            }
            // Get optimization recommendations
            const metrics = performanceOptimizer.getPerformanceMetrics();
            logger.info(`Database optimization completed: ${indexesRebuilt} indexes rebuilt`, "EMAIL_STORAGE");
            return {
                indexesRebuilt,
                vacuumCompleted,
                optimizationRecommendations: metrics.recommendations,
            };
        }
        catch (error) {
            logger.error(`Database optimization failed: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    async close() {
        // Stop SLA monitoring
        this.stopSLAMonitoring();
        // Stop performance monitoring
        try {
            queryPerformanceMonitor.stopMonitoring();
            performanceOptimizer.destroy();
            logger.info("Performance monitoring stopped", "EMAIL_STORAGE");
        }
        catch (error) {
            logger.warn(`Failed to stop performance monitoring: ${error}`, "EMAIL_STORAGE");
        }
        // Close database or connection pool
        if (this.useConnectionPool && this.connectionPool) {
            this.connectionPool.close();
            logger.info("Connection pool closed", "EMAIL_STORAGE");
        }
        else {
            this.db.close();
            logger.info("Database connection closed", "EMAIL_STORAGE");
        }
        logger.info("EmailStorageService closed", "EMAIL_STORAGE");
    }
    /**
     * Get connection pool statistics (if using pool)
     */
    getPoolStats() {
        if (this.useConnectionPool && this.connectionPool) {
            return this.connectionPool.getStats();
        }
        return null;
    }
    /**
     * Get a single email by ID
     */
    async getEmail(emailId) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM emails 
        WHERE id = ?
      `);
            const email = stmt.get(emailId);
            return email || null;
        }
        catch (error) {
            logger.error(`Failed to get email ${emailId}: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Update an email record
     */
    async updateEmail(emailId, updates) {
        try {
            const updateFields = Object.keys(updates)
                .filter((key) => key !== "id")
                .map((key) => `${key} = @${key}`)
                .join(", ");
            const stmt = this.db.prepare(`
        UPDATE emails 
        SET ${updateFields}
        WHERE id = @id
      `);
            stmt.run({ id: emailId, ...updates });
            logger.info(`Updated email ${emailId}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to update email ${emailId}: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Log an activity related to email assignment
     */
    async logActivity(activity) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO activity_logs (id, email_id, action, user_id, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(uuidv4(), activity.emailId || null, activity.action, activity.userId, JSON.stringify(activity.details || {}), activity.timestamp);
            logger.info(`Logged activity: ${activity.action}`, "EMAIL_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to log activity: ${error}`, "EMAIL_STORAGE");
            // Don't throw - logging should not break the main flow
        }
    }
    /**
     * Get assignment workload distribution
     */
    async getAssignmentWorkload() {
        try {
            const stmt = this.db.prepare(`
        SELECT assignedTo, COUNT(*) as count
        FROM emails
        WHERE assignedTo IS NOT NULL
        GROUP BY assignedTo
      `);
            const results = stmt.all();
            const workload = {};
            results.forEach((row) => {
                workload[row.assignedTo] = row.count;
            });
            return workload;
        }
        catch (error) {
            logger.error(`Failed to get assignment workload: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Get count of unassigned emails
     */
    async getUnassignedCount() {
        try {
            const stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM emails
        WHERE assignedTo IS NULL OR assignedTo = ''
      `);
            const result = stmt.get();
            return result.count;
        }
        catch (error) {
            logger.error(`Failed to get unassigned count: ${error}`, "EMAIL_STORAGE");
            throw error;
        }
    }
    /**
     * Create singleton instance getter
     */
    static instance;
    static getInstance() {
        if (!EmailStorageService.instance) {
            EmailStorageService.instance = new EmailStorageService();
        }
        return EmailStorageService.instance;
    }
}
//# sourceMappingURL=EmailStorageService.js.map