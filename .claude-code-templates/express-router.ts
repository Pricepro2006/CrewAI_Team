import { Router } from 'express';
import { z } from 'zod';
import {
  authenticate,
  authorize,
  validateRequest,
  rateLimiter,
  cacheMiddleware,
} from '@/api/middleware';
import { asyncHandler } from '@/api/middleware/asyncHandler';
import { {{ServiceName}} } from '@/services/{{ServiceName}}';
import { logger } from '@/utils/logger';

// Initialize router
const router = Router();

// Initialize service
const {{serviceName}} = new {{ServiceName}}();

// Validation schemas
const CreateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

const UpdateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),
});

const GetByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const ListSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
    sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().optional(),
    filter: z.string().optional(), // JSON string
  }),
});

// Route documentation
/**
 * @swagger
 * /api/{{resource}}:
 *   get:
 *     summary: List all {{resources}}
 *     tags: [{{Resource}}]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  rateLimiter({ windowMs: 60000, max: 100 }),
  validateRequest(ListSchema),
  cacheMiddleware({ ttl: 300 }), // Cache for 5 minutes
  asyncHandler(async (req, res) => {
    const { page, limit, sort, order, search, filter } = req.query;
    
    logger.info('Listing {{resources}}', {
      userId: req.user?.id,
      query: req.query,
    });
    
    const parsedFilter = filter ? JSON.parse(filter as string) : {};
    
    const result = await {{serviceName}}.list({
      pagination: { page: Number(page), limit: Number(limit) },
      sort: { field: sort as string, order: order as 'asc' | 'desc' },
      search: search as string,
      filter: parsedFilter,
    });
    
    res.json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

/**
 * @swagger
 * /api/{{resource}}/{id}:
 *   get:
 *     summary: Get {{resource}} by ID
 *     tags: [{{Resource}}]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.get(
  '/:id',
  authenticate,
  validateRequest(GetByIdSchema),
  cacheMiddleware({ ttl: 600 }), // Cache for 10 minutes
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    logger.info('Getting {{resource}} by ID', {
      userId: req.user?.id,
      resourceId: id,
    });
    
    const resource = await {{serviceName}}.getById(id);
    
    res.json({
      success: true,
      data: resource,
    });
  })
);

/**
 * @swagger
 * /api/{{resource}}:
 *   post:
 *     summary: Create new {{resource}}
 *     tags: [{{Resource}}]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 */
router.post(
  '/',
  authenticate,
  authorize(['admin', 'user']),
  validateRequest(CreateSchema),
  asyncHandler(async (req, res) => {
    const { body } = req;
    
    logger.info('Creating {{resource}}', {
      userId: req.user?.id,
      data: body,
    });
    
    const resource = await {{serviceName}}.create({
      ...body,
      userId: req.user!.id,
    });
    
    res.status(201).json({
      success: true,
      data: resource,
    });
  })
);

/**
 * @swagger
 * /api/{{resource}}/{id}:
 *   put:
 *     summary: Update {{resource}}
 *     tags: [{{Resource}}]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'user']),
  validateRequest(UpdateSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { body } = req;
    
    logger.info('Updating {{resource}}', {
      userId: req.user?.id,
      resourceId: id,
      updates: body,
    });
    
    // Check ownership
    const existing = await {{serviceName}}.getById(id);
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to update this resource',
      });
    }
    
    const updated = await {{serviceName}}.update(id, body);
    
    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * @swagger
 * /api/{{resource}}/{id}:
 *   delete:
 *     summary: Delete {{resource}}
 *     tags: [{{Resource}}]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin', 'user']),
  validateRequest(GetByIdSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    logger.info('Deleting {{resource}}', {
      userId: req.user?.id,
      resourceId: id,
    });
    
    // Check ownership
    const existing = await {{serviceName}}.getById(id);
    if (existing.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to delete this resource',
      });
    }
    
    await {{serviceName}}.delete(id);
    
    res.status(204).send();
  })
);

// Bulk operations
router.post(
  '/bulk',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { operation, ids, data } = req.body;
    
    logger.info('Bulk operation', {
      userId: req.user?.id,
      operation,
      count: ids.length,
    });
    
    let result;
    
    switch (operation) {
      case 'delete':
        result = await {{serviceName}}.bulkDelete(ids);
        break;
      case 'update':
        result = await {{serviceName}}.bulkUpdate(ids, data);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid bulk operation',
        });
    }
    
    res.json({
      success: true,
      data: result,
    });
  })
);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: '{{ServiceName}}',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export { router as {{routerName}}Router };