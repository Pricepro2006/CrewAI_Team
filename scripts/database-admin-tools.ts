#!/usr/bin/env tsx
/**
 * Database Administration Tools
 * 
 * Comprehensive database administration utilities for the CrewAI Team
 * adaptive email pipeline. Handles maintenance, monitoring, backup,
 * and performance optimization for 143k+ email dataset.
 * 
 * Usage:
 *   npm run db:admin -- --help
 *   npm run db:admin -- --status
 *   npm run db:admin -- --backup
 *   npm run db:admin -- --maintenance
 *   npm run db:admin -- --analyze-chains
 *   npm run db:admin -- --performance-report
 */

import { Command } from 'commander';
import { getDatabaseConnection } from '../src/database/connection.js';
import { logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface DatabaseStats {
  totalEmails: number;
  pendingEmails: number;
  processingEmails: number;
  completedEmails: number;
  failedEmails: number;
  totalChains: number;
  completeChains: number;
  partialChains: number;
  brokenChains: number;
  avgProcessingTime: number;
  avgCompletenessScore: number;
  databaseSize: string;
  indexCount: number;
  tableCount: number;
}

interface ChainAnalysis {
  chainId: string;
  emailCount: number;
  completenessScore: number;
  chainStatus: string;
  firstEmailAt: string;
  lastEmailAt: string;
  durationHours: number;
  primaryWorkflow: string | null;
}

interface PerformanceMetrics {
  date: string;
  emailsProcessed: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  phase1Completed: number;
  phase2Completed: number;
  phase3Completed: number;
  errorRatePercent: number;
}

class DatabaseAdmin {
  private db: any;

  constructor() {
    this.db = getDatabaseConnection();
  }

  /**
   * Get comprehensive database status
   */
  async getStatus(): Promise<DatabaseStats> {
    logger.info("Collecting database status information", "DB_ADMIN");

    // Get basic email statistics
    const emailStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_emails,
        SUM(CASE WHEN processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN processing_status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(processing_time_ms) as avg_processing_time,
        AVG(completeness_score) as avg_completeness_score
      FROM emails_enhanced
    `).get();

    // Get chain statistics
    const chainStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_chains,
        SUM(CASE WHEN chain_status = 'complete' THEN 1 ELSE 0 END) as complete_chains,
        SUM(CASE WHEN chain_status = 'partial' THEN 1 ELSE 0 END) as partial_chains,
        SUM(CASE WHEN chain_status = 'broken' THEN 1 ELSE 0 END) as broken_chains
      FROM email_chains
    `).get();

    // Get database metadata
    const indexCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'index'
    `).get().count;

    const tableCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table'
    `).get().count;

    // Get database file size
    const dbPath = process.env.DATABASE_PATH || './data/crewai_team.db';
    let databaseSize = 'Unknown';
    try {
      const stats = fs.statSync(dbPath);
      databaseSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    } catch (error) {
      logger.warn(`Could not get database file size: ${error}`, "DB_ADMIN");
    }

    return {
      totalEmails: emailStats.total_emails || 0,
      pendingEmails: emailStats.pending || 0,
      processingEmails: emailStats.processing || 0,
      completedEmails: emailStats.completed || 0,
      failedEmails: emailStats.failed || 0,
      totalChains: chainStats?.total_chains || 0,
      completeChains: chainStats?.complete_chains || 0,
      partialChains: chainStats?.partial_chains || 0,
      brokenChains: chainStats?.broken_chains || 0,
      avgProcessingTime: emailStats.avg_processing_time || 0,
      avgCompletenessScore: emailStats.avg_completeness_score || 0,
      databaseSize,
      indexCount,
      tableCount
    };
  }

  /**
   * Create database backup
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const backupDir = './data/backups';
    const backupFile = path.join(backupDir, `crewai_team_${timestamp}.db`);

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    logger.info(`Creating database backup: ${backupFile}`, "DB_ADMIN");

    try {
      // Create backup using SQLite's backup API
      this.db.backup(backupFile);

      // Verify backup integrity
      const backupDb = require('better-sqlite3')(backupFile, { readonly: true });
      const integrityCheck = backupDb.prepare("PRAGMA integrity_check").get();
      backupDb.close();

      if (integrityCheck.integrity_check !== 'ok') {
        throw new Error(`Backup integrity check failed: ${integrityCheck.integrity_check}`);
      }

      // Compress backup
      execSync(`gzip "${backupFile}"`);
      const compressedFile = `${backupFile}.gz`;

      logger.info(`Backup created and compressed: ${compressedFile}`, "DB_ADMIN");

      // Clean up old backups (keep last 30 days)
      this.cleanupOldBackups(backupDir, 30);

      return compressedFile;
    } catch (error) {
      logger.error(`Backup failed: ${error}`, "DB_ADMIN");
      throw error;
    }
  }

  /**
   * Clean up old backup files
   */
  private cleanupOldBackups(backupDir: string, daysToKeep: number): void {
    try {
      const files = fs.readdirSync(backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deletedCount = 0;
      for (const file of files) {
        if (file.startsWith('crewai_team_') && file.endsWith('.db.gz')) {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old backup files`, "DB_ADMIN");
      }
    } catch (error) {
      logger.warn(`Failed to cleanup old backups: ${error}`, "DB_ADMIN");
    }
  }

  /**
   * Perform database maintenance
   */
  async performMaintenance(): Promise<void> {
    logger.info("Starting database maintenance", "DB_ADMIN");

    try {
      // Update table statistics
      logger.info("Updating table statistics", "DB_ADMIN");
      this.db.exec("ANALYZE");

      // Optimize query planner
      logger.info("Optimizing query planner", "DB_ADMIN");
      this.db.exec("PRAGMA optimize");

      // Check database integrity
      logger.info("Checking database integrity", "DB_ADMIN");
      const integrityResult = this.db.prepare("PRAGMA integrity_check").all();
      const hasErrors = integrityResult.some((row: any) => row.integrity_check !== 'ok');
      
      if (hasErrors) {
        logger.error("Database integrity check failed!", "DB_ADMIN");
        integrityResult.forEach((row: any) => {
          if (row.integrity_check !== 'ok') {
            logger.error(`Integrity error: ${row.integrity_check}`, "DB_ADMIN");
          }
        });
      } else {
        logger.info("Database integrity check passed", "DB_ADMIN");
      }

      // Incremental vacuum
      logger.info("Performing incremental vacuum", "DB_ADMIN");
      this.db.exec("PRAGMA incremental_vacuum");

      // Update chain completeness scores
      logger.info("Updating chain completeness scores", "DB_ADMIN");
      const updateResult = this.db.prepare(`
        UPDATE email_chains 
        SET 
          completeness_score = (
            SELECT AVG(e.completeness_score)
            FROM emails_enhanced e 
            WHERE e.chain_id = email_chains.id
          ),
          email_count = (
            SELECT COUNT(*)
            FROM emails_enhanced e 
            WHERE e.chain_id = email_chains.id
          ),
          last_activity_at = CURRENT_TIMESTAMP
        WHERE id IN (
          SELECT DISTINCT chain_id 
          FROM emails_enhanced 
          WHERE chain_id IS NOT NULL
        )
      `).run();

      logger.info(`Updated ${updateResult.changes} chain records`, "DB_ADMIN");

      // Clean up old processing statistics (keep 90 days)
      logger.info("Cleaning up old statistics", "DB_ADMIN");
      const cleanupResult = this.db.prepare(`
        DELETE FROM processing_statistics 
        WHERE date_day < date('now', '-90 days')
      `).run();

      if (cleanupResult.changes > 0) {
        logger.info(`Cleaned up ${cleanupResult.changes} old statistics records`, "DB_ADMIN");
      }

      logger.info("Database maintenance completed successfully", "DB_ADMIN");

    } catch (error) {
      logger.error(`Database maintenance failed: ${error}`, "DB_ADMIN");
      throw error;
    }
  }

  /**
   * Analyze email chains for insights
   */
  async analyzeChains(limit: number = 50): Promise<ChainAnalysis[]> {
    logger.info(`Analyzing top ${limit} email chains`, "DB_ADMIN");

    const chains = this.db.prepare(`
      SELECT 
        ec.id as chain_id,
        ec.email_count,
        ec.completeness_score,
        ec.chain_status,
        ec.first_email_at,
        ec.last_email_at,
        ec.primary_workflow,
        CASE 
          WHEN ec.last_email_at IS NOT NULL AND ec.first_email_at IS NOT NULL 
          THEN (julianday(ec.last_email_at) - julianday(ec.first_email_at)) * 24
          ELSE 0 
        END as duration_hours
      FROM email_chains ec
      ORDER BY ec.completeness_score DESC, ec.email_count DESC
      LIMIT ?
    `).all(limit);

    return chains.map((chain: any) => ({
      chainId: chain.chain_id,
      emailCount: chain.email_count,
      completenessScore: chain.completeness_score,
      chainStatus: chain.chain_status,
      firstEmailAt: chain.first_email_at,
      lastEmailAt: chain.last_email_at,
      durationHours: chain.duration_hours,
      primaryWorkflow: chain.primary_workflow
    }));
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(days: number = 7): Promise<PerformanceMetrics[]> {
    logger.info(`Generating performance report for last ${days} days`, "DB_ADMIN");

    const metrics = this.db.prepare(`
      SELECT 
        DATE(received_at) as date,
        COUNT(*) as emails_processed,
        AVG(processing_time_ms) as avg_time_ms,
        MIN(processing_time_ms) as min_time_ms,
        MAX(processing_time_ms) as max_time_ms,
        SUM(CASE WHEN phase_completed >= 1 THEN 1 ELSE 0 END) as phase1_completed,
        SUM(CASE WHEN phase_completed >= 2 THEN 1 ELSE 0 END) as phase2_completed,
        SUM(CASE WHEN phase_completed >= 3 THEN 1 ELSE 0 END) as phase3_completed,
        ROUND(100.0 * SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_percent
      FROM emails_enhanced
      WHERE processing_time_ms IS NOT NULL 
        AND received_at >= date('now', '-${days} days')
      GROUP BY DATE(received_at)
      ORDER BY date DESC
    `).all();

    return metrics.map((metric: any) => ({
      date: metric.date,
      emailsProcessed: metric.emails_processed,
      avgTimeMs: metric.avg_time_ms,
      minTimeMs: metric.min_time_ms,
      maxTimeMs: metric.max_time_ms,
      phase1Completed: metric.phase1_completed,
      phase2Completed: metric.phase2_completed,
      phase3Completed: metric.phase3_completed,
      errorRatePercent: metric.error_rate_percent
    }));
  }

  /**
   * Update processing statistics
   */
  async updateProcessingStats(): Promise<void> {
    logger.info("Updating processing statistics", "DB_ADMIN");

    const now = new Date();
    const dateHour = now.toISOString().slice(0, 13).replace('T', '-');
    const dateDay = now.toISOString().slice(0, 10);

    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_emails,
        SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN phase_completed >= 1 THEN 1 ELSE 0 END) as phase1,
        SUM(CASE WHEN phase_completed >= 2 THEN 1 ELSE 0 END) as phase2,
        SUM(CASE WHEN phase_completed >= 3 THEN 1 ELSE 0 END) as phase3,
        AVG(processing_time_ms) as avg_time,
        MAX(processing_time_ms) as max_time,
        MIN(processing_time_ms) as min_time,
        SUM(tokens_used) as total_tokens,
        AVG(tokens_used) as avg_tokens
      FROM emails_enhanced
      WHERE received_at >= datetime('now', '-1 hour')
    `).get();

    const chainStats = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN chain_status = 'complete' THEN 1 ELSE 0 END) as complete,
        SUM(CASE WHEN chain_status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN chain_status = 'broken' THEN 1 ELSE 0 END) as broken
      FROM email_chains
      WHERE updated_at >= datetime('now', '-1 hour')
    `).get();

    this.db.prepare(`
      INSERT OR REPLACE INTO processing_statistics (
        date_hour, date_day, emails_processed, emails_pending, emails_failed,
        phase1_processed, phase2_processed, phase3_processed,
        complete_chains, partial_chains, broken_chains,
        avg_processing_time_ms, max_processing_time_ms, min_processing_time_ms,
        total_tokens_used, avg_tokens_per_email, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      dateHour, dateDay, stats.completed || 0, stats.pending || 0, stats.failed || 0,
      stats.phase1 || 0, stats.phase2 || 0, stats.phase3 || 0,
      chainStats?.complete || 0, chainStats?.partial || 0, chainStats?.broken || 0,
      stats.avg_time || 0, stats.max_time || 0, stats.min_time || 0,
      stats.total_tokens || 0, stats.avg_tokens || 0
    );

    logger.info("Processing statistics updated", "DB_ADMIN");
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// CLI Interface
const program = new Command();

program
  .name('database-admin-tools')
  .description('Database administration tools for CrewAI Team adaptive email pipeline')
  .version('1.0.0');

program
  .command('status')
  .description('Show database status and statistics')
  .action(async () => {
    const admin = new DatabaseAdmin();
    try {
      const stats = await admin.getStatus();
      
      console.log('\n📊 Database Status Report');
      console.log('='.repeat(50));
      console.log(`📧 Total Emails: ${stats.totalEmails.toLocaleString()}`);
      console.log(`⏳ Pending: ${stats.pendingEmails.toLocaleString()}`);
      console.log(`🔄 Processing: ${stats.processingEmails.toLocaleString()}`);
      console.log(`✅ Completed: ${stats.completedEmails.toLocaleString()}`);
      console.log(`❌ Failed: ${stats.failedEmails.toLocaleString()}`);
      console.log();
      console.log(`🔗 Total Chains: ${stats.totalChains.toLocaleString()}`);
      console.log(`✅ Complete Chains: ${stats.completeChains.toLocaleString()}`);
      console.log(`🔶 Partial Chains: ${stats.partialChains.toLocaleString()}`);
      console.log(`💔 Broken Chains: ${stats.brokenChains.toLocaleString()}`);
      console.log();
      console.log(`⚡ Avg Processing Time: ${stats.avgProcessingTime.toFixed(2)}ms`);
      console.log(`📈 Avg Completeness Score: ${stats.avgCompletenessScore.toFixed(3)}`);
      console.log();
      console.log(`💾 Database Size: ${stats.databaseSize}`);
      console.log(`🗂️ Tables: ${stats.tableCount}`);
      console.log(`📇 Indexes: ${stats.indexCount}`);
      
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    } finally {
      admin.close();
    }
  });

program
  .command('backup')
  .description('Create database backup')
  .action(async () => {
    const admin = new DatabaseAdmin();
    try {
      const backupFile = await admin.createBackup();
      console.log(`✅ Backup created: ${backupFile}`);
    } catch (error) {
      console.error('❌ Backup failed:', error);
      process.exit(1);
    } finally {
      admin.close();
    }
  });

program
  .command('maintenance')
  .description('Perform database maintenance')
  .action(async () => {
    const admin = new DatabaseAdmin();
    try {
      await admin.performMaintenance();
      console.log('✅ Database maintenance completed');
    } catch (error) {
      console.error('❌ Maintenance failed:', error);
      process.exit(1);
    } finally {
      admin.close();
    }
  });

program
  .command('analyze-chains')
  .description('Analyze email chains for insights')
  .option('-l, --limit <number>', 'Number of chains to analyze', '20')
  .action(async (options) => {
    const admin = new DatabaseAdmin();
    try {
      const chains = await admin.analyzeChains(parseInt(options.limit));
      
      console.log(`\n🔗 Top ${chains.length} Email Chains Analysis`);
      console.log('='.repeat(80));
      
      chains.forEach((chain, index) => {
        console.log(`${index + 1}. Chain ${chain.chainId.slice(0, 8)}...`);
        console.log(`   📧 Emails: ${chain.emailCount} | Score: ${chain.completenessScore.toFixed(3)} | Status: ${chain.chainStatus}`);
        console.log(`   ⏱️ Duration: ${chain.durationHours.toFixed(1)}h | Workflow: ${chain.primaryWorkflow || 'Unknown'}`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Chain analysis failed:', error);
      process.exit(1);
    } finally {
      admin.close();
    }
  });

program
  .command('performance-report')
  .description('Generate performance report')
  .option('-d, --days <number>', 'Number of days to analyze', '7')
  .action(async (options) => {
    const admin = new DatabaseAdmin();
    try {
      const metrics = await admin.generatePerformanceReport(parseInt(options.days));
      
      console.log(`\n⚡ Performance Report (Last ${options.days} days)`);
      console.log('='.repeat(80));
      
      metrics.forEach(metric => {
        console.log(`📅 ${metric.date}`);
        console.log(`   📧 Processed: ${metric.emailsProcessed.toLocaleString()}`);
        console.log(`   ⏱️ Avg Time: ${metric.avgTimeMs.toFixed(2)}ms (${metric.minTimeMs}ms - ${metric.maxTimeMs}ms)`);
        console.log(`   🔄 Phases: P1=${metric.phase1Completed} P2=${metric.phase2Completed} P3=${metric.phase3Completed}`);
        console.log(`   ❌ Error Rate: ${metric.errorRatePercent}%`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Performance report failed:', error);
      process.exit(1);
    } finally {
      admin.close();
    }
  });

program
  .command('update-stats')
  .description('Update processing statistics')
  .action(async () => {
    const admin = new DatabaseAdmin();
    try {
      await admin.updateProcessingStats();
      console.log('✅ Processing statistics updated');
    } catch (error) {
      console.error('❌ Statistics update failed:', error);
      process.exit(1);
    } finally {
      admin.close();
    }
  });

// Error handling
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`, "DB_ADMIN");
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at ${promise}: ${reason}`, "DB_ADMIN");
  process.exit(1);
});

// Parse command line arguments
program.parse();

export { DatabaseAdmin };