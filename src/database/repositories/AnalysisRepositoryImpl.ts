// Removed BaseRepository import as we don't extend it
import type { IAnalysisRepository } from "./interfaces/IAnalysisRepository.js";
import { AnalysisPhase } from "../../types/AnalysisTypes.js";
import type {
  EmailAnalysis,
  Phase1Results,
  Phase2Results,
  Phase3Results,
} from "../../types/AnalysisTypes.js";
import { executeQuery, executeTransaction } from "../ConnectionPool.js";
import { logger } from "../../utils/logger.js";

/**
 * Email analysis repository implementation
 */
export class AnalysisRepositoryImpl implements IAnalysisRepository {
  protected tableName = "email_analysis";
  protected primaryKey = "id";

  constructor() {
    // No super call needed
  }

  /**
   * Generate a new UUID for entity ID
   */
  protected generateId(): string {
    return require('uuid').v4();
  }

  /**
   * Map database row to EmailAnalysis entity
   */
  protected mapRowToEntity(row: any): EmailAnalysis {
    const phases_completed: AnalysisPhase[] = [];
    if (row.phase1_results) phases_completed.push(AnalysisPhase.PHASE_1);
    if (row.phase2_results) phases_completed.push(AnalysisPhase.PHASE_2);
    if (row.phase3_results) phases_completed.push(AnalysisPhase.PHASE_3);

    return {
      id: row.id,
      email_id: row.email_id,
      analysis_version: row.analysis_version,
      phase1_results: row.phase1_results
        ? JSON.parse(row.phase1_results)
        : undefined,
      phase2_results: row.phase2_results
        ? JSON.parse(row.phase2_results)
        : undefined,
      phase3_results: row.phase3_results
        ? JSON.parse(row.phase3_results)
        : undefined,
      final_summary: JSON.parse(row.final_summary),
      confidence_score: row.confidence_score,
      workflow_type: row.workflow_type,
      chain_id: row.chain_id,
      is_complete_chain: Boolean(row.is_complete_chain),
      total_processing_time_ms: row.total_processing_time_ms || 0,
      phases_completed,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }

  /**
   * Map EmailAnalysis entity to database row
   */
  protected mapEntityToRow(entity: Partial<EmailAnalysis>): any {
    const row: any = {};

    if (entity.email_id !== undefined) row.email_id = entity.email_id;
    if (entity.analysis_version !== undefined)
      row.analysis_version = entity.analysis_version;
    if (entity.phase1_results !== undefined)
      row.phase1_results = JSON.stringify(entity.phase1_results);
    if (entity.phase2_results !== undefined)
      row.phase2_results = JSON.stringify(entity.phase2_results);
    if (entity.phase3_results !== undefined)
      row.phase3_results = JSON.stringify(entity.phase3_results);
    if (entity.final_summary !== undefined)
      row.final_summary = JSON.stringify(entity.final_summary);
    if (entity.confidence_score !== undefined)
      row.confidence_score = entity.confidence_score;
    if (entity.workflow_type !== undefined)
      row.workflow_type = entity.workflow_type;
    if (entity.chain_id !== undefined) row.chain_id = entity.chain_id;
    if (entity.is_complete_chain !== undefined)
      row.is_complete_chain = entity.is_complete_chain ? 1 : 0;
    if (entity.total_processing_time_ms !== undefined)
      row.total_processing_time_ms = entity.total_processing_time_ms;

    return row;
  }

  /**
   * Find analysis by email ID
   */
  async findByEmailId(emailId: string): Promise<EmailAnalysis | null> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE email_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = stmt.get(emailId);
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  /**
   * Find analyses by version
   */
  async findByVersion(version: string): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE analysis_version = ?
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(version);
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find analyses by workflow type
   */
  async findByWorkflowType(workflowType: string): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE workflow_type = ?
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(workflowType);
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find analyses by confidence range
   */
  async findByConfidenceRange(
    minConfidence: number,
    maxConfidence: number,
  ): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE confidence_score BETWEEN ? AND ?
        ORDER BY confidence_score DESC
      `);
      const rows = stmt.all(minConfidence, maxConfidence);
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find analyses with specific phase results
   */
  async findByPhaseCompletion(
    phases: AnalysisPhase[],
  ): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      const conditions = phases?.map((phase: any) => {
        switch (phase) {
          case AnalysisPhase.PHASE_1:
            return "phase1_results IS NOT NULL";
          case AnalysisPhase.PHASE_2:
            return "phase2_results IS NOT NULL";
          case AnalysisPhase.PHASE_3:
            return "phase3_results IS NOT NULL";
        }
      });

      const query = `
        SELECT * FROM ${this.tableName}
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
      `;

      const stmt = db.prepare(query);
      const rows = stmt.all();
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Update phase results
   */
  async updatePhaseResults(
    analysisId: string,
    phase: AnalysisPhase,
    results: any,
  ): Promise<void> {
    await executeQuery((db: any) => {
      const columnMap = {
        [AnalysisPhase.PHASE_1]: "phase1_results",
        [AnalysisPhase.PHASE_2]: "phase2_results",
        [AnalysisPhase.PHASE_3]: "phase3_results",
      };

      const column = columnMap[phase];
      const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET ${column} = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(JSON.stringify(results), analysisId);

      // Update total processing time if results include processing_time_ms
      if (results.processing_time_ms) {
        const updateTimeStmt = db.prepare(`
          UPDATE ${this.tableName}
          SET total_processing_time_ms = total_processing_time_ms + ?
          WHERE id = ?
        `);
        updateTimeStmt.run(results.processing_time_ms, analysisId);
      }
    });
  }

  /**
   * Update final summary
   */
  async updateSummary(analysisId: string, summary: any): Promise<void> {
    await executeQuery((db: any) => {
      const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET final_summary = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(JSON.stringify(summary), analysisId);
    });
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStatistics(): Promise<{
    total: number;
    byVersion: Record<string, number>;
    byWorkflowType: Record<string, number>;
    avgConfidence: number;
    phase1Only: number;
    phase2Completed: number;
    phase3Completed: number;
  }> {
    return executeQuery((db: any) => {
      // Total and phase counts
      const statsStmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          AVG(confidence_score) as avg_confidence,
          SUM(CASE WHEN phase1_results IS NOT NULL AND phase2_results IS NULL THEN 1 ELSE 0 END) as phase1_only,
          SUM(CASE WHEN phase2_results IS NOT NULL THEN 1 ELSE 0 END) as phase2_completed,
          SUM(CASE WHEN phase3_results IS NOT NULL THEN 1 ELSE 0 END) as phase3_completed
        FROM ${this.tableName}
      `);
      const stats = statsStmt.get() as any;

      // By version
      const versionStmt = db.prepare(`
        SELECT analysis_version, COUNT(*) as count
        FROM ${this.tableName}
        GROUP BY analysis_version
      `);
      const versionCounts = versionStmt.all() as any[];
      const byVersion: Record<string, number> = {};
      versionCounts.forEach((v: any) => {
        byVersion[v.analysis_version] = v.count;
      });

      // By workflow type
      const workflowStmt = db.prepare(`
        SELECT workflow_type, COUNT(*) as count
        FROM ${this.tableName}
        GROUP BY workflow_type
      `);
      const workflowCounts = workflowStmt.all() as any[];
      const byWorkflowType: Record<string, number> = {};
      workflowCounts.forEach((w: any) => {
        byWorkflowType[w.workflow_type] = w.count;
      });

      return {
        total: stats.total || 0,
        byVersion,
        byWorkflowType,
        avgConfidence: stats.avg_confidence || 0,
        phase1Only: stats.phase1_only || 0,
        phase2Completed: stats.phase2_completed || 0,
        phase3Completed: stats.phase3_completed || 0,
      };
    });
  }

  /**
   * Find analyses for complete chains
   */
  async findForCompleteChains(): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE is_complete_chain = 1
        ORDER BY created_at DESC
      `);
      const rows = stmt.all();
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Batch create analyses
   */
  async batchCreate(
    analyses: Omit<EmailAnalysis, "id">[],
  ): Promise<EmailAnalysis[]> {
    return executeTransaction((db: any) => {
      const insertStmt = db.prepare(`
        INSERT INTO ${this.tableName} (
          id, email_id, analysis_version, phase1_results, phase2_results,
          phase3_results, final_summary, confidence_score, workflow_type,
          chain_id, is_complete_chain, total_processing_time_ms, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
        )
      `);

      const createdAnalyses: EmailAnalysis[] = [];

      for (const analysis of analyses) {
        const id = this.generateId();
        const row = this.mapEntityToRow(analysis);

        insertStmt.run(
          id,
          row.email_id,
          row.analysis_version,
          row.phase1_results,
          row.phase2_results,
          row.phase3_results,
          row.final_summary,
          row.confidence_score,
          row.workflow_type,
          row.chain_id,
          row.is_complete_chain,
          row.total_processing_time_ms || 0,
        );

        createdAnalyses.push({
          ...analysis,
          id,
          created_at: new Date(),
          phases_completed: this.determinePhases(analysis),
        } as EmailAnalysis);
      }

      logger.info(
        `Batch created ${createdAnalyses?.length || 0} analyses`,
        "ANALYSIS_REPOSITORY",
      );
      return createdAnalyses;
    });
  }

  /**
   * Find recent analyses
   */
  async findRecent(limit: number): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        ORDER BY created_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit);
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Delete old analyses
   */
  async deleteOlderThan(date: Date): Promise<number> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE created_at < ?
      `);
      const result = stmt.run(date.toISOString());

      if (result.changes > 0) {
        logger.info(
          `Deleted ${result.changes} old analyses`,
          "ANALYSIS_REPOSITORY",
        );
      }

      return result.changes;
    });
  }

  /**
   * Find analyses needing phase upgrade
   */
  async findNeedingPhaseUpgrade(
    currentPhase: AnalysisPhase,
  ): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      let condition: string;

      switch (currentPhase) {
        case AnalysisPhase.PHASE_1:
          condition = "phase1_results IS NOT NULL AND phase2_results IS NULL";
          break;
        case AnalysisPhase.PHASE_2:
          condition = "phase2_results IS NOT NULL AND phase3_results IS NULL";
          break;
        default:
          return [];
      }

      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE ${condition}
        ORDER BY confidence_score ASC, created_at ASC
      `);
      const rows = stmt.all();
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Adapter method to match IRepository interface
   */
  async findAll(filter?: Partial<EmailAnalysis>): Promise<EmailAnalysis[]> {
    return executeQuery((db: any) => {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key: any) => {
          params.push(filter[key as keyof EmailAnalysis]);
          return `${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY created_at DESC`;

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];
      return rows?.map((row: any) => this.mapRowToEntity(row));
    });
  }

  /**
   * Override methods to use connection pool
   */
  async create(data: Omit<EmailAnalysis, "id">): Promise<EmailAnalysis> {
    return executeQuery((db: any) => {
      const id = this.generateId();
      const analysisData: EmailAnalysis = {
        ...data,
        id,
        created_at: new Date(),
        phases_completed: this.determinePhases(data),
      };

      const row = this.mapEntityToRow(analysisData);
      const columns = Object.keys(row);
      const values = columns?.map((col: any) => row[col]);
      const placeholders = columns?.map(() => "?").join(", ");

      const query = `INSERT INTO ${this.tableName} (id, ${columns.join(", ")}, created_at) VALUES (?, ${placeholders}, datetime('now'))`;
      const stmt = db.prepare(query);
      stmt.run(id, ...values);

      logger.info("Analysis created", "ANALYSIS_REPOSITORY", {
        analysisId: id,
        emailId: data.email_id,
      });
      return analysisData;
    });
  }

  /**
   * Find analysis by ID
   */
  async findById(id: string): Promise<EmailAnalysis | null> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(
        `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
      );
      const row = stmt.get(id) as any;
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  /**
   * Update an analysis record
   */
  async update(
    id: string,
    data: Partial<Omit<EmailAnalysis, "id" | "created_at">>,
  ): Promise<EmailAnalysis | null> {
    return executeQuery(async (db: any) => {
      const row = this.mapEntityToRow(data);
      const columns = Object.keys(row);

      if (columns?.length || 0 === 0) {
        return await this.findById(id);
      }

      const values = columns?.map((col: any) => row[col]);
      values.push(id);

      const setClause = columns?.map((col: any) => `${col} = ?`).join(", ");
      const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = datetime('now') WHERE ${this.primaryKey} = ?`;

      const stmt = db.prepare(query);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return null;
      }

      logger.info("Analysis updated", "ANALYSIS_REPOSITORY", { id });
      return await this.findById(id);
    });
  }

  /**
   * Count analyses with optional filtering
   */
  async count(filter?: Partial<EmailAnalysis>): Promise<number> {
    return executeQuery((db: any) => {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key: any) => {
          params.push(filter[key as keyof EmailAnalysis]);
          return `${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const stmt = db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    });
  }

  /**
   * Check if an analysis exists
   */
  async exists(id: string): Promise<boolean> {
    const analysis = await this.findById(id);
    return analysis !== null;
  }

  /**
   * Delete an analysis
   */
  async delete(id: string): Promise<boolean> {
    return executeQuery((db: any) => {
      const stmt = db.prepare(
        `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
      );
      const result = stmt.run(id);
      const deleted = result.changes > 0;

      if (deleted) {
        logger.info("Analysis deleted", "ANALYSIS_REPOSITORY", { id });
      }

      return deleted;
    });
  }

  /**
   * Helper to determine completed phases
   */
  private determinePhases(analysis: Partial<EmailAnalysis>): AnalysisPhase[] {
    const phases: AnalysisPhase[] = [];
    if (analysis.phase1_results) phases.push(AnalysisPhase.PHASE_1);
    if (analysis.phase2_results) phases.push(AnalysisPhase.PHASE_2);
    if (analysis.phase3_results) phases.push(AnalysisPhase.PHASE_3);
    return phases;
  }
}
