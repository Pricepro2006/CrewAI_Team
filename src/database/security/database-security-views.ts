/**
 * Database Security Views and Access Control
 * Implements secure views and access patterns for SQLite
 */

import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export class DatabaseSecurityViews {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Create secure views for limited data access
   */
  createSecurityViews(): void {
    try {
      logger.info("Creating security views", "DB_SECURITY");

      // View for email summaries (no sensitive content)
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_email_summaries AS
        SELECT 
          e.id,
          e.graph_id,
          e.subject,
          e.sender_email,
          e.received_at,
          e.priority,
          e.status,
          e.has_attachments,
          e.is_read,
          e.assigned_to,
          COUNT(DISTINCT ee.id) as entity_count,
          COUNT(DISTINCT ea.id) as attachment_count
        FROM emails_enhanced e
        LEFT JOIN email_entities ee ON e.id = ee.email_id
        LEFT JOIN email_attachments ea ON e.id = ea.email_id
        GROUP BY e.id;
      `);

      // View for user workload analysis
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_user_workload AS
        SELECT 
          assigned_to as user_id,
          COUNT(*) as total_emails,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_emails,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN priority IN ('critical', 'high') THEN 1 ELSE 0 END) as urgent_emails,
          AVG(CASE 
            WHEN status = 'completed' AND assigned_at IS NOT NULL 
            THEN (julianday(updated_at) - julianday(assigned_at)) * 24 
            ELSE NULL 
          END) as avg_completion_hours
        FROM emails_enhanced
        WHERE assigned_to IS NOT NULL
        GROUP BY assigned_to;
      `);

      // View for workflow performance metrics
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_workflow_metrics AS
        SELECT 
          workflow_type,
          COUNT(*) as chain_count,
          AVG(email_count) as avg_emails_per_chain,
          SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as completed_chains,
          AVG(CASE 
            WHEN is_complete = 1 
            THEN (julianday(completed_at) - julianday(created_at)) * 24 
            ELSE NULL 
          END) as avg_completion_hours,
          MIN(created_at) as first_chain_date,
          MAX(created_at) as last_chain_date
        FROM workflow_chains
        GROUP BY workflow_type;
      `);

      // View for entity statistics (no actual entity values)
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_entity_statistics AS
        SELECT 
          entity_type,
          COUNT(DISTINCT entity_value) as unique_values,
          COUNT(*) as total_occurrences,
          AVG(confidence) as avg_confidence,
          SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_count,
          COUNT(DISTINCT email_id) as email_count
        FROM email_entities
        GROUP BY entity_type;
      `);

      // View for daily email analytics
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_daily_email_stats AS
        SELECT 
          DATE(received_at) as email_date,
          COUNT(*) as total_emails,
          COUNT(DISTINCT sender_email) as unique_senders,
          SUM(CASE WHEN has_attachments = 1 THEN 1 ELSE 0 END) as emails_with_attachments,
          AVG(CASE 
            WHEN processed_at IS NOT NULL 
            THEN (julianday(processed_at) - julianday(received_at)) * 24 * 60
            ELSE NULL 
          END) as avg_processing_minutes,
          SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_emails,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_emails
        FROM emails_enhanced
        GROUP BY DATE(received_at);
      `);

      // View for conversation threads (limited info)
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_conversation_threads AS
        SELECT 
          conversation_id_ref,
          thread_id,
          COUNT(*) as email_count,
          MIN(received_at) as first_email_date,
          MAX(received_at) as last_email_date,
          COUNT(DISTINCT sender_email) as participant_count,
          MAX(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as has_critical_email,
          MAX(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as has_active_email
        FROM emails_enhanced
        WHERE conversation_id_ref IS NOT NULL
        GROUP BY conversation_id_ref, thread_id;
      `);

      // View for SLA monitoring
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_sla_monitoring AS
        SELECT 
          e.id,
          e.received_at,
          e.priority,
          e.status,
          e.assigned_to,
          ea.action_sla_status,
          CASE 
            WHEN e.priority = 'critical' THEN 4
            WHEN e.priority = 'high' THEN 8
            WHEN e.priority = 'medium' THEN 24
            ELSE 48
          END as sla_hours,
          CASE 
            WHEN e.status != 'completed' THEN 
              (julianday('now') - julianday(e.received_at)) * 24
            ELSE 
              (julianday(e.updated_at) - julianday(e.received_at)) * 24
          END as elapsed_hours
        FROM emails_enhanced e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        WHERE e.status IN ('new', 'in_progress');
      `);

      // View for attachment analysis (no content)
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_attachment_analysis AS
        SELECT 
          content_type,
          COUNT(*) as file_count,
          AVG(size_bytes) as avg_size_bytes,
          MIN(size_bytes) as min_size_bytes,
          MAX(size_bytes) as max_size_bytes,
          SUM(size_bytes) as total_size_bytes,
          COUNT(DISTINCT email_id) as email_count
        FROM email_attachments
        GROUP BY content_type;
      `);

      logger.info("Security views created successfully", "DB_SECURITY");
    } catch (error) {
      logger.error("Failed to create security views", "DB_SECURITY", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create triggers for audit logging
   */
  createAuditTriggers(): void {
    try {
      logger.info("Creating audit triggers", "DB_SECURITY");

      // Ensure audit_logs table exists
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          old_values TEXT,
          new_values TEXT,
          performed_by TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Trigger for email updates
      this?.db?.exec(`
        CREATE TRIGGER IF NOT EXISTS tr_audit_email_update
        AFTER UPDATE ON emails_enhanced
        FOR EACH ROW
        WHEN OLD.status != NEW.status 
          OR OLD.priority != NEW.priority 
          OR OLD.assigned_to != NEW.assigned_to
        BEGIN
          INSERT INTO audit_logs (
            id, entity_type, entity_id, action, 
            old_values, new_values, performed_by, created_at
          ) VALUES (
            lower(hex(randomblob(16))),
            'email',
            NEW.id,
            'update',
            json_object(
              'status', OLD.status,
              'priority', OLD.priority,
              'assigned_to', OLD.assigned_to
            ),
            json_object(
              'status', NEW.status,
              'priority', NEW.priority,
              'assigned_to', NEW.assigned_to
            ),
            COALESCE(NEW.assigned_to, 'system'),
            datetime('now')
          );
        END;
      `);

      // Trigger for user login attempts
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          success INTEGER NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          failure_reason TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created 
        ON login_attempts(email, created_at DESC);
      `);

      // Trigger to monitor failed login attempts
      this?.db?.exec(`
        CREATE TRIGGER IF NOT EXISTS tr_monitor_failed_logins
        AFTER INSERT ON login_attempts
        FOR EACH ROW
        WHEN NEW.success = 0
        BEGIN
          SELECT CASE
            WHEN (
              SELECT COUNT(*) 
              FROM login_attempts 
              WHERE email = NEW.email 
                AND success = 0 
                AND created_at > datetime('now', '-15 minutes')
            ) >= 5
            THEN RAISE(ABORT, 'Too many failed login attempts')
          END;
        END;
      `);

      logger.info("Audit triggers created successfully", "DB_SECURITY");
    } catch (error) {
      logger.error("Failed to create audit triggers", "DB_SECURITY", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create role-based access control tables
   */
  createRBACTables(): void {
    try {
      logger.info("Creating RBAC tables", "DB_SECURITY");

      // Permissions table
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS permissions (
          id TEXT PRIMARY KEY,
          resource TEXT NOT NULL,
          action TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(resource, action)
        );

        CREATE INDEX IF NOT EXISTS idx_permissions_resource_action 
        ON permissions(resource, action);
      `);

      // Role permissions mapping
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          permission_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (permission_id) REFERENCES permissions(id),
          UNIQUE(role, permission_id)
        );

        CREATE INDEX IF NOT EXISTS idx_role_permissions_role 
        ON role_permissions(role);
      `);

      // User permissions (for specific overrides)
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          permission_id TEXT NOT NULL,
          granted INTEGER NOT NULL DEFAULT 1,
          expires_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (permission_id) REFERENCES permissions(id),
          UNIQUE(user_id, permission_id)
        );

        CREATE INDEX IF NOT EXISTS idx_user_permissions_user 
        ON user_permissions(user_id);
      `);

      // Insert default permissions
      const defaultPermissions = [
        {
          resource: "email",
          action: "read",
          description: "View email content",
        },
        {
          resource: "email",
          action: "write",
          description: "Create/update emails",
        },
        { resource: "email", action: "delete", description: "Delete emails" },
        {
          resource: "email",
          action: "assign",
          description: "Assign emails to users",
        },
        {
          resource: "analytics",
          action: "view",
          description: "View analytics data",
        },
        {
          resource: "user",
          action: "manage",
          description: "Manage user accounts",
        },
        {
          resource: "workflow",
          action: "create",
          description: "Create workflows",
        },
        {
          resource: "workflow",
          action: "execute",
          description: "Execute workflows",
        },
        {
          resource: "system",
          action: "admin",
          description: "System administration",
        },
      ];

      const insertPermission = this?.db?.prepare(`
        INSERT OR IGNORE INTO permissions (id, resource, action, description)
        VALUES (?, ?, ?, ?)
      `);

      for (const perm of defaultPermissions) {
        const id = `${perm.resource}:${perm.action}`;
        insertPermission.run(id, perm.resource, perm.action, perm.description);
      }

      logger.info("RBAC tables created successfully", "DB_SECURITY");
    } catch (error) {
      logger.error("Failed to create RBAC tables", "DB_SECURITY", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create data masking functions (simulated with views)
   */
  createDataMaskingViews(): void {
    try {
      logger.info("Creating data masking views", "DB_SECURITY");

      // Masked email view for non-privileged users
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_emails_masked AS
        SELECT 
          e.id,
          e.graph_id,
          e.subject,
          CASE 
            WHEN LENGTH(e.sender_email) > 0 THEN 
              SUBSTR(e.sender_email, 1, 3) || '***@' || 
              SUBSTR(e.sender_email, INSTR(e.sender_email, '@') + 1)
            ELSE e.sender_email
          END as sender_email_masked,
          e.received_at,
          e.priority,
          e.status,
          e.has_attachments,
          e.is_read,
          e.assigned_to,
          '***' as body_preview_masked
        FROM emails_enhanced e;
      `);

      // Masked user view
      this?.db?.exec(`
        CREATE VIEW IF NOT EXISTS v_users_masked AS
        SELECT 
          id,
          CASE 
            WHEN LENGTH(email) > 0 THEN 
              SUBSTR(email, 1, 3) || '***@' || 
              SUBSTR(email, INSTR(email, '@') + 1)
            ELSE email
          END as email_masked,
          role,
          is_active,
          created_at,
          last_login
        FROM users;
      `);

      logger.info("Data masking views created successfully", "DB_SECURITY");
    } catch (error) {
      logger.error("Failed to create data masking views", "DB_SECURITY", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initialize all security views and controls
   */
  initializeSecurityLayer(): void {
    try {
      this.createSecurityViews();
      this.createAuditTriggers();
      this.createRBACTables();
      this.createDataMaskingViews();

      logger.info("Database security layer initialized", "DB_SECURITY");
    } catch (error) {
      logger.error("Failed to initialize security layer", "DB_SECURITY", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check user permissions
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    try {
      // First check user-specific permissions
      const userPerm = this.db
        .prepare(
          `
        SELECT granted, expires_at 
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = ? 
          AND p.resource = ? 
          AND p.action = ?
          AND (up.expires_at IS NULL OR up.expires_at > datetime('now'))
      `,
        )
        .get(userId, resource, action) as any;

      if (userPerm) {
        return userPerm.granted === 1;
      }

      // Check role-based permissions
      const rolePerm = this.db
        .prepare(
          `
        SELECT 1
        FROM users u
        JOIN role_permissions rp ON u.role = rp.role
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = ? 
          AND p.resource = ? 
          AND p.action = ?
      `,
        )
        .get(userId, resource, action);

      return !!rolePerm;
    } catch (error) {
      logger.error("Failed to check permission", "DB_SECURITY", {
        error: error instanceof Error ? error.message : String(error),
        userId,
        resource,
        action,
      });
      return false;
    }
  }
}

// Export factory function
export function createDatabaseSecurityViews(
  db: Database.Database,
): DatabaseSecurityViews {
  return new DatabaseSecurityViews(db);
}
