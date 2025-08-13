#!/usr/bin/env tsx
/**
 * Email Pipeline Backend Service
 * Autonomous service that continuously processes emails through three-phase analysis
 * and feeds actionable data to the UI
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as cron from "node-cron";
import { EventEmitter } from "events";
import { WebSocketServer } from "ws";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  EMAIL_POLL_INTERVAL: 5 * 60 * 1000, // 5 minutes
  METRIC_AGGREGATION_INTERVAL: 15 * 60 * 1000, // 15 minutes
  SLA_CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutes
  BATCH_SIZE: 100,
  PARALLEL_WORKERS: 5,
  DB_PATH: "./data/crewai.db",
  CACHE_DIR: "./data/cache",
  WS_PORT: 3002,
};

// ============================================
// EMAIL PIPELINE SERVICE
// ============================================

class EmailPipelineService extends EventEmitter {
  private db: Database.Database;
  private wsServer: WebSocketServer;
  private isRunning: boolean = false;
  private lastSyncTokens: Map<string, string> = new Map();
  private processingQueue: any[] = [];

  constructor() {
    super();
    this.db = // Use connection pool instead: getDatabaseConnection().getDatabase() or executeQuery((db) => ...)CONFIG.DB_PATH);
      this.wsServer = new WebSocketServer({ port: CONFIG.WS_PORT });
    this.setupWebSocket();
    this.loadSyncTokens();
  }

  // ----------------------------------------
  // Main Pipeline Loop
  // ----------------------------------------

  async start() {
    console.log("🚀 Email Pipeline Service Starting...");
    this.isRunning = true;

    // Start all background services
    this.startEmailIngestion();
    this.startMetricAggregation();
    this.startSLAMonitoring();
    this.startQueueProcessor();

    console.log("✅ Email Pipeline Service Started");
    console.log(
      `   - Email polling: Every ${CONFIG.EMAIL_POLL_INTERVAL / 60000} minutes`,
    );
    console.log(
      `   - Metric aggregation: Every ${CONFIG.METRIC_AGGREGATION_INTERVAL / 60000} minutes`,
    );
    console.log(
      `   - SLA monitoring: Every ${CONFIG.SLA_CHECK_INTERVAL / 60000} minutes`,
    );
    console.log(`   - WebSocket server: Port ${CONFIG.WS_PORT}`);
  }

  // ----------------------------------------
  // Email Ingestion Service
  // ----------------------------------------

  private startEmailIngestion() {
    // Schedule email polling
    cron.schedule("*/5 * * * *", async () => {
      if (!this.isRunning) return;

      console.log("📧 Checking for new emails...");
      const startTime = Date.now();

      try {
        const mailboxes = await this.getMailboxes();
        let totalNewEmails = 0;

        for (const mailbox of mailboxes) {
          const newEmails = await this.fetchNewEmails(mailbox);
          if (newEmails.length > 0) {
            console.log(`   📬 ${mailbox}: ${newEmails.length} new emails`);
            await this.queueEmailsForAnalysis(newEmails);
            totalNewEmails += newEmails.length;
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `   ✓ Email check complete: ${totalNewEmails} new emails (${elapsed}s)`,
        );
      } catch (error) {
        console.error("❌ Email ingestion error:", error);
      }
    });
  }

  private async fetchNewEmails(mailbox: string): Promise<any[]> {
    // In production, this would use Microsoft Graph API
    // For now, simulate with database query
    const lastSync = this.lastSyncTokens.get(mailbox) || "2025-01-31T00:00:00Z";

    const newEmails = this.db
      .prepare(
        `
      SELECT * FROM emails 
      WHERE recipient_emails LIKE ?
        AND received_at > ?
      ORDER BY received_at ASC
      LIMIT 50
    `,
      )
      .all(`%${mailbox}%`, lastSync);

    if (newEmails.length > 0) {
      const latestDate = newEmails[newEmails.length - 1].received_at;
      this.lastSyncTokens.set(mailbox, latestDate);
      this.saveSyncTokens();
    }

    return newEmails;
  }

  private async queueEmailsForAnalysis(emails: any[]) {
    // Add emails to processing queue
    this.processingQueue.push(...emails);

    // Emit event for monitoring
    this.emit("emails:queued", {
      count: emails.length,
      queueSize: this.processingQueue.length,
    });
  }

  // ----------------------------------------
  // Queue Processing Service
  // ----------------------------------------

  private startQueueProcessor() {
    setInterval(async () => {
      if (!this.isRunning || this.processingQueue.length === 0) return;

      // Process batch
      const batch = this.processingQueue.splice(0, CONFIG.BATCH_SIZE);
      console.log(`⚙️  Processing batch of ${batch.length} emails...`);

      try {
        await this.processBatch(batch);
      } catch (error) {
        console.error("❌ Batch processing error:", error);
        // Re-queue failed emails
        this.processingQueue.unshift(...batch);
      }
    }, 10000); // Process every 10 seconds
  }

  private async processBatch(emails: any[]) {
    const tasks: any[] = [];
    const startTime = Date.now();

    for (const email of emails) {
      // Import and run three-phase analysis
      const { processEmailIncremental } = await import(
        "./analyze-emails-three-phase-incremental.js"
      );
      const result = await processEmailIncremental(email, this.db);

      tasks.push(result.task);

      // Emit real-time events
      this.broadcastEvent("workflow:task:created", {
        task: result.task,
        analysis: {
          phases: result.analysis.analysis_phases,
          category: result.task.workflow_category,
          status: result.task.task_status,
          value: result.task.entities.dollar_value,
        },
      });

      // Special handling for critical tasks
      if (
        result.task.task_status === "RED" ||
        result.task.priority === "CRITICAL"
      ) {
        this.broadcastEvent("workflow:critical:alert", {
          taskId: result.task.task_id,
          title: result.task.title,
          owner: result.task.current_owner,
          deadline: result.task.sla_deadline,
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `   ✓ Batch processed: ${tasks.length} tasks created (${elapsed}s)`,
    );

    // Update metrics after batch
    await this.updateMetrics();
  }

  // ----------------------------------------
  // Metric Aggregation Service
  // ----------------------------------------

  private startMetricAggregation() {
    // Initial aggregation
    setTimeout(() => this.aggregateMetrics(), 5000);

    // Schedule regular aggregation
    cron.schedule("*/15 * * * *", async () => {
      if (!this.isRunning) return;
      await this.aggregateMetrics();
    });
  }

  private async aggregateMetrics() {
    console.log("📊 Aggregating metrics...");
    const startTime = Date.now();

    try {
      // Executive metrics
      const executiveMetrics = this.db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_tasks,
          SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_tasks,
          SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_tasks,
          SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as revenue_at_risk,
          COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
                AND task_status != 'COMPLETED' THEN 1 END) as sla_violations
        FROM workflow_tasks
        WHERE created_at > datetime('now', '-7 days')
      `,
        )
        .get();

      // Category breakdown
      const categoryBreakdown = this.db
        .prepare(
          `
        SELECT 
          workflow_category,
          COUNT(*) as count,
          SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_count,
          AVG(dollar_value) as avg_value,
          COUNT(CASE WHEN task_status = 'COMPLETED' THEN 1 END) * 100.0 / COUNT(*) as completion_rate
        FROM workflow_tasks
        GROUP BY workflow_category
        ORDER BY count DESC
      `,
        )
        .all();

      // Owner workload
      const ownerWorkload = this.db
        .prepare(
          `
        SELECT 
          current_owner,
          COUNT(*) as active_tasks,
          SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_tasks,
          SUM(dollar_value) as total_value,
          MIN(sla_deadline) as next_deadline
        FROM workflow_tasks
        WHERE task_status != 'COMPLETED'
        GROUP BY current_owner
        ORDER BY critical_tasks DESC, active_tasks DESC
        LIMIT 20
      `,
        )
        .all();

      // Trend data (last 7 days)
      const trendData = this.db
        .prepare(
          `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_tasks,
          SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
          AVG(dollar_value) as avg_value
        FROM workflow_tasks
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
        )
        .all();

      // Cache metrics
      const metrics = {
        executive: executiveMetrics,
        categories: categoryBreakdown,
        owners: ownerWorkload,
        trends: trendData,
        lastUpdated: new Date().toISOString(),
      };

      await this.cacheMetrics(metrics);

      // Broadcast update
      this.broadcastEvent("workflow:metrics:updated", metrics);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ✓ Metrics aggregated (${elapsed}s)`);
    } catch (error) {
      console.error("❌ Metric aggregation error:", error);
    }
  }

  // ----------------------------------------
  // SLA Monitoring Service
  // ----------------------------------------

  private startSLAMonitoring() {
    cron.schedule("*/10 * * * *", async () => {
      if (!this.isRunning) return;
      await this.checkSLADeadlines();
    });
  }

  private async checkSLADeadlines() {
    console.log("⏰ Checking SLA deadlines...");

    try {
      // Find tasks approaching SLA
      const approachingTasks = this.db
        .prepare(
          `
        SELECT 
          task_id,
          title,
          current_owner,
          sla_deadline,
          (julianday(sla_deadline) - julianday('now')) * 24 as hours_remaining
        FROM workflow_tasks
        WHERE task_status != 'COMPLETED'
          AND datetime(sla_deadline) > datetime('now')
          AND datetime(sla_deadline) < datetime('now', '+24 hours')
        ORDER BY sla_deadline
      `,
        )
        .all();

      // Find violated SLAs
      const violatedTasks = this.db
        .prepare(
          `
        SELECT 
          task_id,
          title,
          current_owner,
          sla_deadline,
          (julianday('now') - julianday(sla_deadline)) * 24 as hours_overdue
        FROM workflow_tasks
        WHERE task_status != 'COMPLETED'
          AND datetime(sla_deadline) < datetime('now')
      `,
        )
        .all();

      // Send warnings for approaching SLAs
      for (const task of approachingTasks) {
        const severity = task.hours_remaining < 4 ? "CRITICAL" : "WARNING";

        this.broadcastEvent("workflow:sla:warning", {
          taskId: task.task_id,
          title: task.title,
          owner: task.current_owner,
          hoursRemaining: Math.round(task.hours_remaining),
          severity,
        });
      }

      // Update status for violated SLAs
      for (const task of violatedTasks) {
        // Update task status to RED
        this.db
          .prepare(
            `
          UPDATE workflow_tasks 
          SET task_status = 'RED', 
              updated_at = datetime('now')
          WHERE task_id = ?
        `,
          )
          .run(task.task_id);

        this.broadcastEvent("workflow:sla:violated", {
          taskId: task.task_id,
          title: task.title,
          owner: task.current_owner,
          hoursOverdue: Math.round(task.hours_overdue),
        });
      }

      if (approachingTasks.length > 0 || violatedTasks.length > 0) {
        console.log(
          `   ⚠️  ${approachingTasks.length} approaching, ${violatedTasks.length} violated`,
        );
      } else {
        console.log(`   ✓ All SLAs on track`);
      }
    } catch (error) {
      console.error("❌ SLA monitoring error:", error);
    }
  }

  // ----------------------------------------
  // WebSocket Event Broadcasting
  // ----------------------------------------

  private setupWebSocket() {
    this.wsServer.on("connection", (ws) => {
      console.log("🔌 New WebSocket connection");

      // Send current metrics on connection
      this.sendCachedMetrics(ws);

      ws.on("close", () => {
        console.log("🔌 WebSocket disconnected");
      });
    });
  }

  private broadcastEvent(event: string, data: any) {
    const message = JSON.stringify({ event, data, timestamp: new Date() });

    this.wsServer.clients.forEach((client) => {
      if (client.readyState === 1) {
        // OPEN
        client.send(message);
      }
    });
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  private async getMailboxes(): Promise<string[]> {
    // In production, load from configuration
    return [
      "InsightOrderSupport@tdsynnex.com",
      "nick.paul@tdsynnex.com",
      "t119889c@tdsynnex.com",
      "team4401@tdsynnex.com",
      "insighthpi@tdsynnex.com",
    ];
  }

  private loadSyncTokens() {
    const tokenFile = path.join(CONFIG.CACHE_DIR, "sync-tokens.json");
    if (fs.existsSync(tokenFile)) {
      const tokens = JSON.parse(fs.readFileSync(tokenFile, "utf-8"));
      this.lastSyncTokens = new Map(Object.entries(tokens));
    }
  }

  private saveSyncTokens() {
    const tokenFile = path.join(CONFIG.CACHE_DIR, "sync-tokens.json");
    const tokens = Object.fromEntries(this.lastSyncTokens);
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
  }

  private async cacheMetrics(metrics: any) {
    const cacheFile = path.join(CONFIG.CACHE_DIR, "dashboard-metrics.json");
    fs.writeFileSync(cacheFile, JSON.stringify(metrics, null, 2));
  }

  private async sendCachedMetrics(ws: any) {
    const cacheFile = path.join(CONFIG.CACHE_DIR, "dashboard-metrics.json");
    if (fs.existsSync(cacheFile)) {
      const metrics = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      ws.send(
        JSON.stringify({
          event: "workflow:metrics:initial",
          data: metrics,
        }),
      );
    }
  }

  private async updateMetrics() {
    // Quick metric update after batch processing
    const quickMetrics = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_active,
        SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as revenue_at_risk
      FROM workflow_tasks
      WHERE task_status != 'COMPLETED'
    `,
      )
      .get();

    this.broadcastEvent("workflow:metrics:quick", quickMetrics);
  }

  // ----------------------------------------
  // Graceful Shutdown
  // ----------------------------------------

  async stop() {
    console.log("🛑 Stopping Email Pipeline Service...");
    this.isRunning = false;

    // Save state
    this.saveSyncTokens();

    // Close connections
    this.wsServer.close();
    this.db.close();

    console.log("✅ Email Pipeline Service Stopped");
  }
}

// ============================================
// SERVICE INITIALIZATION
// ============================================

async function main() {
  // Ensure cache directory exists
  if (!fs.existsSync(CONFIG.CACHE_DIR)) {
    fs.mkdirSync(CONFIG.CACHE_DIR, { recursive: true });
  }

  // Create and start service
  const pipeline = new EmailPipelineService();

  // Handle shutdown
  process.on("SIGINT", async () => {
    await pipeline.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await pipeline.stop();
    process.exit(0);
  });

  // Start the pipeline
  await pipeline.start();

  // Log initial status
  console.log("\n📊 Pipeline Status Dashboard:");
  console.log("   http://localhost:3001/dashboard");
  console.log("   WebSocket: ws://localhost:3002");
  console.log("\nPress Ctrl+C to stop the service\n");
}

// Run the service
main().catch(console.error);
