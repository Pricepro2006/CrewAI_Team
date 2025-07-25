#!/usr/bin/env tsx

/**
 * Monitor Three-Stage Pipeline Progress
 * Real-time dashboard for pipeline execution
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";
import * as readline from "readline";

interface PipelineStatus {
  executionId: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  stage1Count: number;
  stage2Count: number;
  stage3Count: number;
  totalTime?: number;
  errorMessage?: string;
}

interface EmailStats {
  totalEmails: number;
  processedEmails: number;
  averageQuality: number;
  topModels: Array<{ model: string; count: number }>;
}

async function getCurrentExecution(): Promise<PipelineStatus | null> {
  const db = getDatabaseConnection();
  const execution = db.prepare(`
    SELECT * FROM pipeline_executions
    ORDER BY started_at DESC
    LIMIT 1
  `).get() as any;

  if (!execution) return null;

  return {
    executionId: execution.id,
    status: execution.status,
    startedAt: execution.started_at,
    completedAt: execution.completed_at || undefined,
    stage1Count: execution.stage1_count || 0,
    stage2Count: execution.stage2_count || 0,
    stage3Count: execution.stage3_count || 0,
    totalTime: execution.total_processing_time_seconds || undefined,
    errorMessage: execution.error_message || undefined,
  };
}

async function getEmailStats(executionId: number): Promise<EmailStats> {
  const db = getDatabaseConnection();
  
  // Get total emails
  const totalResult = db.prepare("SELECT COUNT(*) as count FROM emails_enhanced").get() as { count: number };

  // Get processed emails for this execution
  const processedResult = db.prepare(
    "SELECT COUNT(*) as count FROM stage_results WHERE execution_id = ?"
  ).get(executionId) as { count: number };

  // Get average quality score
  const qualityResult = db.prepare(
    "SELECT AVG(analysis_quality_score) as avg_quality FROM stage_results WHERE execution_id = ?"
  ).get(executionId) as { avg_quality: number };

  // Get model usage stats
  const modelStats = db.prepare(`
    SELECT model_used, COUNT(*) as count 
    FROM stage_results 
    WHERE execution_id = ?
    GROUP BY model_used
    ORDER BY count DESC
  `).all(executionId) as Array<{ model_used: string; count: number }>;

  return {
    totalEmails: totalResult?.count || 0,
    processedEmails: processedResult?.count || 0,
    averageQuality: qualityResult?.avg_quality || 0,
    topModels: modelStats.map(m => ({
      model: m.model_used,
      count: m.count,
    })),
  };
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function progressBar(current: number, total: number, width: number = 40): string {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(width * percentage);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

async function displayDashboard() {
  // Clear console
  console.clear();

  const execution = await getCurrentExecution();
  
  if (!execution) {
    console.log("\n❌ No pipeline execution found\n");
    return;
  }

  const stats = await getEmailStats(execution.executionId);
  const elapsedTime = execution.completedAt 
    ? execution.totalTime || 0
    : (Date.now() - new Date(execution.startedAt).getTime()) / 1000;

  // Header
  console.log("╔" + "═".repeat(58) + "╗");
  console.log("║" + " Three-Stage Pipeline Monitor".padEnd(58) + "║");
  console.log("╠" + "═".repeat(58) + "╣");

  // Status
  const statusEmoji = execution.status === 'running' ? '🔄' : 
                     execution.status === 'completed' ? '✅' : '❌';
  console.log(`║ Status: ${statusEmoji} ${execution.status.toUpperCase()}`.padEnd(59) + "║");
  console.log(`║ Execution ID: ${execution.executionId}`.padEnd(59) + "║");
  console.log(`║ Started: ${new Date(execution.startedAt).toLocaleString()}`.padEnd(59) + "║");
  console.log(`║ Elapsed: ${formatTime(elapsedTime)}`.padEnd(59) + "║");
  
  console.log("╠" + "═".repeat(58) + "╣");

  // Stage Progress
  console.log("║ Stage Progress:".padEnd(59) + "║");
  console.log("║".padEnd(59) + "║");
  
  // Stage 1
  const stage1Progress = progressBar(execution.stage1Count, stats.totalEmails);
  const stage1Percent = (execution.stage1Count / stats.totalEmails * 100).toFixed(1);
  console.log(`║ Stage 1: [${stage1Progress}] ${stage1Percent}%`.padEnd(59) + "║");
  console.log(`║          ${execution.stage1Count}/${stats.totalEmails} emails`.padEnd(59) + "║");
  
  // Stage 2
  const stage2Progress = progressBar(execution.stage2Count, 5000);
  const stage2Percent = (execution.stage2Count / 5000 * 100).toFixed(1);
  console.log(`║ Stage 2: [${stage2Progress}] ${stage2Percent}%`.padEnd(59) + "║");
  console.log(`║          ${execution.stage2Count}/5000 priority emails`.padEnd(59) + "║");
  
  // Stage 3
  const stage3Progress = progressBar(execution.stage3Count, 500);
  const stage3Percent = (execution.stage3Count / 500 * 100).toFixed(1);
  console.log(`║ Stage 3: [${stage3Progress}] ${stage3Percent}%`.padEnd(59) + "║");
  console.log(`║          ${execution.stage3Count}/500 critical emails`.padEnd(59) + "║");

  console.log("╠" + "═".repeat(58) + "╣");

  // Statistics
  console.log("║ Analysis Quality:".padEnd(59) + "║");
  console.log(`║ Average Score: ${stats.averageQuality.toFixed(2)}/10`.padEnd(59) + "║");
  console.log("║".padEnd(59) + "║");
  console.log("║ Model Usage:".padEnd(59) + "║");
  for (const model of stats.topModels) {
    console.log(`║ - ${model.model}: ${model.count} emails`.padEnd(59) + "║");
  }

  // Error message if any
  if (execution.errorMessage) {
    console.log("╠" + "═".repeat(58) + "╣");
    console.log("║ ❌ Error:".padEnd(59) + "║");
    console.log(`║ ${execution.errorMessage.substring(0, 56)}`.padEnd(59) + "║");
  }

  // Footer
  console.log("╚" + "═".repeat(58) + "╝");

  // Estimated completion
  if (execution.status === 'running') {
    const totalEstimated = 21 * 3600; // 21 hours in seconds
    const percentComplete = stats.processedEmails / stats.totalEmails;
    const estimatedRemaining = (totalEstimated * (1 - percentComplete));
    console.log(`\n⏱️  Estimated time remaining: ${formatTime(estimatedRemaining)}`);
  }

  console.log("\nPress Ctrl+C to exit");
}

async function main() {
  // Set up refresh interval
  const refreshInterval = 5000; // 5 seconds

  // Initial display
  await displayDashboard();

  // Refresh periodically
  const interval = setInterval(async () => {
    await displayDashboard();
  }, refreshInterval);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log("\n\n👋 Pipeline monitor stopped\n");
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(interval);
    process.exit(0);
  });
}

// Run the monitor
main().catch((error) => {
  logger.error("Monitor error", "MONITOR", error as Error);
  process.exit(1);
});