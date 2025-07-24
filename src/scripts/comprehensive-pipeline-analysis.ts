#!/usr/bin/env tsx
/**
 * Comprehensive Analysis of Pipeline Results, Database Integration, and UI Compatibility
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";
import { PipelineAnalysisAdapter } from "../adapters/PipelineAnalysisAdapter";

interface AnalysisReport {
  database: DatabaseAnalysis;
  pipeline: PipelineAnalysis;
  integration: IntegrationAnalysis;
  uiCompatibility: UICompatibilityAnalysis;
  recommendations: string[];
}

interface DatabaseAnalysis {
  schema: SchemaValidation;
  dataIntegrity: DataIntegrityCheck;
  performance: PerformanceMetrics;
}

interface PipelineAnalysis {
  executions: ExecutionHistory;
  stages: StageAnalysis;
  duplicateDetection: DuplicateAnalysis;
}

interface IntegrationAnalysis {
  adapterCompatibility: boolean;
  joinPerformance: JoinTest[];
  dataTransformation: TransformationTest;
}

interface UICompatibilityAnalysis {
  dashboardFields: FieldMapping[];
  missingData: string[];
  statusAlignment: StatusMapping;
}

async function comprehensiveAnalysis(): Promise<AnalysisReport> {
  logger.info("🔍 Starting Comprehensive Pipeline Analysis...", "ANALYSIS");

  const db = getDatabaseConnection();
  const adapter = new PipelineAnalysisAdapter();

  // 1. DATABASE ANALYSIS
  logger.info("📊 Analyzing Database Structure...", "ANALYSIS");

  const schema = await analyzeSchema(db);
  const dataIntegrity = await checkDataIntegrity(db);
  const performance = await measurePerformance(db);

  // 2. PIPELINE ANALYSIS
  logger.info("⚙️ Analyzing Pipeline Performance...", "ANALYSIS");

  const executions = await analyzeExecutions(db);
  const stages = await analyzeStages(db);
  const duplicates = await analyzeDuplicates(db);

  // 3. INTEGRATION ANALYSIS
  logger.info("🔗 Testing Integration Components...", "ANALYSIS");

  const adapterTest = await testAdapterCompatibility(db, adapter);
  const joinTests = await testJoinPerformance(db);
  const transformationTest = await testDataTransformation(db, adapter);

  // 4. UI COMPATIBILITY ANALYSIS
  logger.info("🖥️ Checking UI Dashboard Compatibility...", "ANALYSIS");

  const dashboardFields = await mapDashboardFields(db);
  const missingData = await identifyMissingData(db);
  const statusMapping = await mapStatusFields(db);

  const report: AnalysisReport = {
    database: {
      schema,
      dataIntegrity,
      performance,
    },
    pipeline: {
      executions,
      stages,
      duplicateDetection: duplicates,
    },
    integration: {
      adapterCompatibility: adapterTest,
      joinPerformance: joinTests,
      dataTransformation: transformationTest,
    },
    uiCompatibility: {
      dashboardFields,
      missingData,
      statusAlignment: statusMapping,
    },
    recommendations: [],
  };

  // Generate recommendations
  report.recommendations = generateRecommendations(report);

  return report;
}

async function analyzeSchema(db: any): Promise<SchemaValidation> {
  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master WHERE type='table' 
    ORDER BY name
  `,
    )
    .all() as Array<{ name: string }>;

  const emailAnalysisColumns = db
    .prepare(
      `
    PRAGMA table_info(email_analysis)
  `,
    )
    .all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>;

  const emailsEnhancedColumns = db
    .prepare(
      `
    PRAGMA table_info(emails_enhanced)
  `,
    )
    .all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>;

  const expectedTables = [
    "email_analysis",
    "emails_enhanced",
    "pipeline_executions",
    "stage_results",
  ];

  const expectedEmailAnalysisColumns = [
    "id",
    "email_id",
    "pipeline_stage",
    "pipeline_priority_score",
    "llama_analysis",
    "phi4_analysis",
    "final_model_used",
    "analysis_timestamp",
  ];

  const missingTables = expectedTables.filter(
    (t) => !tables.some((table) => table.name === t),
  );

  const missingColumns = expectedEmailAnalysisColumns.filter(
    (c) => !emailAnalysisColumns.some((col) => col.name === c),
  );

  return {
    totalTables: tables.length,
    expectedTables: expectedTables.length,
    missingTables,
    emailAnalysisColumns: emailAnalysisColumns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: !c.notnull,
      primaryKey: !!c.pk,
    })),
    missingColumns,
    schemaValid: missingTables.length === 0 && missingColumns.length === 0,
  };
}

async function checkDataIntegrity(db: any): Promise<DataIntegrityCheck> {
  // Check for orphaned records
  const orphanedAnalysis = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM email_analysis ea
    LEFT JOIN emails_enhanced e ON ea.email_id = e.id
    WHERE e.id IS NULL
  `,
    )
    .get() as { count: number };

  // Check for emails without analysis
  const emailsWithoutAnalysis = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM emails_enhanced e
    LEFT JOIN email_analysis ea ON e.id = ea.email_id
    WHERE ea.email_id IS NULL
  `,
    )
    .get() as { count: number };

  // Check data types consistency
  const invalidScores = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM email_analysis
    WHERE pipeline_priority_score < 0 OR pipeline_priority_score > 100
  `,
    )
    .get() as { count: number };

  // Check timestamp consistency
  const invalidTimestamps = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM email_analysis
    WHERE analysis_timestamp IS NULL OR analysis_timestamp = ''
  `,
    )
    .get() as { count: number };

  return {
    orphanedAnalysisRecords: orphanedAnalysis.count,
    emailsWithoutAnalysis: emailsWithoutAnalysis.count,
    invalidPriorityScores: invalidScores.count,
    invalidTimestamps: invalidTimestamps.count,
    integrityScore: calculateIntegrityScore(
      orphanedAnalysis.count,
      emailsWithoutAnalysis.count,
      invalidScores.count,
      invalidTimestamps.count,
    ),
  };
}

async function measurePerformance(db: any): Promise<PerformanceMetrics> {
  const start = Date.now();

  // Test join performance
  const joinTest = db
    .prepare(
      `
    SELECT COUNT(*)
    FROM emails_enhanced e
    JOIN email_analysis ea ON e.id = ea.email_id
    WHERE ea.pipeline_priority_score > 50
  `,
    )
    .get();

  const joinTime = Date.now() - start;

  // Test analysis query performance
  const analysisStart = Date.now();
  const analysisTest = db
    .prepare(
      `
    SELECT pipeline_stage, COUNT(*), AVG(pipeline_priority_score)
    FROM email_analysis
    GROUP BY pipeline_stage
  `,
    )
    .all();

  const analysisTime = Date.now() - analysisStart;

  return {
    joinQueryTime: joinTime,
    analysisQueryTime: analysisTime,
    performanceGrade:
      joinTime < 100 && analysisTime < 50 ? "A" : joinTime < 500 ? "B" : "C",
  };
}

async function analyzeExecutions(db: any): Promise<ExecutionHistory> {
  const executions = db
    .prepare(
      `
    SELECT id, started_at, completed_at, status, stage1_count, stage2_count, stage3_count, error_message
    FROM pipeline_executions
    ORDER BY started_at DESC
    LIMIT 10
  `,
    )
    .all() as Array<{
    id: number;
    started_at: string;
    completed_at?: string;
    status: string;
    stage1_count: number;
    stage2_count: number;
    stage3_count: number;
    error_message?: string;
  }>;

  const statusCounts = db
    .prepare(
      `
    SELECT status, COUNT(*) as count
    FROM pipeline_executions
    GROUP BY status
  `,
    )
    .all() as Array<{ status: string; count: number }>;

  return {
    totalExecutions: executions.length,
    recentExecutions: executions.slice(0, 5),
    statusDistribution: statusCounts,
    hasStuckExecutions: executions.some(
      (e) =>
        e.status === "running" &&
        new Date(e.started_at).getTime() < Date.now() - 3600000,
    ), // 1 hour ago
  };
}

async function analyzeStages(db: any): Promise<StageAnalysis> {
  const stageStats = db
    .prepare(
      `
    SELECT 
      pipeline_stage,
      COUNT(*) as record_count,
      final_model_used,
      MIN(pipeline_priority_score) as min_score,
      MAX(pipeline_priority_score) as max_score,
      AVG(pipeline_priority_score) as avg_score
    FROM email_analysis
    WHERE pipeline_stage IS NOT NULL
    GROUP BY pipeline_stage, final_model_used
    ORDER BY pipeline_stage
  `,
    )
    .all() as Array<{
    pipeline_stage: number;
    record_count: number;
    final_model_used: string;
    min_score: number;
    max_score: number;
    avg_score: number;
  }>;

  const nullStageRecords = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM email_analysis WHERE pipeline_stage IS NULL
  `,
    )
    .get() as { count: number };

  return {
    stageBreakdown: stageStats,
    nullStageRecords: nullStageRecords.count,
    stage2Performance: stageStats.find((s) => s.pipeline_stage === 2),
    stage3Performance: stageStats.find((s) => s.pipeline_stage === 3),
    completionRate: calculateCompletionRate(stageStats),
  };
}

async function analyzeDuplicates(db: any): Promise<DuplicateAnalysis> {
  const duplicates = db
    .prepare(
      `
    SELECT 
      email_id,
      COUNT(*) as duplicate_count,
      GROUP_CONCAT(pipeline_stage) as stages,
      GROUP_CONCAT(analysis_timestamp) as timestamps
    FROM email_analysis
    GROUP BY email_id
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC
    LIMIT 10
  `,
    )
    .all() as Array<{
    email_id: string;
    duplicate_count: number;
    stages: string;
    timestamps: string;
  }>;

  const totalDuplicates = db
    .prepare(
      `
    SELECT COUNT(*) as total_duplicates
    FROM (
      SELECT email_id
      FROM email_analysis
      GROUP BY email_id
      HAVING COUNT(*) > 1
    )
  `,
    )
    .get() as { total_duplicates: number };

  return {
    hasDuplicates: duplicates.length > 0,
    duplicateCount: totalDuplicates.total_duplicates,
    sampleDuplicates: duplicates.slice(0, 5),
    severity:
      totalDuplicates.total_duplicates > 1000
        ? "HIGH"
        : totalDuplicates.total_duplicates > 100
          ? "MEDIUM"
          : "LOW",
  };
}

async function testAdapterCompatibility(
  db: any,
  adapter: PipelineAnalysisAdapter,
): Promise<boolean> {
  try {
    const sample = db
      .prepare(
        `
      SELECT * FROM email_analysis 
      ORDER BY pipeline_priority_score DESC 
      LIMIT 1
    `,
      )
      .get();

    if (!sample) return false;

    const transformed = adapter.fromDatabase(sample);
    return !!(transformed.quick && transformed.deep && transformed.metadata);
  } catch (error) {
    logger.error(
      "Adapter compatibility test failed",
      "ANALYSIS",
      {},
      error as Error,
    );
    return false;
  }
}

async function testJoinPerformance(db: any): Promise<JoinTest[]> {
  const tests = [];

  // Test 1: Basic join
  const start1 = Date.now();
  const basicJoin = db
    .prepare(
      `
    SELECT COUNT(*)
    FROM emails_enhanced e
    JOIN email_analysis ea ON e.id = ea.email_id
  `,
    )
    .get();
  tests.push({
    name: "Basic Join",
    executionTime: Date.now() - start1,
    resultCount: basicJoin["COUNT(*)"],
    passed: true,
  });

  // Test 2: Complex join with filtering
  const start2 = Date.now();
  const complexJoin = db
    .prepare(
      `
    SELECT e.id, e.subject, ea.pipeline_priority_score, ea.final_model_used
    FROM emails_enhanced e
    JOIN email_analysis ea ON e.id = ea.email_id
    WHERE ea.pipeline_priority_score > 80
    ORDER BY ea.pipeline_priority_score DESC
    LIMIT 100
  `,
    )
    .all();
  tests.push({
    name: "Complex Join with Filter",
    executionTime: Date.now() - start2,
    resultCount: complexJoin.length,
    passed: complexJoin.length > 0,
  });

  return tests;
}

async function testDataTransformation(
  db: any,
  adapter: PipelineAnalysisAdapter,
): Promise<TransformationTest> {
  const samples = db
    .prepare(
      `
    SELECT * FROM email_analysis 
    ORDER BY pipeline_priority_score DESC 
    LIMIT 10
  `,
    )
    .all();

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sample of samples) {
    try {
      const result = adapter.fromDatabase(sample);
      if (result.quick && result.deep && result.metadata) {
        successful++;
      } else {
        failed++;
        errors.push(`Incomplete transformation for ${sample.email_id}`);
      }
    } catch (error) {
      failed++;
      errors.push(
        `Transform failed for ${sample.email_id}: ${(error as Error).message}`,
      );
    }
  }

  return {
    totalTested: samples.length,
    successful,
    failed,
    successRate: (successful / samples.length) * 100,
    errors: errors.slice(0, 5),
  };
}

async function mapDashboardFields(db: any): Promise<FieldMapping[]> {
  // Based on the dashboard image, map required fields
  const dashboardFields = [
    {
      uiField: "Email Alias",
      dbField: "sender_email",
      table: "emails_enhanced",
    },
    {
      uiField: "Requested By",
      dbField: "sender_email",
      table: "emails_enhanced",
    },
    { uiField: "Subject", dbField: "subject", table: "emails_enhanced" },
    { uiField: "Summary", dbField: "llama_analysis", table: "email_analysis" },
    { uiField: "Status", dbField: "pipeline_stage", table: "email_analysis" },
    {
      uiField: "Assigned To",
      dbField: "llama_analysis",
      table: "email_analysis",
    },
    {
      uiField: "Priority Score",
      dbField: "pipeline_priority_score",
      table: "email_analysis",
    },
  ];

  const mappings: FieldMapping[] = [];

  for (const field of dashboardFields) {
    const exists = db
      .prepare(
        `
      PRAGMA table_info(${field.table})
    `,
      )
      .all()
      .some((col: any) => col.name === field.dbField);

    mappings.push({
      uiField: field.uiField,
      dbField: field.dbField,
      table: field.table,
      available: exists,
      needsTransformation: field.dbField === "llama_analysis",
    });
  }

  return mappings;
}

async function identifyMissingData(db: any): Promise<string[]> {
  const missing: string[] = [];

  // Check for missing Stage 2 data
  const stage2Count = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM email_analysis WHERE pipeline_stage = 2
  `,
    )
    .get() as { count: number };

  if (stage2Count.count === 0) {
    missing.push("Stage 2 (Llama) analysis data");
  }

  // Check for missing Stage 3 data
  const stage3Count = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM email_analysis WHERE pipeline_stage = 3
  `,
    )
    .get() as { count: number };

  if (stage3Count.count === 0) {
    missing.push("Stage 3 (Critical) analysis data");
  }

  // Check for missing llama_analysis content
  const nullLlama = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM email_analysis 
    WHERE llama_analysis IS NULL OR llama_analysis = ''
  `,
    )
    .get() as { count: number };

  if (nullLlama.count > 0) {
    missing.push(`${nullLlama.count} records missing Llama analysis content`);
  }

  return missing;
}

async function mapStatusFields(db: any): Promise<StatusMapping> {
  const statusValues = db
    .prepare(
      `
    SELECT DISTINCT pipeline_stage, final_model_used, COUNT(*) as count
    FROM email_analysis
    GROUP BY pipeline_stage, final_model_used
  `,
    )
    .all() as Array<{
    pipeline_stage: number;
    final_model_used: string;
    count: number;
  }>;

  return {
    availableStatuses: statusValues,
    uiStatusMapping: {
      1: "Triaged",
      2: "Analyzed",
      3: "Critical Review",
    },
    colorMapping: {
      1: "blue",
      2: "yellow",
      3: "green",
    },
  };
}

function generateRecommendations(report: AnalysisReport): string[] {
  const recommendations: string[] = [];

  // Database recommendations
  if (!report.database.schema.schemaValid) {
    recommendations.push("🔧 Fix missing database schema elements");
  }

  if (report.database.dataIntegrity.integrityScore < 0.9) {
    recommendations.push("🛠️ Address data integrity issues");
  }

  // Pipeline recommendations
  if (report.pipeline.duplicateDetection.hasDuplicates) {
    recommendations.push("🔄 Implement duplicate prevention in pipeline");
  }

  if (report.pipeline.executions.hasStuckExecutions) {
    recommendations.push("⚠️ Clean up stuck pipeline executions");
  }

  // Integration recommendations
  if (!report.integration.adapterCompatibility) {
    recommendations.push("🔗 Fix adapter compatibility issues");
  }

  // UI recommendations
  if (report.uiCompatibility.missingData.length > 0) {
    recommendations.push(
      "📊 Complete missing pipeline stages for full UI functionality",
    );
  }

  // Performance recommendations
  if (report.database.performance.performanceGrade === "C") {
    recommendations.push("⚡ Optimize database queries for better performance");
  }

  return recommendations;
}

// Helper functions
function calculateIntegrityScore(
  orphaned: number,
  missing: number,
  invalid: number,
  nullTimestamps: number,
): number {
  const totalIssues = orphaned + missing + invalid + nullTimestamps;
  return Math.max(0, 1 - totalIssues / 10000); // Normalize against expected volume
}

function calculateCompletionRate(
  stages: Array<{ pipeline_stage: number; record_count: number }>,
): number {
  const stage1Count =
    stages.find((s) => s.pipeline_stage === 1)?.record_count || 0;
  const stage2Count =
    stages.find((s) => s.pipeline_stage === 2)?.record_count || 0;
  const stage3Count =
    stages.find((s) => s.pipeline_stage === 3)?.record_count || 0;

  if (stage1Count === 0) return 0;
  return (stage2Count + stage3Count) / stage1Count;
}

// Type definitions
interface SchemaValidation {
  totalTables: number;
  expectedTables: number;
  missingTables: string[];
  emailAnalysisColumns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
  }>;
  missingColumns: string[];
  schemaValid: boolean;
}

interface DataIntegrityCheck {
  orphanedAnalysisRecords: number;
  emailsWithoutAnalysis: number;
  invalidPriorityScores: number;
  invalidTimestamps: number;
  integrityScore: number;
}

interface PerformanceMetrics {
  joinQueryTime: number;
  analysisQueryTime: number;
  performanceGrade: "A" | "B" | "C";
}

interface ExecutionHistory {
  totalExecutions: number;
  recentExecutions: Array<{
    id: number;
    started_at: string;
    completed_at?: string;
    status: string;
    stage1_count: number;
    stage2_count: number;
    stage3_count: number;
    error_message?: string;
  }>;
  statusDistribution: Array<{ status: string; count: number }>;
  hasStuckExecutions: boolean;
}

interface StageAnalysis {
  stageBreakdown: Array<{
    pipeline_stage: number;
    record_count: number;
    final_model_used: string;
    min_score: number;
    max_score: number;
    avg_score: number;
  }>;
  nullStageRecords: number;
  stage2Performance?: {
    pipeline_stage: number;
    record_count: number;
    final_model_used: string;
    min_score: number;
    max_score: number;
    avg_score: number;
  };
  stage3Performance?: {
    pipeline_stage: number;
    record_count: number;
    final_model_used: string;
    min_score: number;
    max_score: number;
    avg_score: number;
  };
  completionRate: number;
}

interface DuplicateAnalysis {
  hasDuplicates: boolean;
  duplicateCount: number;
  sampleDuplicates: Array<{
    email_id: string;
    duplicate_count: number;
    stages: string;
    timestamps: string;
  }>;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

interface JoinTest {
  name: string;
  executionTime: number;
  resultCount: number;
  passed: boolean;
}

interface TransformationTest {
  totalTested: number;
  successful: number;
  failed: number;
  successRate: number;
  errors: string[];
}

interface FieldMapping {
  uiField: string;
  dbField: string;
  table: string;
  available: boolean;
  needsTransformation: boolean;
}

interface StatusMapping {
  availableStatuses: Array<{
    pipeline_stage: number;
    final_model_used: string;
    count: number;
  }>;
  uiStatusMapping: { [key: number]: string };
  colorMapping: { [key: number]: string };
}

// Main execution
async function main() {
  try {
    const report = await comprehensiveAnalysis();

    // Output comprehensive report
    console.log("\n" + "=".repeat(80));
    console.log("📋 COMPREHENSIVE PIPELINE ANALYSIS REPORT");
    console.log("=".repeat(80));

    // Database Analysis
    console.log("\n🗄️  DATABASE ANALYSIS");
    console.log("-".repeat(40));
    console.log(
      `Schema Valid: ${report.database.schema.schemaValid ? "✅" : "❌"}`,
    );
    console.log(`Total Tables: ${report.database.schema.totalTables}`);
    console.log(
      `Missing Tables: ${report.database.schema.missingTables.length > 0 ? report.database.schema.missingTables.join(", ") : "None"}`,
    );
    console.log(
      `Missing Columns: ${report.database.schema.missingColumns.length > 0 ? report.database.schema.missingColumns.join(", ") : "None"}`,
    );
    console.log(
      `Data Integrity Score: ${(report.database.dataIntegrity.integrityScore * 100).toFixed(1)}%`,
    );
    console.log(
      `Performance Grade: ${report.database.performance.performanceGrade}`,
    );

    // Pipeline Analysis
    console.log("\n⚙️  PIPELINE ANALYSIS");
    console.log("-".repeat(40));
    console.log(
      `Total Executions: ${report.pipeline.executions.totalExecutions}`,
    );
    console.log(
      `Stuck Executions: ${report.pipeline.executions.hasStuckExecutions ? "⚠️ YES" : "✅ None"}`,
    );
    console.log(
      `Duplicate Records: ${report.pipeline.duplicateDetection.duplicateCount} (${report.pipeline.duplicateDetection.severity} severity)`,
    );
    console.log(
      `Stage Completion Rate: ${(report.pipeline.stages.completionRate * 100).toFixed(1)}%`,
    );

    console.log("\nStage Breakdown:");
    for (const stage of report.pipeline.stages.stageBreakdown) {
      console.log(
        `  Stage ${stage.pipeline_stage}: ${stage.record_count} records (${stage.final_model_used}, avg score: ${stage.avg_score.toFixed(1)})`,
      );
    }

    // Integration Analysis
    console.log("\n🔗 INTEGRATION ANALYSIS");
    console.log("-".repeat(40));
    console.log(
      `Adapter Compatible: ${report.integration.adapterCompatibility ? "✅" : "❌"}`,
    );
    console.log(
      `Transformation Success Rate: ${report.integration.dataTransformation.successRate.toFixed(1)}%`,
    );

    console.log("\nJoin Performance:");
    for (const test of report.integration.joinPerformance) {
      console.log(
        `  ${test.name}: ${test.executionTime}ms (${test.resultCount} results) ${test.passed ? "✅" : "❌"}`,
      );
    }

    // UI Compatibility Analysis
    console.log("\n🖥️  UI COMPATIBILITY ANALYSIS");
    console.log("-".repeat(40));

    console.log("Dashboard Field Mapping:");
    for (const field of report.uiCompatibility.dashboardFields) {
      const status = field.available ? "✅" : "❌";
      const transform = field.needsTransformation ? " (needs transform)" : "";
      console.log(
        `  ${field.uiField}: ${field.table}.${field.dbField} ${status}${transform}`,
      );
    }

    if (report.uiCompatibility.missingData.length > 0) {
      console.log("\nMissing Data:");
      for (const missing of report.uiCompatibility.missingData) {
        console.log(`  ❌ ${missing}`);
      }
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS");
    console.log("-".repeat(40));
    if (report.recommendations.length === 0) {
      console.log(
        "✅ No critical issues found - system is ready for production!",
      );
    } else {
      for (const rec of report.recommendations) {
        console.log(`  ${rec}`);
      }
    }

    console.log("\n" + "=".repeat(80));

    logger.info("Comprehensive analysis completed", "ANALYSIS");
  } catch (error) {
    logger.error("Analysis failed", "ANALYSIS", {}, error as Error);
    process.exit(1);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Analysis crashed", "ANALYSIS", {}, error as Error);
    process.exit(1);
  });
