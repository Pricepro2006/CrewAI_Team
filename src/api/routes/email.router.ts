import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc/enhanced-router';
import { EmailStorageService } from '../services/EmailStorageService';
import { logger } from '../../utils/logger';

// Initialize email storage service
const emailStorage = new EmailStorageService();
// Start SLA monitoring
emailStorage.startSLAMonitoring();

// Input validation schemas
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
              error 
            });
            results.push({ emailId, success: false, error: error.message });
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

  // Search emails
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
        logger.info('Searching emails', 'EMAIL_ROUTER', { 
          query: input.query,
          filters: input.filters
        });
        
        // TODO: Implement full-text search functionality
        // This would search through email subjects, bodies, and analysis data
        
        return {
          success: true,
          data: {
            emails: [],
            total: 0,
            query: input.query,
            filters: input.filters
          }
        };
      } catch (error) {
        logger.error('Failed to search emails', 'EMAIL_ROUTER', { error });
        throw new Error('Failed to search emails');
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