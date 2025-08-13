/**
 * Circuit Breaker Integration Examples
 * 
 * This file demonstrates how to integrate the CircuitBreakerService with existing services
 * in the Walmart Grocery Agent microservices architecture.
 */

import { circuitBreakerService } from './CircuitBreakerService.js';
import { OllamaProvider, OllamaGenerateOptions } from '../llm/OllamaProvider.js';
import { cacheManager } from '../cache/RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';

/**
 * Enhanced Ollama Provider with Circuit Breaker
 */
export class CircuitBreakerOllamaProvider extends OllamaProvider {
  async generate(prompt: string, options?: OllamaGenerateOptions): Promise<string> {
    return circuitBreakerService.executeOllamaRequest(
      'generate',
      () => super.generate(prompt, options),
      async () => {
        // Fallback: return a simple response when Ollama is down
        logger.warn('Ollama circuit breaker activated, using fallback', 'OLLAMA_CIRCUIT_BREAKER');
        return "I apologize, but I'm experiencing technical difficulties with the AI model. Please try again in a moment.";
      }
    );
  }

  async generateWithLogProbs(
    prompt: string, 
    options?: OllamaGenerateOptions
  ): Promise<any> {
    return circuitBreakerService.executeOllamaRequest(
      'generateWithLogProbs',
      () => super.generateWithLogProbs(prompt, options),
      async () => {
        // Fallback: return basic response structure
        return {
          text: "I apologize, but I'm experiencing technical difficulties with confidence scoring. Please try again in a moment.",
          tokens: undefined,
          logProbs: undefined,
          metadata: {
            model: 'fallback',
            duration: 0,
            tokenCount: 0,
          },
        };
      }
    );
  }

  async embed(text: string): Promise<number[]> {
    return circuitBreakerService.executeOllamaRequest(
      'embed',
      () => super.embed(text),
      async () => {
        // Fallback: return zero vector or cached embedding
        const cached = await cacheManager.get<number[]>(`embedding_fallback_${text.slice(0, 50)}`);
        return cached || new Array(384).fill(0); // Default embedding size
      }
    );
  }

  async listModels(): Promise<any[]> {
    return circuitBreakerService.executeOllamaRequest(
      'listModels',
      () => super.listModels(),
      async () => {
        // Fallback: return cached model list or default models
        const cached = await cacheManager.get<any[]>('models_list_fallback');
        return cached || [{ name: 'llama3.2:3b', modified_at: '', size: 0, digest: '' }];
      }
    );
  }
}

/**
 * Enhanced Cache Manager with Circuit Breaker
 */
export class CircuitBreakerCacheManager {
  private inMemoryCache = new Map<string, { value: any; expiry: number }>();
  private readonly MAX_MEMORY_CACHE_SIZE = 1000;

  async get<T>(key: string, namespace: string = 'default'): Promise<T | null> {
    return circuitBreakerService.executeRedisOperation(
      'get',
      () => cacheManager.get<T>(key, namespace),
      this.getFromMemoryCache<T>(key, namespace)
    );
  }

  async set<T>(key: string, value: T, config?: any): Promise<boolean> {
    // Always try to set in memory cache as backup
    this.setInMemoryCache(key, value, config?.ttl || 3600);

    return circuitBreakerService.executeRedisOperation(
      'set',
      () => cacheManager.set(key, value, config),
      true // Fallback: consider it successful if Redis is down
    );
  }

  async del(key: string, namespace: string = 'default'): Promise<boolean> {
    // Remove from memory cache too
    this.deleteFromMemoryCache(key, namespace);

    return circuitBreakerService.executeRedisOperation(
      'del',
      () => cacheManager.del(key, namespace),
      true
    );
  }

  async mget<T>(keys: string[], namespace: string = 'default'): Promise<Map<string, T>> {
    return circuitBreakerService.executeRedisOperation(
      'mget',
      () => cacheManager.mget<T>(keys, namespace),
      new Map<string, T>() // Empty map fallback
    );
  }

  private getFromMemoryCache<T>(key: string, namespace: string): T | null {
    const fullKey = `${namespace}:${key}`;
    const cached = this.inMemoryCache.get(fullKey);
    
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.inMemoryCache.delete(fullKey);
      return null;
    }
    
    return cached.value as T;
  }

  private setInMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
    const fullKey = `default:${key}`;
    
    // Prevent memory leaks
    if (this.inMemoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      const oldestKey = this.inMemoryCache.keys().next().value;
      this.inMemoryCache.delete(oldestKey);
    }
    
    this.inMemoryCache.set(fullKey, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000),
    });
  }

  private deleteFromMemoryCache(key: string, namespace: string): void {
    const fullKey = `${namespace}:${key}`;
    this.inMemoryCache.delete(fullKey);
  }
}

/**
 * Database Service with Circuit Breaker
 */
export class CircuitBreakerDatabaseService {
  constructor(private db: any) {}

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return circuitBreakerService.executeDatabaseQuery(
      'query',
      () => this.db.prepare(sql).all(params) as T[],
      [] as T[] // Empty array fallback
    );
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return circuitBreakerService.executeDatabaseQuery(
      'get',
      () => this.db.prepare(sql).get(params) as T | undefined,
      undefined
    );
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    return circuitBreakerService.executeDatabaseQuery(
      'run',
      () => this.db.prepare(sql).run(params),
      { changes: 0, lastInsertRowid: null } // Fallback result
    );
  }

  async transaction<T>(operations: (() => T)[]): Promise<T[]> {
    return circuitBreakerService.executeDatabaseQuery(
      'transaction',
      async () => {
        const transaction = this.db.transaction(() => {
          return operations.map(op => op());
        });
        return transaction();
      },
      [] as T[]
    );
  }
}

/**
 * External API Service with Circuit Breaker (Walmart Pricing Example)
 */
export class CircuitBreakerWalmartAPI {
  private baseURL = 'https://developer.api.walmart.com';

  async getProductPrice(productId: string): Promise<any> {
    return circuitBreakerService.executeExternalAPI(
      'walmart',
      'getProductPrice',
      async () => {
        const response = await axios.get(`${this.baseURL}/v1/items/${productId}`, {
          headers: { 'WM_SVC.NAME': 'Walmart Open API' },
          timeout: 30000,
        });
        return response.data;
      },
      {
        // Fallback data structure
        itemId: productId,
        name: 'Product information temporarily unavailable',
        salePrice: null,
        msrp: null,
        availability: 'UNKNOWN',
        error: 'SERVICE_UNAVAILABLE',
      }
    );
  }

  async searchProducts(query: string, options: any = {}): Promise<any> {
    return circuitBreakerService.executeExternalAPI(
      'walmart',
      'searchProducts',
      async () => {
        const response = await axios.get(`${this.baseURL}/v1/search`, {
          params: { query, ...options },
          headers: { 'WM_SVC.NAME': 'Walmart Open API' },
          timeout: 45000,
        });
        return response.data;
      },
      {
        // Fallback search results
        items: [],
        totalResults: 0,
        query,
        error: 'SEARCH_SERVICE_UNAVAILABLE',
      }
    );
  }
}

/**
 * WebSocket Service with Circuit Breaker
 */
export class CircuitBreakerWebSocketService {
  private connections = new Set<any>();

  async broadcast(message: any): Promise<void> {
    return circuitBreakerService.executeWebSocketOperation(
      'broadcast',
      async () => {
        const promises = Array.from(this.connections).map(ws => 
          new Promise<void>((resolve, reject) => {
            try {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(message));
                resolve();
              } else {
                reject(new Error('WebSocket not open'));
              }
            } catch (error) {
              reject(error);
            }
          })
        );
        
        await Promise.allSettled(promises);
      },
      true // Enable queue fallback
    );
  }

  async sendToUser(userId: string, message: any): Promise<void> {
    return circuitBreakerService.executeWebSocketOperation(
      'sendToUser',
      async () => {
        const userConnection = Array.from(this.connections).find(
          (ws: any) => ws.userId === userId
        );
        
        if (!userConnection || userConnection.readyState !== userConnection.OPEN) {
          throw new Error(`User ${userId} not connected`);
        }
        
        userConnection.send(JSON.stringify(message));
      },
      true
    );
  }
}

/**
 * Service Mesh Communication with Circuit Breaker
 */
export class CircuitBreakerServiceMesh {
  async callService<T>(
    serviceName: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    return circuitBreakerService.executeServiceCall(
      serviceName,
      endpoint,
      async () => {
        const response = await axios({
          method,
          url: `http://${serviceName}:3000${endpoint}`,
          data,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'walmart-grocery-agent',
            'X-Request-Id': `req_${Date.now()}_${Math.random()}`,
          },
        });
        
        return response.data as T;
      },
      null as T
    );
  }

  async callNLPService(text: string): Promise<any> {
    return this.callService('nlp-service', '/analyze', 'POST', { text });
  }

  async callPricingService(productIds: string[]): Promise<any> {
    return this.callService('pricing-service', '/bulk-prices', 'POST', { productIds });
  }

  async callInventoryService(storeId: string): Promise<any> {
    return this.callService('inventory-service', `/stores/${storeId}/inventory`);
  }
}

/**
 * Usage Examples and Integration Tests
 */
export class CircuitBreakerIntegrationExamples {
  private ollamaProvider = new CircuitBreakerOllamaProvider({
    model: 'llama3.2:3b',
    baseUrl: 'http://localhost:11434',
  });
  
  private cacheService = new CircuitBreakerCacheManager();
  private walmartAPI = new CircuitBreakerWalmartAPI();
  private wsService = new CircuitBreakerWebSocketService();
  private serviceMesh = new CircuitBreakerServiceMesh();

  /**
   * Example: Complete grocery list processing with circuit breaker protection
   */
  async processGroceryList(userInput: string, userId: string): Promise<any> {
    try {
      // Step 1: Use LLM to parse grocery list (with circuit breaker)
      const parsedList = await this.ollamaProvider.generate(
        `Parse this grocery list and extract items with quantities: ${userInput}`,
        { format: 'json', temperature: 0.1 }
      );

      // Step 2: Cache the parsed result (with circuit breaker)
      await this.cacheService.set(`grocery_list_${userId}`, parsedList, { ttl: 3600 });

      // Step 3: Get pricing information (with circuit breaker)
      const products = JSON.parse(parsedList).items || [];
      const pricePromises = products.map((product: any) => 
        this.walmartAPI.getProductPrice(product.id)
      );
      const prices = await Promise.allSettled(pricePromises);

      // Step 4: Send real-time update to user (with circuit breaker)
      await this.wsService.sendToUser(userId, {
        type: 'grocery_list_processed',
        data: { products, prices },
      });

      // Step 5: Call inventory service to check availability (with circuit breaker)
      const inventory = await this.serviceMesh.callInventoryService('store_123');

      return {
        success: true,
        parsedList: JSON.parse(parsedList),
        prices,
        inventory,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Grocery list processing failed', 'CIRCUIT_BREAKER_INTEGRATION', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return partial results if some services failed
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        partialData: await this.cacheService.get(`grocery_list_${userId}`),
      };
    }
  }

  /**
   * Example: Health check for all circuit breakers
   */
  async performHealthCheck(): Promise<any> {
    const health = circuitBreakerService.getSystemHealth();
    
    logger.info('Circuit breaker health check completed', 'HEALTH_CHECK', {
      overall: health.overall,
      servicesChecked: Object.keys(health.services).length,
      openCircuits: Object.entries(health.services).filter(
        ([_, service]: [string, any]) => 
          Object.values(service.circuitBreakers).some((cb: any) => cb.state === 'open')
      ).length,
    });

    return health;
  }

  /**
   * Example: Manual circuit breaker management
   */
  async emergencyMaintenance(service: string): Promise<void> {
    // Force circuit breaker open for maintenance
    circuitBreakerService.forceCircuitBreakerOpen(service);
    
    logger.info('Emergency maintenance mode activated', 'MAINTENANCE', { service });
    
    // Perform maintenance tasks...
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Reset circuit breaker after maintenance
    circuitBreakerService.resetCircuitBreaker(service);
    
    logger.info('Emergency maintenance mode deactivated', 'MAINTENANCE', { service });
  }

  /**
   * Example: Dead letter queue processing
   */
  async processPendingOperations(): Promise<number> {
    const deadLetters = circuitBreakerService.getDeadLetterQueue();
    let processedCount = 0;

    for (const item of deadLetters) {
      try {
        const success = await circuitBreakerService.retryDeadLetterItem(item.id);
        if (success) {
          processedCount++;
        }
      } catch (error) {
        logger.warn('Failed to retry dead letter item', 'DLQ_PROCESSOR', {
          itemId: item.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Dead letter queue processing completed', 'DLQ_PROCESSOR', {
      totalItems: deadLetters.length,
      processedCount,
      remainingCount: deadLetters.length - processedCount,
    });

    return processedCount;
  }
}

// Export singleton instances for easy access
export const enhancedOllamaProvider = new CircuitBreakerOllamaProvider({
  model: 'llama3.2:3b',
  baseUrl: 'http://localhost:11434',
});

export const enhancedCacheManager = new CircuitBreakerCacheManager();
export const walmartAPIService = new CircuitBreakerWalmartAPI();
export const webSocketService = new CircuitBreakerWebSocketService();
export const serviceMeshClient = new CircuitBreakerServiceMesh();
export const integrationExamples = new CircuitBreakerIntegrationExamples();