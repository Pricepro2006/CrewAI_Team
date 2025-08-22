/**
 * Vector Database Integration Tests
 * Tests for ChromaDB Manager, Connection Manager, and Resilient Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChromaDBManager, ChromaDocument, ChromaQueryResult } from '../ChromaDBManager.js';
import { ChromaDBConnectionManager, ConnectionState } from '../ChromaDBConnectionManager.js';
import { ResilientChromaDBManager, StorageMode } from '../ResilientChromaDBManager.js';
import { GroceryVectorCollections } from '../GroceryVectorCollections.js';

// Mock ChromaDB client
const mockChromaClient = {
  version: vi.fn().mockResolvedValue('1.0.0'),
  heartbeat: vi.fn().mockResolvedValue(1234567890),
  listCollections: vi.fn().mockResolvedValue(['test-collection']),
  getCollection: vi.fn().mockResolvedValue({
    name: 'test-collection',
    metadata: {},
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({
      ids: [['doc1', 'doc2']],
      documents: [['Document 1 content', 'Document 2 content']],
      metadatas: [[{ type: 'test' }, { type: 'test' }]],
      distances: [[0.1, 0.2]],
    }),
    get: vi.fn().mockResolvedValue({
      ids: ['doc1'],
      documents: ['Document 1 content'],
      metadatas: [{ type: 'test' }],
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(2),
  }),
  createCollection: vi.fn().mockResolvedValue({
    name: 'new-collection',
    metadata: {},
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({
      ids: [[]],
      documents: [[]],
      metadatas: [[]],
      distances: [[]],
    }),
    get: vi.fn().mockResolvedValue({
      ids: [],
      documents: [],
      metadatas: [],
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
  }),
  deleteCollection: vi.fn().mockResolvedValue(undefined),
};

// Mock ChromaClient constructor
vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => mockChromaClient),
}));

describe('Vector Database Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChromaDBManager', () => {
    let manager: ChromaDBManager;

    beforeEach(async () => {
      manager = new ChromaDBManager({
        host: 'localhost',
        port: 8000,
      });
    });

    it('should initialize ChromaDB connection', async () => {
      await manager.initialize();
      
      expect(mockChromaClient.version).toHaveBeenCalled();
      expect(mockChromaClient.heartbeat).toHaveBeenCalled();
    });

    it('should create a collection with proper configuration', async () => {
      await manager.initialize();
      
      const collection = await manager.createCollection({
        name: 'test-collection',
        description: 'Test collection',
        metadataSchema: {
          category: { type: 'string', required: true },
        },
      });

      expect(collection).toBeDefined();
      expect(mockChromaClient.getCollection).toHaveBeenCalled();
    });

    it('should add documents to a collection', async () => {
      await manager.initialize();
      const collection = await manager.createCollection({
        name: 'test-collection',
        description: 'Test collection',
      });

      const documents: ChromaDocument[] = [
        {
          id: 'doc1',
          content: 'Test document content',
          metadata: { category: 'test' },
        },
      ];

      await manager.addDocuments('test-collection', documents);
      
      expect(collection.add).toHaveBeenCalledWith({
        ids: ['doc1'],
        documents: ['Test document content'],
        metadatas: [expect.objectContaining({
          category: 'test',
          indexed_at: expect.any(String),
          content_length: 21,
        })],
      });
    });

    it('should query documents with embeddings', async () => {
      await manager.initialize();
      await manager.createCollection({
        name: 'test-collection',
        description: 'Test collection',
      });

      const queryEmbedding = [0.1, 0.2, 0.3];
      const results = await manager.queryDocuments('test-collection', queryEmbedding);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'doc1',
        content: 'Document 1 content',
        metadata: { type: 'test' },
        distance: 0.1,
        similarity: 0.9,
      });
    });

    it('should perform health check', async () => {
      await manager.initialize();
      
      const health = await manager.healthCheck();
      
      expect(health.connected).toBe(true);
      expect(health.version).toBe('1.0.0');
      expect(health.collections).toBe(1);
    });

    it('should create system collections', async () => {
      await manager.initialize();
      
      await manager.createSystemCollections();
      
      // Should attempt to create all 5 system collections
      expect(mockChromaClient.getCollection).toHaveBeenCalledTimes(5);
    });
  });

  describe('ChromaDBConnectionManager', () => {
    let connectionManager: ChromaDBConnectionManager;

    beforeEach(() => {
      connectionManager = new ChromaDBConnectionManager({
        host: 'localhost',
        port: 8000,
        maxRetries: 3,
        initialRetryDelay: 100,
      });
    });

    afterEach(async () => {
      await connectionManager.disconnect();
    });

    it('should connect successfully', async () => {
      const connected = await connectionManager.connect();
      
      expect(connected).toBe(true);
      expect(connectionManager.isConnected()).toBe(true);
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTED);
    });

    it('should provide connection metrics', async () => {
      await connectionManager.connect();
      
      const metrics = connectionManager.getMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        connectionAttempts: expect.any(Number),
        successfulConnections: expect.any(Number),
        currentState: ConnectionState.CONNECTED,
        averageResponseTime: expect.any(Number),
        uptimePercentage: expect.any(Number),
      }));
    });

    it('should handle connection failures with circuit breaker', async () => {
      mockChromaClient.version.mockRejectedValue(new Error('Connection failed'));
      
      const connected = await connectionManager.connect();
      
      expect(connected).toBe(false);
      expect(connectionManager.getState()).toBe(ConnectionState.FAILED);
      
      const circuitState = connectionManager.getCircuitBreakerState();
      expect(circuitState.failures).toBeGreaterThan(0);
    });

    it('should get/create collections through connection manager', async () => {
      await connectionManager.connect();
      
      const collection = await connectionManager.getCollection('test-collection');
      expect(collection).toBeDefined();
      expect(mockChromaClient.getCollection).toHaveBeenCalled();
    });
  });

  describe('ResilientChromaDBManager', () => {
    let resilientManager: ResilientChromaDBManager;

    beforeEach(async () => {
      resilientManager = new ResilientChromaDBManager({
        chromadb: { host: 'localhost', port: 8000 },
        fallback: { enabled: true, maxInMemoryDocuments: 1000 },
      });
    });

    afterEach(async () => {
      await resilientManager.shutdown();
    });

    it('should initialize with ChromaDB mode', async () => {
      await resilientManager.initialize();
      
      expect(resilientManager.getStorageMode()).toBe(StorageMode.CHROMADB);
    });

    it('should switch to in-memory mode on connection failure', async () => {
      // Mock connection failure
      mockChromaClient.version.mockRejectedValue(new Error('Connection failed'));
      
      await resilientManager.initialize();
      
      expect(resilientManager.getStorageMode()).toBe(StorageMode.IN_MEMORY);
    });

    it('should add documents in both modes', async () => {
      await resilientManager.initialize();
      
      const documents: ChromaDocument[] = [
        {
          id: 'doc1',
          content: 'Test document',
          metadata: { category: 'test' },
        },
      ];

      await resilientManager.addDocuments('test-collection', documents);
      
      // Should work regardless of mode
      expect(true).toBe(true); // Test passes if no error thrown
    });

    it('should provide health status', async () => {
      await resilientManager.initialize();
      
      const health = await resilientManager.getHealthStatus();
      
      expect(health).toEqual(expect.objectContaining({
        status: expect.any(String),
        mode: expect.any(String),
        chromadb: expect.objectContaining({
          connected: expect.any(Boolean),
          state: expect.any(String),
        }),
        inMemory: expect.objectContaining({
          documentCount: expect.any(Number),
          pendingSync: expect.any(Number),
        }),
        message: expect.any(String),
      }));
    });

    it('should handle manual mode switching', async () => {
      await resilientManager.initialize();
      
      await resilientManager.switchToInMemory();
      expect(resilientManager.getStorageMode()).toBe(StorageMode.IN_MEMORY);
      
      // Mock successful reconnection
      mockChromaClient.version.mockResolvedValue('1.0.0');
      const reconnected = await resilientManager.reconnect();
      
      if (reconnected) {
        expect(resilientManager.getStorageMode()).toBe(StorageMode.CHROMADB);
      }
    });
  });

  describe('GroceryVectorCollections', () => {
    let groceryCollections: GroceryVectorCollections;
    let chromaManager: ChromaDBManager;

    beforeEach(async () => {
      chromaManager = new ChromaDBManager({
        host: 'localhost',
        port: 8000,
      });
      await chromaManager.initialize();
      
      groceryCollections = new GroceryVectorCollections(chromaManager);
    });

    it('should initialize all grocery collections', async () => {
      await groceryCollections.initializeCollections();
      
      // Should create 5 grocery collections
      expect(mockChromaClient.getCollection).toHaveBeenCalledTimes(5);
    });

    it('should add a product vector', async () => {
      await groceryCollections.initializeCollections();
      
      const product = {
        product_id: 'prod1',
        name: 'Test Product',
        brand: 'Test Brand',
        category: 'Test Category',
        description: 'Test description',
        search_text: 'test product brand',
        price_range: 'mid' as const,
        dietary_tags: ['vegetarian'],
      };

      await groceryCollections.addProduct(product);
      
      // Should add document to walmart_products collection
      expect(mockChromaClient.getCollection).toHaveBeenCalledWith({
        name: 'walmart_products',
      });
    });

    it('should search for similar products', async () => {
      await groceryCollections.initializeCollections();
      
      const results = await groceryCollections.searchSimilarProducts(
        'organic vegetables',
        { category: 'produce', priceRange: 'mid' },
        5
      );

      expect(results).toBeInstanceOf(Array);
      // Results depend on mock implementation
    });

    it('should add and search recipes', async () => {
      await groceryCollections.initializeCollections();
      
      const recipe = {
        recipe_id: 'recipe1',
        name: 'Test Recipe',
        ingredients: ['ingredient1', 'ingredient2'],
        cuisine_type: 'Italian',
        meal_type: 'dinner',
        prep_time: 30,
        difficulty: 'easy' as const,
        dietary_info: ['vegetarian'],
      };

      await groceryCollections.addRecipe(recipe);
      
      const recipeResults = await groceryCollections.findRecipesByIngredients(
        ['ingredient1'],
        ['vegetarian'],
        3
      );

      expect(recipeResults).toBeInstanceOf(Array);
    });

    it('should store and retrieve shopping patterns', async () => {
      await groceryCollections.initializeCollections();
      
      const pattern = {
        pattern_id: 'pattern1',
        user_id: 'user1',
        pattern_type: 'weekly' as const,
        common_items: ['milk', 'bread', 'eggs'],
        shopping_frequency: 1,
        average_spend: 50,
      };

      await groceryCollections.storeShoppingPattern(pattern);
      
      const recommendations = await groceryCollections.getUserRecommendations(
        'user1',
        ['milk']
      );

      expect(recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling', () => {
    it('should handle ChromaDB connection errors gracefully', async () => {
      mockChromaClient.version.mockRejectedValue(new Error('Connection failed'));
      
      const manager = new ChromaDBManager();
      
      await expect(manager.initialize()).rejects.toThrow('ChromaDB connection failed');
    });

    it('should validate document structure', async () => {
      const manager = new ChromaDBManager();
      await manager.initialize();
      
      const invalidDocuments = [
        {
          id: '', // Invalid empty ID
          content: 'Test content',
          metadata: { test: true },
        },
      ] as ChromaDocument[];

      await expect(manager.addDocuments('test', invalidDocuments))
        .rejects.toThrow('Document ID is required');
    });

    it('should handle collection creation failures', async () => {
      mockChromaClient.getCollection.mockRejectedValue(new Error('Collection not found'));
      mockChromaClient.createCollection.mockRejectedValue(new Error('Creation failed'));
      
      const manager = new ChromaDBManager();
      await manager.initialize();
      
      await expect(manager.createCollection({
        name: 'failing-collection',
        description: 'This should fail',
      })).rejects.toThrow('Creation failed');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large batch operations', async () => {
      const manager = new ChromaDBManager();
      await manager.initialize();
      
      await manager.createCollection({
        name: 'batch-test',
        description: 'Batch testing',
      });

      // Create large batch of documents
      const documents: ChromaDocument[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc${i}`,
        content: `Document ${i} content`,
        metadata: { index: i, category: 'batch-test' },
      }));

      await manager.addDocuments('batch-test', documents);
      
      expect(mockChromaClient.getCollection).toHaveBeenCalled();
    });

    it('should cache collections for performance', async () => {
      const manager = new ChromaDBManager();
      await manager.initialize();
      
      // First call should create/get collection
      const collection1 = await manager.getCollection('cached-collection');
      
      // Second call should use cached version
      const collection2 = await manager.getCollection('cached-collection');
      
      expect(collection1).toBe(collection2);
      expect(mockChromaClient.getCollection).toHaveBeenCalledTimes(1);
    });
  });
});