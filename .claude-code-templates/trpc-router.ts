import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '@/api/trpc';
import { TRPCError } from '@trpc/server';
import { {{ServiceName}} } from '@/services/{{ServiceName}}';
import { logger } from '@/utils/logger';

// Initialize service
const {{serviceName}} = new {{ServiceName}}();

// Input validation schemas
const listInput = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sort: z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  }).optional(),
  filter: z.record(z.unknown()).optional(),
  search: z.string().optional(),
});

const getByIdInput = z.object({
  id: z.string().uuid(),
});

const createInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateInput = z.object({
  id: z.string().uuid(),
  data: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),
});

const deleteInput = z.object({
  id: z.string().uuid(),
});

const bulkDeleteInput = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

/**
 * {{RouterName}} tRPC router
 * 
 * @description Handles all {{resource}} related operations
 */
export const {{routerName}}Router = router({
  /**
   * List {{resources}} with pagination, sorting, and filtering
   */
  list: publicProcedure
    .input(listInput)
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Listing {{resources}}', {
          userId: ctx.user?.id,
          input,
        });
        
        const result = await {{serviceName}}.list({
          pagination: {
            page: input.page,
            limit: input.limit,
          },
          sort: input.sort,
          filter: input.filter,
          search: input.search,
        });
        
        return {
          items: result.items,
          meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            hasNext: result.hasNext,
            hasPrev: result.hasPrev,
          },
        };
      } catch (error) {
        logger.error('Failed to list {{resources}}', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list {{resources}}',
          cause: error,
        });
      }
    }),
  
  /**
   * Get a single {{resource}} by ID
   */
  getById: publicProcedure
    .input(getByIdInput)
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Getting {{resource}} by ID', {
          userId: ctx.user?.id,
          resourceId: input.id,
        });
        
        const resource = await {{serviceName}}.getById(input.id);
        
        if (!resource) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '{{Resource}} not found',
          });
        }
        
        return resource;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        logger.error('Failed to get {{resource}}', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get {{resource}}',
          cause: error,
        });
      }
    }),
  
  /**
   * Create a new {{resource}}
   */
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Creating {{resource}}', {
          userId: ctx.user.id,
          input,
        });
        
        const resource = await {{serviceName}}.create({
          ...input,
          userId: ctx.user.id,
        });
        
        return resource;
      } catch (error) {
        logger.error('Failed to create {{resource}}', { error });
        
        if (error instanceof Error && error.message.includes('duplicate')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '{{Resource}} already exists',
          });
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create {{resource}}',
          cause: error,
        });
      }
    }),
  
  /**
   * Update an existing {{resource}}
   */
  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Updating {{resource}}', {
          userId: ctx.user.id,
          resourceId: input.id,
          updates: input.data,
        });
        
        // Check if resource exists and user has permission
        const existing = await {{serviceName}}.getById(input.id);
        
        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '{{Resource}} not found',
          });
        }
        
        if (existing.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to update this {{resource}}',
          });
        }
        
        const updated = await {{serviceName}}.update(input.id, input.data);
        
        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        logger.error('Failed to update {{resource}}', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update {{resource}}',
          cause: error,
        });
      }
    }),
  
  /**
   * Delete a {{resource}}
   */
  delete: protectedProcedure
    .input(deleteInput)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Deleting {{resource}}', {
          userId: ctx.user.id,
          resourceId: input.id,
        });
        
        // Check if resource exists and user has permission
        const existing = await {{serviceName}}.getById(input.id);
        
        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '{{Resource}} not found',
          });
        }
        
        if (existing.userId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to delete this {{resource}}',
          });
        }
        
        await {{serviceName}}.delete(input.id);
        
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        logger.error('Failed to delete {{resource}}', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete {{resource}}',
          cause: error,
        });
      }
    }),
  
  /**
   * Bulk delete {{resources}} (admin only)
   */
  bulkDelete: protectedProcedure
    .input(bulkDeleteInput)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can perform bulk delete',
        });
      }
      
      try {
        logger.info('Bulk deleting {{resources}}', {
          userId: ctx.user.id,
          count: input.ids.length,
        });
        
        const results = await {{serviceName}}.bulkDelete(input.ids);
        
        return {
          deleted: results.deleted,
          failed: results.failed,
        };
      } catch (error) {
        logger.error('Failed to bulk delete {{resources}}', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to bulk delete {{resources}}',
          cause: error,
        });
      }
    }),
  
  /**
   * Get statistics about {{resources}}
   */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const stats = await {{serviceName}}.getStats({
          userId: ctx.user.role === 'admin' ? undefined : ctx.user.id,
        });
        
        return stats;
      } catch (error) {
        logger.error('Failed to get {{resource}} stats', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get statistics',
          cause: error,
        });
      }
    }),
  
  /**
   * Search {{resources}} with advanced options
   */
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      options: z.object({
        fuzzy: z.boolean().optional(),
        fields: z.array(z.string()).optional(),
        limit: z.number().min(1).max(50).default(10),
      }).optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Searching {{resources}}', {
          userId: ctx.user?.id,
          query: input.query,
          options: input.options,
        });
        
        const results = await {{serviceName}}.search(input.query, input.options);
        
        return results;
      } catch (error) {
        logger.error('Failed to search {{resources}}', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search {{resources}}',
          cause: error,
        });
      }
    }),
});