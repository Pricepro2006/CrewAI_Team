import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../trpc/enhanced-router.js";
import { EmailAnalyticsService } from "../../core/database/EmailAnalyticsService.js";
import { EmailQueryBuilder } from "../../core/database/EmailQueryBuilder.js";
import Database from "better-sqlite3";
import type { DatabaseRow } from "../../shared/types/api.types.js";

// Database result interfaces
interface ExtractionStatsRow extends DatabaseRow {
  count: number;
  avg_confidence: number;
}

interface WorkflowStatsRow extends DatabaseRow {
  workflow_category: string;
  count: number;
  avg_dollar_value: number;
}

interface EntityStatsRow extends DatabaseRow {
  entity_type: string;
  count: number;
  avg_confidence: number;
}

interface DistributionRow extends DatabaseRow {
  category: string;
  count: number;
  percentage?: number;
}

// Input validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  days: z.number().min(1).max(365).optional().default(7),
});

const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const emailAnalyticsRouter = router({
  /**
   * Get aggregated email statistics
   */
  getStats: protectedProcedure.query(async () => {
    const service = new EmailAnalyticsService();
    try {
      return await service.getStats();
    } finally {
      service.close();
    }
  }),

  /**
   * Get daily email volume for a date range
   */
  getDailyVolume: protectedProcedure
    .input(dateRangeSchema)
    .query(async ({ input }) => {
      const db = new Database("./data/app.db");
      try {
        const { days = 7 } = input;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const query = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
          FROM emails
          WHERE created_at >= ? AND created_at <= ?
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;

        const stmt = db.prepare(query);
        const results = stmt.all(
          startDate.toISOString(),
          endDate.toISOString(),
        ) as { date: string; count: number }[];

        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          data: results,
        };
      } catch (error) {
        console.error("Error getting daily volume:", error);
        return {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          data: [],
        };
      } finally {
        db.close();
      }
    }),

  /**
   * Get entity extraction metrics
   */
  getEntityMetrics: protectedProcedure.query(async () => {
    const db = new Database("./data/app.db");
    try {
      const query = `
          SELECT 
            entity_type,
            COUNT(*) as count,
            AVG(confidence_score) as avg_confidence
          FROM entity_extractions
          GROUP BY entity_type
          ORDER BY count DESC
        `;

      const stmt = db.prepare(query);
      const results = stmt.all() as {
        entity_type: string;
        count: number;
        avg_confidence: number;
      }[];

      return {
        entities: results,
        totalExtractions: results.reduce((sum: number, r: ExtractionStatsRow) => sum + r.count, 0),
        avgConfidence:
          results.reduce((sum: number, r: ExtractionStatsRow) => sum + r.avg_confidence, 0) /
            results?.length || 0 || 0,
      };
    } catch (error) {
      console.error("Error getting entity metrics:", error);
      return {
        entities: [],
        totalExtractions: 0,
        avgConfidence: 0,
      };
    } finally {
      db.close();
    }
  }),

  /**
   * Get workflow distribution
   */
  getWorkflowDistribution: protectedProcedure.query(async () => {
    const db = new Database("./data/app.db");
    try {
      const query = `
          SELECT 
            primary_workflow as workflow,
            COUNT(*) as count,
            AVG(processing_time_ms) as avg_processing_time
          FROM email_analysis
          WHERE workflow_state = 'COMPLETE'
          GROUP BY primary_workflow
          ORDER BY count DESC
        `;

      const stmt = db.prepare(query);
      const results = stmt.all() as {
        workflow: string;
        count: number;
        avg_processing_time: number;
      }[];

      const total = results.reduce((sum: number, r: WorkflowStatsRow) => sum + r.count, 0);

      return {
        workflows: results?.map((r: WorkflowStatsRow) => ({
          ...r,
          percentage: (r.count / total) * 100,
        })),
        totalProcessed: total,
      };
    } catch (error) {
      console.error("Error getting workflow distribution:", error);
      return {
        workflows: [],
        totalProcessed: 0,
      };
    } finally {
      db.close();
    }
  }),

  /**
   * Get processing performance metrics
   */
  getProcessingPerformance: protectedProcedure
    .input(dateRangeSchema)
    .query(async ({ input }) => {
      const db = new Database("./data/app.db");
      try {
        const { days = 7 } = input;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const query = `
          SELECT 
            DATE(analysis_timestamp) as date,
            COUNT(*) as processed_count,
            AVG(processing_time_ms) as avg_time,
            MIN(processing_time_ms) as min_time,
            MAX(processing_time_ms) as max_time,
            SUM(CASE WHEN workflow_state = 'ERROR' THEN 1 ELSE 0 END) as error_count
          FROM email_analysis
          WHERE analysis_timestamp >= ? AND analysis_timestamp <= ?
          GROUP BY DATE(analysis_timestamp)
          ORDER BY date ASC
        `;

        const stmt = db.prepare(query);
        const results = stmt.all(
          startDate.toISOString(),
          endDate.toISOString(),
        ) as {
          date: string;
          processed_count: number;
          avg_time: number;
          min_time: number;
          max_time: number;
          error_count: number;
        }[];

        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          data: results?.map((r: EntityStatsRow) => ({
            ...r,
            success_rate:
              ((r.processed_count - r.error_count) / r.processed_count) * 100,
          })),
        };
      } catch (error) {
        console.error("Error getting processing performance:", error);
        return {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          data: [],
        };
      } finally {
        db.close();
      }
    }),

  /**
   * Get urgency distribution
   */
  getUrgencyDistribution: protectedProcedure.query(async () => {
    const db = new Database("./data/app.db");
    try {
      const query = `
          SELECT 
            urgency_level,
            COUNT(*) as count
          FROM email_analysis
          WHERE urgency_level IS NOT NULL
          GROUP BY urgency_level
          ORDER BY 
            CASE urgency_level
              WHEN 'HIGH' THEN 1
              WHEN 'MEDIUM' THEN 2
              WHEN 'LOW' THEN 3
              ELSE 4
            END
        `;

      const stmt = db.prepare(query);
      const results = stmt.all() as {
        urgency_level: string;
        count: number;
      }[];

      const total = results.reduce((sum: number, r: WorkflowStatsRow) => sum + r.count, 0);

      return {
        distribution: results?.map((r: DistributionRow) => ({
          level: r.urgency_level,
          count: r.count,
          percentage: (r.count / total) * 100,
        })),
        total,
      };
    } catch (error) {
      console.error("Error getting urgency distribution:", error);
      return {
        distribution: [],
        total: 0,
      };
    } finally {
      db.close();
    }
  }),
});
