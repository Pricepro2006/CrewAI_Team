import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc/enhanced-router';
import { EmailStorageService } from '../services/EmailStorageService';
import { logger } from '../../utils/logger';

// Initialize email storage service
const emailStorage = new EmailStorageService();
// Start SLA monitoring
emailStorage.startSLAMonitoring();

// Input validation schemas - Enhanced for table view (Agent 10)
const GetEmailsTableInputSchema = z.object({
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(1).max(100).optional().default(50),
  sortBy: z.enum(['received_date', 'subject', 'requested_by', 'status', 'priority']).optional().default('received_date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  filters: z.object({
    status: z.array(z.enum(['red', 'yellow', 'green'])).optional(),
    emailAlias: z.array(z.string()).optional(),
    workflowState: z.array(z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION'])).optional(),
    priority: z.array(z.enum(['Critical', 'High', 'Medium', 'Low'])).optional(),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime()
    }).optional()
  }).optional(),
  search: z.string().optional(),
  refreshKey: z.number().optional()
});

const GetEmailsInputSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  workflow: z.string().optional(),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  status: z.string().optional(),
  slaStatus: z.enum(['on-track', 'at-risk', 'overdue']).optional(),
  search: z.string().optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional(),
  refreshKey: z.number().optional()
});

const GetEmailByIdInputSchema = z.object({
  id: z.string().uuid()
});

const UpdateWorkflowStateInputSchema = z.object({
  emailId: z.string().uuid(),
  newState: z.enum(['New', 'In Review', 'In Progress', 'Pending External', 'Completed', 'Archived'])
});

const BulkUpdateInputSchema = z.object({
  emailIds: z.array(z.string().uuid()),
  action: z.enum(['mark-read', 'archive', 'set-priority', 'change-state']),
  value: z.string().optional()
});

// Enhanced batch operations schemas (Agent 10)
const BatchCreateEmailsInputSchema = z.object({
  emails: z.array(z.object({
    messageId: z.string(),
    emailAlias: z.string().email(),
    requestedBy: z.string(),
    subject: z.string(),
    summary: z.string(),
    status: z.enum(['red', 'yellow', 'green']),
    statusText: z.string(),
    workflowState: z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION']),
    workflowType: z.string().optional(),
    priority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
    receivedDate: z.date().optional(),
    entities: z.array(z.object({
      type: z.string(),
      value: z.string()
    })).optional()
  })),
  batchId: z.string().optional()
});

const BatchUpdateStatusInputSchema = z.object({
  updates: z.array(z.object({
    emailId: z.string().uuid(),
    status: z.enum(['red', 'yellow', 'green']),
    statusText: z.string(),
    workflowState: z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION']).optional()
  })),
  changedBy: z.string().optional()
});

const BatchDeleteInputSchema = z.object({
  emailIds: z.array(z.string().uuid()),
  softDelete: z.boolean().optional().default(true),
  reason: z.string().optional()
});

const SendEmailInputSchema = z.object({
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  template: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string()
  })).optional()
});

export const emailRouter = router({
  // Get table data with advanced filtering, pagination, and sorting (Agent 10)
  getTableData: publicProcedure
    .input(GetEmailsTableInputSchema)
    .query(async ({ input }) => {
      try {
        logger.info('Fetching table data', 'EMAIL_ROUTER', { 
          page: input.page,
          pageSize: input.pageSize,
          sortBy: input.sortBy,
          filters: input.filters,
          search: input.search
        });
        
        const result = await emailStorage.getEmailsForTableView(input);
        
        // Broadcast table data update for real-time synchronization
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailTableDataUpdated(result.emails.length, input);
        } catch (error) {
          logger.error('Failed to broadcast table data update', 'EMAIL_ROUTER', { error });
        }
        
        return {
          success: true,
          data: result
        };
      } catch (error) {
        logger.error('Failed to fetch table data', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch table data');
      }
    }),

  // Get dashboard statistics with cache support (Agent 10)
  getDashboardStats: publicProcedure
    .input(z.object({
      refreshKey: z.number().optional()
    }))
    .query(async ({ input: _input }) => {
      try {
        logger.info('Fetching dashboard statistics', 'EMAIL_ROUTER');
        
        const stats = await emailStorage.getDashboardStats();
        
        // Broadcast stats update for real-time dashboard sync
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailStatsUpdated({
            total: stats.totalEmails,
            critical: stats.criticalCount,
            inProgress: stats.inProgressCount,
            completed: stats.completedCount
          });
        } catch (error) {
          logger.error('Failed to broadcast stats update', 'EMAIL_ROUTER', { error });
        }
        
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        logger.error('Failed to fetch dashboard statistics', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch dashboard statistics');
      }
    }),

  // Get email analytics
  getAnalytics: publicProcedure
    .input(z.object({
      refreshKey: z.number().optional()
    }))
    .query(async ({ input: _input }) => {
      try {
        logger.info('Fetching email analytics', 'EMAIL_ROUTER');
        
        const analytics = await emailStorage.getWorkflowAnalytics();
        
        // Broadcast analytics update for real-time dashboard updates
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailAnalyticsUpdated(
            analytics.totalEmails,
            analytics.workflowDistribution,
            analytics.slaCompliance,
            analytics.averageProcessingTime
          );
        } catch (error) {
          logger.error('Failed to broadcast analytics update', 'EMAIL_ROUTER', { error });
        }
        
        return {
          success: true,
          data: analytics
        };
      } catch (error) {
        logger.error('Failed to fetch email analytics', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch email analytics');
      }
    }),

  // Get filtered email list
  getList: publicProcedure
    .input(GetEmailsInputSchema)
    .query(async ({ input }) => {
      try {
        logger.info('Fetching email list', 'EMAIL_ROUTER', { filters: input });
        
        let emails: any[] = [];
        
        if (input.workflow) {
          emails = await emailStorage.getEmailsByWorkflow(
            input.workflow,
            input.limit,
            input.offset
          );
        } else {
          // For now, return empty array - this would be replaced with actual filtering logic
          emails = [];
        }
        
        // Apply additional filters
        if (input.search) {
          emails = emails.filter((email: any) => 
            email.subject.toLowerCase().includes(input.search!.toLowerCase()) ||
            email.from.emailAddress.address.toLowerCase().includes(input.search!.toLowerCase()) ||
            email.from.emailAddress.name.toLowerCase().includes(input.search!.toLowerCase())
          );
        }
        
        if (input.priority) {
          emails = emails.filter((email: any) => 
            email.analysis?.quick_priority === input.priority
          );
        }
        
        if (input.status) {
          emails = emails.filter((email: any) => 
            email.analysis?.workflow_state === input.status
          );
        }
        
        if (input.slaStatus) {
          emails = emails.filter((email: any) => 
            email.analysis?.action_sla_status === input.slaStatus
          );
        }
        
        if (input.dateRange) {
          emails = emails.filter(email => {
            const emailDate = new Date(email.receivedDateTime);
            return emailDate >= input.dateRange!.start && emailDate <= input.dateRange!.end;
          });
        }
        
        return {
          success: true,
          data: emails
        };
      } catch (error) {
        logger.error('Failed to fetch email list', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch email list');
      }
    }),

  // Get email by ID
  getById: publicProcedure
    .input(GetEmailByIdInputSchema)
    .query(async ({ input }) => {
      try {
        logger.info('Fetching email by ID', 'EMAIL_ROUTER', { id: input.id });
        
        const email = await emailStorage.getEmailWithAnalysis(input.id);
        
        if (!email) {
          throw new Error('Email not found');
        }
        
        return {
          success: true,
          data: email
        };
      } catch (error) {
        logger.error('Failed to fetch email by ID', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch email');
      }
    }),

  // Update workflow state
  updateWorkflowState: protectedProcedure
    .input(UpdateWorkflowStateInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Updating workflow state', 'EMAIL_ROUTER', { 
          emailId: input.emailId, 
          newState: input.newState 
        });
        
        // Pass user context as changedBy for WebSocket broadcast
        const changedBy = (ctx.user as any)?.email || (ctx.user as any)?.name || 'system';
        await emailStorage.updateWorkflowState(input.emailId, input.newState, changedBy);
        
        return {
          success: true,
          message: 'Workflow state updated successfully'
        };
      } catch (error) {
        logger.error('Failed to update workflow state', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to update workflow state');
      }
    }),

  // Bulk update emails
  bulkUpdate: protectedProcedure
    .input(BulkUpdateInputSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('Performing bulk update', 'EMAIL_ROUTER', { 
          emailIds: input.emailIds, 
          action: input.action,
          value: input.value
        });
        
        // Process bulk actions
        const results = [];
        
        for (const emailId of input.emailIds) {
          try {
            switch (input.action) {
              case 'mark-read':
                // TODO: Implement mark as read functionality
                break;
              case 'archive':
                await emailStorage.updateWorkflowState(emailId, 'Archived');
                break;
              case 'set-priority':
                // TODO: Implement priority update functionality
                break;
              case 'change-state':
                if (input.value) {
                  await emailStorage.updateWorkflowState(emailId, input.value);
                }
                break;
            }
            results.push({ emailId, success: true });
          } catch (error) {
            logger.error('Failed to process bulk action for email', 'EMAIL_ROUTER', { 
              emailId, 
              error: error instanceof Error ? error.message : String(error)
            });
            results.push({ emailId, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        // Broadcast bulk update completion
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailBulkUpdate(
            input.action,
            input.emailIds,
            {
              successful: successCount,
              failed: failureCount,
              total: results.length
            }
          );
        } catch (error) {
          logger.error('Failed to broadcast bulk update completion', 'EMAIL_ROUTER', { error: String(error) });
        }
        
        return {
          success: true,
          data: {
            processed: results.length,
            successful: successCount,
            failed: failureCount,
            results
          }
        };
      } catch (error) {
        logger.error('Failed to perform bulk update', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to perform bulk update');
      }
    }),

  // Send email
  sendEmail: protectedProcedure
    .input(SendEmailInputSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('Sending email', 'EMAIL_ROUTER', { 
          to: input.to.length,
          subject: input.subject,
          template: input.template
        });
        
        // TODO: Implement actual email sending functionality
        // This would integrate with Microsoft Graph API or SMTP service
        
        // For now, just log the email data
        logger.info('Email would be sent', 'EMAIL_ROUTER', {
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          priority: input.priority,
          template: input.template,
          hasAttachments: input.attachments && input.attachments.length > 0
        });
        
        return {
          success: true,
          data: {
            messageId: `mock-${Date.now()}`,
            sentAt: new Date().toISOString(),
            recipients: input.to.length + (input.cc?.length || 0) + (input.bcc?.length || 0)
          }
        };
      } catch (error) {
        logger.error('Failed to send email', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to send email');
      }
    }),

  // Get workflow patterns
  getWorkflowPatterns: publicProcedure
    .query(async () => {
      try {
        logger.info('Fetching workflow patterns', 'EMAIL_ROUTER');
        
        const patterns = await emailStorage.getWorkflowPatterns();
        
        return {
          success: true,
          data: patterns
        };
      } catch (error) {
        logger.error('Failed to fetch workflow patterns', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch workflow patterns');
      }
    }),

  // Get email statistics for dashboard
  getStats: publicProcedure
    .query(async () => {
      try {
        logger.info('Fetching email statistics', 'EMAIL_ROUTER');
        
        const analytics = await emailStorage.getWorkflowAnalytics();
        
        // Calculate additional stats
        const stats = {
          ...analytics,
          todayStats: {
            received: 0, // TODO: Calculate today's emails
            processed: 0, // TODO: Calculate today's processed emails
            overdue: analytics.slaCompliance['overdue'] || 0,
            critical: 0 // TODO: Calculate today's critical emails
          }
        };
        
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        logger.error('Failed to fetch email statistics', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch email statistics');
      }
    }),

  // Enhanced search with advanced filtering (Agent 10)
  searchAdvanced: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      page: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(50),
      searchFields: z.array(z.enum(['subject', 'summary', 'requestedBy', 'emailAlias', 'entities'])).optional().default(['subject', 'summary']),
      filters: z.object({
        status: z.array(z.enum(['red', 'yellow', 'green'])).optional(),
        emailAlias: z.array(z.string()).optional(),
        workflowState: z.array(z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION'])).optional(),
        priority: z.array(z.enum(['Critical', 'High', 'Medium', 'Low'])).optional(),
        workflowType: z.array(z.string()).optional(),
        dateRange: z.object({
          start: z.string().datetime(),
          end: z.string().datetime()
        }).optional(),
        entityTypes: z.array(z.string()).optional()
      }).optional(),
      sortBy: z.enum(['relevance', 'received_date', 'subject', 'status']).optional().default('relevance'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      includeHighlight: z.boolean().optional().default(true)
    }))
    .query(async ({ input }) => {
      try {
        logger.info('Performing advanced search', 'EMAIL_ROUTER', { 
          query: input.query,
          searchFields: input.searchFields,
          filters: input.filters,
          page: input.page
        });
        
        // Use table view method with search parameter for now
        // TODO: Implement specialized full-text search with ranking
        const searchParams = {
          page: input.page,
          pageSize: input.pageSize,
          sortBy: input.sortBy === 'relevance' ? 'received_date' : input.sortBy,
          sortOrder: input.sortOrder,
          filters: input.filters,
          search: input.query
        };
        
        const result = await emailStorage.getEmailsForTableView(searchParams);
        
        // Enhance results with search metadata
        const enhancedResult = {
          ...result,
          searchMetadata: {
            query: input.query,
            searchFields: input.searchFields,
            totalMatches: result.totalCount,
            searchTime: Date.now(), // Simple timing
            relevanceScoring: input.sortBy === 'relevance'
          }
        };
        
        return {
          success: true,
          data: enhancedResult
        };
      } catch (error) {
        logger.error('Failed to perform advanced search', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to perform advanced search');
      }
    }),

  // Search emails (legacy endpoint)
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).optional().default(20),
      filters: z.object({
        workflow: z.string().optional(),
        priority: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
        status: z.string().optional(),
        slaStatus: z.enum(['on-track', 'at-risk', 'overdue']).optional(),
        dateRange: z.object({
          start: z.date(),
          end: z.date()
        }).optional()
      }).optional()
    }))
    .query(async ({ input }) => {
      try {
        logger.info('Searching emails (legacy)', 'EMAIL_ROUTER', { 
          query: input.query,
          filters: input.filters
        });
        
        // Forward to advanced search with compatibility mapping
        const advancedParams = {
          query: input.query,
          pageSize: input.limit,
          filters: {
            priority: input.filters?.priority ? [input.filters.priority] : undefined,
            workflowState: input.filters?.status ? [input.filters.status as any] : undefined
          }
        };
        
        const result = await emailStorage.getEmailsForTableView(advancedParams);
        
        return {
          success: true,
          data: {
            emails: result.emails,
            total: result.totalCount,
            query: input.query,
            filters: input.filters
          }
        };
      } catch (error) {
        logger.error('Failed to search emails', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to search emails');
      }
    }),

  // Batch create emails from IEMS data (Agent 10)
  batchCreateEmails: protectedProcedure
    .input(BatchCreateEmailsInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Batch creating emails', 'EMAIL_ROUTER', { 
          emailCount: input.emails.length,
          batchId: input.batchId
        });
        
        const results = [];
        const errors = [];
        
        for (const emailData of input.emails) {
          try {
            const emailId = await emailStorage.createEmail({
              ...emailData,
              receivedDate: emailData.receivedDate || new Date()
            });
            results.push({ emailId, messageId: emailData.messageId, success: true });
          } catch (error) {
            errors.push({ 
              messageId: emailData.messageId, 
              error: error instanceof Error ? error.message : String(error),
              success: false 
            });
            logger.error('Failed to create email in batch', 'EMAIL_ROUTER', { 
              messageId: emailData.messageId,
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        }
        
        // Broadcast batch creation completion
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailBatchCreated(
            input.batchId || `batch_${Date.now()}`,
            results.length,
            errors.length
          );
        } catch (error) {
          logger.error('Failed to broadcast batch creation', 'EMAIL_ROUTER', { error });
        }
        
        return {
          success: true,
          data: {
            created: results.length,
            failed: errors.length,
            total: input.emails.length,
            results,
            errors: errors.length > 0 ? errors : undefined
          }
        };
      } catch (error) {
        logger.error('Failed to batch create emails', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to batch create emails');
      }
    }),

  // Batch update email statuses (Agent 10)
  batchUpdateStatuses: protectedProcedure
    .input(BatchUpdateStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Batch updating email statuses', 'EMAIL_ROUTER', { 
          updateCount: input.updates.length,
          changedBy: input.changedBy
        });
        
        const results = [];
        const errors = [];
        const changedBy = input.changedBy || (ctx.user as any)?.email || 'system';
        
        for (const update of input.updates) {
          try {
            await emailStorage.updateEmailStatus(
              update.emailId,
              update.status,
              update.statusText,
              changedBy
            );
            results.push({ emailId: update.emailId, success: true });
          } catch (error) {
            errors.push({ 
              emailId: update.emailId, 
              error: error instanceof Error ? error.message : String(error),
              success: false 
            });
            logger.error('Failed to update email status in batch', 'EMAIL_ROUTER', { 
              emailId: update.emailId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        // Broadcast batch status update completion
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailBatchStatusUpdated(
            input.updates.map(u => u.emailId),
            results.length,
            errors.length,
            changedBy
          );
        } catch (error) {
          logger.error('Failed to broadcast batch status update', 'EMAIL_ROUTER', { error });
        }
        
        return {
          success: true,
          data: {
            updated: results.length,
            failed: errors.length,
            total: input.updates.length,
            results,
            errors: errors.length > 0 ? errors : undefined
          }
        };
      } catch (error) {
        logger.error('Failed to batch update statuses', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to batch update statuses');
      }
    }),

  // Batch delete emails (Agent 10)
  batchDelete: protectedProcedure
    .input(BatchDeleteInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Batch deleting emails', 'EMAIL_ROUTER', { 
          emailIds: input.emailIds,
          softDelete: input.softDelete,
          reason: input.reason
        });
        
        // For now, use existing bulk update with archive state
        // TODO: Implement proper soft/hard delete functionality
        const results = [];
        const errors = [];
        
        for (const emailId of input.emailIds) {
          try {
            if (input.softDelete) {
              await emailStorage.updateWorkflowState(emailId, 'Archived');
              // TODO: Add audit log for deletion reason
            } else {
              // TODO: Implement hard delete functionality
              logger.warn('Hard delete not implemented, using soft delete', 'EMAIL_ROUTER', { emailId });
              await emailStorage.updateWorkflowState(emailId, 'Archived');
            }
            results.push({ emailId, success: true });
          } catch (error) {
            errors.push({ 
              emailId, 
              error: error instanceof Error ? error.message : String(error),
              success: false 
            });
            logger.error('Failed to delete email in batch', 'EMAIL_ROUTER', { 
              emailId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        // Broadcast batch deletion completion
        try {
          const { wsService } = await import('../services/WebSocketService');
          wsService.broadcastEmailBatchDeleted(
            input.emailIds,
            results.length,
            errors.length,
            input.softDelete
          );
        } catch (error) {
          logger.error('Failed to broadcast batch deletion', 'EMAIL_ROUTER', { error });
        }
        
        return {
          success: true,
          data: {
            deleted: results.length,
            failed: errors.length,
            total: input.emailIds.length,
            softDelete: input.softDelete,
            results,
            errors: errors.length > 0 ? errors : undefined
          }
        };
      } catch (error) {
        logger.error('Failed to batch delete emails', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to batch delete emails');
      }
    }),

  // Get table metadata for frontend configuration (Agent 10)
  getTableMetadata: publicProcedure
    .query(async () => {
      try {
        logger.info('Fetching table metadata', 'EMAIL_ROUTER');
        
        // Return configuration data for table setup
        const metadata = {
          columns: [
            { 
              key: 'status', 
              label: 'Status', 
              type: 'status-indicator',
              sortable: false,
              filterable: true,
              width: 80
            },
            { 
              key: 'emailAlias', 
              label: 'Email Alias', 
              type: 'email',
              sortable: true,
              filterable: true,
              width: 200
            },
            { 
              key: 'requestedBy', 
              label: 'Requested By', 
              type: 'text',
              sortable: true,
              filterable: false,
              width: 150
            },
            { 
              key: 'subject', 
              label: 'Subject', 
              type: 'text',
              sortable: true,
              filterable: false,
              width: 300
            },
            { 
              key: 'summary', 
              label: 'Summary', 
              type: 'text',
              sortable: false,
              filterable: false,
              width: 350
            },
            { 
              key: 'priority', 
              label: 'Priority', 
              type: 'badge',
              sortable: true,
              filterable: true,
              width: 100
            },
            { 
              key: 'workflowState', 
              label: 'Workflow', 
              type: 'badge',
              sortable: true,
              filterable: true,
              width: 120
            },
            { 
              key: 'receivedDate', 
              label: 'Received', 
              type: 'datetime',
              sortable: true,
              filterable: true,
              width: 150
            }
          ],
          filterOptions: {
            status: [
              { value: 'red', label: 'Critical', color: '#EF4444' },
              { value: 'yellow', label: 'Warning', color: '#F59E0B' },
              { value: 'green', label: 'Success', color: '#10B981' }
            ],
            priority: [
              { value: 'Critical', label: 'Critical', color: '#DC2626' },
              { value: 'High', label: 'High', color: '#EA580C' },
              { value: 'Medium', label: 'Medium', color: '#D97706' },
              { value: 'Low', label: 'Low', color: '#65A30D' }
            ],
            workflowState: [
              { value: 'START_POINT', label: 'Start Point', color: '#6366F1' },
              { value: 'IN_PROGRESS', label: 'In Progress', color: '#8B5CF6' },
              { value: 'COMPLETION', label: 'Completion', color: '#10B981' }
            ]
          },
          defaultSort: {
            column: 'receivedDate',
            direction: 'desc'
          },
          pagination: {
            defaultPageSize: 50,
            pageSizeOptions: [25, 50, 100]
          },
          features: {
            search: true,
            filtering: true,
            sorting: true,
            bulkActions: true,
            export: true,
            realTimeUpdates: true
          }
        };
        
        return {
          success: true,
          data: metadata
        };
      } catch (error) {
        logger.error('Failed to fetch table metadata', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to fetch table metadata');
      }
    }),

  // WebSocket subscriptions for real-time updates
  subscribeToEmailUpdates: publicProcedure
    .input(z.object({
      types: z.array(z.string()).optional().default(['email.analyzed', 'email.state_changed', 'email.sla_alert', 'email.analytics_updated'])
    }))
    .subscription(async function* ({ input }) {
      try {
        const { wsService } = await import('../services/WebSocketService');
        const clientId = `email-dashboard-${Date.now()}-${Math.random()}`;
        
        // Subscribe to email-specific message types
        wsService.subscribe(clientId, input.types);
        
        // Create an async generator for the subscription
        const messageQueue: unknown[] = [];
        let resolver: ((value: unknown) => void) | null = null;
        
        const messageHandler = (message: unknown) => {
          if (message && typeof message === 'object' && 'type' in message && input.types.includes((message as any).type)) {
            if (resolver) {
              resolver(message);
              resolver = null;
            } else {
              messageQueue.push(message);
            }
          }
        };
        
        // Listen for email events
        input.types.forEach(type => {
          wsService.on(type, messageHandler);
        });
        
        try {
          while (true) {
            let message;
            if (messageQueue.length > 0) {
              message = messageQueue.shift();
            } else {
              message = await new Promise<unknown>((resolve) => {
                resolver = resolve;
              });
            }
            
            yield {
              type: (message as any).type,
              data: message,
              timestamp: new Date().toISOString()
            };
          }
        } finally {
          // Clean up
          input.types.forEach(type => {
            wsService.off(type, messageHandler);
          });
          wsService.unsubscribe(clientId, input.types);
        }
      } catch (error) {
        logger.error('WebSocket subscription error', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to establish WebSocket subscription');
      }
    })
});

export type EmailRouter = typeof emailRouter;