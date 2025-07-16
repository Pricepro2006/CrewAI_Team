import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

// Event emitter for real-time updates
const chatEvents = new EventEmitter();

export const chatRouter = router({
  // Create a new conversation
  create: publicProcedure
    .input(z.object({
      message: z.string().min(1).max(5000)
    }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.create();
      
      // Process the initial message
      const result = await ctx.masterOrchestrator.processQuery({
        text: input.message,
        conversationId: conversation.id
      });

      // Add messages to conversation
      await ctx.conversationService.addMessage(conversation.id, {
        role: 'user',
        content: input.message
      });

      await ctx.conversationService.addMessage(conversation.id, {
        role: 'assistant',
        content: result.summary
      });

      // Emit event for real-time updates
      chatEvents.emit('message', {
        conversationId: conversation.id,
        message: {
          role: 'assistant',
          content: result.summary
        }
      });

      return {
        conversationId: conversation.id,
        response: result.summary,
        metadata: result.metadata
      };
    }),

  // Send a message in an existing conversation
  message: publicProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      message: z.string().min(1).max(5000)
    }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.get(input.conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Add user message
      await ctx.conversationService.addMessage(input.conversationId, {
        role: 'user',
        content: input.message
      });

      // Process with context
      const result = await ctx.masterOrchestrator.processQuery({
        text: input.message,
        conversationId: input.conversationId,
        history: conversation.messages
      });

      // Add assistant response
      await ctx.conversationService.addMessage(input.conversationId, {
        role: 'assistant',
        content: result.summary
      });

      // Emit event
      chatEvents.emit('message', {
        conversationId: input.conversationId,
        message: {
          role: 'assistant',
          content: result.summary
        }
      });

      return {
        response: result.summary,
        metadata: result.metadata
      };
    }),

  // Get conversation history
  history: publicProcedure
    .input(z.object({
      conversationId: z.string().uuid()
    }))
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.get(input.conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return conversation.messages;
    }),

  // List all conversations
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      return await ctx.conversationService.list(input.limit, input.offset);
    }),

  // Delete a conversation
  delete: publicProcedure
    .input(z.object({
      conversationId: z.string().uuid()
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.conversationService.delete(input.conversationId);
      return { success: true };
    }),

  // Subscribe to conversation updates
  onMessage: publicProcedure
    .input(z.object({
      conversationId: z.string().uuid()
    }))
    .subscription(({ input }) => {
      return observable((observer) => {
        const handler = (data: any) => {
          if (data.conversationId === input.conversationId) {
            observer.next(data.message);
          }
        };

        chatEvents.on('message', handler);

        return () => {
          chatEvents.off('message', handler);
        };
      });
    }),

  // Generate a title for the conversation
  generateTitle: publicProcedure
    .input(z.object({
      conversationId: z.string().uuid()
    }))
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.conversationService.get(input.conversationId);
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Use first few messages to generate title
      const messages = conversation.messages.slice(0, 4);
      const context = messages.map(m => `${m.role}: ${m.content}`).join('\n');

      const prompt = `
        Generate a short, descriptive title (max 50 characters) for this conversation:
        
        ${context}
        
        Return only the title, no quotes or explanation.
      `;

      const title = await ctx.masterOrchestrator['llm'].generate(prompt);
      
      await ctx.conversationService.updateTitle(input.conversationId, title.trim());

      return { title: title.trim() };
    })
});
