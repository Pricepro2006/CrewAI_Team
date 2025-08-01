import { z } from "zod";
import { router, publicProcedure } from "../trpc/router.js";
import type { Router } from "@trpc/server";
import { logger } from "../../utils/logger.js";
import Database from "better-sqlite3";
import { TRPCError } from "@trpc/server";
import { WorkflowWebSocketHandler } from "../../core/websocket/WorkflowWebSocketHandler.js";

// Zod schemas for workflow data
const WorkflowCategory = z.enum([
  "Order Management",
  "Quote Processing",
  "Shipping and Logistics",
  "Vendor Pricing Updates",
  "Returns and RMA",
  "Account Changes",
  "Deal Activations",
  "General Support"
]);

const WorkflowState = z.enum(["START_POINT", "IN_PROGRESS", "COMPLETION"]);
const TaskStatus = z.enum(["RED", "YELLOW", "GREEN", "COMPLETED"]);
const Priority = z.enum(["CRITICAL", "HIGH", "MEDIUM", "NORMAL"]);

const WorkflowTaskSchema = z.object({
  task_id: z.string(),
  email_id: z.string(),
  workflow_category: WorkflowCategory,
  workflow_state: WorkflowState,
  task_status: TaskStatus,
  title: z.string(),
  description: z.string().optional(),
  priority: Priority,
  current_owner: z.string().optional(),
  owner_email: z.string().optional(),
  dollar_value: z.number().default(0),
  sla_deadline: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  completion_date: z.string().optional(),
  confidence_score: z.number().optional(),
  entities: z.object({
    po_numbers: z.array(z.string()).optional(),
    quote_numbers: z.array(z.string()).optional(),
    customers: z.array(z.string()).optional()
  }).optional()
});

export const workflowRouter: Router<any> = router({
  // Get all workflow tasks
  list: publicProcedure
    .input(z.object({
      filter: z.object({
        status: TaskStatus.optional(),
        category: WorkflowCategory.optional(),
        owner: z.string().optional(),
        priority: Priority.optional(),
        dateRange: z.object({
          start: z.string().optional(),
          end: z.string().optional()
        }).optional()
      }).optional(),
      pagination: z.object({
        page: z.number().default(1),
        limit: z.number().default(50).max(100)
      }).optional(),
      sort: z.object({
        field: z.enum(["created_at", "sla_deadline", "dollar_value", "priority"]).default("created_at"),
        direction: z.enum(["asc", "desc"]).default("desc")
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        let query = 'SELECT * FROM workflow_tasks WHERE 1=1';
        const params: any[] = [];
        
        // Apply filters
        if (input.filter?.status) {
          query += ' AND task_status = ?';
          params.push(input.filter.status);
        }
        
        if (input.filter?.category) {
          query += ' AND workflow_category = ?';
          params.push(input.filter.category);
        }
        
        if (input.filter?.owner) {
          query += ' AND current_owner = ?';
          params.push(input.filter.owner);
        }
        
        if (input.filter?.priority) {
          query += ' AND priority = ?';
          params.push(input.filter.priority);
        }
        
        if (input.filter?.dateRange?.start) {
          query += ' AND created_at >= ?';
          params.push(input.filter.dateRange.start);
        }
        
        if (input.filter?.dateRange?.end) {
          query += ' AND created_at <= ?';
          params.push(input.filter.dateRange.end);
        }
        
        // Add sorting
        const sortField = input.sort?.field || 'created_at';
        const sortDirection = input.sort?.direction || 'desc';
        query += ` ORDER BY ${sortField} ${sortDirection.toUpperCase()}`;
        
        // Add pagination
        const page = input.pagination?.page || 1;
        const limit = input.pagination?.limit || 50;
        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        // Execute query
        const tasks = db.prepare(query).all(...params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM workflow_tasks WHERE 1=1';
        const countParams = params.slice(0, -2); // Remove limit and offset
        if (input.filter?.status) countQuery += ' AND task_status = ?';
        if (input.filter?.category) countQuery += ' AND workflow_category = ?';
        if (input.filter?.owner) countQuery += ' AND current_owner = ?';
        if (input.filter?.priority) countQuery += ' AND priority = ?';
        if (input.filter?.dateRange?.start) countQuery += ' AND created_at >= ?';
        if (input.filter?.dateRange?.end) countQuery += ' AND created_at <= ?';
        
        const totalResult = db.prepare(countQuery).get(...countParams) as { total: number };
        
        // Parse entities JSON
        const parsedTasks = tasks.map(task => ({
          ...task,
          entities: task.po_numbers || task.quote_numbers || task.customers ? {
            po_numbers: task.po_numbers ? JSON.parse(task.po_numbers) : [],
            quote_numbers: task.quote_numbers ? JSON.parse(task.quote_numbers) : [],
            customers: task.customers ? JSON.parse(task.customers) : []
          } : undefined
        }));
        
        return {
          tasks: parsedTasks,
          pagination: {
            page,
            limit,
            total: totalResult.total,
            totalPages: Math.ceil(totalResult.total / limit)
          }
        };
      } finally {
        db.close();
      }
    }),
    
  // Get single workflow task
  get: publicProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        const task = db.prepare('SELECT * FROM workflow_tasks WHERE task_id = ?').get(input.taskId);
        
        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Task ${input.taskId} not found`
          });
        }
        
        // Parse entities
        if (task.po_numbers || task.quote_numbers || task.customers) {
          task.entities = {
            po_numbers: task.po_numbers ? JSON.parse(task.po_numbers) : [],
            quote_numbers: task.quote_numbers ? JSON.parse(task.quote_numbers) : [],
            customers: task.customers ? JSON.parse(task.customers) : []
          };
        }
        
        // Get status history
        const history = db.prepare(`
          SELECT * FROM workflow_status_history 
          WHERE task_id = ? 
          ORDER BY changed_at DESC
        `).all(input.taskId);
        
        return {
          task,
          history
        };
      } finally {
        db.close();
      }
    }),
    
  // Update workflow task
  update: publicProcedure
    .input(z.object({
      taskId: z.string(),
      updates: z.object({
        task_status: TaskStatus.optional(),
        workflow_state: WorkflowState.optional(),
        current_owner: z.string().optional(),
        owner_email: z.string().optional(),
        priority: Priority.optional(),
        sla_deadline: z.string().optional(),
        description: z.string().optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        // Get current task
        const currentTask = db.prepare('SELECT * FROM workflow_tasks WHERE task_id = ?').get(input.taskId);
        
        if (!currentTask) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Task ${input.taskId} not found`
          });
        }
        
        // Build update query
        const updates: string[] = [];
        const params: any[] = [];
        
        Object.entries(input.updates).forEach(([key, value]) => {
          if (value !== undefined) {
            updates.push(`${key} = ?`);
            params.push(value);
          }
        });
        
        if (updates.length === 0) {
          return { success: false, message: 'No updates provided' };
        }
        
        // Always update the updated_at timestamp
        updates.push('updated_at = datetime("now")');
        params.push(input.taskId);
        
        // Execute update
        db.prepare(`
          UPDATE workflow_tasks 
          SET ${updates.join(', ')} 
          WHERE task_id = ?
        `).run(...params);
        
        // Log status change if applicable
        if (input.updates.task_status && input.updates.task_status !== currentTask.task_status) {
          db.prepare(`
            INSERT INTO workflow_status_history (
              task_id, old_status, new_status, changed_by, reason, changed_at
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))
          `).run(
            input.taskId,
            currentTask.task_status,
            input.updates.task_status,
            input.updates.current_owner || 'system',
            'Status updated via API'
          );
        }
        
        // Emit WebSocket event if available
        if (ctx.wsManager) {
          const wsHandler = new WorkflowWebSocketHandler(ctx.wsManager);
          
          // Broadcast task updated
          wsHandler.broadcastTaskUpdated(input.taskId, input.updates);
          
          // If status changed, broadcast specific status change event
          if (input.updates.task_status && input.updates.task_status !== currentTask.task_status) {
            wsHandler.broadcastStatusChanged({
              taskId: input.taskId,
              oldStatus: currentTask.task_status,
              newStatus: input.updates.task_status,
              changedBy: input.updates.current_owner || 'system',
              reason: 'Status updated via API'
            });
          }
        }
        
        logger.info('Workflow task updated', 'WORKFLOW', { taskId: input.taskId, updates: input.updates });
        
        return { success: true, taskId: input.taskId };
      } finally {
        db.close();
      }
    }),
    
  // Create new workflow task
  create: publicProcedure
    .input(z.object({
      email_id: z.string(),
      workflow_category: WorkflowCategory,
      workflow_state: WorkflowState.default("START_POINT"),
      task_status: TaskStatus,
      title: z.string(),
      description: z.string().optional(),
      priority: Priority,
      current_owner: z.string(),
      owner_email: z.string().optional(),
      dollar_value: z.number().default(0),
      sla_hours: z.number().default(24),
      entities: z.object({
        po_numbers: z.array(z.string()).optional(),
        quote_numbers: z.array(z.string()).optional(),
        customers: z.array(z.string()).optional()
      }).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        const taskId = `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const slaDeadline = new Date(Date.now() + input.sla_hours * 60 * 60 * 1000).toISOString();
        
        db.prepare(`
          INSERT INTO workflow_tasks (
            task_id, email_id, workflow_category, workflow_state, task_status,
            title, description, priority, current_owner, owner_email,
            dollar_value, created_at, updated_at, sla_deadline,
            po_numbers, quote_numbers, customers
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          input.email_id,
          input.workflow_category,
          input.workflow_state,
          input.task_status,
          input.title,
          input.description || '',
          input.priority,
          input.current_owner,
          input.owner_email || `${input.current_owner.toLowerCase().replace(/\s+/g, '.')}@tdsynnex.com`,
          input.dollar_value,
          now,
          now,
          slaDeadline,
          JSON.stringify(input.entities?.po_numbers || []),
          JSON.stringify(input.entities?.quote_numbers || []),
          JSON.stringify(input.entities?.customers || [])
        );
        
        // Log initial status
        db.prepare(`
          INSERT INTO workflow_status_history (
            task_id, old_status, new_status, changed_by, reason, changed_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          'NEW',
          input.task_status,
          input.current_owner,
          'Task created',
          now
        );
        
        // Emit WebSocket event
        if (ctx.wsManager) {
          const wsHandler = new WorkflowWebSocketHandler(ctx.wsManager);
          wsHandler.broadcastTaskCreated({
            taskId,
            category: input.workflow_category,
            status: input.task_status,
            priority: input.priority,
            owner: input.current_owner,
            value: input.dollar_value
          });
        }
        
        logger.info('Workflow task created', 'WORKFLOW', { taskId, category: input.workflow_category });
        
        return { success: true, taskId };
      } finally {
        db.close();
      }
    }),
    
  // Delete workflow task
  delete: publicProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        // Check if task exists
        const task = db.prepare('SELECT * FROM workflow_tasks WHERE task_id = ?').get(input.taskId);
        
        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Task ${input.taskId} not found`
          });
        }
        
        // Delete task and history
        db.prepare('DELETE FROM workflow_status_history WHERE task_id = ?').run(input.taskId);
        db.prepare('DELETE FROM workflow_tasks WHERE task_id = ?').run(input.taskId);
        
        logger.info('Workflow task deleted', 'WORKFLOW', { taskId: input.taskId });
        
        return { success: true };
      } finally {
        db.close();
      }
    }),
    
  // Get executive metrics
  metrics: publicProcedure
    .query(async ({ ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        const metrics = db.prepare(`
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
        `).get();
        
        const categoryBreakdown = db.prepare(`
          SELECT 
            workflow_category,
            COUNT(*) as count,
            SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_count,
            AVG(dollar_value) as avg_value
          FROM workflow_tasks
          GROUP BY workflow_category
          ORDER BY count DESC
        `).all();
        
        const ownerWorkload = db.prepare(`
          SELECT 
            current_owner,
            COUNT(*) as active_tasks,
            SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as critical_tasks,
            SUM(dollar_value) as total_value
          FROM workflow_tasks
          WHERE task_status != 'COMPLETED'
          GROUP BY current_owner
          ORDER BY critical_tasks DESC, active_tasks DESC
          LIMIT 10
        `).all();
        
        return {
          executive: metrics,
          categories: categoryBreakdown,
          owners: ownerWorkload,
          lastUpdated: new Date().toISOString()
        };
      } finally {
        db.close();
      }
    }),
    
  // Get analytics data
  analytics: publicProcedure
    .input(z.object({
      period: z.enum(["day", "week", "month"]).default("week")
    }))
    .query(async ({ input, ctx }) => {
      const db = new Database('./data/crewai.db');
      
      try {
        let dateFormat: string;
        let dateRange: string;
        
        switch (input.period) {
          case 'day':
            dateFormat = '%Y-%m-%d %H:00:00';
            dateRange = '-24 hours';
            break;
          case 'week':
            dateFormat = '%Y-%m-%d';
            dateRange = '-7 days';
            break;
          case 'month':
            dateFormat = '%Y-%m-%d';
            dateRange = '-30 days';
            break;
        }
        
        const trendData = db.prepare(`
          SELECT 
            strftime('${dateFormat}', created_at) as period,
            COUNT(*) as new_tasks,
            SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
            AVG(dollar_value) as avg_value
          FROM workflow_tasks
          WHERE created_at > datetime('now', '${dateRange}')
          GROUP BY period
          ORDER BY period
        `).all();
        
        const completionRates = db.prepare(`
          SELECT 
            workflow_category,
            COUNT(*) as total,
            SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
            ROUND(SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as completion_rate
          FROM workflow_tasks
          WHERE created_at > datetime('now', '${dateRange}')
          GROUP BY workflow_category
        `).all();
        
        const slaPerformance = db.prepare(`
          SELECT 
            DATE(sla_deadline) as date,
            COUNT(*) as total_slas,
            SUM(CASE WHEN task_status = 'COMPLETED' AND datetime(completion_date) <= datetime(sla_deadline) THEN 1 ELSE 0 END) as met_slas,
            SUM(CASE WHEN datetime(sla_deadline) < datetime('now') AND task_status != 'COMPLETED' THEN 1 ELSE 0 END) as violated_slas
          FROM workflow_tasks
          WHERE sla_deadline > datetime('now', '${dateRange}')
          GROUP BY date
          ORDER BY date
        `).all();
        
        return {
          trends: trendData,
          completionRates,
          slaPerformance,
          period: input.period
        };
      } finally {
        db.close();
      }
    })
});