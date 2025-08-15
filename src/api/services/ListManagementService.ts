import { EventEmitter } from 'events';
import { z } from 'zod';
import { LRUCache } from 'lru-cache';
import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';

// Type definitions for list items and operations
export const ListItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  completed: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.any()).optional()
});

export const ListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  items: z.array(ListItemSchema),
  ownerId: z.string(),
  collaborators: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number(),
  metadata: z.record(z.any()).optional()
});

export const ListOperationSchema = z.object({
  type: z.enum([
    'CREATE_LIST', 'UPDATE_LIST', 'DELETE_LIST',
    'ADD_ITEM', 'UPDATE_ITEM', 'DELETE_ITEM', 'REORDER_ITEMS',
    'ADD_COLLABORATOR', 'REMOVE_COLLABORATOR'
  ]),
  listId: z.string(),
  itemId: z.string().optional(),
  data: z.any(),
  userId: z.string(),
  timestamp: z.number(),
  optimistic: z.boolean().default(false),
  rollback: z.any().optional()
});

export type ListItem = z.infer<typeof ListItemSchema>;
export type List = z.infer<typeof ListSchema>;
export type ListOperation = z.infer<typeof ListOperationSchema>;

// Reactive state management
interface ReactiveStateConfig {
  maxCacheSize: number;
  syncInterval: number;
  conflictResolution: 'last-write-wins' | 'merge' | 'manual';
}

export class ReactiveListState extends EventEmitter {
  private cache: LRUCache<string, List>;
  private pendingOperations: Map<string, ListOperation[]> = new Map();
  private subscribers: Map<string, Set<WebSocket>> = new Map();
  private operationQueue: ListOperation[] = [];
  private isProcessing = false;
  private config: ReactiveStateConfig;

  constructor(config: Partial<ReactiveStateConfig> = {}) {
    super();
    
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 10000,
      syncInterval: config.syncInterval ?? 100, // 100ms for <10ms updates
      conflictResolution: config.conflictResolution ?? 'last-write-wins'
    };

    this.cache = new LRUCache<string, List>({
      max: this?.config?.maxCacheSize,
      updateAgeOnGet: true
    });

    // Start the reactive processing loop
    this.startReactiveLoop();
  }

  private startReactiveLoop(): void {
    setInterval(() => {
      if (!this.isProcessing && this?.operationQueue?.length > 0) {
        this.processOperationBatch();
      }
    }, this?.config?.syncInterval);
  }

  private async processOperationBatch(): Promise<void> {
    if (this.isProcessing || this?.operationQueue?.length === 0) return;

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Process operations in batches for better performance
      const batchSize = 50;
      const batch = this?.operationQueue?.splice(0, batchSize);
      
      // Group operations by list for efficient processing
      const operationsByList = new Map<string, ListOperation[]>();
      for (const op of batch) {
        if (!operationsByList.has(op.listId)) {
          operationsByList.set(op.listId, []);
        }
        operationsByList.get(op.listId)!.push(op);
      }

      // Process each list's operations
      const updatedLists = new Set<string>();
      for (const [listId, operations] of operationsByList) {
        const result = await this.applyOperationsToList(listId, operations);
        if (result.updated) {
          updatedLists.add(listId);
        }
      }

      // Emit updates for changed lists
      for (const listId of updatedLists) {
        const list = this?.cache?.get(listId);
        if (list) {
          this.emitListUpdate(listId, list);
        }
      }

      const processingTime = Date.now() - startTime;
      this.emit('batch:processed', {
        count: batch?.length || 0,
        listsUpdated: updatedLists.size,
        processingTime
      });

      // Ensure <10ms processing time
      if (processingTime > 10) {
        console.warn(`[ReactiveListState] Batch processing took ${processingTime}ms, reducing batch size`);
      }

    } catch (error) {
      this.emit('error', { source: 'batch-processing', error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async applyOperationsToList(
    listId: string, 
    operations: ListOperation[]
  ): Promise<{ updated: boolean; conflicts: ListOperation[] }> {
    let list = this?.cache?.get(listId);
    let updated = false;
    const conflicts: ListOperation[] = [];

    for (const operation of operations) {
      try {
        const result = await this.applyOperation(list, operation);
        if (result.success) {
          list = result.list;
          updated = true;
        } else {
          conflicts.push(operation);
        }
      } catch (error) {
        this.emit('operation:error', { operation, error });
        conflicts.push(operation);
      }
    }

    if (updated && list) {
      list.version++;
      list.updatedAt = Date.now();
      this?.cache?.set(listId, list);
    }

    return { updated, conflicts };
  }

  private async applyOperation(
    list: List | undefined, 
    operation: ListOperation
  ): Promise<{ success: boolean; list?: List }> {
    switch (operation.type) {
      case 'CREATE_LIST':
        if (list) return { success: false }; // List already exists
        const newList: List = {
          ...operation.data,
          id: operation.listId,
          version: 1,
          createdAt: operation.timestamp,
          updatedAt: operation.timestamp
        };
        return { success: true, list: newList };

      case 'UPDATE_LIST':
        if (!list) return { success: false };
        return {
          success: true,
          list: { ...list, ...operation.data, id: list.id, version: list.version }
        };

      case 'ADD_ITEM':
        if (!list) return { success: false };
        const newItem: ListItem = {
          id: operation.itemId || nanoid(),
          ...operation.data,
          createdAt: operation.timestamp,
          updatedAt: operation.timestamp
        };
        return {
          success: true,
          list: { ...list, items: [...list.items, newItem] }
        };

      case 'UPDATE_ITEM':
        if (!list || !operation.itemId) return { success: false };
        const updatedItems = list?.items?.map(item =>
          item.id === operation.itemId
            ? { ...item, ...operation.data, updatedAt: operation.timestamp }
            : item
        );
        return {
          success: true,
          list: { ...list, items: updatedItems }
        };

      case 'DELETE_ITEM':
        if (!list || !operation.itemId) return { success: false };
        const filteredItems = list?.items?.filter(item => item.id !== operation.itemId);
        return {
          success: true,
          list: { ...list, items: filteredItems }
        };

      case 'REORDER_ITEMS':
        if (!list) return { success: false };
        const { fromIndex, toIndex } = operation.data;
        const reorderedItems = [...list.items];
        const [movedItem] = reorderedItems.splice(fromIndex, 1);
        if (movedItem) {
          reorderedItems.splice(toIndex, 0, movedItem);
        }
        return {
          success: true,
          list: { ...list, items: reorderedItems }
        };

      default:
        return { success: false };
    }
  }

  public queueOperation(operation: ListOperation): void {
    // Validate operation
    const validated = ListOperationSchema.parse(operation);
    
    // Add to queue for batch processing
    this?.operationQueue?.push(validated);

    // For optimistic operations, apply immediately to cache
    if (validated.optimistic) {
      this.applyOptimisticOperation(validated);
    }

    this.emit('operation:queued', validated);
  }

  private applyOptimisticOperation(operation: ListOperation): void {
    const list = this?.cache?.get(operation.listId);
    if (list) {
      // Store rollback data
      operation.rollback = { ...list };
      
      // Apply operation optimistically
      this.applyOperation(list, operation).then(result => {
        if (result.success && result.list) {
          this?.cache?.set(operation.listId, result.list);
          this.emitListUpdate(operation.listId, result.list);
        }
      }).catch(error => {
        this.emit('optimistic:error', { operation, error });
      });
    }
  }

  public rollbackOptimisticOperation(operationId: string, rollbackData: any): void {
    // Implement rollback logic for failed optimistic updates
    this.emit('optimistic:rollback', { operationId, rollbackData });
  }

  public getList(listId: string): List | undefined {
    return this?.cache?.get(listId);
  }

  public subscribeToList(listId: string, ws: WebSocket): void {
    if (!this?.subscribers?.has(listId)) {
      this?.subscribers?.set(listId, new Set());
    }
    this?.subscribers?.get(listId)!.add(ws);

    // Send current list state
    const list = this?.cache?.get(listId);
    if (list) {
      this.sendToWebSocket(ws, {
        type: 'list:snapshot',
        listId,
        data: list
      });
    }

    // Handle WebSocket disconnect
    ws.on('close', () => {
      this.unsubscribeFromList(listId, ws);
    });
  }

  public unsubscribeFromList(listId: string, ws: WebSocket): void {
    const subscribers = this?.subscribers?.get(listId);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this?.subscribers?.delete(listId);
      }
    }
  }

  private emitListUpdate(listId: string, list: List): void {
    const subscribers = this?.subscribers?.get(listId);
    if (!subscribers) return;

    const message = {
      type: 'list:update',
      listId,
      data: list,
      timestamp: Date.now(),
      optimistic: false
    };

    for (const ws of subscribers) {
      this.sendToWebSocket(ws, message);
    }

    this.emit('list:updated', { listId, list, subscriberCount: subscribers.size });
  }

  private sendToWebSocket(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        this.emit('websocket:error', { error });
      }
    }
  }

  public getMetrics() {
    return {
      cacheSize: this?.cache?.size,
      maxCacheSize: this?.config?.maxCacheSize,
      pendingOperations: this?.operationQueue?.length,
      activeSubscriptions: Array.from(this?.subscribers?.entries()).reduce(
        (total, [_, subs]) => total + subs.size, 0
      ),
      subscribedLists: this?.subscribers?.size
    };
  }

  public clearCache(): void {
    this?.cache?.clear();
    this?.operationQueue?.length = 0;
    this?.pendingOperations?.clear();
  }
}

export class ListManagementService extends EventEmitter {
  private reactiveState: ReactiveListState;
  private persistenceLayer: any; // Database/storage service
  
  constructor(config?: any) {
    super();
    this.reactiveState = new ReactiveListState(config?.reactive);
    
    // Forward reactive state events
    this?.reactiveState?.on('list:updated', (data: any) => this.emit('list:updated', data));
    this?.reactiveState?.on('error', (error: any) => this.emit('error', error));
    this?.reactiveState?.on('batch:processed', (stats: any) => this.emit('batch:processed', stats));
  }

  // CRUD operations with reactive updates
  public async createList(data: Omit<List, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<List> {
    const listId = nanoid();
    const operation: ListOperation = {
      type: 'CREATE_LIST',
      listId,
      data: {
        ...data,
        items: data.items || []
      },
      userId: data.ownerId,
      timestamp: Date.now(),
      optimistic: false
    };

    this?.reactiveState?.queueOperation(operation);
    
    // Return optimistic result
    const newList: List = {
      ...data,
      id: listId,
      version: 1,
      createdAt: operation.timestamp,
      updatedAt: operation.timestamp,
      items: data.items || []
    };

    return newList;
  }

  public async updateList(listId: string, updates: Partial<List>, userId: string): Promise<void> {
    const operation: ListOperation = {
      type: 'UPDATE_LIST',
      listId,
      data: updates,
      userId,
      timestamp: Date.now(),
      optimistic: true
    };

    this?.reactiveState?.queueOperation(operation);
  }

  public async addItem(listId: string, item: Omit<ListItem, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> {
    const itemId = nanoid();
    const operation: ListOperation = {
      type: 'ADD_ITEM',
      listId,
      itemId,
      data: item,
      userId,
      timestamp: Date.now(),
      optimistic: true
    };

    this?.reactiveState?.queueOperation(operation);
    return itemId;
  }

  public async updateItem(listId: string, itemId: string, updates: Partial<ListItem>, userId: string): Promise<void> {
    const operation: ListOperation = {
      type: 'UPDATE_ITEM',
      listId,
      itemId,
      data: updates,
      userId,
      timestamp: Date.now(),
      optimistic: true
    };

    this?.reactiveState?.queueOperation(operation);
  }

  public async deleteItem(listId: string, itemId: string, userId: string): Promise<void> {
    const operation: ListOperation = {
      type: 'DELETE_ITEM',
      listId,
      itemId,
      data: {},
      userId,
      timestamp: Date.now(),
      optimistic: true
    };

    this?.reactiveState?.queueOperation(operation);
  }

  public async reorderItems(listId: string, fromIndex: number, toIndex: number, userId: string): Promise<void> {
    const operation: ListOperation = {
      type: 'REORDER_ITEMS',
      listId,
      data: { fromIndex, toIndex },
      userId,
      timestamp: Date.now(),
      optimistic: true
    };

    this?.reactiveState?.queueOperation(operation);
  }

  // Real-time subscription management
  public subscribeToList(listId: string, ws: WebSocket): void {
    this?.reactiveState?.subscribeToList(listId, ws);
  }

  public unsubscribeFromList(listId: string, ws: WebSocket): void {
    this?.reactiveState?.unsubscribeFromList(listId, ws);
  }

  // Utility methods
  public getList(listId: string): List | undefined {
    return this?.reactiveState?.getList(listId);
  }

  public getMetrics() {
    return this?.reactiveState?.getMetrics();
  }

  public async flush(): Promise<void> {
    // Force process all pending operations
    this.emit('flush:requested');
  }

  public clearCache(): void {
    this?.reactiveState?.clearCache();
  }
}