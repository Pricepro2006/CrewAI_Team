import { z } from "zod";
import { router, publicProcedure, commonSchemas, createFeatureRouter, } from "../trpc/enhanced-router";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
// Router type available via enhanced-router
// Security schemas available via enhanced-router
import { logger } from "../../utils/logger";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../utils/timeout";
// Event emitter for real-time updates
const chatEvents = new EventEmitter();
// Enhanced input validation schemas
const chatSchemas = {
    message: z.object({
        message: z.string().min(1).max(5000),
        conversationId: z.string().uuid().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
    }),
    conversation: z.object({
        id: commonSchemas.id,
    }),
    messageHistory: z.object({
        conversationId: commonSchemas.id,
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
    }),
};
export const chatRouter = createFeatureRouter("chat", router({
    // Create a new conversation
    create: publicProcedure
        .input(chatSchemas.message)
        .mutation(async ({ input, ctx }) => {
        logger.info("Creating new chat conversation", "CHAT", {
            userId: ctx.user?.id,
            messageLength: input.message.length,
            priority: input.priority,
            requestId: ctx.requestId,
        });
        const conversation = await ctx.conversationService.create();
        // Process the initial message
        const result = await ctx.masterOrchestrator.processQuery({
            text: input.message,
            conversationId: conversation.id,
        });
        // Add messages to conversation
        await ctx.conversationService.addMessage(conversation.id, {
            role: "user",
            content: input.message,
        });
        await ctx.conversationService.addMessage(conversation.id, {
            role: "assistant",
            content: result.summary,
        });
        // Emit event for real-time updates
        chatEvents.emit("message", {
            conversationId: conversation.id,
            message: {
                role: "assistant",
                content: result.summary,
            },
        });
        logger.info("Chat conversation created successfully", "CHAT", {
            conversationId: conversation.id,
            userId: ctx.user?.id,
            responseLength: result.summary.length,
        });
        return {
            conversationId: conversation.id,
            response: result.summary,
            metadata: {
                ...result.metadata,
                requestId: ctx.requestId,
                timestamp: ctx.timestamp,
            },
        };
    }),
    // Send a message in an existing conversation
    message: publicProcedure
        .input(z.object({
        conversationId: commonSchemas.id,
        message: z.string().min(1).max(5000),
    }))
        .mutation(async ({ input, ctx }) => {
        logger.info("Processing chat message", "CHAT", {
            conversationId: input.conversationId,
            userId: ctx.user?.id,
            messageLength: input.message.length,
            requestId: ctx.requestId,
        });
        const conversation = await ctx.conversationService.get(input.conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }
        // Add user message
        await ctx.conversationService.addMessage(input.conversationId, {
            role: "user",
            content: input.message,
        });
        // Process with context
        const result = await ctx.masterOrchestrator.processQuery({
            text: input.message,
            conversationId: input.conversationId,
            history: conversation.messages,
        });
        // Add assistant response
        await ctx.conversationService.addMessage(input.conversationId, {
            role: "assistant",
            content: result.summary,
        });
        // Emit event
        chatEvents.emit("message", {
            conversationId: input.conversationId,
            message: {
                role: "assistant",
                content: result.summary,
            },
        });
        return {
            response: result.summary,
            metadata: result.metadata,
        };
    }),
    // Get conversation history
    history: publicProcedure
        .input(z.object({
        conversationId: z.string().uuid(),
    }))
        .query(async ({ input, ctx }) => {
        const conversation = await ctx.conversationService.get(input.conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }
        return conversation.messages;
    }),
    // List all conversations
    list: publicProcedure
        .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
    }))
        .query(async ({ input, ctx }) => {
        return await ctx.conversationService.list(input.limit, input.offset);
    }),
    // Delete a conversation
    delete: publicProcedure
        .input(z.object({
        conversationId: z.string().uuid(),
    }))
        .mutation(async ({ input, ctx }) => {
        await ctx.conversationService.delete(input.conversationId);
        return { success: true };
    }),
    // Subscribe to conversation updates
    onMessage: publicProcedure
        .input(z.object({
        conversationId: z.string().uuid(),
    }))
        .subscription(({ input }) => {
        return observable((observer) => {
            const handler = (data) => {
                if (data.conversationId === input.conversationId) {
                    observer.next(data.message);
                }
            };
            chatEvents.on("message", handler);
            return () => {
                chatEvents.off("message", handler);
            };
        });
    }),
    // Generate a title for the conversation
    generateTitle: publicProcedure
        .input(z.object({
        conversationId: z.string().uuid(),
    }))
        .mutation(async ({ input, ctx }) => {
        const conversation = await ctx.conversationService.get(input.conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }
        // Use first few messages to generate title
        const messages = conversation.messages.slice(0, 4);
        const context = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");
        const prompt = `
        Generate a short, descriptive title (max 50 characters) for this conversation:
        
        ${context}
        
        Return only the title, no quotes or explanation.
      `;
        const title = await withTimeout(ctx.masterOrchestrator["llm"].generate(prompt), DEFAULT_TIMEOUTS.LLM_GENERATION, "Title generation timed out");
        await ctx.conversationService.updateTitle(input.conversationId, title.trim());
        return { title: title.trim() };
    }),
    // Search conversations
    search: publicProcedure
        .input(z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(20),
    }))
        .query(async ({ input, ctx }) => {
        logger.info("Searching conversations", "CHAT", {
            query: input.query,
            limit: input.limit,
            userId: ctx.user?.id,
        });
        const results = await ctx.conversationService.search(input.query, input.limit);
        logger.info("Search completed", "CHAT", {
            query: input.query,
            resultsCount: results.length,
        });
        return results;
    }),
    // Get recent conversations
    recent: publicProcedure
        .input(z.object({
        days: z.number().min(1).max(30).default(7),
        limit: z.number().min(1).max(100).default(50),
    }))
        .query(async ({ input, ctx }) => {
        return await ctx.conversationService.getRecentConversations(input.days, input.limit);
    }),
    // Get conversation statistics
    stats: publicProcedure.query(async ({ ctx }) => {
        return await ctx.conversationService.getConversationStats();
    }),
    // Export a single conversation
    export: publicProcedure
        .input(z.object({
        conversationId: z.string().uuid(),
        format: z.enum(["json", "markdown"]).default("json"),
    }))
        .query(async ({ input, ctx }) => {
        logger.info("Exporting conversation", "CHAT", {
            conversationId: input.conversationId,
            format: input.format,
            userId: ctx.user?.id,
        });
        const data = await ctx.conversationService.exportConversation(input.conversationId, input.format);
        return {
            data,
            format: input.format,
            conversationId: input.conversationId,
            timestamp: new Date().toISOString(),
        };
    }),
    // Export all conversations
    exportAll: publicProcedure
        .input(z.object({
        format: z.enum(["json", "csv"]).default("json"),
    }))
        .query(async ({ input, ctx }) => {
        logger.info("Exporting all conversations", "CHAT", {
            format: input.format,
            userId: ctx.user?.id,
        });
        const data = await ctx.conversationService.exportAllConversations(input.format);
        return {
            data,
            format: input.format,
            timestamp: new Date().toISOString(),
        };
    }),
}));
//# sourceMappingURL=chat.router.js.map