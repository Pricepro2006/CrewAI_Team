import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../trpc/enhanced-router.js";
// Removed MockEmailStorageService import - using real service only
import { realEmailStorageService } from "../services/RealEmailStorageService.js";
// import { emailStorageAdapter } from "../services/EmailStorageServiceAdapter.js"; // Disabled - conflicts with enhanced DB
// import { UnifiedEmailService } from "../services/UnifiedEmailService.js";
import { emailIntegrationService } from "../services/EmailIntegrationService.js";
// import { simpleAPIProxy } from "../services/SimpleAPIProxy.js";
import { logger } from "../../utils/logger.js";

// Initialize email services
// Use RealEmailStorageService that connects to crewai_enhanced.db
const emailStorage = realEmailStorageService; // Real database connection with enhanced schema
// const unifiedEmailService = new UnifiedEmailService(); // Can't use - wrong database schema
// const unifiedEmailService: UnifiedEmailService | null = null; // Temporary disable until database fixed
// Start SLA monitoring
// emailStorage.startSLAMonitoring(); // Not implemented in RealEmailStorageService yet

// Input validation schemas - Enhanced for table view (Agent 10)
const GetEmailsTableInputSchema = z.object({
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(1).max(100).optional().default(50),
  sortBy: z
    .enum(["received_date", "subject", "requested_by", "status", "priority"])
    .optional()
    .default("received_date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  filters: z
    .object({
      status: z.array(z.enum(["red", "yellow", "green"])).optional(),
      emailAlias: z.array(z.string()).optional(),
      workflowState: z
        .array(z.enum(["START_POINT", "IN_PROGRESS", "COMPLETION"]))
        .optional(),
      priority: z
        .array(z.enum(["critical", "high", "medium", "low"]))
        .optional(),
      dateRange: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
    })
    .optional(),
  search: z.string().optional(),
  refreshKey: z.number().optional(),
});

// Type definition for validated input
type GetEmailsTableInput = z.infer<typeof GetEmailsTableInputSchema>;

const GetEmailsInputSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  workflow: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z.string().optional(),
  slaStatus: z.enum(["on-track", "at-risk", "overdue"]).optional(),
  search: z.string().optional(),
  dateRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),
  refreshKey: z.number().optional(),
});

const GetEmailByIdInputSchema = z.object({
  id: z.string().uuid(),
});

const UpdateWorkflowStateInputSchema = z.object({
  emailId: z.string().uuid(),
  newState: z.enum([
    "New",
    "In Review",
    "In Progress",
    "Pending External",
    "Completed",
    "Archived",
  ]),
});

const BulkUpdateInputSchema = z.object({
  emailIds: z.array(z.string().uuid()),
  action: z.enum(["mark-read", "archive", "set-priority", "change-state"]),
  value: z.string().optional(),
});

// Enhanced batch operations schemas (Agent 10)
const BatchCreateEmailsInputSchema = z.object({
  emails: z.array(
    z.object({
      messageId: z.string(),
      emailAlias: z.string().email(),
      requestedBy: z.string(),
      subject: z.string(),
      summary: z.string(),
      status: z.enum(["red", "yellow", "green"]),
      statusText: z.string(),
      workflowState: z.enum(["START_POINT", "IN_PROGRESS", "COMPLETION"]),
      workflowType: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      receivedDate: z.date().optional(),
      entities: z
        .array(
          z.object({
            type: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  batchId: z.string().optional(),
});

const BatchUpdateStatusInputSchema = z.object({
  updates: z.array(
    z.object({
      emailId: z.string().uuid(),
      status: z.enum(["red", "yellow", "green"]),
      statusText: z.string(),
      workflowState: z
        .enum(["START_POINT", "IN_PROGRESS", "COMPLETION"])
        .optional(),
    }),
  ),
  changedBy: z.string().optional(),
});

const BatchDeleteInputSchema = z.object({
  emailIds: z.array(z.string().uuid()),
  softDelete: z.boolean().optional().default(true),
  reason: z.string().optional(),
});

const SendEmailInputSchema = z.object({
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
  template: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(),
        contentType: z.string(),
      }),
    )
    .optional(),
});

export const emailRouter = router({
  // Get table data with advanced filtering, pagination, and sorting (Agent 10)
  getTableData: publicProcedure
    .input(GetEmailsTableInputSchema)
    .query(async ({ input }) => {
      try {
        logger.info("Fetching table data", "EMAIL_ROUTER", {
          page: input.page,
          pageSize: input.pageSize,
          sortBy: input.sortBy,
          filters: input.filters,
          search: input.search,
        });

        // Convert input to emailStorage-compatible format
        const storageInput: Parameters<typeof emailStorage.getEmailsForTableView>[0] = {
          page: input.page,
          pageSize: input.pageSize,
          sortBy: input.sortBy as string | undefined,
          sortOrder: input.sortOrder,
          filters: input.filters ? {
            status: input.filters.status as string[] | undefined,
            priority: input.filters.priority as string[] | undefined,
            dateRange: input.filters.dateRange ? {
              start: input.filters.dateRange.start,
              end: input.filters.dateRange.end
            } : undefined
          } : undefined,
          search: input.search
        };

        // Use real email storage service to get analyzed emails
        const result = await emailStorage.getEmailsForTableView(storageInput);

        // Broadcast table data update for real-time synchronization
        try {
          const { wsService } = await import('../services/WebSocketService.js');
          if (wsService && typeof wsService.broadcastEmailTableDataUpdated === 'function') {
            wsService.broadcastEmailTableDataUpdated(result?.emails?.length || 0, input);
          }
        } catch (error) {
          logger.debug('WebSocket service not available, skipping broadcast', 'EMAIL_ROUTER');
        }

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error("Failed to fetch table data", "EMAIL_ROUTER", { error });
        throw new Error("Failed to fetch table data");
      }
    }),

  // Get dashboard statistics with cache support (Agent 10)
  getDashboardStats: publicProcedure
    .input(
      z.object({
        refreshKey: z.number().optional(),
      }),
    )
    .query(async ({ input: _input }) => {
      try {
        logger.info("Fetching dashboard statistics", "EMAIL_ROUTER");

        // Use real email storage service to get stats
        const stats = await emailStorage.getDashboardStats();

        // Broadcast stats update for real-time dashboard sync
        try {
          const { wsService } = await import('../services/WebSocketService.js');
          if (wsService && typeof wsService.broadcastEmailStatsUpdated === 'function') {
            wsService.broadcastEmailStatsUpdated({
              total: stats.totalEmails,
              critical: stats.criticalCount,
              inProgress: stats.inProgressCount,
              completed: stats.completedCount
            });
          }
        } catch (error) {
          logger.debug('WebSocket service not available, skipping stats broadcast', 'EMAIL_ROUTER');
        }

        return {
          success: true,
          data: stats,
        };
      } catch (error) {
        logger.error("Failed to fetch dashboard statistics", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to fetch dashboard statistics");
      }
    }),

  // Get email analytics
  getAnalytics: publicProcedure
    .input(
      z.object({
        refreshKey: z.number().optional(),
      }),
    )
    .query(async ({ input: _input }) => {
      try {
        logger.info("Fetching email analytics", "EMAIL_ROUTER");

        // Use real email storage service to get analytics
        const analytics = await emailStorage.getWorkflowAnalytics();

        // Broadcast analytics update for real-time dashboard updates
        try {
          const { wsService } = await import('../services/WebSocketService.js');
          if (wsService && typeof wsService.broadcastEmailAnalyticsUpdated === 'function') {
            wsService.broadcastEmailAnalyticsUpdated(
              analytics.totalEmails,
              analytics.workflowDistribution,
              analytics.slaCompliance,
              analytics.averageProcessingTime
            );
          }
        } catch (error) {
          logger.debug('WebSocket service not available, skipping analytics broadcast', 'EMAIL_ROUTER');
        }

        return {
          success: true,
          data: analytics,
        };
      } catch (error) {
        logger.error("Failed to fetch email analytics", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to fetch email analytics");
      }
    }),

  // Get filtered email list
  getList: publicProcedure
    .input(GetEmailsInputSchema)
    .query(async ({ input }) => {
      try {
        logger.info("Fetching email list", "EMAIL_ROUTER", { filters: input });

        let emails: Array<{
          id: string;
          subject: string;
          from?: { emailAddress: { address: string; name: string } };
          analysis?: {
            quick_priority?: string;
            workflow_state?: string;
            action_sla_status?: string;
          };
          receivedDateTime: string;
        }> = [];

        if (input.workflow) {
          // Get emails by workflow - simplified call
          const allEmails = await emailStorage.getEmailsForTableView({
            page: 1,
            pageSize: input.limit || 50,
            filters: {
              // Map workflow state to status for compatibility
              status: [input.workflow === 'COMPLETION' ? 'green' : input.workflow === 'START_POINT' ? 'red' : 'yellow']
            }
          });
          // Transform the emails to match the expected format
          emails = (allEmails.emails || []).map(email => ({
            id: email.id,
            subject: email.subject,
            from: email.requested_by ? {
              emailAddress: {
                address: email.requested_by,
                name: email.requested_by
              }
            } : undefined,
            analysis: {
              quick_priority: email.priority,
              workflow_state: email.workflow_state,
              action_sla_status: email.status
            },
            receivedDateTime: email.received_date
          }));
        } else {
          // For now, return empty array - this would be replaced with actual filtering logic
          emails = [];
        }

        // Apply additional filters
        if (input.search) {
          emails = emails?.filter(
            (email) =>
              email.subject
                .toLowerCase()
                .includes(input.search!.toLowerCase()) ||
              email.from?.emailAddress?.address
                ?.toLowerCase()
                .includes(input.search!.toLowerCase()) ||
              email.from?.emailAddress?.name
                ?.toLowerCase()
                .includes(input.search!.toLowerCase()),
          );
        }

        if (input.priority) {
          emails = emails?.filter(
            (email) => email.analysis?.quick_priority === input.priority,
          );
        }

        if (input.status) {
          emails = emails?.filter(
            (email) => email.analysis?.workflow_state === input.status,
          );
        }

        if (input.slaStatus) {
          emails = emails?.filter(
            (email) =>
              email.analysis?.action_sla_status === input.slaStatus,
          );
        }

        if (input.dateRange) {
          emails = emails?.filter((email) => {
            const emailDate = new Date(email.receivedDateTime);
            return (
              emailDate >= input.dateRange!.start &&
              emailDate <= input.dateRange!.end
            );
          });
        }

        return {
          success: true,
          data: emails,
        };
      } catch (error) {
        logger.error("Failed to fetch email list", "EMAIL_ROUTER", { error });
        throw new Error("Failed to fetch email list");
      }
    }),

  // Get email by ID
  getById: publicProcedure
    .input(GetEmailByIdInputSchema)
    .query(async ({ input }) => {
      try {
        logger.info("Fetching email by ID", "EMAIL_ROUTER", { id: input.id });

        const email = await emailStorage.getEmailWithAnalysis(input.id);

        if (!email) {
          throw new Error("Email not found");
        }

        return {
          success: true,
          data: email,
        };
      } catch (error) {
        logger.error("Failed to fetch email by ID", "EMAIL_ROUTER", { error });
        throw new Error("Failed to fetch email");
      }
    }),

  // Update workflow state
  updateWorkflowState: protectedProcedure
    .input(UpdateWorkflowStateInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Updating workflow state", "EMAIL_ROUTER", {
          emailId: input.emailId,
          newState: input.newState,
        });

        // Pass user context as changedBy for WebSocket broadcast
        const user = ctx.user;
        const changedBy = user?.email ?? user?.username ?? "system";
        await emailStorage.updateWorkflowState(
          input.emailId,
          input.newState,
          changedBy,
        );

        return {
          success: true,
          message: "Workflow state updated successfully",
        };
      } catch (error) {
        logger.error("Failed to update workflow state", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to update workflow state");
      }
    }),

  // Update email status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["red", "yellow", "green"]),
        status_text: z.string(),
        workflow_state: z
          .enum(["START_POINT", "IN_PROGRESS", "COMPLETION"])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Updating email status", "EMAIL_ROUTER", {
          emailId: input.id,
          status: input.status,
          status_text: input.status_text,
          workflow_state: input.workflow_state,
        });

        const user = ctx.user;
        const changedBy = user?.email ?? user?.username ?? "system";

        // Update the email status
        await emailStorage.updateEmailStatus(
          input.id,
          input.status,
          input.status_text,
          changedBy,
        );

        // If workflow state is provided, update it as well
        if (input.workflow_state) {
          const email = await emailStorage.getEmail(input.id);
          if (email) {
            await emailStorage.updateEmail(input.id, {
              ...email,
              workflow_state: input.workflow_state,
              lastUpdated: new Date().toISOString(),
            });
          }
        }

        // Broadcast the update
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          const updatedEmail = await emailStorage.getEmail(input.id);
          if (updatedEmail) {
            wsService.emitEmailUpdate({
              type: "update",
              email: updatedEmail,
            });
          }
        } catch (error) {
          logger.error("Failed to broadcast email update", "EMAIL_ROUTER", {
            error,
          });
        }

        return {
          success: true,
          message: "Email status updated successfully",
        };
      } catch (error) {
        logger.error("Failed to update email status", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to update email status");
      }
    }),

  // Bulk update emails
  bulkUpdate: protectedProcedure
    .input(BulkUpdateInputSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info("Performing bulk update", "EMAIL_ROUTER", {
          emailIds: input.emailIds,
          action: input.action,
          value: input.value,
        });

        // Process bulk actions
        const results = [];

        for (const emailId of input.emailIds) {
          try {
            switch (input.action) {
              case "mark-read":
                // TODO: Implement mark as read functionality
                break;
              case "archive":
                await emailStorage.updateWorkflowState(emailId, "Archived");
                break;
              case "set-priority":
                // TODO: Implement priority update functionality
                break;
              case "change-state":
                if (input.value) {
                  await emailStorage.updateWorkflowState(emailId, input.value);
                }
                break;
            }
            results.push({ emailId, success: true });
          } catch (error) {
            logger.error(
              "Failed to process bulk action for email",
              "EMAIL_ROUTER",
              {
                emailId,
                error: error instanceof Error ? error.message : String(error),
              },
            );
            results.push({
              emailId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.filter((r) => !r.success).length;

        // Broadcast bulk update completion
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailBulkUpdate(input.action, input.emailIds, {
            successful: successCount,
            failed: failureCount,
            total: results.length,
          });
        } catch (error) {
          logger.error(
            "Failed to broadcast bulk update completion",
            "EMAIL_ROUTER",
            { error: String(error) },
          );
        }

        return {
          success: true,
          data: {
            processed: results.length,
            successful: successCount,
            failed: failureCount,
            results,
          },
        };
      } catch (error) {
        logger.error("Failed to perform bulk update", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to perform bulk update");
      }
    }),

  // Send email
  sendEmail: protectedProcedure
    .input(SendEmailInputSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info("Sending email", "EMAIL_ROUTER", {
          to: input.to.length,
          subject: input.subject,
          template: input.template,
        });

        // TODO: Implement actual email sending functionality
        // This would integrate with Microsoft Graph API or SMTP service

        // For now, just log the email data
        logger.info("Email would be sent", "EMAIL_ROUTER", {
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          priority: input.priority,
          template: input.template,
          hasAttachments: input.attachments && input.attachments.length > 0,
        });

        return {
          success: true,
          data: {
            messageId: `mock-${Date.now()}`,
            sentAt: new Date().toISOString(),
            recipients:
              input.to.length +
              (input.cc?.length ?? 0) +
              (input.bcc?.length ?? 0),
          },
        };
      } catch (error) {
        logger.error("Failed to send email", "EMAIL_ROUTER", { error });
        throw new Error("Failed to send email");
      }
    }),

  // Get workflow patterns
  getWorkflowPatterns: publicProcedure.query(async () => {
    try {
      logger.info("Fetching workflow patterns", "EMAIL_ROUTER");

      const patterns = await emailStorage.getWorkflowPatterns();

      return {
        success: true,
        data: patterns,
      };
    } catch (error) {
      logger.error("Failed to fetch workflow patterns", "EMAIL_ROUTER", {
        error,
      });
      throw new Error("Failed to fetch workflow patterns");
    }
  }),

  // Get email statistics for dashboard
  getStats: publicProcedure.query(async () => {
    try {
      logger.info("Fetching email statistics", "EMAIL_ROUTER");

      const analytics = await emailStorage.getWorkflowAnalytics();

      // Calculate additional stats
      const stats = {
        ...analytics,
        todayStats: {
          received: 0, // TODO: Calculate today's emails
          processed: 0, // TODO: Calculate today's processed emails
          overdue: analytics.slaCompliance["overdue"] || 0,
          critical: 0, // TODO: Calculate today's critical emails
        },
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      logger.error("Failed to fetch email statistics", "EMAIL_ROUTER", {
        error,
      });
      throw new Error("Failed to fetch email statistics");
    }
  }),

  // Get comprehensive business intelligence data
  getBusinessIntelligence: publicProcedure
    .input(
      z.object({
        timeRange: z
          .object({
            start: z.string().datetime(),
            end: z.string().datetime(),
          })
          .optional(),
        customerFilter: z.array(z.string()).optional(),
        workflowFilter: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).optional().default(20),
        useCache: z.boolean().optional().default(true),
      }),
    )
    .query(async ({ input }) => {
      try {
        logger.info("Fetching business intelligence data", "EMAIL_ROUTER", {
          timeRange: input.timeRange,
          filters: { customers: input.customerFilter, workflows: input.workflowFilter },
        });

        // Import the new BusinessIntelligenceService
        const { getBusinessIntelligenceService } = await import(
          "../services/BusinessIntelligenceService.js"
        );
        const biService = getBusinessIntelligenceService();

        // Convert string dates to Date objects
        const options = {
          timeRange: input.timeRange
            ? {
                start: new Date(input?.timeRange?.start),
                end: new Date(input?.timeRange?.end),
              }
            : undefined,
          customerFilter: input.customerFilter,
          workflowFilter: input.workflowFilter,
          limit: input.limit,
          useCache: input.useCache,
        };

        const biData = await biService.getBusinessIntelligence(options);

        return {
          success: true,
          data: biData,
        };
      } catch (error) {
        logger.error("Failed to fetch business intelligence", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to fetch business intelligence data");
      }
    }),

  // Get business intelligence summary (lightweight endpoint)
  getBISummary: publicProcedure
    .input(
      z.object({
        refreshKey: z.number().optional(),
      }),
    )
    .query(async ({ input: _input }) => {
      try {
        logger.info("Fetching BI summary", "EMAIL_ROUTER");

        const { getBusinessIntelligenceService } = await import(
          "../services/BusinessIntelligenceService.js"
        );
        const biService = getBusinessIntelligenceService();

        // Get summary data only
        const biData = await biService.getBusinessIntelligence({
          useCache: true,
        });

        // Return condensed summary
        return {
          success: true,
          data: {
            summary: biData.summary,
            topMetrics: {
              totalValue: biData?.summary?.totalBusinessValue,
              emailsAnalyzed: biData?.summary?.totalEmailsAnalyzed,
              uniqueCustomers: biData?.summary?.uniqueCustomerCount,
              highPriorityRate: biData?.summary?.highPriorityRate,
            },
            recentHighValueItems: biData?.entityExtracts?.recentHighValueItems.slice(0, 5),
            topWorkflows: biData?.workflowDistribution?.slice(0, 3),
            generatedAt: biData.generatedAt,
          },
        };
      } catch (error) {
        logger.error("Failed to fetch BI summary", "EMAIL_ROUTER", { error });
        throw new Error("Failed to fetch business intelligence summary");
      }
    }),

  // Get customer insights
  getCustomerInsights: publicProcedure
    .input(
      z.object({
        customerName: z.string().optional(),
        limit: z.number().min(1).max(50).optional().default(10),
        sortBy: z
          .enum(["emailCount", "totalValue", "lastInteraction"])
          .optional()
          .default("emailCount"),
      }),
    )
    .query(async ({ input }) => {
      try {
        logger.info("Fetching customer insights", "EMAIL_ROUTER", {
          customer: input.customerName,
          limit: input.limit,
        });

        const { getBusinessIntelligenceService } = await import(
          "../services/BusinessIntelligenceService.js"
        );
        const biService = getBusinessIntelligenceService();

        const biData = await biService.getBusinessIntelligence({
          customerFilter: input.customerName ? [input.customerName] : undefined,
          useCache: true,
        });

        // Sort customers based on input
        const sortedCustomers = [...biData.topCustomers].sort((a, b) => {
          switch (input.sortBy) {
            case "totalValue":
              return b.totalValue - a.totalValue;
            case "lastInteraction":
              return new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime();
            default:
              return b.emailCount - a.emailCount;
          }
        });

        return {
          success: true,
          data: {
            customers: sortedCustomers.slice(0, input.limit),
            totalCustomers: biData?.summary?.uniqueCustomerCount,
            metrics: {
              avgEmailsPerCustomer:
                biData?.summary?.totalEmailsAnalyzed / biData?.summary?.uniqueCustomerCount,
              avgValuePerCustomer:
                biData?.summary?.totalBusinessValue / biData?.summary?.uniqueCustomerCount,
            },
          },
        };
      } catch (error) {
        logger.error("Failed to fetch customer insights", "EMAIL_ROUTER", { error });
        throw new Error("Failed to fetch customer insights");
      }
    }),

  // Get value metrics and financial insights
  getValueMetrics: publicProcedure
    .input(
      z.object({
        groupBy: z.enum(["workflow", "priority", "customer", "time"]).optional().default("workflow"),
        timeGranularity: z.enum(["hour", "day", "week", "month"]).optional().default("day"),
        limit: z.number().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      try {
        logger.info("Fetching value metrics", "EMAIL_ROUTER", {
          groupBy: input.groupBy,
          granularity: input.timeGranularity,
        });

        const { getBusinessIntelligenceService } = await import(
          "../services/BusinessIntelligenceService.js"
        );
        const biService = getBusinessIntelligenceService();

        const biData = await biService.getBusinessIntelligence({ useCache: true });

        // Group data based on input
        let groupedData: Array<{
          label: string;
          value: number;
          count: number;
          [key: string]: unknown;
        }> = [];

        switch (input.groupBy) {
          case "workflow":
            groupedData = biData?.workflowDistribution?.map((w: { type: string; totalValue: number; count: number; avgValue: number }) => ({
              label: w.type,
              value: w.totalValue,
              count: w.count,
              avgValue: w.avgValue,
            })) || [];
            break;

          case "priority":
            groupedData = biData?.priorityDistribution?.map((p: { level: string; count: number; percentage: number }) => ({
              label: p.level,
              value: 0, // Would need to enhance BI service to include value by priority
              count: p.count,
              percentage: p.percentage,
            })) || [];
            break;

          case "customer":
            groupedData = biData?.topCustomers?.map((c: any) => ({
              label: c.name,
              value: c.totalValue,
              count: c.emailCount,
              avgResponseTime: c.avgResponseTime,
            }));
            break;

          default:
            // Time-based grouping would require additional implementation
            groupedData = [];
        }

        return {
          success: true,
          data: {
            metrics: groupedData.slice(0, input.limit),
            summary: {
              totalValue: biData?.summary?.totalBusinessValue,
              totalItems: biData?.summary?.totalEmailsAnalyzed,
              uniqueEntities: {
                poNumbers: biData?.summary?.uniquePOCount,
                quoteNumbers: biData?.summary?.uniqueQuoteCount,
                customers: biData?.summary?.uniqueCustomerCount,
              },
            },
            timeRange: biData?.processingMetrics?.timeRange,
          },
        };
      } catch (error) {
        logger.error("Failed to fetch value metrics", "EMAIL_ROUTER", { error });
        throw new Error("Failed to fetch value metrics");
      }
    }),

  // Enhanced search with advanced filtering (Agent 10)
  searchAdvanced: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().min(1).optional().default(1),
        pageSize: z.number().min(1).max(100).optional().default(50),
        searchFields: z
          .array(
            z.enum([
              "subject",
              "summary",
              "requestedBy",
              "emailAlias",
              "entities",
            ]),
          )
          .optional()
          .default(["subject", "summary"]),
        filters: z
          .object({
            status: z.array(z.enum(["red", "yellow", "green"])).optional(),
            emailAlias: z.array(z.string()).optional(),
            workflowState: z
              .array(z.enum(["START_POINT", "IN_PROGRESS", "COMPLETION"]))
              .optional(),
            priority: z
              .array(z.enum(["critical", "high", "medium", "low"]))
              .optional(),
            workflowType: z.array(z.string()).optional(),
            dateRange: z
              .object({
                start: z.string().datetime(),
                end: z.string().datetime(),
              })
              .optional(),
            entityTypes: z.array(z.string()).optional(),
          })
          .optional(),
        sortBy: z
          .enum(["relevance", "received_date", "subject", "status"])
          .optional()
          .default("relevance"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
        includeHighlight: z.boolean().optional().default(true),
      }),
    )
    .query(async ({ input }) => {
      try {
        logger.info("Performing advanced search", "EMAIL_ROUTER", {
          query: input.query,
          searchFields: input.searchFields,
          filters: input.filters,
          page: input.page,
        });

        // Use table view method with search parameter for now
        // TODO: Implement specialized full-text search with ranking
        const searchParams = {
          page: input.page,
          pageSize: input.pageSize,
          sortBy: input.sortBy === "relevance" ? "received_date" : input.sortBy,
          sortOrder: input.sortOrder,
          filters: input.filters,
          search: input.query,
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
            relevanceScoring: input.sortBy === "relevance",
          },
        };

        return {
          success: true,
          data: enhancedResult,
        };
      } catch (error) {
        logger.error("Failed to perform advanced search", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to perform advanced search");
      }
    }),

  // Search emails (legacy endpoint)
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).optional().default(20),
        filters: z
          .object({
            workflow: z.string().optional(),
            priority: z.enum(["critical", "high", "medium", "low"]).optional(),
            status: z.string().optional(),
            slaStatus: z.enum(["on-track", "at-risk", "overdue"]).optional(),
            dateRange: z
              .object({
                start: z.date(),
                end: z.date(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        logger.info("Searching emails (legacy)", "EMAIL_ROUTER", {
          query: input.query,
          filters: input.filters,
        });

        // Forward to advanced search with compatibility mapping
        const advancedParams = {
          query: input.query,
          pageSize: input.limit,
          filters: {
            priority: input.filters?.priority
              ? [input?.filters?.priority]
              : undefined,
            workflowState: input.filters?.status
              ? [input?.filters?.status as any]
              : undefined,
          },
        };

        const result = await emailStorage.getEmailsForTableView(advancedParams);

        return {
          success: true,
          data: {
            emails: result.emails,
            total: result.totalCount,
            query: input.query,
            filters: input.filters,
          },
        };
      } catch (error) {
        logger.error("Failed to search emails", "EMAIL_ROUTER", { error });
        throw new Error("Failed to search emails");
      }
    }),

  // Batch create emails from IEMS data (Agent 10)
  batchCreateEmails: protectedProcedure
    .input(BatchCreateEmailsInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Batch creating emails", "EMAIL_ROUTER", {
          emailCount: input.emails.length,
          batchId: input.batchId,
        });

        const results = [];
        const errors = [];

        for (const emailData of input.emails) {
          try {
            const emailId = await emailStorage.createEmail({
              ...emailData,
              receivedDate: emailData.receivedDate || new Date(),
            });
            results.push({
              emailId,
              messageId: emailData.messageId,
              success: true,
            });
          } catch (error) {
            errors.push({
              messageId: emailData.messageId,
              error: error instanceof Error ? error.message : String(error),
              success: false,
            });
            logger.error("Failed to create email in batch", "EMAIL_ROUTER", {
              messageId: emailData.messageId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Broadcast batch creation completion
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailBatchCreated(
            input.batchId || `batch_${Date.now()}`,
            results?.length || 0,
            errors?.length || 0,
          );
        } catch (error) {
          logger.error("Failed to broadcast batch creation", "EMAIL_ROUTER", {
            error,
          });
        }

        return {
          success: true,
          data: {
            created: results?.length || 0,
            failed: errors?.length || 0,
            total: input.emails.length,
            results,
            errors: errors?.length || 0 > 0 ? errors : undefined,
          },
        };
      } catch (error) {
        logger.error("Failed to batch create emails", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to batch create emails");
      }
    }),

  // Batch update email statuses (Agent 10)
  batchUpdateStatuses: protectedProcedure
    .input(BatchUpdateStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Batch updating email statuses", "EMAIL_ROUTER", {
          updateCount: input.updates.length,
          changedBy: input.changedBy,
        });

        const results = [];
        const errors = [];
        const user = ctx.user;
        const changedBy = input.changedBy || user?.email || user?.username || "system";

        for (const update of input.updates) {
          try {
            await emailStorage.updateEmailStatus(
              update.emailId,
              update.status,
              update.statusText,
              changedBy,
            );
            results.push({ emailId: update.emailId, success: true });
          } catch (error) {
            errors.push({
              emailId: update.emailId,
              error: error instanceof Error ? error.message : String(error),
              success: false,
            });
            logger.error(
              "Failed to update email status in batch",
              "EMAIL_ROUTER",
              {
                emailId: update.emailId,
                error: error instanceof Error ? error.message : String(error),
              },
            );
          }
        }

        // Broadcast batch status update completion
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailBatchStatusUpdated(
            input?.updates?.map((u: any) => u.emailId),
            results?.length || 0,
            errors?.length || 0,
            changedBy,
          );
        } catch (error) {
          logger.error(
            "Failed to broadcast batch status update",
            "EMAIL_ROUTER",
            { error },
          );
        }

        return {
          success: true,
          data: {
            updated: results?.length || 0,
            failed: errors?.length || 0,
            total: input.updates.length,
            results,
            errors: errors?.length || 0 > 0 ? errors : undefined,
          },
        };
      } catch (error) {
        logger.error("Failed to batch update statuses", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to batch update statuses");
      }
    }),

  // Batch delete emails (Agent 10)
  batchDelete: protectedProcedure
    .input(BatchDeleteInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Batch deleting emails", "EMAIL_ROUTER", {
          emailIds: input.emailIds,
          softDelete: input.softDelete,
          reason: input.reason,
        });

        // For now, use existing bulk update with archive state
        // TODO: Implement proper soft/hard delete functionality
        const results = [];
        const errors = [];

        for (const emailId of input.emailIds) {
          try {
            if (input.softDelete) {
              await emailStorage.updateWorkflowState(emailId, "Archived");
              // TODO: Add audit log for deletion reason
            } else {
              // TODO: Implement hard delete functionality
              logger.warn(
                "Hard delete not implemented, using soft delete",
                "EMAIL_ROUTER",
                { emailId },
              );
              await emailStorage.updateWorkflowState(emailId, "Archived");
            }
            results.push({ emailId, success: true });
          } catch (error) {
            errors.push({
              emailId,
              error: error instanceof Error ? error.message : String(error),
              success: false,
            });
            logger.error("Failed to delete email in batch", "EMAIL_ROUTER", {
              emailId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Broadcast batch deletion completion
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailBatchDeleted(
            input.emailIds,
            results?.length || 0,
            errors?.length || 0,
            input.softDelete,
          );
        } catch (error) {
          logger.error("Failed to broadcast batch deletion", "EMAIL_ROUTER", {
            error,
          });
        }

        return {
          success: true,
          data: {
            deleted: results?.length || 0,
            failed: errors?.length || 0,
            total: input.emailIds.length,
            softDelete: input.softDelete,
            results,
            errors: errors?.length || 0 > 0 ? errors : undefined,
          },
        };
      } catch (error) {
        logger.error("Failed to batch delete emails", "EMAIL_ROUTER", {
          error,
        });
        throw new Error("Failed to batch delete emails");
      }
    }),

  // Get table metadata for frontend configuration (Agent 10)
  getTableMetadata: publicProcedure.query(async () => {
    try {
      logger.info("Fetching table metadata", "EMAIL_ROUTER");

      // Return configuration data for table setup
      const metadata = {
        columns: [
          {
            key: "status",
            label: "Status",
            type: "status-indicator",
            sortable: false,
            filterable: true,
            width: 80,
          },
          {
            key: "emailAlias",
            label: "Email Alias",
            type: "email",
            sortable: true,
            filterable: true,
            width: 200,
          },
          {
            key: "requestedBy",
            label: "Requested By",
            type: "text",
            sortable: true,
            filterable: false,
            width: 150,
          },
          {
            key: "subject",
            label: "Subject",
            type: "text",
            sortable: true,
            filterable: false,
            width: 300,
          },
          {
            key: "summary",
            label: "Summary",
            type: "text",
            sortable: false,
            filterable: false,
            width: 350,
          },
          {
            key: "priority",
            label: "Priority",
            type: "badge",
            sortable: true,
            filterable: true,
            width: 100,
          },
          {
            key: "workflowState",
            label: "Workflow",
            type: "badge",
            sortable: true,
            filterable: true,
            width: 120,
          },
          {
            key: "receivedDate",
            label: "Received",
            type: "datetime",
            sortable: true,
            filterable: true,
            width: 150,
          },
        ],
        filterOptions: {
          status: [
            { value: "red", label: "Critical", color: "#EF4444" },
            { value: "yellow", label: "Warning", color: "#F59E0B" },
            { value: "green", label: "Success", color: "#10B981" },
          ],
          priority: [
            { value: "critical", label: "Critical", color: "#DC2626" },
            { value: "high", label: "High", color: "#EA580C" },
            { value: "medium", label: "Medium", color: "#D97706" },
            { value: "low", label: "Low", color: "#65A30D" },
          ],
          workflowState: [
            { value: "START_POINT", label: "Start Point", color: "#6366F1" },
            { value: "IN_PROGRESS", label: "In Progress", color: "#8B5CF6" },
            { value: "COMPLETION", label: "Completion", color: "#10B981" },
          ],
        },
        defaultSort: {
          column: "receivedDate",
          direction: "desc",
        },
        pagination: {
          defaultPageSize: 50,
          pageSizeOptions: [25, 50, 100],
        },
        features: {
          search: true,
          filtering: true,
          sorting: true,
          bulkActions: true,
          export: true,
          realTimeUpdates: true,
        },
      };

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      logger.error("Failed to fetch table metadata", "EMAIL_ROUTER", { error });
      throw new Error("Failed to fetch table metadata");
    }
  }),

  // Ingest emails from various sources
  ingestEmails: protectedProcedure
    .input(
      z.object({
        source: z.enum(["json", "database", "api"]),
        data: z.any(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        logger.info("Ingesting emails", "EMAIL_ROUTER", {
          source: input.source,
        });

        const progress = await emailIntegrationService.ingestEmails(
          input.source,
          input.data,
        );

        return {
          success: true,
          data: progress,
        };
      } catch (error) {
        logger.error("Failed to ingest emails", "EMAIL_ROUTER", { error });
        throw new Error("Failed to ingest emails");
      }
    }),

  // Get email processing status
  getProcessingStatus: publicProcedure.query(async () => {
    try {
      const status = emailIntegrationService.getProcessingStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      logger.error("Failed to get processing status", "EMAIL_ROUTER", { error });
      throw new Error("Failed to get processing status");
    }
  }),

  // Agent Processing Control Endpoints
  
  // Start agent-based email processing
  startAgentProcessing: protectedProcedure
    .input(
      z.object({
        batchSize: z.number().min(1).max(1000).optional().default(100),
        maxConcurrent: z.number().min(1).max(10).optional().default(3),
        skipProcessed: z.boolean().optional().default(true),
        targetEmails: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Starting agent processing", "EMAIL_ROUTER", {
          batchSize: input.batchSize,
          maxConcurrent: input.maxConcurrent,
          skipProcessed: input.skipProcessed,
          targetEmails: input.targetEmails?.length,
        });

        const user = ctx.user;
        const initiatedBy = user?.email ?? user?.username ?? "system";

        // Start the agent processing
        await emailStorage.startAgentBacklogProcessing({
          batchSize: input.batchSize,
          maxEmails: input.targetEmails?.length || 1000,
          priority: input.skipProcessed ? ['medium', 'high', 'critical'] : undefined
        });

        // Broadcast processing start
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailProcessingStarted({
            initiatedBy,
            batchSize: input.batchSize,
            maxConcurrent: input.maxConcurrent,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error("Failed to broadcast processing start", "EMAIL_ROUTER", { error });
        }

        return {
          success: true,
          message: "Agent processing started successfully",
          data: {
            initiatedBy,
            batchSize: input.batchSize,
            maxConcurrent: input.maxConcurrent,
            startedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        logger.error("Failed to start agent processing", "EMAIL_ROUTER", { error });
        throw new Error("Failed to start agent processing");
      }
    }),

  // Stop agent-based email processing
  stopAgentProcessing: protectedProcedure
    .input(
      z.object({
        reason: z.string().optional().default("Manual stop"),
        forceStop: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Stopping agent processing", "EMAIL_ROUTER", {
          reason: input.reason,
          forceStop: input.forceStop,
        });

        const user = ctx.user;
        const stoppedBy = user?.email ?? user?.username ?? "system";

        // Stop the agent processing
        await emailStorage.stopAgentProcessing({
          graceful: !input.forceStop,
          timeout: 30000
        });

        // Broadcast processing stop
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailProcessingStopped({
            stoppedBy,
            reason: input.reason,
            forceStop: input.forceStop,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error("Failed to broadcast processing stop", "EMAIL_ROUTER", { error });
        }

        return {
          success: true,
          message: "Agent processing stopped successfully",
          data: {
            stoppedBy,
            reason: input.reason,
            stoppedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        logger.error("Failed to stop agent processing", "EMAIL_ROUTER", { error });
        throw new Error("Failed to stop agent processing");
      }
    }),

  // Get agent processing status and metrics
  getAgentProcessingStatus: publicProcedure.query(async () => {
    try {
      logger.info("Fetching agent processing status", "EMAIL_ROUTER");

      const status = await emailStorage.getAgentProcessingStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      logger.error("Failed to get agent processing status", "EMAIL_ROUTER", { error });
      throw new Error("Failed to get agent processing status");
    }
  }),

  // Process specific emails through agents
  processEmailsThroughAgents: protectedProcedure
    .input(
      z.object({
        emailIds: z.array(z.string().uuid()).min(1).max(50),
        priority: z.enum(["high", "normal", "low"]).optional().default("normal"),
        agentType: z.enum(["analysis", "research", "data"]).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Processing specific emails through agents", "EMAIL_ROUTER", {
          emailIds: input.emailIds,
          priority: input.priority,
          agentType: input.agentType,
        });

        const user = ctx.user;
        const requestedBy = user?.email ?? user?.username ?? "system";

        const results = [];
        const errors = [];

        for (const emailId of input.emailIds) {
          try {
            const email = await emailStorage.getEmail(emailId);
            if (!email) {
              errors.push({
                emailId,
                error: "Email not found",
                success: false,
              });
              continue;
            }

            // Process through agent system
            const result = await emailStorage.processEmailThroughAgents(email);
            
            results.push({
              emailId,
              agentResult: result,
              success: true,
            });

            // Broadcast individual email processing completion
            try {
              const { wsService } = await import("../services/WebSocketService.js");
              wsService.broadcastEmailAgentProcessed({
                emailId,
                agentType: input.agentType || "analysis",
                requestedBy,
                result,
                timestamp: new Date(),
              });
            } catch (error) {
              logger.error("Failed to broadcast email processing", "EMAIL_ROUTER", { error });
            }

          } catch (error) {
            errors.push({
              emailId,
              error: error instanceof Error ? error.message : String(error),
              success: false,
            });
            logger.error("Failed to process email through agents", "EMAIL_ROUTER", {
              emailId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          success: true,
          data: {
            processed: results.length,
            failed: errors.length,
            total: input.emailIds.length,
            results,
            errors: errors.length > 0 ? errors : undefined,
            requestedBy,
            processedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        logger.error("Failed to process emails through agents", "EMAIL_ROUTER", { error });
        throw new Error("Failed to process emails through agents");
      }
    }),

  // Get agent processing metrics and performance data
  getAgentProcessingMetrics: publicProcedure
    .input(
      z.object({
        timeRange: z.object({
          start: z.string().datetime(),
          end: z.string().datetime(),
        }).optional(),
        groupBy: z.enum(["hour", "day", "agent", "status"]).optional().default("day"),
        includeDetails: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ input }) => {
      try {
        logger.info("Fetching agent processing metrics", "EMAIL_ROUTER", {
          timeRange: input.timeRange,
          groupBy: input.groupBy,
          includeDetails: input.includeDetails,
        });

        const metrics = await emailStorage.getAgentProcessingMetrics({
          timeRange: input.timeRange?.start ? 'day' : 'day',
          agentType: input.groupBy
        });

        return {
          success: true,
          data: metrics,
        };
      } catch (error) {
        logger.error("Failed to get agent processing metrics", "EMAIL_ROUTER", { error });
        throw new Error("Failed to get agent processing metrics");
      }
    }),

  // Reset agent processing state (emergency use)
  resetAgentProcessing: protectedProcedure
    .input(
      z.object({
        confirmReset: z.boolean(),
        reason: z.string().min(10),
        clearProgress: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!input.confirmReset) {
          throw new Error("Reset confirmation required");
        }

        logger.warn("Resetting agent processing state", "EMAIL_ROUTER", {
          reason: input.reason,
          clearProgress: input.clearProgress,
        });

        const user = ctx.user;
        const resetBy = user?.email ?? user?.username ?? "system";

        await emailStorage.resetAgentProcessing({
          resetQueue: input.clearProgress || true,
          resetMetrics: input.clearProgress || false,
          resetHistory: input.clearProgress || false
        });

        // Broadcast processing reset
        try {
          const { wsService } = await import("../services/WebSocketService.js");
          wsService.broadcastEmailProcessingReset({
            resetBy,
            reason: input.reason,
            clearProgress: input.clearProgress,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.error("Failed to broadcast processing reset", "EMAIL_ROUTER", { error });
        }

        return {
          success: true,
          message: "Agent processing state reset successfully",
          data: {
            resetBy,
            reason: input.reason,
            resetAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        logger.error("Failed to reset agent processing", "EMAIL_ROUTER", { error });
        throw new Error("Failed to reset agent processing");
      }
    }),

  // WebSocket subscriptions for real-time updates
  subscribeToEmailUpdates: publicProcedure
    .input(
      z.object({
        types: z
          .array(z.string())
          .optional()
          .default([
            "email.analyzed",
            "email.state_changed",
            "email.sla_alert",
            "email.analytics_updated",
            "email.processing_progress",
            "email.agent_processed",
          ]),
      }),
    )
    .subscription(async function* ({ input }) {
      try {
        const { wsService } = await import("../services/WebSocketService.js");
        const clientId = `email-dashboard-${Date.now()}-${Math.random()}`;

        // Subscribe to email-specific message types
        wsService.subscribe(clientId, input.types);

        // Create an async generator for the subscription
        const messageQueue: unknown[] = [];
        let resolver: ((value: unknown) => void) | null = null;

        const messageHandler = (message: unknown) => {
          if (
            message &&
            typeof message === "object" &&
            "type" in message &&
            input?.types?.includes((message as any).type)
          ) {
            if (resolver) {
              resolver(message);
              resolver = null;
            } else {
              messageQueue.push(message);
            }
          }
        };

        // Listen for email events
        input?.types?.forEach((type: any) => {
          wsService.on(type, messageHandler);
        });

        try {
          while (true) {
            let message;
            if (messageQueue?.length || 0 > 0) {
              message = messageQueue.shift();
            } else {
              message = await new Promise<unknown>((resolve: any) => {
                resolver = resolve;
              });
            }

            yield {
              type: (message as any).type,
              data: message,
              timestamp: new Date().toISOString(),
            };
          }
        } finally {
          // Clean up
          input?.types?.forEach((type: any) => {
            wsService.off(type, messageHandler);
          });
          wsService.unsubscribe(clientId, input.types);
        }
      } catch (error) {
        logger.error("WebSocket subscription error", "EMAIL_ROUTER", { error });
        throw new Error("Failed to establish WebSocket subscription");
      }
    }),
});

export type EmailRouter = typeof emailRouter;
