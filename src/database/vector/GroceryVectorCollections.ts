/**
 * Grocery Vector Collections - ChromaDB collections for Walmart grocery features
 * Manages product embeddings, search history, and recommendation vectors
 */

import { ChromaClient, Collection } from "chromadb";
import { logger } from "../../utils/logger";
import type { WalmartProduct } from "../../types/walmart-grocery";

interface CollectionConfig {
  name: string;
  metadata: Record<string, any>;
  embeddingFunction?: any;
}

interface ProductEmbedding {
  id: string;
  embedding: number[];
  metadata: {
    name: string;
    brand?: string;
    category?: string;
    price?: number;
    inStock?: boolean;
    rating?: number;
    department?: string;
  };
  document: string;
}

export class GroceryVectorCollections {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();
  private initialized: boolean = false;

  // Collection names
  private readonly PRODUCTS_COLLECTION = "walmart_products";
  private readonly SEARCH_HISTORY_COLLECTION = "walmart_search_history";
  private readonly USER_PREFERENCES_COLLECTION = "walmart_user_preferences";
  private readonly RECOMMENDATIONS_COLLECTION = "walmart_recommendations";

  constructor(client: ChromaClient) {
    this.client = client;
  }

  /**
   * Initialize all grocery-related collections
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info("Grocery vector collections already initialized", "GROCERY_VECTORS");
      return;
    }

    try {
      logger.info("Initializing grocery vector collections", "GROCERY_VECTORS");

      // Create collections
      await this.createProductsCollection();
      await this.createSearchHistoryCollection();
      await this.createUserPreferencesCollection();
      await this.createRecommendationsCollection();

      this.initialized = true;
      logger.info("Grocery vector collections initialized successfully", "GROCERY_VECTORS");
    } catch (error) {
      logger.error("Failed to initialize grocery vector collections", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Create products collection
   */
  private async createProductsCollection(): Promise<void> {
    try {
      const collection = await this.client.getOrCreateCollection({
        name: this.PRODUCTS_COLLECTION,
        metadata: {
          description: "Walmart product embeddings for semantic search",
          created_at: new Date().toISOString(),
          vector_size: 384,
          distance_metric: "cosine"
        }
      });

      this.collections.set(this.PRODUCTS_COLLECTION, collection);
      logger.info("Products collection created/loaded", "GROCERY_VECTORS");
    } catch (error) {
      logger.error("Failed to create products collection", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Create search history collection
   */
  private async createSearchHistoryCollection(): Promise<void> {
    try {
      const collection = await this.client.getOrCreateCollection({
        name: this.SEARCH_HISTORY_COLLECTION,
        metadata: {
          description: "User search history embeddings for personalization",
          created_at: new Date().toISOString(),
          vector_size: 384,
          distance_metric: "cosine"
        }
      });

      this.collections.set(this.SEARCH_HISTORY_COLLECTION, collection);
      logger.info("Search history collection created/loaded", "GROCERY_VECTORS");
    } catch (error) {
      logger.error("Failed to create search history collection", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Create user preferences collection
   */
  private async createUserPreferencesCollection(): Promise<void> {
    try {
      const collection = await this.client.getOrCreateCollection({
        name: this.USER_PREFERENCES_COLLECTION,
        metadata: {
          description: "User preference embeddings for recommendation",
          created_at: new Date().toISOString(),
          vector_size: 384,
          distance_metric: "cosine"
        }
      });

      this.collections.set(this.USER_PREFERENCES_COLLECTION, collection);
      logger.info("User preferences collection created/loaded", "GROCERY_VECTORS");
    } catch (error) {
      logger.error("Failed to create user preferences collection", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Create recommendations collection
   */
  private async createRecommendationsCollection(): Promise<void> {
    try {
      const collection = await this.client.getOrCreateCollection({
        name: this.RECOMMENDATIONS_COLLECTION,
        metadata: {
          description: "Product recommendation embeddings",
          created_at: new Date().toISOString(),
          vector_size: 384,
          distance_metric: "cosine"
        }
      });

      this.collections.set(this.RECOMMENDATIONS_COLLECTION, collection);
      logger.info("Recommendations collection created/loaded", "GROCERY_VECTORS");
    } catch (error) {
      logger.error("Failed to create recommendations collection", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Add product to vector database
   */
  async addProduct(product: WalmartProduct, embedding: number[]): Promise<void> {
    try {
      const collection = this.collections.get(this.PRODUCTS_COLLECTION);
      if (!collection) {
        throw new Error("Products collection not initialized");
      }

      const document = this.createProductDocument(product);
      const metadata = this.createProductMetadata(product);

      await collection.add({
        ids: [product.product_id],
        embeddings: [embedding],
        metadatas: [metadata],
        documents: [document]
      });

      logger.info("Added product to vector database", "GROCERY_VECTORS", { 
        productId: product.product_id 
      });
    } catch (error) {
      logger.error("Failed to add product to vector database", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Add multiple products in batch
   */
  async addProductsBatch(products: Array<{ product: WalmartProduct; embedding: number[] }>): Promise<void> {
    try {
      const collection = this.collections.get(this.PRODUCTS_COLLECTION);
      if (!collection) {
        throw new Error("Products collection not initialized");
      }

      const ids = products.map(p => p.product.product_id);
      const embeddings = products.map(p => p.embedding);
      const metadatas = products.map(p => this.createProductMetadata(p.product));
      const documents = products.map(p => this.createProductDocument(p.product));

      await collection.add({
        ids,
        embeddings,
        metadatas,
        documents
      });

      logger.info("Added product batch to vector database", "GROCERY_VECTORS", { 
        count: products.length 
      });
    } catch (error) {
      logger.error("Failed to add product batch", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Search for similar products
   */
  async searchSimilarProducts(
    queryEmbedding: number[],
    limit: number = 10,
    filters?: Record<string, any>
  ): Promise<Array<{ id: string; score: number; metadata: any }>> {
    try {
      const collection = this.collections.get(this.PRODUCTS_COLLECTION);
      if (!collection) {
        throw new Error("Products collection not initialized");
      }

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: filters
      });

      if (!results.ids || !results.ids[0]) {
        return [];
      }

      return results.ids[0].map((id, index) => ({
        id,
        score: results.distances ? 1 - results.distances[0][index] : 0,
        metadata: results.metadatas ? results.metadatas[0][index] : {}
      }));
    } catch (error) {
      logger.error("Failed to search similar products", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Add search to history
   */
  async addSearchHistory(
    userId: string,
    query: string,
    embedding: number[],
    results: string[]
  ): Promise<void> {
    try {
      const collection = this.collections.get(this.SEARCH_HISTORY_COLLECTION);
      if (!collection) {
        throw new Error("Search history collection not initialized");
      }

      const id = `${userId}_${Date.now()}`;
      const metadata = {
        userId,
        query,
        timestamp: new Date().toISOString(),
        resultCount: results.length,
        topResults: results.slice(0, 5)
      };

      await collection.add({
        ids: [id],
        embeddings: [embedding],
        metadatas: [metadata],
        documents: [query]
      });

      // Clean old entries (keep last 100 per user)
      await this.cleanOldSearchHistory(userId);
    } catch (error) {
      logger.error("Failed to add search history", "GROCERY_VECTORS", { error });
    }
  }

  /**
   * Get user search patterns
   */
  async getUserSearchPatterns(
    userId: string,
    limit: number = 20
  ): Promise<Array<{ query: string; timestamp: string; frequency: number }>> {
    try {
      const collection = this.collections.get(this.SEARCH_HISTORY_COLLECTION);
      if (!collection) {
        throw new Error("Search history collection not initialized");
      }

      const results = await collection.get({
        where: { userId },
        limit
      });

      // Aggregate by query
      const patterns = new Map<string, { timestamp: string; count: number }>();
      
      if (results.metadatas) {
        results.metadatas.forEach((metadata: any) => {
          const query = metadata.query;
          if (!patterns.has(query)) {
            patterns.set(query, { timestamp: metadata.timestamp, count: 0 });
          }
          patterns.get(query)!.count++;
        });
      }

      return Array.from(patterns.entries())
        .map(([query, data]) => ({
          query,
          timestamp: data.timestamp,
          frequency: data.count
        }))
        .sort((a, b) => b.frequency - a.frequency);
    } catch (error) {
      logger.error("Failed to get user search patterns", "GROCERY_VECTORS", { error });
      return [];
    }
  }

  /**
   * Update user preference embedding
   */
  async updateUserPreferences(
    userId: string,
    preferenceEmbedding: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const collection = this.collections.get(this.USER_PREFERENCES_COLLECTION);
      if (!collection) {
        throw new Error("User preferences collection not initialized");
      }

      // Upsert user preferences
      await collection.upsert({
        ids: [userId],
        embeddings: [preferenceEmbedding],
        metadatas: [{
          ...metadata,
          userId,
          updatedAt: new Date().toISOString()
        }],
        documents: [JSON.stringify(metadata)]
      });

      logger.info("Updated user preferences", "GROCERY_VECTORS", { userId });
    } catch (error) {
      logger.error("Failed to update user preferences", "GROCERY_VECTORS", { error });
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(
    userId: string,
    contextEmbedding: number[],
    limit: number = 10
  ): Promise<string[]> {
    try {
      // Get user preferences
      const prefsCollection = this.collections.get(this.USER_PREFERENCES_COLLECTION);
      const userPrefs = await prefsCollection?.get({ ids: [userId] });
      
      // Combine user preferences with context
      let queryEmbedding = contextEmbedding;
      if (userPrefs?.embeddings && userPrefs.embeddings[0]) {
        // Average the embeddings
        queryEmbedding = contextEmbedding.map((val, idx) => 
          (val + userPrefs.embeddings![0][idx]) / 2
        );
      }

      // Search for products
      const results = await this.searchSimilarProducts(queryEmbedding, limit);
      
      return results.map(r => r.id);
    } catch (error) {
      logger.error("Failed to get personalized recommendations", "GROCERY_VECTORS", { error });
      return [];
    }
  }

  /**
   * Helper: Create product document for indexing
   */
  private createProductDocument(product: WalmartProduct): string {
    const parts = [
      product.name,
      product.brand,
      product.description,
      product.category_path,
      product.department
    ].filter(Boolean);

    return parts.join(" ");
  }

  /**
   * Helper: Create product metadata
   */
  private createProductMetadata(product: WalmartProduct): Record<string, any> {
    return {
      name: product.name,
      brand: product.brand,
      category: product.category_path?.split("/")[0],
      department: product.department,
      price: product.current_price,
      inStock: product.in_stock,
      rating: product.average_rating,
      reviewCount: product.review_count
    };
  }

  /**
   * Helper: Clean old search history
   */
  private async cleanOldSearchHistory(userId: string): Promise<void> {
    try {
      const collection = this.collections.get(this.SEARCH_HISTORY_COLLECTION);
      if (!collection) return;

      // Get all user's searches
      const results = await collection.get({
        where: { userId }
      });

      if (results.ids && results.ids.length > 100) {
        // Sort by timestamp and keep only recent 100
        const sorted = results.ids
          .map((id, idx) => ({
            id,
            timestamp: results.metadatas![idx].timestamp
          }))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        const toDelete = sorted.slice(100).map(item => item.id);
        
        if (toDelete.length > 0) {
          await collection.delete({ ids: toDelete });
          logger.info("Cleaned old search history", "GROCERY_VECTORS", { 
            userId, 
            deleted: toDelete.length 
          });
        }
      }
    } catch (error) {
      logger.error("Failed to clean search history", "GROCERY_VECTORS", { error });
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<Record<string, { count: number; metadata: any }>> {
    const stats: Record<string, { count: number; metadata: any }> = {};

    for (const [name, collection] of this.collections) {
      try {
        const count = await collection.count();
        stats[name] = {
          count,
          metadata: (collection as any).metadata || {}
        };
      } catch (error) {
        stats[name] = { count: 0, metadata: {} };
      }
    }

    return stats;
  }

  /**
   * Delete all collections (for testing/reset)
   */
  async deleteAllCollections(): Promise<void> {
    for (const name of this.collections.keys()) {
      try {
        await this.client.deleteCollection({ name });
        logger.info(`Deleted collection: ${name}`, "GROCERY_VECTORS");
      } catch (error) {
        logger.error(`Failed to delete collection: ${name}`, "GROCERY_VECTORS", { error });
      }
    }
    this.collections.clear();
    this.initialized = false;
  }
}