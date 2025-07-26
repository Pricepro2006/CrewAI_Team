import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/api/middleware/asyncHandler';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

// Request validation schemas
const {{EndpointName}}Schema = z.object({
  // Add your request body schema here
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  data: z.object({
    // Nested data structure
  }).optional(),
});

const {{EndpointName}}QuerySchema = z.object({
  // Add your query parameters schema here
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

// Types
export type {{EndpointName}}Request = z.infer<typeof {{EndpointName}}Schema>;
export type {{EndpointName}}Query = z.infer<typeof {{EndpointName}}QuerySchema>;

interface {{EndpointName}}Response {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * {{EndpointDescription}}
 * 
 * @route POST /api/{{endpoint-path}}
 * @access Private
 */
export const {{endpointName}} = asyncHandler(async (
  req: Request<{}, {}, {{EndpointName}}Request, {{EndpointName}}Query>,
  res: Response<{{EndpointName}}Response>,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate request body
    const validatedBody = {{EndpointName}}Schema.parse(req.body);
    
    // Validate query parameters
    const validatedQuery = {{EndpointName}}QuerySchema.parse(req.query);
    
    // Log the request
    logger.info('{{EndpointName}} request received', {
      userId: req.user?.id,
      body: validatedBody,
      query: validatedQuery,
    });
    
    // Business logic here
    const result = await processRequest(validatedBody, validatedQuery);
    
    // Send response
    res.status(200).json({
      success: true,
      data: result.data,
      metadata: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        total: result.total,
      },
    });
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw new AppError('Validation failed', 400, {
        errors: error.errors,
      });
    }
    
    // Re-throw other errors to be handled by error middleware
    throw error;
  }
});

/**
 * Process the request (separate business logic)
 */
async function processRequest(
  body: {{EndpointName}}Request,
  query: {{EndpointName}}Query
): Promise<{ data: any; total: number }> {
  // Implement your business logic here
  
  // Example: Database operation
  try {
    const data = await db.{{model}}.findMany({
      where: {
        name: body.name,
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: {
        createdAt: query.sort,
      },
    });
    
    const total = await db.{{model}}.count({
      where: {
        name: body.name,
      },
    });
    
    return { data, total };
  } catch (error) {
    logger.error('Database operation failed', { error });
    throw new AppError('Failed to process request', 500);
  }
}

/**
 * Additional endpoint handlers
 */

// GET endpoint
export const get{{EndpointName}} = asyncHandler(async (
  req: Request<{ id: string }>,
  res: Response<{{EndpointName}}Response>
): Promise<void> => {
  const { id } = req.params;
  
  if (!id) {
    throw new AppError('ID is required', 400);
  }
  
  const data = await db.{{model}}.findUnique({
    where: { id },
  });
  
  if (!data) {
    throw new AppError('Resource not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data,
  });
});

// UPDATE endpoint
export const update{{EndpointName}} = asyncHandler(async (
  req: Request<{ id: string }, {}, {{EndpointName}}Request>,
  res: Response<{{EndpointName}}Response>
): Promise<void> => {
  const { id } = req.params;
  const validatedBody = {{EndpointName}}Schema.partial().parse(req.body);
  
  const updated = await db.{{model}}.update({
    where: { id },
    data: validatedBody,
  });
  
  res.status(200).json({
    success: true,
    data: updated,
  });
});

// DELETE endpoint
export const delete{{EndpointName}} = asyncHandler(async (
  req: Request<{ id: string }>,
  res: Response<{{EndpointName}}Response>
): Promise<void> => {
  const { id } = req.params;
  
  await db.{{model}}.delete({
    where: { id },
  });
  
  res.status(204).send();
});