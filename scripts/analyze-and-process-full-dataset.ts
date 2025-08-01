#!/usr/bin/env tsx

/**
 * Comprehensive analysis and processing of both existing and new emails
 * 1. Analyzes crewai.db + 20k new emails for complete workflow chains
 * 2. Runs adaptive three-phase pipeline on all emails
 * 3. Updates crewai.db with new analysis and workflow information
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { logger } from "../src/utils/logger.js";
import chalk from "chalk";
import { promises as fs } from "fs";
import path from "path";
import { EventEmitter } from "events";

interface WorkflowChain {
  chain_id: string;
  email_ids: string[];
  email_count: number;
  completeness_score: number;
  is_complete: boolean;
  chain_type: string;
  start_time: Date;
  end_time: Date;
  duration_hours: number;
}

interface ProcessingStats {
  total_emails: number;
  new_emails: number;
  existing_emails: number;
  total_chains: number;
  complete_chains: number;
  incomplete_chains: number;
  emails_processed: number;
  phase3_count: number;
  phase2_only_count: number;
  processing_time: number;
  errors: number;
}

class FullDatasetProcessor extends EventEmitter {
  private db: any;
  private chainAnalyzer: EmailChainAnalyzer;
  private threePhaseService: EmailThreePhaseAnalysisService;
  private stats: ProcessingStats;

  constructor() {
    super();
    const dbManager = getDatabaseManager();
    this.db = dbManager.getSQLiteDatabase();
    this.chainAnalyzer = new EmailChainAnalyzer();
    this.threePhaseService = new EmailThreePhaseAnalysisService();
    this.stats = {
      total_emails: 0,
      new_emails: 0,
      existing_emails: 0,
      total_chains: 0,
      complete_chains: 0,
      incomplete_chains: 0,
      emails_processed: 0,
      phase3_count: 0,
      phase2_only_count: 0,
      processing_time: 0,
      errors: 0,
    };
  }

  async processFullDataset() {
    console.log(chalk.blue.bold("\n🚀 Full Dataset Analysis & Processing\n"));
    console.log(chalk.white("This process will:"));
    console.log(chalk.white("1. Import 20k new emails into crewai.db"));
    console.log(chalk.white("2. Analyze all emails for workflow chains"));
    console.log(chalk.white("3. Run adaptive three-phase analysis"));
    console.log(chalk.white("4. Update database with results\n"));

    const startTime = Date.now();

    try {
      // Step 1: Import new emails
      await this.importNewEmails();

      // Step 2: Analyze workflow chains
      const workflowChains = await this.analyzeWorkflowChains();

      // Step 3: Process emails with adaptive pipeline
      await this.processEmailsWithAdaptivePipeline(workflowChains);

      // Step 4: Generate workflow templates
      await this.generateWorkflowTemplates(workflowChains);

      // Step 5: Update database with analysis results
      await this.updateDatabaseWithResults();

      this.stats.processing_time = (Date.now() - startTime) / 1000;

      // Display final results
      this.displayResults();
    } catch (error) {
      logger.error("Failed to process full dataset", "FULL_DATASET_PROCESSOR", {
        error,
      });
      console.error(chalk.red("\n❌ Fatal error:"), error);
      throw error;
    }
  }

  private async importNewEmails() {
    console.log(chalk.yellow("\n📥 Step 1: Importing new emails...\n"));

    // Check for email extraction files
    const extractionPath = path.join(
      process.cwd(),
      "scripts/email-extraction/extracted_emails",
    );
    const batchesPath = path.join(extractionPath, "batches");

    try {
      const files = await fs.readdir(batchesPath);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      console.log(
        chalk.cyan(`Found ${jsonFiles.length} email batch files to import`),
      );

      let importedCount = 0;
      let skippedCount = 0;

      for (const file of jsonFiles) {
        const filePath = path.join(batchesPath, file);
        const content = await fs.readFile(filePath, "utf-8");
        const batch = JSON.parse(content);

        for (const email of batch.emails) {
          try {
            // Check if email already exists
            const existing = this.db
              .prepare("SELECT id FROM emails WHERE message_id = ?")
              .get(email.id);

            if (existing) {
              skippedCount++;
              continue;
            }

            // Import new email
            this.db
              .prepare(
                `
              INSERT INTO emails (
                message_id, subject, body_text, body_html,
                from_address, to_addresses, cc_addresses,
                received_time, conversation_id, in_reply_to,
                references, has_attachments, importance,
                folder, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
            `,
              )
              .run(
                email.id,
                email.subject,
                email.bodyPreview || email.body?.content || "",
                email.body?.content || "",
                email.from?.emailAddress?.address || "",
                email.toRecipients
                  ?.map((r) => r.emailAddress?.address)
                  .join(",") || "",
                email.ccRecipients
                  ?.map((r) => r.emailAddress?.address)
                  .join(",") || "",
                email.receivedDateTime,
                email.conversationId,
                email.inReplyTo || null,
                email.references || null,
                email.hasAttachments ? 1 : 0,
                email.importance || "normal",
                email.parentFolderId || "inbox",
              );

            importedCount++;
          } catch (error) {
            logger.error("Failed to import email", "IMPORT", {
              error,
              emailId: email.id,
            });
            this.stats.errors++;
          }
        }

        process.stdout.write(
          `\rImported: ${importedCount} | Skipped: ${skippedCount}`,
        );
      }

      console.log(
        chalk.green(
          `\n✅ Import complete: ${importedCount} new emails, ${skippedCount} duplicates skipped`,
        ),
      );
      this.stats.new_emails = importedCount;
    } catch (error) {
      console.log(
        chalk.yellow(
          "⚠️  No new email files found. Proceeding with existing database.",
        ),
      );
    }

    // Get total email count
    const totalCount = this.db
      .prepare("SELECT COUNT(*) as count FROM emails")
      .get();
    this.stats.total_emails = totalCount.count;
    this.stats.existing_emails =
      this.stats.total_emails - this.stats.new_emails;

    console.log(
      chalk.cyan(
        `\nTotal emails in database: ${this.stats.total_emails.toLocaleString()}`,
      ),
    );
  }

  private async analyzeWorkflowChains(): Promise<WorkflowChain[]> {
    console.log(chalk.yellow("\n🔍 Step 2: Analyzing workflow chains...\n"));

    // Group emails by conversation
    const conversations = this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        GROUP_CONCAT(id) as email_ids,
        COUNT(*) as email_count,
        MIN(received_time) as start_time,
        MAX(received_time) as end_time
      FROM emails
      WHERE conversation_id IS NOT NULL AND conversation_id != ''
      GROUP BY conversation_id
      ORDER BY email_count DESC
    `,
      )
      .all() as any[];

    console.log(
      chalk.cyan(`Found ${conversations.length} conversation threads`),
    );

    const workflowChains: WorkflowChain[] = [];
    let processedCount = 0;

    // Analyze each conversation
    for (const conversation of conversations) {
      const emailIds = conversation.email_ids.split(",");

      // Get full email data for the chain
      const emails = this.db
        .prepare(
          `
        SELECT * FROM emails 
        WHERE id IN (${emailIds.map(() => "?").join(",")})
        ORDER BY received_time
      `,
        )
        .all(...emailIds);

      // Analyze chain completeness
      const lastEmail = emails[emails.length - 1];
      const chainAnalysis = await this.chainAnalyzer.analyzeChain({
        ...lastEmail,
        thread_emails: emails,
      });

      const duration =
        (new Date(conversation.end_time).getTime() -
          new Date(conversation.start_time).getTime()) /
        (1000 * 60 * 60);

      workflowChains.push({
        chain_id: conversation.conversation_id,
        email_ids: emailIds,
        email_count: emails.length,
        completeness_score: chainAnalysis.completeness_score,
        is_complete: chainAnalysis.is_complete,
        chain_type: chainAnalysis.chain_type,
        start_time: new Date(conversation.start_time),
        end_time: new Date(conversation.end_time),
        duration_hours: duration,
      });

      if (chainAnalysis.is_complete) {
        this.stats.complete_chains++;
      } else {
        this.stats.incomplete_chains++;
      }

      processedCount++;
      if (processedCount % 100 === 0) {
        process.stdout.write(
          `\rAnalyzed: ${processedCount}/${conversations.length} chains`,
        );
      }
    }

    this.stats.total_chains = workflowChains.length;

    console.log(chalk.green(`\n✅ Chain analysis complete:`));
    console.log(`   • Total chains: ${this.stats.total_chains}`);
    console.log(
      `   • Complete chains: ${this.stats.complete_chains} (${((this.stats.complete_chains / this.stats.total_chains) * 100).toFixed(1)}%)`,
    );
    console.log(`   • Incomplete chains: ${this.stats.incomplete_chains}`);

    return workflowChains;
  }

  private async processEmailsWithAdaptivePipeline(
    workflowChains: WorkflowChain[],
  ) {
    console.log(
      chalk.yellow("\n⚡ Step 3: Running adaptive three-phase analysis...\n"),
    );

    const startTime = Date.now();
    let processedCount = 0;
    let batchNumber = 1;

    // Process complete chains first (they get all 3 phases)
    console.log(chalk.cyan("Processing complete workflow chains..."));

    for (const chain of workflowChains.filter((c) => c.is_complete)) {
      try {
        const emails = this.db
          .prepare(
            `
          SELECT * FROM emails 
          WHERE id IN (${chain.email_ids.map(() => "?").join(",")})
          ORDER BY received_time
        `,
          )
          .all(...chain.email_ids);

        for (const email of emails) {
          const analysis = await this.threePhaseService.analyzeEmail(email, {
            forceAllPhases: true, // Complete chains always get all phases
            includeWorkflowAnalysis: true,
          });

          // Save analysis results
          await this.saveAnalysisResults(email.id, analysis, chain);

          processedCount++;
          this.stats.emails_processed++;
          this.stats.phase3_count++;

          if (processedCount % 10 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = processedCount / elapsed;
            const remaining = (this.stats.total_emails - processedCount) / rate;

            process.stdout.write(
              `\rProcessed: ${processedCount}/${this.stats.total_emails} | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(remaining / 60)}m`,
            );
          }
        }

        // Save workflow template
        await this.saveWorkflowTemplate(chain, emails);
      } catch (error) {
        logger.error("Failed to process chain", "PIPELINE", {
          error,
          chainId: chain.chain_id,
        });
        this.stats.errors++;
      }
    }

    // Process incomplete chains and standalone emails (they get 2 phases only)
    console.log(
      chalk.cyan("\n\nProcessing incomplete chains and standalone emails..."),
    );

    const incompleteEmails = this.db
      .prepare(
        `
      SELECT * FROM emails 
      WHERE status = 'pending' OR status IS NULL
      ORDER BY received_time DESC
    `,
      )
      .all();

    for (const email of incompleteEmails) {
      try {
        const analysis = await this.threePhaseService.analyzeEmail(email, {
          forceAllPhases: false, // Let adaptive logic decide
          includeWorkflowAnalysis: false,
        });

        // Save analysis results
        await this.saveAnalysisResults(email.id, analysis, null);

        processedCount++;
        this.stats.emails_processed++;
        this.stats.phase2_only_count++;

        if (processedCount % 10 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = processedCount / elapsed;
          const remaining = (this.stats.total_emails - processedCount) / rate;

          process.stdout.write(
            `\rProcessed: ${processedCount}/${this.stats.total_emails} | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(remaining / 60)}m`,
          );
        }
      } catch (error) {
        logger.error("Failed to process email", "PIPELINE", {
          error,
          emailId: email.id,
        });
        this.stats.errors++;
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(
      chalk.green(
        `\n✅ Processing complete in ${(totalTime / 60).toFixed(1)} minutes`,
      ),
    );
  }

  private async saveAnalysisResults(
    emailId: string,
    analysis: any,
    chain: WorkflowChain | null,
  ) {
    try {
      // Update email status
      this.db
        .prepare(
          `
        UPDATE emails 
        SET status = 'analyzed',
            analyzed_at = datetime('now'),
            workflow_state = ?,
            priority = ?,
            confidence_score = ?
        WHERE id = ?
      `,
        )
        .run(
          analysis.workflow_state || "unknown",
          analysis.priority || "medium",
          analysis.confidence || 0,
          emailId,
        );

      // Save to email_analysis table
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO email_analysis (
          email_id, analysis_version, phase1_results, phase2_results, 
          phase3_results, final_summary, confidence_score, 
          workflow_type, chain_id, is_complete_chain, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
        )
        .run(
          emailId,
          "2.1.0",
          JSON.stringify(analysis.phase1Results || {}),
          JSON.stringify(analysis.phase2Results || {}),
          JSON.stringify(analysis.phase3Results || {}),
          JSON.stringify(analysis.summary || {}),
          analysis.confidence || 0,
          chain?.chain_type || analysis.workflow_type || "unknown",
          chain?.chain_id || null,
          chain?.is_complete ? 1 : 0,
        );

      // Extract and save entities
      const entities = this.extractEntities(analysis);
      for (const entity of entities) {
        this.db
          .prepare(
            `
          INSERT OR IGNORE INTO email_entities (
            email_id, entity_type, entity_value, confidence, 
            extracted_by, created_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `,
          )
          .run(
            emailId,
            entity.type,
            entity.value,
            entity.confidence || 1.0,
            entity.extracted_by || "three-phase-analysis",
          );
      }

      // Save action items
      const actionItems = analysis.phase2Results?.action_items || [];
      for (const action of actionItems) {
        this.db
          .prepare(
            `
          INSERT INTO action_items (
            email_id, description, owner, deadline, priority, 
            status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `,
          )
          .run(
            emailId,
            action.task,
            action.owner || "unassigned",
            action.deadline || null,
            action.priority || "medium",
          );
      }
    } catch (error) {
      logger.error("Failed to save analysis results", "SAVE", {
        error,
        emailId,
      });
      throw error;
    }
  }

  private extractEntities(analysis: any): any[] {
    const entities = [];

    // Extract from all phases
    const allResults = [
      analysis.phase1Results,
      analysis.phase2Results,
      analysis.phase3Results,
    ].filter(Boolean);

    for (const results of allResults) {
      // PO numbers
      if (results.entities?.po_numbers) {
        results.entities.po_numbers.forEach((po) => {
          entities.push({ type: "po_number", value: po, confidence: 0.95 });
        });
      }

      // Quote numbers
      if (results.entities?.quotes) {
        results.entities.quotes.forEach((quote) => {
          entities.push({
            type: "quote_number",
            value: quote,
            confidence: 0.95,
          });
        });
      }

      // Case numbers
      if (results.entities?.cases) {
        results.entities.cases.forEach((caseNum) => {
          entities.push({
            type: "case_number",
            value: caseNum,
            confidence: 0.95,
          });
        });
      }

      // Product/Part numbers
      if (results.entities?.parts) {
        results.entities.parts.forEach((part) => {
          entities.push({ type: "part_number", value: part, confidence: 0.9 });
        });
      }

      // Companies from phase 2
      if (results.missed_entities?.company_names) {
        results.missed_entities.company_names.forEach((company) => {
          entities.push({ type: "company", value: company, confidence: 0.85 });
        });
      }

      // People from phase 2
      if (results.missed_entities?.people) {
        results.missed_entities.people.forEach((person) => {
          entities.push({ type: "person", value: person, confidence: 0.85 });
        });
      }
    }

    return entities;
  }

  private async saveWorkflowTemplate(chain: WorkflowChain, emails: any[]) {
    try {
      // Extract workflow stages
      const stages = emails.map((email) => {
        const subject = email.subject?.toLowerCase() || "";
        const body = email.body_text?.toLowerCase() || "";

        if (subject.includes("quote") || body.includes("quote request"))
          return "quote_request";
        if (subject.includes("order") || body.includes("place order"))
          return "order_placement";
        if (subject.includes("confirm")) return "confirmation";
        if (subject.includes("ship") || subject.includes("tracking"))
          return "shipping";
        if (subject.includes("deliver")) return "delivery";
        if (subject.includes("complete") || subject.includes("close"))
          return "completion";
        return "update";
      });

      const template = {
        chain_id: chain.chain_id,
        workflow_type: chain.chain_type,
        stages: stages,
        email_count: chain.email_count,
        duration_hours: chain.duration_hours,
        completeness_score: chain.completeness_score,
        created_at: new Date().toISOString(),
      };

      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO workflow_templates (
          chain_id, workflow_type, template_data, 
          email_count, duration_hours, completeness_score,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `,
        )
        .run(
          chain.chain_id,
          chain.chain_type,
          JSON.stringify(template),
          chain.email_count,
          chain.duration_hours,
          chain.completeness_score,
        );
    } catch (error) {
      logger.error("Failed to save workflow template", "TEMPLATE", {
        error,
        chainId: chain.chain_id,
      });
    }
  }

  private async generateWorkflowTemplates(workflowChains: WorkflowChain[]) {
    console.log(
      chalk.yellow("\n📝 Step 4: Generating workflow templates...\n"),
    );

    const completeChains = workflowChains.filter((c) => c.is_complete);
    const templatesByType = {};

    for (const chain of completeChains) {
      if (!templatesByType[chain.chain_type]) {
        templatesByType[chain.chain_type] = [];
      }
      templatesByType[chain.chain_type].push(chain);
    }

    console.log(chalk.cyan("Workflow templates by type:"));
    Object.entries(templatesByType).forEach(
      ([type, chains]: [string, any[]]) => {
        const avgDuration =
          chains.reduce((sum, c) => sum + c.duration_hours, 0) / chains.length;
        console.log(
          `   • ${type}: ${chains.length} templates, avg ${avgDuration.toFixed(1)}h duration`,
        );
      },
    );

    // Save aggregated templates
    const templatesPath = path.join(
      process.cwd(),
      "data",
      "workflow_templates_full.json",
    );
    await fs.mkdir(path.dirname(templatesPath), { recursive: true });
    await fs.writeFile(templatesPath, JSON.stringify(templatesByType, null, 2));

    console.log(
      chalk.green(`✅ Saved workflow templates to: ${templatesPath}`),
    );
  }

  private async updateDatabaseWithResults() {
    console.log(
      chalk.yellow("\n💾 Step 5: Updating database with results...\n"),
    );

    // Create or update workflow summary table
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS workflow_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_date TEXT NOT NULL,
        total_emails INTEGER,
        new_emails INTEGER,
        total_chains INTEGER,
        complete_chains INTEGER,
        incomplete_chains INTEGER,
        emails_processed INTEGER,
        phase3_count INTEGER,
        phase2_only_count INTEGER,
        processing_time_seconds REAL,
        errors INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
      )
      .run();

    // Save run summary
    this.db
      .prepare(
        `
      INSERT INTO workflow_summary (
        run_date, total_emails, new_emails, total_chains,
        complete_chains, incomplete_chains, emails_processed,
        phase3_count, phase2_only_count, processing_time_seconds, errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        new Date().toISOString(),
        this.stats.total_emails,
        this.stats.new_emails,
        this.stats.total_chains,
        this.stats.complete_chains,
        this.stats.incomplete_chains,
        this.stats.emails_processed,
        this.stats.phase3_count,
        this.stats.phase2_only_count,
        this.stats.processing_time,
        this.stats.errors,
      );

    console.log(chalk.green("✅ Database updated successfully"));
  }

  private displayResults() {
    console.log(chalk.blue.bold("\n\n📊 FINAL RESULTS\n"));
    console.log(chalk.white("─".repeat(60)));

    console.log(chalk.white.bold("Email Statistics:"));
    console.log(
      `   • Total emails: ${this.stats.total_emails.toLocaleString()}`,
    );
    console.log(
      `   • New emails imported: ${this.stats.new_emails.toLocaleString()}`,
    );
    console.log(
      `   • Existing emails: ${this.stats.existing_emails.toLocaleString()}`,
    );

    console.log(chalk.white.bold("\nWorkflow Chain Analysis:"));
    console.log(
      `   • Total chains: ${this.stats.total_chains.toLocaleString()}`,
    );
    console.log(
      `   • Complete chains: ${this.stats.complete_chains} (${((this.stats.complete_chains / this.stats.total_chains) * 100).toFixed(1)}%)`,
    );
    console.log(`   • Incomplete chains: ${this.stats.incomplete_chains}`);

    console.log(chalk.white.bold("\nProcessing Results:"));
    console.log(
      `   • Emails processed: ${this.stats.emails_processed.toLocaleString()}`,
    );
    console.log(
      `   • Full 3-phase analysis: ${this.stats.phase3_count.toLocaleString()}`,
    );
    console.log(
      `   • 2-phase analysis only: ${this.stats.phase2_only_count.toLocaleString()}`,
    );
    console.log(`   • Processing errors: ${this.stats.errors}`);

    console.log(chalk.white.bold("\nPerformance:"));
    console.log(
      `   • Total processing time: ${(this.stats.processing_time / 60).toFixed(1)} minutes`,
    );
    console.log(
      `   • Average time per email: ${(this.stats.processing_time / this.stats.emails_processed).toFixed(2)} seconds`,
    );

    const timeSaved = (this.stats.phase2_only_count * 80) / 3600; // 80 seconds saved per 2-phase
    console.log(
      chalk.green(
        `   • Time saved with adaptive approach: ${timeSaved.toFixed(1)} hours`,
      ),
    );

    console.log(chalk.white.bold("\n🎯 Next Steps:"));
    console.log(
      "   1. Review workflow templates in: data/workflow_templates_full.json",
    );
    console.log(
      "   2. Check email analysis dashboard: http://localhost:3001/dashboard",
    );
    console.log("   3. Query enhanced database for insights");
    console.log("   4. Set up automated pipeline for new emails");
  }
}

// Create required tables if they don't exist
function ensureTablesExist(db: any) {
  // Email analysis table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS email_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL UNIQUE,
      analysis_version TEXT,
      phase1_results TEXT,
      phase2_results TEXT,
      phase3_results TEXT,
      final_summary TEXT,
      confidence_score REAL,
      workflow_type TEXT,
      chain_id TEXT,
      is_complete_chain INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  // Email entities table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS email_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_value TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      extracted_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email_id, entity_type, entity_value)
    )
  `,
  ).run();

  // Action items table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT,
      deadline TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  // Workflow templates table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id TEXT UNIQUE,
      workflow_type TEXT NOT NULL,
      template_data TEXT,
      email_count INTEGER,
      duration_hours REAL,
      completeness_score REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();

  // Add new columns to emails table if they don't exist
  try {
    db.prepare("ALTER TABLE emails ADD COLUMN workflow_state TEXT").run();
  } catch (e) {}

  try {
    db.prepare(
      'ALTER TABLE emails ADD COLUMN priority TEXT DEFAULT "medium"',
    ).run();
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE emails ADD COLUMN confidence_score REAL").run();
  } catch (e) {}

  try {
    db.prepare("ALTER TABLE emails ADD COLUMN analyzed_at TEXT").run();
  } catch (e) {}
}

// Main execution
async function main() {
  try {
    // Ensure all required tables exist
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();
    ensureTablesExist(db);

    // Run the full dataset processor
    const processor = new FullDatasetProcessor();

    // Listen to progress events
    processor.on("progress", (data) => {
      console.log(chalk.gray(`[Progress] ${data.message}`));
    });

    await processor.processFullDataset();

    console.log(chalk.green.bold("\n\n✨ Full dataset processing complete!\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Fatal error:"), error);
    process.exit(1);
  }
}

// Run the script
main();
