#!/usr/bin/env tsx
/**
 * Create optimized SQL views for workflow analytics dashboard
 * These views provide pre-aggregated data for fast dashboard loading
 */

import Database from "better-sqlite3";
import chalk from "chalk";

function createAnalyticsViews() {
  console.log(chalk.blue("📊 Creating Workflow Analytics Views...\n"));

  const db = new Database("./data/crewai.db");

  try {
    // Drop existing views to recreate with optimizations
    console.log(chalk.yellow("Dropping existing views..."));
    db.exec(`
      DROP VIEW IF EXISTS executive_metrics_v2;
      DROP VIEW IF EXISTS category_performance_v2;
      DROP VIEW IF EXISTS owner_workload_v2;
      DROP VIEW IF EXISTS sla_performance_v2;
      DROP VIEW IF EXISTS workflow_trends_v2;
      DROP VIEW IF EXISTS real_time_metrics;
    `);

    // 1. Executive Metrics View (Optimized for dashboard)
    console.log(chalk.cyan("Creating executive_metrics_v2..."));
    db.exec(`
      CREATE VIEW executive_metrics_v2 AS
      WITH recent_tasks AS (
        SELECT * FROM workflow_tasks 
        WHERE created_at > datetime('now', '-30 days')
      )
      SELECT 
        -- Task Counts
        COUNT(*) as total_tasks,
        SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_tasks,
        SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_tasks,
        SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_tasks,
        SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
        
        -- Financial Metrics
        SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as revenue_at_risk,
        SUM(CASE WHEN task_status != 'COMPLETED' THEN dollar_value ELSE 0 END) as active_revenue,
        SUM(dollar_value) as total_revenue,
        
        -- SLA Metrics
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
             AND task_status != 'COMPLETED' THEN 1 END) as sla_violations,
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now', '+24 hours') 
             AND datetime(sla_deadline) > datetime('now')
             AND task_status != 'COMPLETED' THEN 1 END) as sla_warning_24h,
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now', '+4 hours') 
             AND datetime(sla_deadline) > datetime('now')
             AND task_status != 'COMPLETED' THEN 1 END) as sla_critical_4h,
        
        -- Efficiency Metrics
        AVG(CASE WHEN task_status = 'COMPLETED' 
            THEN julianday(completion_date) - julianday(created_at) 
            ELSE NULL END) as avg_completion_days,
        COUNT(CASE WHEN task_status = 'COMPLETED' 
              AND datetime(completion_date) <= datetime(sla_deadline) 
              THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN task_status = 'COMPLETED' THEN 1 END), 0) as sla_met_percentage,
        
        -- Time-based Metrics
        COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as tasks_last_24h,
        COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as tasks_last_7d,
        
        -- Priority Distribution
        SUM(CASE WHEN priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_priority_count,
        SUM(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END) as high_priority_count,
        
        -- Last Update
        datetime('now') as calculated_at
      FROM recent_tasks;
    `);
    console.log(chalk.green("✓ executive_metrics_v2 created"));

    // 2. Category Performance View
    console.log(chalk.cyan("Creating category_performance_v2..."));
    db.exec(`
      CREATE VIEW category_performance_v2 AS
      SELECT 
        workflow_category,
        
        -- Volume Metrics
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as tasks_last_7d,
        
        -- Status Distribution
        SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_count,
        SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_count,
        SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_count,
        SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
        
        -- Financial Metrics
        SUM(dollar_value) as total_value,
        AVG(dollar_value) as avg_value,
        MAX(dollar_value) as max_value,
        SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as value_at_risk,
        
        -- Performance Metrics
        ROUND(SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as completion_rate,
        AVG(CASE WHEN task_status = 'COMPLETED' 
            THEN julianday(completion_date) - julianday(created_at) 
            ELSE NULL END) as avg_completion_days,
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
             AND task_status != 'COMPLETED' THEN 1 END) as sla_violations,
        
        -- Efficiency Score (0-100)
        ROUND(
          (SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) * 50.0 / COUNT(*)) +
          (50.0 - (COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
                   AND task_status != 'COMPLETED' THEN 1 END) * 50.0 / COUNT(*))),
          1
        ) as efficiency_score
        
      FROM workflow_tasks
      WHERE created_at > datetime('now', '-30 days')
      GROUP BY workflow_category
      ORDER BY total_value DESC;
    `);
    console.log(chalk.green("✓ category_performance_v2 created"));

    // 3. Owner Workload View
    console.log(chalk.cyan("Creating owner_workload_v2..."));
    db.exec(`
      CREATE VIEW owner_workload_v2 AS
      SELECT 
        current_owner,
        owner_email,
        
        -- Task Counts
        COUNT(*) as total_active_tasks,
        SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_tasks,
        SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as warning_tasks,
        SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as normal_tasks,
        
        -- Financial Responsibility
        SUM(dollar_value) as total_value_managed,
        SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as critical_value,
        MAX(dollar_value) as highest_value_task,
        
        -- SLA Pressure
        MIN(CASE WHEN task_status != 'COMPLETED' THEN sla_deadline END) as next_deadline,
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now', '+24 hours') 
             AND task_status != 'COMPLETED' THEN 1 END) as due_within_24h,
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
             AND task_status != 'COMPLETED' THEN 1 END) as overdue_tasks,
        
        -- Workload Score (higher = more pressure)
        ROUND(
          (COUNT(*) * 0.3) + 
          (SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) * 10) +
          (SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) * 5) +
          (COUNT(CASE WHEN datetime(sla_deadline) < datetime('now', '+24 hours') 
                 AND task_status != 'COMPLETED' THEN 1 END) * 20),
          1
        ) as workload_score,
        
        -- Category Distribution (JSON)
        json_group_array(DISTINCT workflow_category) as categories_handled
        
      FROM workflow_tasks
      WHERE task_status != 'COMPLETED'
      GROUP BY current_owner, owner_email
      ORDER BY workload_score DESC
      LIMIT 50;
    `);
    console.log(chalk.green("✓ owner_workload_v2 created"));

    // 4. SLA Performance View
    console.log(chalk.cyan("Creating sla_performance_v2..."));
    db.exec(`
      CREATE VIEW sla_performance_v2 AS
      WITH sla_data AS (
        SELECT 
          DATE(sla_deadline) as sla_date,
          task_status,
          CASE 
            WHEN task_status = 'COMPLETED' AND datetime(completion_date) <= datetime(sla_deadline) THEN 'MET'
            WHEN task_status = 'COMPLETED' AND datetime(completion_date) > datetime(sla_deadline) THEN 'MISSED'
            WHEN task_status != 'COMPLETED' AND datetime(sla_deadline) < datetime('now') THEN 'VIOLATED'
            WHEN task_status != 'COMPLETED' AND datetime(sla_deadline) >= datetime('now') THEN 'PENDING'
          END as sla_status,
          workflow_category,
          dollar_value
        FROM workflow_tasks
        WHERE sla_deadline IS NOT NULL
          AND DATE(sla_deadline) >= DATE('now', '-30 days')
      )
      SELECT 
        sla_date,
        COUNT(*) as total_slas,
        SUM(CASE WHEN sla_status = 'MET' THEN 1 ELSE 0 END) as met_count,
        SUM(CASE WHEN sla_status = 'MISSED' THEN 1 ELSE 0 END) as missed_count,
        SUM(CASE WHEN sla_status = 'VIOLATED' THEN 1 ELSE 0 END) as violated_count,
        SUM(CASE WHEN sla_status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
        
        -- Performance Rate
        ROUND(SUM(CASE WHEN sla_status = 'MET' THEN 1 ELSE 0 END) * 100.0 / 
              NULLIF(SUM(CASE WHEN sla_status IN ('MET', 'MISSED', 'VIOLATED') THEN 1 ELSE 0 END), 0), 1) as sla_performance_rate,
        
        -- Financial Impact
        SUM(CASE WHEN sla_status IN ('MISSED', 'VIOLATED') THEN dollar_value ELSE 0 END) as value_impacted,
        
        -- Category with most violations
        (SELECT workflow_category 
         FROM sla_data sd2 
         WHERE sd2.sla_date = sla_data.sla_date 
           AND sd2.sla_status IN ('MISSED', 'VIOLATED')
         GROUP BY workflow_category 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as worst_performing_category
         
      FROM sla_data
      GROUP BY sla_date
      ORDER BY sla_date DESC;
    `);
    console.log(chalk.green("✓ sla_performance_v2 created"));

    // 5. Workflow Trends View (Time Series)
    console.log(chalk.cyan("Creating workflow_trends_v2..."));
    db.exec(`
      CREATE VIEW workflow_trends_v2 AS
      WITH daily_data AS (
        SELECT 
          DATE(created_at) as task_date,
          workflow_category,
          task_status,
          priority,
          dollar_value,
          CASE 
            WHEN task_status = 'COMPLETED' THEN julianday(completion_date) - julianday(created_at)
            ELSE NULL 
          END as completion_time_days
        FROM workflow_tasks
        WHERE created_at > datetime('now', '-90 days')
      )
      SELECT 
        task_date,
        
        -- Volume Trends
        COUNT(*) as new_tasks,
        SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
        
        -- Status Distribution Trends
        SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_tasks,
        SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_tasks,
        SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_tasks,
        
        -- Priority Trends
        SUM(CASE WHEN priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_priority,
        SUM(CASE WHEN priority = 'HIGH' THEN 1 ELSE 0 END) as high_priority,
        
        -- Financial Trends
        SUM(dollar_value) as daily_value,
        AVG(dollar_value) as avg_task_value,
        
        -- Performance Trends
        AVG(completion_time_days) as avg_completion_time,
        
        -- Running Averages (7-day)
        AVG(COUNT(*)) OVER (ORDER BY task_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as tasks_7d_avg,
        AVG(SUM(dollar_value)) OVER (ORDER BY task_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as value_7d_avg
        
      FROM daily_data
      GROUP BY task_date
      ORDER BY task_date DESC;
    `);
    console.log(chalk.green("✓ workflow_trends_v2 created"));

    // 6. Real-time Metrics View (For WebSocket updates)
    console.log(chalk.cyan("Creating real_time_metrics..."));
    db.exec(`
      CREATE VIEW real_time_metrics AS
      SELECT 
        -- Current Status Snapshot
        COUNT(CASE WHEN task_status != 'COMPLETED' THEN 1 END) as active_tasks,
        COUNT(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_now,
        SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as value_at_risk_now,
        
        -- Next Hour Pressure
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now', '+1 hour') 
             AND task_status != 'COMPLETED' THEN 1 END) as due_next_hour,
        
        -- Today's Activity
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as tasks_created_today,
        COUNT(CASE WHEN DATE(completion_date) = DATE('now') THEN 1 END) as tasks_completed_today,
        
        -- Current Bottleneck (category with most RED tasks)
        (SELECT workflow_category 
         FROM workflow_tasks 
         WHERE task_status = 'RED' 
         GROUP BY workflow_category 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as primary_bottleneck,
        
        -- Timestamp
        datetime('now') as snapshot_time
        
      FROM workflow_tasks;
    `);
    console.log(chalk.green("✓ real_time_metrics created"));

    // Create indexes for better query performance
    console.log(chalk.yellow("\nCreating performance indexes..."));

    db.exec(`
      -- Composite indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_workflow_status_created 
        ON workflow_tasks(task_status, created_at);
      
      CREATE INDEX IF NOT EXISTS idx_workflow_owner_status 
        ON workflow_tasks(current_owner, task_status);
      
      CREATE INDEX IF NOT EXISTS idx_workflow_sla_status 
        ON workflow_tasks(sla_deadline, task_status);
      
      CREATE INDEX IF NOT EXISTS idx_workflow_category_value 
        ON workflow_tasks(workflow_category, dollar_value);
    `);

    console.log(chalk.green("✓ Performance indexes created"));

    // Verify all views
    console.log(chalk.blue("\n📋 Verifying created views:"));

    const views = db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='view' 
        AND name LIKE '%workflow%' OR name LIKE '%metrics%'
      ORDER BY name
    `,
      )
      .all();

    views.forEach((view) => {
      console.log(chalk.gray(`   - ${view.name}`));
    });

    // Sample query to test performance
    console.log(chalk.blue("\n📊 Testing executive metrics view:"));
    const metrics = db.prepare("SELECT * FROM executive_metrics_v2").get();
    console.log(chalk.gray(`   Total tasks: ${metrics.total_tasks}`));
    console.log(
      chalk.gray(
        `   Revenue at risk: $${metrics.revenue_at_risk?.toLocaleString() || 0}`,
      ),
    );
    console.log(chalk.gray(`   SLA violations: ${metrics.sla_violations}`));
    console.log(chalk.gray(`   Tasks last 24h: ${metrics.tasks_last_24h}`));

    console.log(
      chalk.green("\n✅ All workflow analytics views created successfully!"),
    );
  } catch (error) {
    console.error(chalk.red("❌ Error creating views:"), error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
createAnalyticsViews();
