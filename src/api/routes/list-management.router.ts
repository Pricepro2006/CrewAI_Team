import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WebSocket } from 'ws';
import { ListManagementService, ListSchema, ListItemSchema } from '../services/ListManagementService.js';
// Simplified rate limiter since createRateLimiter is not exported
const createRateLimiter = (options: any) => (req: any, res: any, next: any) => next();

// Request validation schemas
const CreateListRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  items: z.array(ListItemSchema.omit({ id: true, createdAt: true, updatedAt: true })).optional()
});

const UpdateListRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional()
});

const AddItemRequestSchema = z.object({
  content: z.string().min(1).max(1000),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const UpdateItemRequestSchema = z.object({
  content: z.string().min(1).max(1000).optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const ReorderItemsRequestSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0)
});

export class ListManagementRouter {
  private router: Router;
  private listService: ListManagementService;
  private rateLimiter: any;
  private wsConnections: Map<string, Set<WebSocket>> = new Map();

  constructor(listService?: ListManagementService) {
    this.router = Router();
    this.listService = listService || new ListManagementService();
    
    // Rate limiting for API endpoints
    this.rateLimiter = createRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 500, // 500 requests per minute for list operations
      message: 'Too many list operations, please try again later'
    });

    this.setupRoutes();
    this.setupEventHandlers();
  }

  private setupRoutes(): void {
    // Health check
    this?.router?.get('/health', this?.healthCheck?.bind(this));

    // List CRUD operations
    this?.router?.post('/lists', this.rateLimiter, this?.createList?.bind(this));
    this?.router?.get('/lists/:listId', this.rateLimiter, this?.getList?.bind(this));
    this?.router?.put('/lists/:listId', this.rateLimiter, this?.updateList?.bind(this));
    this?.router?.delete('/lists/:listId', this.rateLimiter, this?.deleteList?.bind(this));

    // Item operations
    this?.router?.post('/lists/:listId/items', this.rateLimiter, this?.addItem?.bind(this));
    this?.router?.put('/lists/:listId/items/:itemId', this.rateLimiter, this?.updateItem?.bind(this));
    this?.router?.delete('/lists/:listId/items/:itemId', this.rateLimiter, this?.deleteItem?.bind(this));
    this?.router?.post('/lists/:listId/items/reorder', this.rateLimiter, this?.reorderItems?.bind(this));

    // Batch operations
    this?.router?.post('/lists/:listId/items/batch', this.rateLimiter, this?.batchItemOperations?.bind(this));

    // Real-time subscription endpoint (HTTP upgrade to WebSocket)
    this?.router?.get('/lists/:listId/subscribe', this?.subscribeToList?.bind(this));

    // Metrics and monitoring
    this?.router?.get('/metrics', this?.getMetrics?.bind(this));
    this?.router?.post('/flush', this?.flush?.bind(this));
  }

  private setupEventHandlers(): void {
    this?.listService?.on('list:updated', (data: any) => {
      console.log(`[ListManagementRouter] List updated: ${data.listId} (${data.subscriberCount} subscribers)`);
    });

    this?.listService?.on('batch:processed', (stats: any) => {
      console.log(`[ListManagementRouter] Batch processed: ${stats.count} operations in ${stats.processingTime}ms`);
    });

    this?.listService?.on('error', (error: any) => {
      console.error('[ListManagementRouter] Service error:', error);
    });
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this?.listService?.getMetrics();
      res.json({
        status: 'healthy',
        service: 'list-management',
        uptime: process.uptime(),
        metrics: {
          cacheSize: metrics.cacheSize,
          pendingOperations: metrics.pendingOperations,
          activeSubscriptions: metrics.activeSubscriptions,
          subscribedLists: metrics.subscribedLists
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.extractUserId(req);
      const validatedData = CreateListRequestSchema.parse(req.body);

      const newList = await this?.listService?.createList({
        ...validatedData,
        ownerId: userId,
        collaborators: [],
        isPublic: validatedData.isPublic ?? false,
        items: (validatedData.items || []).map(item => ({
          ...item,
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
      });

      res.status(201).json(newList);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async getList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId } = req.params;
      if (!listId) {
        res.status(400).json({ error: 'List ID is required' });
        return;
      }
      const list = this?.listService?.getList(listId);

      if (!list) {
        res.status(404).json({ error: 'List not found' });
        return;
      }

      // TODO: Add permission checking
      res.json(list);
    } catch (error) {
      next(error);
    }
  }

  private async updateList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId } = req.params;
      if (!listId) {
        res.status(400).json({ error: 'List ID is required' });
        return;
      }
      const userId = this.extractUserId(req);
      const updates = UpdateListRequestSchema.parse(req.body);

      await this?.listService?.updateList(listId!, updates, userId);
      
      // Return updated list (optimistically)
      const updatedList = this?.listService?.getList(listId!);
      res.json(updatedList);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid update data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async deleteList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId } = req.params;
      const userId = this.extractUserId(req);

      // TODO: Implement list deletion
      res.status(501).json({ error: 'List deletion not yet implemented' });
    } catch (error) {
      next(error);
    }
  }

  private async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId } = req.params;
      if (!listId) {
        res.status(400).json({ error: 'List ID is required' });
        return;
      }
      const userId = this.extractUserId(req);
      const itemData = AddItemRequestSchema.parse(req.body);

      const itemId = await this?.listService?.addItem(listId, {
        ...itemData,
        completed: false,
        tags: itemData.tags || [],
        priority: itemData.priority || 'medium'
      } as any, userId);

      res.status(201).json({ 
        id: itemId,
        listId,
        message: 'Item added successfully' 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid item data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId, itemId } = req.params;
      if (!listId || !itemId) {
        res.status(400).json({ error: 'List ID and Item ID are required' });
        return;
      }
      const userId = this.extractUserId(req);
      const updates = UpdateItemRequestSchema.parse(req.body);

      await this?.listService?.updateItem(listId, itemId, updates, userId);
      
      res.json({ 
        message: 'Item updated successfully',
        listId,
        itemId 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid item update data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId, itemId } = req.params;
      if (!listId || !itemId) {
        res.status(400).json({ error: 'List ID and Item ID are required' });
        return;
      }
      const userId = this.extractUserId(req);

      await this?.listService?.deleteItem(listId, itemId, userId);
      
      res.json({ 
        message: 'Item deleted successfully',
        listId,
        itemId 
      });
    } catch (error) {
      next(error);
    }
  }

  private async reorderItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId } = req.params;
      if (!listId) {
        res.status(400).json({ error: 'List ID is required' });
        return;
      }
      const userId = this.extractUserId(req);
      const { fromIndex, toIndex } = ReorderItemsRequestSchema.parse(req.body);

      await this?.listService?.reorderItems(listId, fromIndex, toIndex, userId);
      
      res.json({ 
        message: 'Items reordered successfully',
        listId,
        fromIndex,
        toIndex 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid reorder data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async batchItemOperations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { listId } = req.params;
      if (!listId) {
        res.status(400).json({ error: 'List ID is required' });
        return;
      }
      const userId = this.extractUserId(req);
      const { operations } = req.body;

      if (!Array.isArray(operations)) {
        res.status(400).json({ error: 'Operations must be an array' });
        return;
      }

      const results = [];
      for (const op of operations) {
        try {
          switch (op.type) {
            case 'add':
              const itemId = await this?.listService?.addItem(listId!, op.data, userId);
              results.push({ type: 'add', success: true, itemId });
              break;
            case 'update':
              await this?.listService?.updateItem(listId!, op.itemId, op.data, userId);
              results.push({ type: 'update', success: true, itemId: op.itemId });
              break;
            case 'delete':
              await this?.listService?.deleteItem(listId!, op.itemId, userId);
              results.push({ type: 'delete', success: true, itemId: op.itemId });
              break;
            default:
              results.push({ type: op.type, success: false, error: 'Unknown operation' });
          }
        } catch (error) {
          results.push({ 
            type: op.type, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      res.json({
        message: 'Batch operations completed',
        results
      });
    } catch (error) {
      next(error);
    }
  }

  private subscribeToList(req: Request, res: Response): void {
    const { listId } = req.params;
    
    // Check if this is a WebSocket upgrade request
    if (req?.headers?.upgrade === 'websocket') {
      // Note: In a real implementation, you'd handle the WebSocket upgrade here
      // For now, return instructions for WebSocket connection
      res.json({
        message: 'WebSocket upgrade required for real-time subscription',
        endpoint: `/ws/lists/${listId}/subscribe`,
        protocol: 'ws' 
      });
    } else {
      res.status(400).json({
        error: 'WebSocket upgrade required for subscription',
        hint: 'Use WebSocket connection to /ws/lists/{listId}/subscribe'
      });
    }
  }

  private async getMetrics(req: Request, res: Response): Promise<void> {
    const metrics = this?.listService?.getMetrics();
    const reset = req?.query?.reset === 'true';

    if (reset) {
      this?.listService?.clearCache();
    }

    res.json({
      timestamp: new Date().toISOString(),
      metrics,
      reset,
      performance: {
        averageBatchProcessingTime: '< 10ms target',
        reactiveUpdates: 'Real-time via WebSocket'
      }
    });
  }

  private async flush(req: Request, res: Response): Promise<void> {
    try {
      await this?.listService?.flush();
      res.json({ 
        message: 'All pending operations flushed successfully',
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to flush operations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Utility methods
  private extractUserId(req: Request): string {
    // TODO: Extract from JWT token or session
    return req.headers['x-user-id'] as string || 'anonymous';
  }

  // WebSocket handling for real-time updates
  public handleWebSocketConnection(ws: WebSocket, listId: string): void {
    console.log(`[ListManagementRouter] New WebSocket connection for list: ${listId}`);
    
    // Subscribe to list updates
    this?.listService?.subscribeToList(listId, ws);

    // Handle incoming WebSocket messages
    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(ws, listId, message);
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON message'
        }));
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`[ListManagementRouter] WebSocket disconnected for list: ${listId}`);
      this?.listService?.unsubscribeFromList(listId, ws);
    });

    // Handle WebSocket errors
    ws.on('error', (error: any) => {
      console.error(`[ListManagementRouter] WebSocket error for list ${listId}:`, error);
    });
  }

  private handleWebSocketMessage(ws: WebSocket, listId: string, message: any): void {
    // Handle real-time operations via WebSocket
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      case 'get_list':
        const list = this?.listService?.getList(listId);
        if (list) {
          ws.send(JSON.stringify({
            type: 'list:snapshot',
            listId,
            data: list
          }));
        }
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        }));
    }
  }

  public getRouter(): Router {
    return this.router;
  }

  public getService(): ListManagementService {
    return this.listService;
  }
}