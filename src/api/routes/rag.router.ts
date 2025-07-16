import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';
import type { Router } from '@trpc/server';

// Configure multer for file uploads (if needed for future use)
// import multer from 'multer';
// const _upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 10 * 1024 * 1024 // 10MB limit
//   }
// });

export const ragRouter: Router<any> = router({
  // Upload a document
  upload: publicProcedure
    .input(z.object({
      filename: z.string(),
      content: z.string(),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.ragSystem.addDocument(input.content, {
        id: Date.now().toString(),
        title: input.filename,
        ...input.metadata
      });

      return { 
        success: true,
        message: 'Document uploaded successfully'
      };
    }),

  // Search documents
  search: publicProcedure
    .input(z.object({
      query: z.string(),
      limit: z.number().min(1).max(50).default(5),
      filter: z.record(z.any()).optional()
    }))
    .query(async ({ input, ctx }) => {
      if (input.filter) {
        return await ctx.ragSystem.searchWithFilter(
          input.query,
          input.filter,
          input.limit
        );
      }
      
      return await ctx.ragSystem.search(input.query, input.limit);
    }),

  // Get document by ID
  getDocument: publicProcedure
    .input(z.object({
      documentId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const document = await ctx.ragSystem.getDocument(input.documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      return document;
    }),

  // Delete a document
  delete: publicProcedure
    .input(z.object({
      documentId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.ragSystem.deleteDocument(input.documentId);
      return { success: true };
    }),

  // List all documents
  list: publicProcedure
    .input(z.object({
      limit: z.number().default(100),
      offset: z.number().default(0)
    }))
    .query(async ({ input, ctx }) => {
      return await ctx.ragSystem.getAllDocuments(input.limit, input.offset);
    }),

  // Get RAG statistics
  stats: publicProcedure.query(async ({ ctx }) => {
    return await ctx.ragSystem.getStats();
  }),

  // Clear all documents
  clear: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.ragSystem.clear();
    return { success: true };
  }),

  // Export documents
  export: publicProcedure
    .input(z.object({
      format: z.enum(['json', 'csv']).default('json')
    }))
    .query(async ({ input, ctx }) => {
      const data = await ctx.ragSystem.exportDocuments(input.format);
      return { 
        data,
        format: input.format,
        timestamp: new Date().toISOString()
      };
    }),

  // Import documents
  import: publicProcedure
    .input(z.object({
      data: z.string(),
      format: z.enum(['json', 'csv']).default('json')
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.ragSystem.importDocuments(input.data, input.format);
      return { 
        success: true,
        message: 'Documents imported successfully'
      };
    })
});
