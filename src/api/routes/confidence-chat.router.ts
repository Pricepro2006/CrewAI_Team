/**
 * Confidence-enabled chat router with feedback and evaluation endpoints
 */

import { z } from "zod";
import {
  router,
  publicProcedure,
  commonSchemas,
  createFeatureRouter,
} from "../trpc/enhanced-router";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger";
import { ConfidenceMasterOrchestrator } from "../../core/master-orchestrator/ConfidenceMasterOrchestrator";
import { assertConfidenceOrchestrator } from "../utils/type-guards";
import { TRPCError } from "@trpc/server";

// Event emitter for real-time updates
const confidenceChatEvents = new EventEmitter();

// Enhanced schemas with confidence support
const confidenceChatSchemas = {
  message: z.object({
    message: z.string().min(1).max(5000),
    conversationId: z.string().uuid().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    includeConfidence: z.boolean().default(true),
    deliveryOptions: z
      .object({
        includeEvidence: z.boolean().optional(),
        includeUncertaintyWarnings: z.boolean().optional(),
        confidenceFormat: z
          .enum(["percentage", "category", "detailed"])
          .optional(),
      })
      .optional(),
  }),

  feedback: z.object({
    feedbackId: z.string(),
    helpful: z.boolean().optional(),
    accurate: z.boolean().optional(),
    comments: z.string().max(1000).optional(),
    corrections: z.string().max(2000).optional(),
  }),

  confidenceUpdate: z.object({
    conversationId: z.string().uuid(),
    stage: z.string(),
    confidence: z.number().min(0).max(1),
    details: z.any().optional(),
  }),
};

// Create router with explicit type to avoid TS2742
const _confidenceChatRouter = router({
  // Create a new conversation with confidence scoring
  create: publicProcedure
    .input(confidenceChatSchemas.message)
    .mutation(async ({ input, ctx }) => {
      logger.info(
        "Creating confidence-scored chat conversation",
        "CONFIDENCE_CHAT",
        {
          userId: ctx.user?.id,
          messageLength: input.message.length,
          priority: input.priority,
          includeConfidence: input.includeConfidence,
          requestId: ctx.requestId,
        },
      );

      const conversation = await ctx.conversationService.create();

      // Ensure we have a confidence orchestrator
      try {
        assertConfidenceOrchestrator(ctx.masterOrchestrator);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This endpoint requires ConfidenceMasterOrchestrator",
        });
      }
      const orchestrator = ctx.masterOrchestrator;

      // Set up event listeners for real-time updates
      orchestrator.on("confidence:update", (data) => {
        confidenceChatEvents.emit("confidence-update", {
          conversationId: conversation.id,
          ...data,
        });
      });

      orchestrator.on("evaluation:complete", (data) => {
        confidenceChatEvents.emit("evaluation-complete", {
          conversationId: conversation.id,
          ...data,
        });
      });

      // Process the initial message with confidence scoring
      const result = await orchestrator.processQuery({
        text: input.message,
        conversationId: conversation.id,
      });

      // Add messages to conversation with confidence metadata
      await ctx.conversationService.addMessage(conversation.id, {
        role: "user",
        content: input.message,
      });

      await ctx.conversationService.addMessage(conversation.id, {
        role: "assistant",
        content: result.deliveredResponse.content,
        metadata: {
          confidence: result.confidence,
          processingPath: result.processingPath,
          feedbackId: result.feedbackId,
          action: result.deliveredResponse.metadata.action,
          humanReviewNeeded:
            result.deliveredResponse.metadata.humanReviewNeeded,
        },
      });

      // Emit completion event
      confidenceChatEvents.emit("message", {
        conversationId: conversation.id,
        message: {
          role: "assistant",
          content: result.deliveredResponse.content,
          confidence: result.confidence,
          feedbackId: result.feedbackId,
        },
      });

      logger.info("Confidence chat conversation created", "CONFIDENCE_CHAT", {
        conversationId: conversation.id,
        confidence: result.confidence,
        processingPath: result.processingPath,
        action: result.deliveredResponse.metadata.action,
      });

      return {
        conversationId: conversation.id,
        response: result.deliveredResponse.content,
        confidence: input.includeConfidence
          ? {
              score: result.confidence,
              category: result.deliveredResponse.confidence.category,
              display: result.deliveredResponse.confidence.display,
            }
          : undefined,
        evidence: result.deliveredResponse.evidence,
        warnings: result.deliveredResponse.warnings,
        feedbackId: result.feedbackId,
        metadata: {
          processingPath: result.processingPath,
          humanReviewNeeded:
            result.deliveredResponse.metadata.humanReviewNeeded,
          uncertaintyAreas: result.deliveredResponse.metadata.uncertaintyAreas,
          processingTime: result.deliveredResponse.metadata.processingTime,
          requestId: ctx.requestId,
          timestamp: ctx.timestamp,
        },
      };
    }),

  // Send a message with confidence scoring
  message: publicProcedure
    .input(
      z.object({
        conversationId: commonSchemas.id,
        message: z.string().min(1).max(5000),
        includeConfidence: z.boolean().default(true),
        deliveryOptions: confidenceChatSchemas.message.shape.deliveryOptions,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      logger.info("Processing confidence chat message", "CONFIDENCE_CHAT", {
        conversationId: input.conversationId,
        userId: ctx.user?.id,
        messageLength: input.message.length,
        requestId: ctx.requestId,
      });

      const conversation = await ctx.conversationService.get(
        input.conversationId,
      );
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Ensure we have a confidence orchestrator
      try {
        assertConfidenceOrchestrator(ctx.masterOrchestrator);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This endpoint requires ConfidenceMasterOrchestrator",
        });
      }
      const orchestrator = ctx.masterOrchestrator;

      // Add user message
      await ctx.conversationService.addMessage(input.conversationId, {
        role: "user",
        content: input.message,
      });

      // Process with confidence scoring
      const result = await orchestrator.processQuery({
        text: input.message,
        conversationId: input.conversationId,
        history: conversation.messages,
      });

      // Add assistant response with confidence
      await ctx.conversationService.addMessage(input.conversationId, {
        role: "assistant",
        content: result.deliveredResponse.content,
        metadata: {
          confidence: result.confidence,
          processingPath: result.processingPath,
          feedbackId: result.feedbackId,
          action: result.deliveredResponse.metadata.action,
        },
      });

      // Emit event
      confidenceChatEvents.emit("message", {
        conversationId: input.conversationId,
        message: {
          role: "assistant",
          content: result.deliveredResponse.content,
          confidence: result.confidence,
          feedbackId: result.feedbackId,
        },
      });

      return {
        response: result.deliveredResponse.content,
        confidence: input.includeConfidence
          ? {
              score: result.confidence,
              category: result.deliveredResponse.confidence.category,
              display: result.deliveredResponse.confidence.display,
            }
          : undefined,
        evidence: result.deliveredResponse.evidence,
        warnings: result.deliveredResponse.warnings,
        feedbackId: result.feedbackId,
        metadata: {
          processingPath: result.processingPath,
          humanReviewNeeded:
            result.deliveredResponse.metadata.humanReviewNeeded,
        },
      };
    }),

  // Submit feedback for a response
  feedback: publicProcedure
    .input(confidenceChatSchemas.feedback)
    .mutation(async ({ input, ctx }) => {
      logger.info("Submitting feedback", "CONFIDENCE_CHAT", {
        feedbackId: input.feedbackId,
        helpful: input.helpful,
        accurate: input.accurate,
        userId: ctx.user?.id,
      });

      // Ensure we have a confidence orchestrator
      try {
        assertConfidenceOrchestrator(ctx.masterOrchestrator);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This endpoint requires ConfidenceMasterOrchestrator",
        });
      }
      const orchestrator = ctx.masterOrchestrator;
      orchestrator.captureFeedback(input.feedbackId, input);

      // Emit feedback event for analytics
      confidenceChatEvents.emit("feedback", {
        feedbackId: input.feedbackId,
        feedback: input,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: "Thank you for your feedback. It helps improve our system.",
      };
    }),

  // Get confidence statistics
  confidenceStats: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid().optional(),
        timeRange: z.enum(["hour", "day", "week", "month"]).default("day"),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Ensure we have a confidence orchestrator
      try {
        assertConfidenceOrchestrator(ctx.masterOrchestrator);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This endpoint requires ConfidenceMasterOrchestrator",
        });
      }
      const orchestrator = ctx.masterOrchestrator;
      const stats = orchestrator.getPerformanceStats();

      // Filter by conversation if specified
      if (input.conversationId) {
        // In production, filter stats by conversation
        logger.info("Filtering stats by conversation", "CONFIDENCE_CHAT", {
          conversationId: input.conversationId,
        });
      }

      return {
        delivery: stats.delivery,
        calibration: stats.calibration,
        performance: stats.performance,
        timeRange: input.timeRange,
        timestamp: new Date().toISOString(),
      };
    }),

  // Subscribe to confidence updates
  onConfidenceUpdate: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
      }),
    )
    .subscription(({ input }) => {
      return observable((observer) => {
        const handler = (data: {
          conversationId: string;
          stage: string;
          confidence: number;
          details?: unknown;
        }) => {
          if (data.conversationId === input.conversationId) {
            observer.next({
              stage: data.stage,
              confidence: data.confidence,
              details: data.details,
              timestamp: new Date().toISOString(),
            });
          }
        };

        confidenceChatEvents.on("confidence-update", handler);

        return () => {
          confidenceChatEvents.off("confidence-update", handler);
        };
      });
    }),

  // Subscribe to evaluation results
  onEvaluationComplete: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
      }),
    )
    .subscription(({ input }) => {
      return observable((observer) => {
        const handler = (data: {
          conversationId: string;
          factuality: number;
          relevance: number;
          coherence: number;
          overall: number;
          action: string;
        }) => {
          if (data.conversationId === input.conversationId) {
            observer.next({
              factuality: data.factuality,
              relevance: data.relevance,
              coherence: data.coherence,
              overall: data.overall,
              action: data.action,
              timestamp: new Date().toISOString(),
            });
          }
        };

        confidenceChatEvents.on("evaluation-complete", handler);

        return () => {
          confidenceChatEvents.off("evaluation-complete", handler);
        };
      });
    }),

  // Get evaluation details for a message
  getEvaluation: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        messageIndex: z.number().min(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.get(
        input.conversationId,
      );
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const message = conversation.messages[input.messageIndex];
      if (!message || message.role !== "assistant") {
        throw new Error("Message not found or not an assistant message");
      }

      return {
        confidence: message.metadata?.confidence,
        processingPath: message.metadata?.processingPath,
        action: message.metadata?.action,
        humanReviewNeeded: message.metadata?.humanReviewNeeded,
        feedbackId: message.metadata?.feedbackId,
      };
    }),

  // Export conversation with confidence data
  exportWithConfidence: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        format: z.enum(["json", "markdown", "csv"]).default("json"),
        includeEvaluations: z.boolean().default(true),
      }),
    )
    .query(async ({ input, ctx }) => {
      logger.info("Exporting conversation with confidence", "CONFIDENCE_CHAT", {
        conversationId: input.conversationId,
        format: input.format,
        userId: ctx.user?.id,
      });

      const conversation = await ctx.conversationService.get(
        input.conversationId,
      );
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Format based on requested type
      let data: string | object;
      switch (input.format) {
        case "markdown":
          data = formatConversationAsMarkdown(
            conversation,
            input.includeEvaluations,
          );
          break;
        case "csv":
          data = formatConversationAsCSV(
            conversation,
            input.includeEvaluations,
          );
          break;
        default:
          data = conversation;
      }

      return {
        data,
        format: input.format,
        conversationId: input.conversationId,
        timestamp: new Date().toISOString(),
        includesConfidence: true,
      };
    }),

  // Regenerate response with different confidence settings
  regenerate: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        messageIndex: z.number().min(0),
        confidenceProfile: z
          .enum(["conservative", "balanced", "permissive"])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      logger.info("Regenerating response with confidence", "CONFIDENCE_CHAT", {
        conversationId: input.conversationId,
        messageIndex: input.messageIndex,
        profile: input.confidenceProfile,
      });

      const conversation = await ctx.conversationService.get(
        input.conversationId,
      );
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Get the user message to regenerate from
      const userMessage = conversation.messages[input.messageIndex - 1];
      if (!userMessage || userMessage.role !== "user") {
        throw new Error("Cannot find user message to regenerate from");
      }

      // Ensure we have a confidence orchestrator
      try {
        assertConfidenceOrchestrator(ctx.masterOrchestrator);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This endpoint requires ConfidenceMasterOrchestrator",
        });
      }
      const orchestrator = ctx.masterOrchestrator;

      // Process with new settings
      const result = await orchestrator.processQuery({
        text: userMessage.content,
        conversationId: input.conversationId,
        history: conversation.messages.slice(0, input.messageIndex - 1),
      });

      // Replace the assistant message
      conversation.messages[input.messageIndex] = {
        role: "assistant",
        content: result.deliveredResponse.content,
        metadata: {
          confidence: result.confidence,
          processingPath: result.processingPath,
          feedbackId: result.feedbackId,
          regenerated: true,
          originalIndex: input.messageIndex,
        },
      };

      // Save updated conversation
      await ctx.conversationService.update(input.conversationId, conversation);

      return {
        response: result.deliveredResponse.content,
        confidence: {
          score: result.confidence,
          category: result.deliveredResponse.confidence.category,
          display: result.deliveredResponse.confidence.display,
        },
        feedbackId: result.feedbackId,
        regenerated: true,
      };
    }),
});

// Export with explicit type annotation to avoid TS2742
import type { TRPCRouter } from "../trpc/enhanced-router";

export const confidenceChatRouter = _confidenceChatRouter;

// Helper functions for formatting
function formatConversationAsMarkdown(
  conversation: {
    title?: string;
    id: string;
    createdAt: string;
    messages: Array<{
      role: string;
      content: string;
      metadata?: {
        confidence?: number;
        processingPath?: string;
        action?: string;
      };
    }>;
  },
  includeEvaluations: boolean,
): string {
  let markdown = `# Conversation: ${conversation.title || conversation.id}\n\n`;
  markdown += `Date: ${conversation.createdAt}\n\n`;

  conversation.messages.forEach((msg, _idx) => {
    markdown += `## ${msg.role === "user" ? "User" : "Assistant"}\n`;
    markdown += `${msg.content}\n\n`;

    if (includeEvaluations && msg.metadata?.confidence) {
      markdown += `*Confidence: ${(msg.metadata.confidence * 100).toFixed(1)}% | `;
      markdown += `Processing: ${msg.metadata.processingPath} | `;
      markdown += `Action: ${msg.metadata.action}*\n\n`;
    }
  });

  return markdown;
}

function formatConversationAsCSV(
  conversation: {
    messages: Array<{
      role: string;
      content: string;
      metadata?: {
        confidence?: number;
        processingPath?: string;
        action?: string;
        feedbackId?: string;
      };
    }>;
  },
  includeEvaluations: boolean,
): string {
  const headers = ["Index", "Role", "Content"];
  if (includeEvaluations) {
    headers.push("Confidence", "ProcessingPath", "Action", "FeedbackId");
  }

  const rows = [headers.join(",")];

  conversation.messages.forEach((msg, idx) => {
    const row = [
      idx.toString(),
      msg.role,
      `"${msg.content.replace(/"/g, '""')}"`,
    ];

    if (includeEvaluations) {
      row.push(
        msg.metadata?.confidence?.toFixed(3) || "",
        msg.metadata?.processingPath || "",
        msg.metadata?.action || "",
        msg.metadata?.feedbackId || "",
      );
    }

    rows.push(row.join(","));
  });

  return rows.join("\n");
}
