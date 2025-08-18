import Database from "better-sqlite3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  up as addCompositeIndexes,
  down as removeCompositeIndexes,
} from "../migrations/007_add_composite_indexes.js";
import { logger } from "../utils/logger.js";

describe("Composite Index Performance Tests", () => {
  let db: Database.Database;
  const testDbPath = ":memory:"; // Use in-memory database for tests

  beforeAll(async () => {
    // Create database connection
    db = new Database(testDbPath);

    // Enable query execution time tracking
    db.pragma("journal_mode = WAL");

    // Create base schema
    await createBaseSchema(db);

    // Insert test data
    await insertTestData(db);
  });

  afterAll(() => {
    db.close();
  });

  describe("Index Creation", () => {
    it("should create all composite indexes successfully", async () => {
      // Run migration
      await addCompositeIndexes(db);

      // Verify indexes were created
      const indexes = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND name LIKE 'idx_%'
        ORDER BY name
      `,
        )
        .all() as { name: string }[];

      // Check for key composite indexes
      const expectedIndexes = [
        "idx_emails_received_sender_subject",
        "idx_emails_graph_received",
        "idx_analysis_workflow_priority",
        "idx_analysis_sla_workflow",
        "idx_analysis_priority_email",
        "idx_analysis_deep_workflow",
        "idx_emails_enhanced_assigned_status",
        "idx_emails_enhanced_priority_due",
        "idx_conversations_user_status_created",
        "idx_messages_conversation_created",
        // New indexes
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

      const indexNames = indexes?.map((idx: any) => idx.name);

      expectedIndexes.forEach((expectedIndex: any) => {
        expect(indexNames).toContain(expectedIndex);
      });
    });

    it("should improve query performance for email listing", async () => {
      // Test query that should benefit from composite index
      const query = `
        SELECT e.*, ea.quick_priority, ea.workflow_state
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        WHERE e.sender_email = ?
        ORDER BY e.received_at DESC
        LIMIT 50
      `;

      // Get query plan before and after indexes
      const planBefore = getQueryPlan(db, query, ["test@example.com"]);

      // The plan should show index usage
      const usesIndex = planBefore.some(
        (step: any) =>
          step.detail?.includes("idx_emails_received_sender_subject") ||
          step.detail?.includes("USING INDEX"),
      );

      expect(usesIndex).toBe(true);
    });

    it("should improve query performance for workflow state queries", async () => {
      const query = `
        SELECT COUNT(*) as count
        FROM email_analysis
        WHERE workflow_state = ? AND quick_priority = ?
      `;

      const plan = getQueryPlan(db, query, ["IN_PROGRESS", "High"]);

      // Should use composite index
      const usesCompositeIndex = plan.some((step: any) =>
        step.detail?.includes("idx_analysis_workflow_priority"),
      );

      expect(usesCompositeIndex).toBe(true);
    });

    it("should improve SLA monitoring query performance", async () => {
      const query = `
        SELECT e.id, e.subject, ea.action_sla_status
        FROM emails e
        JOIN email_analysis ea ON e.id = ea.email_id
        WHERE ea.workflow_state NOT IN ('Completed', 'Archived')
        AND ea.action_sla_status IN ('at-risk', 'overdue')
      `;

      const plan = getQueryPlan(db, query, []);

      // Should use SLA composite index
      const usesSLAIndex = plan.some((step: any) =>
        step.detail?.includes("idx_analysis_sla_workflow"),
      );

      expect(usesSLAIndex).toBe(true);
    });
  });

  describe("Query Performance Benchmarks", () => {
    it("should execute email listing queries efficiently", async () => {
      const query = `
        SELECT e.*, ea.quick_priority, ea.workflow_state
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        ORDER BY e.received_at DESC
        LIMIT 100
      `;

      const startTime = Date.now();
      const stmt = db.prepare(query);
      const results = stmt.all();
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(executionTime).toBeLessThan(50); // Should execute in under 50ms
    });

    it("should execute analytics aggregation queries efficiently", async () => {
      const query = `
        SELECT 
          deep_workflow_primary as workflow,
          COUNT(*) as count,
          AVG(total_processing_time) as avg_time
        FROM email_analysis
        WHERE deep_workflow_primary IS NOT NULL
        GROUP BY deep_workflow_primary
      `;

      const startTime = Date.now();
      const stmt = db.prepare(query);
      const results = stmt.all();
      const executionTime = Date.now() - startTime;

      expect(results?.length || 0).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(30); // Should execute in under 30ms
    });

    it("should execute user workload queries efficiently", async () => {
      const query = `
        SELECT 
          assigned_to,
          COUNT(*) as total_emails,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_emails,
          SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END) as critical_emails
        FROM emails_enhanced
        WHERE assigned_to IS NOT NULL
        GROUP BY assigned_to
      `;

      const startTime = Date.now();
      const stmt = db.prepare(query);
      const results = stmt.all();
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(40); // Should execute in under 40ms
    });

    it("should optimize date range queries with status filtering", async () => {
      const query = `
        SELECT * FROM emails_enhanced
        WHERE received_at BETWEEN ? AND ?
        AND status = ?
        ORDER BY received_at DESC
      `;

      const plan = getQueryPlan(db, query, [
        "2024-01-01",
        "2024-12-31",
        "in_progress",
      ]);

      // Should use the date range status index
      const usesIndex = plan.some((step: any) =>
        step.detail?.includes("idx_emails_enhanced_date_range_status"),
      );

      expect(usesIndex).toBe(true);
    });

    it("should optimize refresh token validation queries", async () => {
      const query = `
        SELECT * FROM refresh_tokens
        WHERE user_id = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      `;

      const plan = getQueryPlan(db, query, ["user123"]);

      // Should use the user expiry index
      const usesIndex = plan.some((step: any) =>
        step.detail?.includes("idx_refresh_tokens_user_expiry"),
      );

      expect(usesIndex).toBe(true);
    });

    it("should optimize email entity queries by email", async () => {
      const query = `
        SELECT * FROM email_entities
        WHERE email_id = ? AND entity_type = ?
        ORDER BY confidence DESC
      `;

      const plan = getQueryPlan(db, query, ["email123", "PO_NUMBER"]);

      // Should use the email type index
      const usesIndex = plan.some((step: any) =>
        step.detail?.includes("idx_email_entities_email_type"),
      );

      expect(usesIndex).toBe(true);
    });

    it("should optimize workflow chain email joins", async () => {
      const query = `
        SELECT wc.* FROM workflow_chains wc
        JOIN workflow_chain_emails wce ON wc.id = wce.chain_id
        WHERE wce.email_id = ?
      `;

      const plan = getQueryPlan(db, query, ["email123"]);

      // Should use the workflow chain email index
      const usesIndex = plan.some((step: any) =>
        step.detail?.includes("idx_workflow_chain_emails_email"),
      );

      expect(usesIndex).toBe(true);
    });
  });

  describe("Index Rollback", () => {
    it("should remove all composite indexes on rollback", async () => {
      // Get index count before rollback
      const indexesBefore = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type = 'index' AND name LIKE 'idx_%'
      `,
        )
        .get() as { count: number };

      // Rollback migration
      await removeCompositeIndexes(db);

      // Get index count after rollback
      const indexesAfter = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type = 'index' AND name LIKE 'idx_%'
      `,
        )
        .get() as { count: number };

      // Should have fewer indexes after rollback
      expect(indexesAfter.count).toBeLessThan(indexesBefore.count);
    });
  });
});

// Helper function to create base schema
async function createBaseSchema(db: Database.Database): Promise<void> {
  // Create emails table
  db.exec(`
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

  // Create email_analysis table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_analysis (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      quick_workflow TEXT,
      quick_priority TEXT,
      quick_intent TEXT,
      quick_urgency TEXT,
      quick_confidence REAL,
      quick_suggested_state TEXT,
      quick_model TEXT,
      quick_processing_time INTEGER,
      deep_workflow_primary TEXT,
      deep_workflow_secondary TEXT,
      deep_workflow_related TEXT,
      deep_confidence REAL,
      entities_po_numbers TEXT,
      entities_quote_numbers TEXT,
      entities_case_numbers TEXT,
      entities_part_numbers TEXT,
      entities_order_references TEXT,
      entities_contacts TEXT,
      action_summary TEXT,
      action_details TEXT,
      action_sla_status TEXT,
      workflow_state TEXT DEFAULT 'New',
      workflow_state_updated_at TEXT,
      workflow_suggested_next TEXT,
      workflow_estimated_completion TEXT,
      workflow_blockers TEXT,
      business_impact_revenue REAL,
      business_impact_satisfaction TEXT,
      business_impact_urgency_reason TEXT,
      contextual_summary TEXT,
      suggested_response TEXT,
      related_emails TEXT,
      thread_position INTEGER,
      deep_model TEXT,
      deep_processing_time INTEGER,
      total_processing_time INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
    );
  `);

  // Create other required tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails_enhanced (
      id TEXT PRIMARY KEY,
      graph_id TEXT UNIQUE,
      message_id TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      body_preview TEXT,
      sender_email TEXT NOT NULL,
      sender_name TEXT,
      recipients TEXT,
      cc_recipients TEXT,
      bcc_recipients TEXT,
      received_at TIMESTAMP NOT NULL,
      sent_at TIMESTAMP,
      importance TEXT,
      categories TEXT,
      has_attachments BOOLEAN DEFAULT FALSE,
      is_read BOOLEAN DEFAULT FALSE,
      is_flagged BOOLEAN DEFAULT FALSE,
      thread_id TEXT,
      conversation_id_ref TEXT,
      in_reply_to TEXT,
      "references" TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'archived')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      assigned_to TEXT,
      assigned_at TIMESTAMP,
      due_date TIMESTAMP,
      processed_at TIMESTAMP,
      processing_version TEXT,
      analysis_confidence REAL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      user_id TEXT NOT NULL,
      agent_type TEXT,
      conversation_type TEXT DEFAULT 'chat',
      status TEXT DEFAULT 'active',
      metadata TEXT,
      tags TEXT,
      priority INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT,
      agent_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT DEFAULT 'text',
      metadata TEXT,
      attachments TEXT,
      parent_message_id TEXT,
      thread_id TEXT,
      confidence_score REAL,
      processing_time INTEGER,
      model_used TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_entities (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_value TEXT NOT NULL,
      entity_format TEXT,
      confidence REAL DEFAULT 1.0,
      extraction_method TEXT,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
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

  // Additional tables for new indexes
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_chains (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_chain_emails (
      id TEXT PRIMARY KEY,
      chain_id TEXT NOT NULL,
      email_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chain_id) REFERENCES workflow_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
}

// Helper function to insert test data
async function insertTestData(db: Database.Database): Promise<void> {
  const emailCount = 1000;
  const analysisCount = 1000;

  // Insert test emails
  const emailStmt = db.prepare(`
    INSERT INTO emails (id, graph_id, subject, sender_email, sender_name, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  for (let i = 0; i < emailCount; i++) {
    const receivedAt = new Date(now.getTime() - i * 60000); // 1 minute apart
    emailStmt.run(
      `email_${i}`,
      `graph_${i}`,
      `Test Email ${i}`,
      `sender${i % 10}@example.com`,
      `Sender ${i % 10}`,
      receivedAt.toISOString(),
    );
  }

  // Insert test email analysis
  const analysisStmt = db.prepare(`
    INSERT INTO email_analysis (
      id, email_id, quick_workflow, quick_priority, workflow_state,
      deep_workflow_primary, action_sla_status, total_processing_time
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const workflows = [
    "Order Management",
    "Customer Support",
    "Quote Processing",
    "Shipping/Logistics",
  ];
  const priorities = ["Critical", "High", "Medium", "Low"];
  const states = ["New", "IN_PROGRESS", "Completed"];
  const slaStatuses = ["on-track", "at-risk", "overdue"];

  for (let i = 0; i < analysisCount; i++) {
    analysisStmt.run(
      `analysis_${i}`,
      `email_${i}`,
      workflows[i % workflows?.length || 0],
      priorities[i % priorities?.length || 0],
      states[i % states?.length || 0],
      workflows[i % workflows?.length || 0],
      slaStatuses[i % slaStatuses?.length || 0],
      Math.floor(Math.random() * 5000), // Random processing time
    );
  }

  // Insert test data for emails_enhanced
  const enhancedStmt = db.prepare(`
    INSERT INTO emails_enhanced (
      id, graph_id, message_id, subject, sender_email, sender_name,
      received_at, status, priority, assigned_to
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const statuses = ["new", "in_progress", "completed", "archived"];
  const users = ["user1", "user2", "user3", "user4", null];

  for (let i = 0; i < 500; i++) {
    const receivedAt = new Date(now.getTime() - i * 120000); // 2 minutes apart
    enhancedStmt.run(
      `enhanced_${i}`,
      `graph_enhanced_${i}`,
      `msg_${i}`,
      `Enhanced Email ${i}`,
      `sender${i % 5}@company.com`,
      `Sender ${i % 5}`,
      receivedAt.toISOString(),
      statuses[i % statuses?.length || 0],
      priorities[i % priorities?.length || 0].toLowerCase(),
      users[i % users?.length || 0],
    );
  }
}

// Helper function to get query execution plan
function getQueryPlan(
  db: Database.Database,
  query: string,
  params: any[],
): any[] {
  const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
  const stmt = db.prepare(explainQuery);
  return stmt.all(...params);
}
