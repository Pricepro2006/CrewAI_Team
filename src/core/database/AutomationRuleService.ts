import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

interface AutomationRule {
  id: number;
  rule_name: string;
  rule_type: "categorization" | "routing" | "notification" | "escalation";
  conditions: any;
  actions: any;
  priority: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  executed_count: number;
  success_count: number;
  last_executed: Date | null;
}

interface EmailRecord {
  id: number;
  rule_name: string;
  success_count: number;
  executed_count: number;
  success_rate?: number;
  avg_execution_time?: number;
  priority: number;
}

interface RulePerformance {
  rule_id: number;
  rule_name: string;
  success_rate: number;
  avg_execution_time: number;
  total_executions: number;
  last_24h_executions: number;
}

interface RuleActivity {
  date: string;
  rule_id: number;
  rule_name: string;
  executions: number;
  successes: number;
  failures: number;
}

export class AutomationRuleService {
  private db: Database.Database;

  constructor(databasePath: string = "./data/app.db") {
    try {
      this.db = new Database(databasePath);
      logger.info("Database connection established", "AUTOMATION_RULES");
    } catch (error) {
      logger.error("Failed to connect to database", "AUTOMATION_RULES", {
        error,
      });
      throw new Error("Database connection failed");
    }
  }

  /**
   * Get all automation rules
   */
  getAllRules(): AutomationRule[] {
    try {
      const stmt = this?.db?.prepare(`
        SELECT * FROM automation_rules 
        ORDER BY priority DESC, rule_name ASC
      `);
      return stmt.all() as AutomationRule[];
    } catch (error) {
      logger.error("Error getting automation rules", "AUTOMATION_RULES", {
        error,
      });
      return [];
    }
  }

  /**
   * Get active automation rules
   */
  getActiveRules(): AutomationRule[] {
    try {
      const stmt = this?.db?.prepare(`
        SELECT * FROM automation_rules 
        WHERE is_active = 1
        ORDER BY priority DESC, rule_name ASC
      `);
      return stmt.all() as AutomationRule[];
    } catch (error) {
      logger.error("Error getting active rules", "AUTOMATION_RULES", { error });
      return [];
    }
  }

  /**
   * Get rule performance metrics
   */
  getRulePerformance(): RulePerformance[] {
    try {
      const stmt = this?.db?.prepare(`
        SELECT 
          ar.id as rule_id,
          ar.rule_name,
          CAST(ar.success_count AS REAL) / NULLIF(ar.executed_count, 0) * 100 as success_rate,
          AVG(re.execution_time_ms) as avg_execution_time,
          ar.executed_count as total_executions,
          COUNT(CASE 
            WHEN re.executed_at >= datetime('now', '-1 day') 
            THEN 1 
          END) as last_24h_executions
        FROM automation_rules ar
        LEFT JOIN rule_executions re ON ar.id = re.rule_id
        GROUP BY ar.id, ar.rule_name, ar.success_count, ar.executed_count
        ORDER BY ar.priority DESC
      `);

      const results = stmt.all() as RulePerformance[];
      return results?.map((r: any) => ({
        ...r,
        success_rate: r.success_rate || 0,
        avg_execution_time: r.avg_execution_time || 0,
      }));
    } catch (error) {
      logger.error("Error getting rule performance", "AUTOMATION_RULES", {
        error,
      });
      return [];
    }
  }

  /**
   * Get rule activity history
   */
  getRuleActivity(days: number = 7): RuleActivity[] {
    try {
      const stmt = this?.db?.prepare(`
        SELECT 
          DATE(re.executed_at) as date,
          ar.id as rule_id,
          ar.rule_name,
          COUNT(*) as executions,
          SUM(CASE WHEN re.status = 'SUCCESS' THEN 1 ELSE 0 END) as successes,
          SUM(CASE WHEN re.status = 'FAILURE' THEN 1 ELSE 0 END) as failures
        FROM rule_executions re
        JOIN automation_rules ar ON re.rule_id = ar.id
        WHERE re.executed_at >= datetime('now', '-' || ? || ' days')
        GROUP BY DATE(re.executed_at), ar.id, ar.rule_name
        ORDER BY date DESC, ar.priority DESC
      `);

      return stmt.all(days) as RuleActivity[];
    } catch (error) {
      logger.error("Error getting rule activity", "AUTOMATION_RULES", {
        error,
      });
      return [];
    }
  }

  /**
   * Update rule status (enable/disable)
   */
  updateRuleStatus(ruleId: number, isActive: boolean): boolean {
    try {
      const stmt = this?.db?.prepare(`
        UPDATE automation_rules 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(isActive ? 1 : 0, ruleId);

      if (result.changes > 0) {
        logger.info("Rule status updated", "AUTOMATION_RULES", {
          ruleId,
          isActive,
        });
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error updating rule status", "AUTOMATION_RULES", {
        error,
        ruleId,
      });
      return false;
    }
  }

  /**
   * Create a new automation rule
   */
  createRule(
    rule: Omit<
      AutomationRule,
      | "id"
      | "created_at"
      | "updated_at"
      | "executed_count"
      | "success_count"
      | "last_executed"
    >,
  ): number | null {
    try {
      const stmt = this?.db?.prepare(`
        INSERT INTO automation_rules (
          rule_name, rule_type, conditions, actions, priority, is_active
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        rule.rule_name,
        rule.rule_type,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.priority,
        rule.is_active ? 1 : 0,
      );

      logger.info("Rule created", "AUTOMATION_RULES", {
        ruleId: result.lastInsertRowid,
      });
      return result.lastInsertRowid as number;
    } catch (error) {
      logger.error("Error creating rule", "AUTOMATION_RULES", { error, rule });
      return null;
    }
  }

  /**
   * Update an existing rule
   */
  updateRule(
    ruleId: number,
    updates: Partial<
      Omit<
        AutomationRule,
        | "id"
        | "created_at"
        | "executed_count"
        | "success_count"
        | "last_executed"
      >
    >,
  ): boolean {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.rule_name !== undefined) {
        fields.push("rule_name = ?");
        values.push(updates.rule_name);
      }
      if (updates.rule_type !== undefined) {
        fields.push("rule_type = ?");
        values.push(updates.rule_type);
      }
      if (updates.conditions !== undefined) {
        fields.push("conditions = ?");
        values.push(JSON.stringify(updates.conditions));
      }
      if (updates.actions !== undefined) {
        fields.push("actions = ?");
        values.push(JSON.stringify(updates.actions));
      }
      if (updates.priority !== undefined) {
        fields.push("priority = ?");
        values.push(updates.priority);
      }
      if (updates.is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(updates.is_active ? 1 : 0);
      }

      if (fields?.length || 0 === 0) return false;

      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(ruleId);

      const stmt = this?.db?.prepare(`
        UPDATE automation_rules 
        SET ${fields.join(", ")}
        WHERE id = ?
      `);

      const result = stmt.run(...values);

      if (result.changes > 0) {
        logger.info("Rule updated", "AUTOMATION_RULES", { ruleId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error updating rule", "AUTOMATION_RULES", {
        error,
        ruleId,
      });
      return false;
    }
  }

  /**
   * Delete a rule
   */
  deleteRule(ruleId: number): boolean {
    try {
      const stmt = this?.db?.prepare("DELETE FROM automation_rules WHERE id = ?");
      const result = stmt.run(ruleId);

      if (result.changes > 0) {
        logger.info("Rule deleted", "AUTOMATION_RULES", { ruleId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Error deleting rule", "AUTOMATION_RULES", {
        error,
        ruleId,
      });
      return false;
    }
  }

  /**
   * Get rule execution history
   */
  getRuleExecutionHistory(ruleId: number, limit: number = 100): any[] {
    try {
      const stmt = this?.db?.prepare(`
        SELECT 
          re.*,
          e.subject as email_subject,
          e.sender as email_sender
        FROM rule_executions re
        JOIN emails e ON re.email_id = e.id
        WHERE re.rule_id = ?
        ORDER BY re.executed_at DESC
        LIMIT ?
      `);

      return stmt.all(ruleId, limit);
    } catch (error) {
      logger.error("Error getting execution history", "AUTOMATION_RULES", {
        error,
        ruleId,
      });
      return [];
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this?.db?.close();
      logger.info("Database connection closed", "AUTOMATION_RULES");
    } catch (error) {
      logger.error("Error closing database connection", "AUTOMATION_RULES", {
        error,
      });
    }
  }
}
