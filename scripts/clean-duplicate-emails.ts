#!/usr/bin/env tsx

/**
 * Email Duplicate Cleanup Script
 *
 * This script identifies and removes duplicate emails from the crewai.db database,
 * keeping the version with the best analysis results.
 *
 * Strategy:
 * 1. Find duplicates by body content (exact matches)
 * 2. For each duplicate group, keep the email with:
 *    - Most complete analysis (email_analysis table)
 *    - Highest confidence scores
 *    - Most recent analysis timestamp
 * 3. Remove the inferior duplicates
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { logger } from "../src/utils/logger.js";

interface EmailWithAnalysis {
  id: string;
  graph_id: string;
  subject: string;
  sender_email: string;
  received_at: string;
  body: string;
  // Analysis fields
  quick_confidence?: number;
  deep_confidence?: number;
  total_processing_time?: number;
  created_at?: string;
  analysis_completeness_score: number;
}

interface DuplicateGroup {
  body_hash: string;
  emails: EmailWithAnalysis[];
  best_email: EmailWithAnalysis;
  duplicates_to_remove: string[];
}

class EmailDuplicateCleaner {
  private db: any;
  private dryRun: boolean;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
  }

  async initialize() {
    const dbManager = await getDatabaseManager();
    this.db = dbManager.getSQLiteDatabase();
    logger.info("Email duplicate cleaner initialized", "DUPLICATE_CLEANER");
  }

  /**
   * Calculate analysis completeness score for an email
   */
  private calculateCompletenessScore(email: EmailWithAnalysis): number {
    let score = 0;

    // Base score for having analysis
    if (email.quick_confidence !== undefined) score += 20;
    if (email.deep_confidence !== undefined) score += 30;

    // Confidence quality bonus
    if (email.quick_confidence && email.quick_confidence > 0.7) score += 10;
    if (email.deep_confidence && email.deep_confidence > 0.7) score += 15;

    // Processing time bonus (more processing usually means better analysis)
    if (email.total_processing_time && email.total_processing_time > 1000)
      score += 10;

    // Recency bonus (more recent analysis is likely better)
    if (email.created_at) {
      const analysisDate = new Date(email.created_at);
      const daysSinceAnalysis =
        (Date.now() - analysisDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAnalysis < 30) score += 10; // Recent analysis
    }

    return score;
  }

  /**
   * Find all duplicate groups based on body content
   */
  async findDuplicateGroups(): Promise<DuplicateGroup[]> {
    logger.info("Finding duplicate email groups...", "DUPLICATE_CLEANER");

    const query = `
      WITH body_groups AS (
        SELECT 
          body,
          COUNT(*) as duplicate_count
        FROM emails 
        WHERE body IS NOT NULL 
          AND LENGTH(body) > 100
        GROUP BY body 
        HAVING COUNT(*) > 1
      ),
      emails_with_analysis AS (
        SELECT 
          e.id,
          e.graph_id,
          e.subject,
          e.sender_email,
          e.received_at,
          e.body,
          ea.quick_confidence,
          ea.deep_confidence,
          ea.total_processing_time,
          ea.created_at as analysis_created_at
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        INNER JOIN body_groups bg ON e.body = bg.body
      )
      SELECT * FROM emails_with_analysis
      ORDER BY body, analysis_created_at DESC
    `;

    const results = this.db.prepare(query).all();
    const groups: Map<string, EmailWithAnalysis[]> = new Map();

    // Group emails by body content
    for (const row of results) {
      const email: EmailWithAnalysis = {
        ...row,
        analysis_completeness_score: 0,
      };

      const bodyKey = row.body;
      if (!groups.has(bodyKey)) {
        groups.set(bodyKey, []);
      }
      groups.get(bodyKey)!.push(email);
    }

    // Calculate scores and determine best email for each group
    const duplicateGroups: DuplicateGroup[] = [];

    for (const [bodyHash, emails] of groups) {
      if (emails.length <= 1) continue;

      // Calculate completeness scores
      emails.forEach((email) => {
        email.analysis_completeness_score =
          this.calculateCompletenessScore(email);
      });

      // Sort by completeness score (highest first)
      emails.sort(
        (a, b) =>
          b.analysis_completeness_score - a.analysis_completeness_score ||
          new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      );

      const bestEmail = emails[0];
      const duplicatesToRemove = emails.slice(1).map((e) => e.id);

      duplicateGroups.push({
        body_hash: bodyHash.substring(0, 50) + "...", // Truncated for logging
        emails,
        best_email: bestEmail,
        duplicates_to_remove: duplicatesToRemove,
      });
    }

    logger.info(
      `Found ${duplicateGroups.length} duplicate groups`,
      "DUPLICATE_CLEANER",
      {
        total_duplicates: duplicateGroups.reduce(
          (sum, group) => sum + group.duplicates_to_remove.length,
          0,
        ),
      },
    );

    return duplicateGroups;
  }

  /**
   * Remove duplicate emails, keeping the best analyzed version
   */
  async cleanupDuplicates(groups: DuplicateGroup[]): Promise<void> {
    let totalRemoved = 0;

    for (const group of groups) {
      logger.info(`Processing duplicate group`, "DUPLICATE_CLEANER", {
        subject: group.best_email.subject,
        sender: group.best_email.sender_email,
        total_duplicates: group.emails.length,
        keeping: group.best_email.id,
        removing: group.duplicates_to_remove.length,
        best_score: group.best_email.analysis_completeness_score,
      });

      if (!this.dryRun && group.duplicates_to_remove.length > 0) {
        // Remove duplicates from both tables
        this.db
          .prepare(
            `DELETE FROM email_analysis WHERE email_id IN (${group.duplicates_to_remove.map(() => "?").join(",")})`,
          )
          .run(...group.duplicates_to_remove);

        this.db
          .prepare(
            `DELETE FROM emails WHERE id IN (${group.duplicates_to_remove.map(() => "?").join(",")})`,
          )
          .run(...group.duplicates_to_remove);

        totalRemoved += group.duplicates_to_remove.length;
      }
    }

    if (this.dryRun) {
      logger.info(
        "DRY RUN: Would have removed duplicates",
        "DUPLICATE_CLEANER",
        {
          groups_processed: groups.length,
          total_would_remove: groups.reduce(
            (sum, group) => sum + group.duplicates_to_remove.length,
            0,
          ),
        },
      );
    } else {
      logger.info("Duplicate cleanup completed", "DUPLICATE_CLEANER", {
        groups_processed: groups.length,
        total_removed: totalRemoved,
      });
    }
  }

  /**
   * Generate cleanup report
   */
  async generateReport(groups: DuplicateGroup[]): Promise<void> {
    const totalDuplicates = groups.reduce(
      (sum, group) => sum + group.duplicates_to_remove.length,
      0,
    );
    const totalGroups = groups.length;

    logger.info("=== EMAIL DUPLICATE CLEANUP REPORT ===", "DUPLICATE_CLEANER");
    logger.info(
      `Total duplicate groups found: ${totalGroups}`,
      "DUPLICATE_CLEANER",
    );
    logger.info(
      `Total duplicate emails to remove: ${totalDuplicates}`,
      "DUPLICATE_CLEANER",
    );

    // Show top 10 duplicate groups
    const topGroups = groups
      .sort(
        (a, b) => b.duplicates_to_remove.length - a.duplicates_to_remove.length,
      )
      .slice(0, 10);

    logger.info("Top 10 duplicate groups:", "DUPLICATE_CLEANER");
    for (const [index, group] of topGroups.entries()) {
      logger.info(
        `${index + 1}. "${group.best_email.subject.substring(0, 60)}..." - ${group.duplicates_to_remove.length} duplicates`,
        "DUPLICATE_CLEANER",
      );
    }

    // Analysis quality distribution
    const withAnalysis = groups.filter(
      (g) => g.best_email.analysis_completeness_score > 20,
    ).length;
    const withHighQuality = groups.filter(
      (g) => g.best_email.analysis_completeness_score > 50,
    ).length;

    logger.info(
      `Groups with analysis: ${withAnalysis}/${totalGroups}`,
      "DUPLICATE_CLEANER",
    );
    logger.info(
      `Groups with high-quality analysis: ${withHighQuality}/${totalGroups}`,
      "DUPLICATE_CLEANER",
    );
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      await this.initialize();

      const groups = await this.findDuplicateGroups();

      if (groups.length === 0) {
        logger.info("No duplicate emails found!", "DUPLICATE_CLEANER");
        return;
      }

      await this.generateReport(groups);
      await this.cleanupDuplicates(groups);

      logger.info(
        "Email duplicate cleanup process completed",
        "DUPLICATE_CLEANER",
      );
    } catch (error) {
      logger.error("Error during duplicate cleanup", "DUPLICATE_CLEANER", {
        error,
      });
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = !process.argv.includes("--execute");

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made");
    console.log("Run with --execute flag to actually remove duplicates\n");
  } else {
    console.log("\n⚠️  LIVE MODE - Duplicates will be permanently removed!\n");
  }

  const cleaner = new EmailDuplicateCleaner(dryRun);

  cleaner
    .run()
    .then(() => {
      console.log("\n✅ Duplicate cleanup completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Duplicate cleanup failed:", error);
      process.exit(1);
    });
}

export { EmailDuplicateCleaner };
