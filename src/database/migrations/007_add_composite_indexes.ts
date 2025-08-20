import Database, { Database as DatabaseInstance } from "better-sqlite3";
import { logger } from "../../utils/logger.js";

/**
 * Migration: Add Composite Indexes for Email Analytics Performance
 *
 * This migration adds composite indexes to improve query performance for common
 * email analytics query patterns identified in EmailStorageService and related services.
 *
 * Query patterns optimized:
 * - Email listing with timestamp ordering
 * - User-based email queries with status filtering
 * - Conversation-based email queries
 * - Priority and status filtering
 * - Processing time analytics
 * - SLA status monitoring
 * - Workflow state transitions
 */
export async function up(db: DatabaseInstance): Promise<void> {
  logger.info(
    "Starting migration: Adding composite indexes for email analytics",
    "MIGRATION",
  );

  try {
    // Begin transaction for atomic index creation
    db.exec("BEGIN TRANSACTION");

    // =====================================================
    // COMPOSITE INDEXES FOR EMAIL TABLE VIEWS
    // =====================================================

    // Index for email listing queries with timestamp ordering
    // Pattern: SELECT * FROM emails WHERE ... ORDER BY received_at DESC
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_received_sender_subject 
      ON emails(received_at DESC, sender_email, subject);
    `);
    logger.info(
      "Created composite index: idx_emails_received_sender_subject",
      "MIGRATION",
    );

    // Index for graph_id lookups with timestamp
    // Pattern: WHERE graph_id = ? ORDER BY received_at
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_graph_received 
      ON emails(graph_id, received_at DESC);
    `);
    logger.info(
      "Created composite index: idx_emails_graph_received",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR EMAIL ANALYSIS
    // =====================================================

    // Index for workflow state queries with priority
    // Pattern: WHERE workflow_state = ? AND quick_priority = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_workflow_priority 
      ON email_analysis(workflow_state, quick_priority, email_id);
    `);
    logger.info(
      "Created composite index: idx_analysis_workflow_priority",
      "MIGRATION",
    );

    // Index for SLA monitoring queries
    // Pattern: WHERE workflow_state NOT IN (...) AND action_sla_status = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_sla_workflow 
      ON email_analysis(action_sla_status, workflow_state, email_id);
    `);
    logger.info(
      "Created composite index: idx_analysis_sla_workflow",
      "MIGRATION",
    );

    // Index for priority-based queries with timestamps
    // Pattern: JOIN on email_id WHERE quick_priority = ? ORDER BY received_at
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_priority_email 
      ON email_analysis(quick_priority, email_id);
    `);
    logger.info(
      "Created composite index: idx_analysis_priority_email",
      "MIGRATION",
    );

    // Index for deep workflow queries
    // Pattern: WHERE deep_workflow_primary = ? ORDER BY ...
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_deep_workflow 
      ON email_analysis(deep_workflow_primary, deep_confidence DESC, email_id);
    `);
    logger.info(
      "Created composite index: idx_analysis_deep_workflow",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR ENHANCED EMAILS
    // =====================================================

    // Index for user-based queries with status
    // Pattern: WHERE assigned_to = ? AND status = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_enhanced_assigned_status 
      ON emails_enhanced(assigned_to, status, received_at DESC);
    `);
    logger.info(
      "Created composite index: idx_emails_enhanced_assigned_status",
      "MIGRATION",
    );

    // Index for priority queries with due dates
    // Pattern: WHERE priority = ? AND due_date < ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_enhanced_priority_due 
      ON emails_enhanced(priority, due_date, status);
    `);
    logger.info(
      "Created composite index: idx_emails_enhanced_priority_due",
      "MIGRATION",
    );

    // Index for thread-based queries
    // Pattern: WHERE thread_id = ? ORDER BY received_at
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_enhanced_thread_received 
      ON emails_enhanced(thread_id, received_at DESC);
    `);
    logger.info(
      "Created composite index: idx_emails_enhanced_thread_received",
      "MIGRATION",
    );

    // Index for conversation reference queries
    // Pattern: WHERE conversation_id_ref = ? ORDER BY received_at
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_enhanced_conversation 
      ON emails_enhanced(conversation_id_ref, received_at DESC);
    `);
    logger.info(
      "Created composite index: idx_emails_enhanced_conversation",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR EMAIL ENTITIES
    // =====================================================

    // Index for entity type and value queries
    // Already exists but let's ensure it includes confidence
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_entities_type_value_conf 
      ON email_entities(entity_type, entity_value, confidence DESC);
    `);
    logger.info(
      "Created composite index: idx_email_entities_type_value_conf",
      "MIGRATION",
    );

    // Index for entity extraction method queries
    // Pattern: WHERE entity_type = ? AND extraction_method = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_entities_type_method 
      ON email_entities(entity_type, extraction_method, verified);
    `);
    logger.info(
      "Created composite index: idx_email_entities_type_method",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR CONVERSATIONS
    // =====================================================

    // Index for user conversations with status
    // Pattern: WHERE user_id = ? AND status = ? ORDER BY created_at DESC
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user_status_created 
      ON conversations(user_id, status, created_at DESC);
    `);
    logger.info(
      "Created composite index: idx_conversations_user_status_created",
      "MIGRATION",
    );

    // Index for conversation type queries
    // Pattern: WHERE conversation_type = ? AND status = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_type_status 
      ON conversations(conversation_type, status, priority DESC);
    `);
    logger.info(
      "Created composite index: idx_conversations_type_status",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR MESSAGES
    // =====================================================

    // Index for conversation messages with timestamp
    // Pattern: WHERE conversation_id = ? ORDER BY created_at
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
      ON messages(conversation_id, created_at DESC);
    `);
    logger.info(
      "Created composite index: idx_messages_conversation_created",
      "MIGRATION",
    );

    // Index for thread-based message queries
    // Pattern: WHERE thread_id = ? AND role = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_thread_role 
      ON messages(thread_id, role, created_at DESC);
    `);
    logger.info(
      "Created composite index: idx_messages_thread_role",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR PROCESSING PERFORMANCE
    // =====================================================

    // Index for processing time analytics
    // Pattern: WHERE total_processing_time IS NOT NULL ORDER BY total_processing_time
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_processing_times 
      ON email_analysis(total_processing_time, quick_processing_time, deep_processing_time)
      WHERE total_processing_time IS NOT NULL;
    `);
    logger.info(
      "Created partial index: idx_analysis_processing_times",
      "MIGRATION",
    );

    // Index for model performance analysis
    // Pattern: WHERE quick_model = ? OR deep_model = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_models 
      ON email_analysis(quick_model, deep_model, total_processing_time);
    `);
    logger.info("Created composite index: idx_analysis_models", "MIGRATION");

    // =====================================================
    // COMPOSITE INDEXES FOR WORKFLOW PATTERNS
    // =====================================================

    // Index for workflow pattern matching
    // Pattern: WHERE workflow_category = ? ORDER BY success_rate DESC
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_patterns_category_rate 
      ON workflow_patterns(workflow_category, success_rate DESC);
    `);
    logger.info(
      "Created composite index: idx_workflow_patterns_category_rate",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR AUDIT LOGS
    // =====================================================

    // Create audit logs table if doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        performed_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Index for audit trail queries
    // Pattern: WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
      ON audit_logs(entity_type, entity_id, created_at DESC);
    `);
    logger.info("Created composite index: idx_audit_logs_entity", "MIGRATION");

    // Index for user activity queries
    // Pattern: WHERE performed_by = ? ORDER BY created_at DESC
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_performer 
      ON audit_logs(performed_by, created_at DESC);
    `);
    logger.info(
      "Created composite index: idx_audit_logs_performer",
      "MIGRATION",
    );

    // =====================================================
    // COMPOSITE INDEXES FOR ACTIVITY LOGS
    // =====================================================

    // Create activity logs table if doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        email_id TEXT,
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL
      );
    `);

    // Index for email activity queries
    // Pattern: WHERE email_id = ? ORDER BY timestamp DESC
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_email 
      ON activity_logs(email_id, timestamp DESC)
      WHERE email_id IS NOT NULL;
    `);
    logger.info("Created partial index: idx_activity_logs_email", "MIGRATION");

    // Index for user activity queries
    // Pattern: WHERE user_id = ? AND action = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action 
      ON activity_logs(user_id, action, timestamp DESC);
    `);
    logger.info(
      "Created composite index: idx_activity_logs_user_action",
      "MIGRATION",
    );

    // =====================================================
    // ADDITIONAL COMPOSITE INDEXES FOR COMPLEX QUERIES
    // =====================================================

    // Index for date range queries with status filtering
    // Pattern: WHERE received_at BETWEEN ? AND ? AND status = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_enhanced_date_range_status 
      ON emails_enhanced(status, received_at);
    `);
    logger.info(
      "Created composite index: idx_emails_enhanced_date_range_status",
      "MIGRATION",
    );

    // Index for workflow chain email joins
    // Pattern: JOIN workflow_chain_emails ON chain_id WHERE email_id = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_chain_emails_email 
      ON workflow_chain_emails(email_id, chain_id);
    `);
    logger.info(
      "Created composite index: idx_workflow_chain_emails_email",
      "MIGRATION",
    );

    // Index for workflow chain queries with date filtering
    // Pattern: WHERE created_at >= ? AND status = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_chains_date_status 
      ON workflow_chains(status, created_at DESC);
    `);
    logger.info(
      "Created composite index: idx_workflow_chains_date_status",
      "MIGRATION",
    );

    // Index for refresh token validation queries
    // Pattern: WHERE user_id = ? AND expires_at > ? AND revoked_at IS NULL
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expiry 
      ON refresh_tokens(user_id, expires_at, revoked_at);
    `);
    logger.info(
      "Created composite index: idx_refresh_tokens_user_expiry",
      "MIGRATION",
    );

    // Index for time-based SLA queries with priority
    // Pattern: WHERE priority = ? AND datetime(received_at, '+X hours') < datetime('now')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_priority_received_sla 
      ON emails(quick_priority, received_at);
    `);
    logger.info(
      "Created composite index: idx_emails_priority_received_sla",
      "MIGRATION",
    );

    // Index for email entity queries by email
    // Pattern: WHERE email_id = ? AND entity_type = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_entities_email_type 
      ON email_entities(email_id, entity_type, confidence DESC);
    `);
    logger.info(
      "Created composite index: idx_email_entities_email_type",
      "MIGRATION",
    );

    // Index for audit log action queries
    // Pattern: WHERE action = ? AND created_at >= ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date 
      ON audit_logs(action, created_at DESC);
    `);
    logger.info(
      "Created composite index: idx_audit_logs_action_date",
      "MIGRATION",
    );

    // Index for conversation message counts
    // Pattern: SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND role = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_count 
      ON messages(conversation_id, role);
    `);
    logger.info(
      "Created composite index: idx_messages_conversation_role_count",
      "MIGRATION",
    );

    // Index for email analysis confidence queries
    // Pattern: WHERE deep_confidence > ? AND workflow_state = ?
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analysis_confidence_workflow 
      ON email_analysis(workflow_state, deep_confidence DESC);
    `);
    logger.info(
      "Created composite index: idx_analysis_confidence_workflow",
      "MIGRATION",
    );

    // =====================================================
    // FOREIGN KEY INDEXES (Ensure they exist)
    // =====================================================

    // These should already exist but let's ensure they do for foreign key performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id 
      ON email_attachments(email_id);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_comments_task_id 
      ON task_comments(task_id);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_comments_user_id 
      ON task_comments(user_id);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
      ON document_chunks(document_id);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id 
      ON agent_executions(agent_id);
    `);

    // =====================================================
    // ANALYZE TABLES FOR QUERY PLANNER
    // =====================================================

    // Update SQLite's internal statistics for better query planning
    db.exec("ANALYZE emails");
    db.exec("ANALYZE email_analysis");
    db.exec("ANALYZE emails_enhanced");
    db.exec("ANALYZE email_entities");
    db.exec("ANALYZE conversations");
    db.exec("ANALYZE messages");
    db.exec("ANALYZE workflow_patterns");
    db.exec("ANALYZE workflow_chains");
    db.exec("ANALYZE workflow_chain_emails");
    db.exec("ANALYZE refresh_tokens");
    db.exec("ANALYZE audit_logs");
    db.exec("ANALYZE activity_logs");
    logger.info("Updated table statistics for query optimizer", "MIGRATION");

    // Commit transaction
    db.exec("COMMIT");

    logger.info(
      "Successfully added composite indexes for email analytics",
      "MIGRATION",
    );

    // Log index summary
    const indexCount = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type = 'index' AND name LIKE 'idx_%'
    `,
      )
      .get() as { count: number };

    logger.info(`Total indexes in database: ${indexCount.count}`, "MIGRATION");
  } catch (error) {
    // Rollback on error
    db.exec("ROLLBACK");
    logger.error(`Failed to add composite indexes: ${error}`, "MIGRATION");
    throw error;
  }
}

/**
 * Rollback migration: Remove composite indexes
 */
export async function down(db: DatabaseInstance): Promise<void> {
  logger.info("Rolling back: Removing composite indexes", "MIGRATION");

  try {
    db.exec("BEGIN TRANSACTION");

    // Drop all composite indexes created in this migration
    const indexesToDrop = [
      "idx_emails_received_sender_subject",
      "idx_emails_graph_received",
      "idx_analysis_workflow_priority",
      "idx_analysis_sla_workflow",
      "idx_analysis_priority_email",
      "idx_analysis_deep_workflow",
      "idx_emails_enhanced_assigned_status",
      "idx_emails_enhanced_priority_due",
      "idx_emails_enhanced_thread_received",
      "idx_emails_enhanced_conversation",
      "idx_email_entities_type_value_conf",
      "idx_email_entities_type_method",
      "idx_conversations_user_status_created",
      "idx_conversations_type_status",
      "idx_messages_conversation_created",
      "idx_messages_thread_role",
      "idx_analysis_processing_times",
      "idx_analysis_models",
      "idx_workflow_patterns_category_rate",
      "idx_audit_logs_entity",
      "idx_audit_logs_performer",
      "idx_activity_logs_email",
      "idx_activity_logs_user_action",
      // New indexes added in this update
      "idx_emails_enhanced_date_range_status",
      "idx_workflow_chain_emails_email",
      "idx_workflow_chains_date_status",
      "idx_refresh_tokens_user_expiry",
      "idx_emails_priority_received_sla",
      "idx_email_entities_email_type",
      "idx_audit_logs_action_date",
      "idx_messages_conversation_role_count",
      "idx_analysis_confidence_workflow",
    ];

    for (const indexName of indexesToDrop) {
      try {
        db.exec(`DROP INDEX IF EXISTS ${indexName}`);
        logger.info(`Dropped index: ${indexName}`, "MIGRATION");
      } catch (error) {
        logger.warn(`Failed to drop index ${indexName}: ${error}`, "MIGRATION");
      }
    }

    db.exec("COMMIT");
    logger.info("Successfully rolled back composite indexes", "MIGRATION");
  } catch (error) {
    db.exec("ROLLBACK");
    logger.error(`Failed to rollback composite indexes: ${error}`, "MIGRATION");
    throw error;
  }
}

// Export migration metadata
export const migration = {
  version: 7,
  name: "add_composite_indexes",
  description:
    "Add composite indexes for email analytics query performance optimization",
  up,
  down,
};
