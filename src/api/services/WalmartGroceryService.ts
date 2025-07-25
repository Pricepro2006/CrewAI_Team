/**
 * Walmart Grocery Service - Core business logic for Walmart grocery operations
 * Handles product search, cart management, list operations, and substitutions
 */

import { logger } from "../../utils/logger";
import type { WalmartProductRepository, SubstitutionRepository, UserPreferencesRepository } from "../../database/repositories/WalmartProductRepository";
import type { GroceryListRepository, GroceryItemRepository, ShoppingSessionRepository } from "../../database/repositories/GroceryRepository";
import { getDatabaseManager } from "../../database/DatabaseManager";
import { BrightDataScraper } from "./BrightDataScraper";
import { ProductLookupService } from "./ProductLookupService";
import { DealMatchingService } from "./DealMatchingService";
import { ChromaDBManager } from "../../database/vector/ChromaDBManager";
import type { 
  WalmartProduct, 
  GroceryList as ServiceGroceryList, 
  GroceryItem as ServiceGroceryItem, 
  ShoppingSession as ServiceShoppingSession,
  Substitution,
  UserPreferences as ServiceUserPreferences 
} from "../../types/walmart-grocery";
import type { 
  GroceryList as RepoGroceryList,
  GroceryItem as RepoGroceryItem,
  ShoppingSession as RepoShoppingSession
} from "../../database/repositories/GroceryRepository";

export interface SearchOptions {
  query: string;
  category?: string;
  priceRange?: { min: number; max: number };
  inStockOnly?: boolean;
  sortBy?: "price" | "rating" | "relevance";
  limit?: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  listId?: string;
  notes?: string;
}

export interface SubstitutionOptions {
  similarityThreshold?: number;
  maxPriceDifference?: number;
  preferredBrands?: string[];
  avoidBrands?: string[];
}

// Type adapters to convert between repository and service types
type WalmartProductWithScore = WalmartProduct & { similarity_score: number };
const convertRepoGroceryItemToService = (repoItem: RepoGroceryItem): ServiceGroceryItem => ({
  id: repoItem.id,
  listId: repoItem.list_id,
  productId: repoItem.product_id || '',
  quantity: repoItem.quantity,
  notes: repoItem.notes,
  isPurchased: repoItem.status === 'purchased',
  addedAt: new Date(repoItem.created_at || Date.now()),
  purchasedAt: repoItem.status === 'purchased' ? new Date() : undefined,
  estimatedPrice: repoItem.estimated_price
});

const convertRepoShoppingSessionToService = (repoSession: RepoShoppingSession): ServiceShoppingSession => ({
  id: repoSession.id,
  userId: repoSession.user_id,
  listId: repoSession.list_id,
  startTime: new Date(repoSession.started_at || Date.now()),
  endTime: repoSession.completed_at ? new Date(repoSession.completed_at) : undefined,
  status: repoSession.status === 'cancelled' ? 'abandoned' : (repoSession.status || 'active') as 'active' | 'paused' | 'completed' | 'abandoned',
  itemsScanned: repoSession.items_found || 0,
  totalAmount: repoSession.total_amount || 0,
  storeId: ''
});

export class WalmartGroceryService {
  private static instance: WalmartGroceryService;
  
  private productRepo: WalmartProductRepository;
  private substitutionRepo: SubstitutionRepository;
  private preferencesRepo: UserPreferencesRepository;
  private listRepo: GroceryListRepository;
  private itemRepo: GroceryItemRepository;
  private sessionRepo: ShoppingSessionRepository;
  private scraper: BrightDataScraper;
  private lookupService: ProductLookupService;
  private dealService: DealMatchingService;
  private chromadb: ChromaDBManager;

  private constructor() {
    const dbManager = getDatabaseManager();
    
    // Initialize repositories
    this.productRepo = dbManager.walmartProducts;
    this.substitutionRepo = dbManager.substitutions;
    this.preferencesRepo = dbManager.userPreferences;
    this.listRepo = dbManager.groceryLists;
    this.itemRepo = dbManager.groceryItems;
    this.sessionRepo = dbManager.shoppingSessions;
    
    // Initialize services
    this.scraper = BrightDataScraper.getInstance();
    this.lookupService = ProductLookupService.getInstance();
    this.dealService = DealMatchingService.getInstance();
    this.chromadb = new ChromaDBManager();
  }

  static getInstance(): WalmartGroceryService {
    if (!WalmartGroceryService.instance) {
      WalmartGroceryService.instance = new WalmartGroceryService();
    }
    return WalmartGroceryService.instance;
  }

  /**
   * Search for products with advanced filtering
   */
  async searchProducts(options: SearchOptions): Promise<WalmartProduct[]> {
    try {
      logger.info("Searching products", "WALMART_SERVICE", { options });

      // First check local database
      let localResults = await this.productRepo.searchProducts(options.query, {
        category: options.category,
        inStock: options.inStockOnly,
        limit: options.limit || 20
      });

      // Apply filters
      if (options.category) {
        localResults = localResults.filter(p => p.category?.includes(options.category!));
      }

      if (options.inStockOnly) {
        localResults = localResults.filter(p => p.in_stock);
      }

      if (options.priceRange) {
        localResults = localResults.filter(p => {
          const price = p.price || 0;
          return price >= options.priceRange!.min && price <= options.priceRange!.max;
        });
      }

      // If not enough local results, fetch from web
      if (localResults.length < (options.limit || 20)) {
        const webResults = await this.scraper.searchWalmartProducts({
          query: options.query,
          limit: options.limit,
          filters: {
            category: options.category,
            priceRange: options.priceRange,
            inStock: options.inStockOnly
          }
        });

        // Convert local results to WalmartProduct format
        const localWalmartProducts = localResults.map(entity => this.transformEntityToProduct(entity));
        
        // Merge and deduplicate results
        const mergedResults = this.mergeProductResults(localWalmartProducts, webResults);
        
        // Update local database with new products
        for (const product of webResults) {
          await this.productRepo.upsertProduct(product);
        }

        return mergedResults;
      }

      return localResults.map(entity => this.transformEntityToProduct(entity));
    } catch (error) {
      logger.error("Product search failed", "WALMART_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Get product details with real-time pricing
   */
  async getProductDetails(productId: string, includeRealTime: boolean = true): Promise<WalmartProduct | null> {
    try {
      // Get from database first
      const productEntity = await this.productRepo.findById(productId);
      const product = productEntity ? this.transformEntityToProduct(productEntity) : null;
      
      if (!product) {
        // Try to fetch from web
        const webProduct = await this.scraper.getProductDetails(productId);
        if (webProduct) {
          await this.productRepo.upsertProduct(webProduct);
          return webProduct;
        }
        return null;
      }

      // Check if we need real-time update
      if (includeRealTime && this.needsPriceUpdate(product)) {
        const updatedProduct = await this.scraper.getProductDetails(productId);
        if (updatedProduct) {
          await this.productRepo.upsertProduct(updatedProduct);
          
          // Record price history if price changed
          if (updatedProduct.price !== product.price) {
            // TODO: Implement recordPriceHistory method in repository
            // await this.productRepo.recordPriceHistory(
            //   productId, 
            //   updatedProduct.price!,
            //   updatedProduct.price! < (updatedProduct.originalPrice || updatedProduct.price)!
            // );
          }
          
          return updatedProduct;
        }
      }

      return product;
    } catch (error) {
      logger.error("Failed to get product details", "WALMART_SERVICE", { error, productId });
      throw error;
    }
  }

  /**
   * Create a new grocery list
   */
  async createGroceryList(userId: string, name: string, description?: string): Promise<ServiceGroceryList> {
    try {
      const list = await this.listRepo.createList({
        user_id: userId,
        list_name: name,
        description,
        list_type: "shopping",
        status: "active"
      });

      logger.info("Created grocery list", "WALMART_SERVICE", { 
        listId: list.id, 
        userId, 
        name 
      });

      // Transform database GroceryList to expected type
      return this.transformDatabaseListToType(list);
    } catch (error) {
      logger.error("Failed to create grocery list", "WALMART_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Add items to grocery list - OPTIMIZED to prevent N+1 queries
   */
  async addItemsToList(listId: string, items: CartItem[]): Promise<ServiceGroceryItem[]> {
    try {
      if (items.length === 0) return [];

      // OPTIMIZATION: Batch fetch all products at once instead of N queries
      const productIds = items.map(item => item.productId);
      const products = await this.productRepo.findByIds(productIds);
      const productMap = new Map(products.map(p => [p.product_id, p]));

      // Use database transaction for consistency
      return await this.productRepo.transaction(async () => {
        const addedItems: ServiceGroceryItem[] = [];

        for (const item of items) {
          const productEntity = productMap.get(item.productId);
          
          if (!productEntity) {
            logger.warn("Product not found for list item", "WALMART_SERVICE", { 
              productId: item.productId 
            });
            continue;
          }

          // Convert entity to product format
          const product = this.productRepo.entityToProduct(productEntity);

          const groceryItem = await this.itemRepo.addItem({
            list_id: listId,
            item_name: product.name,
            product_id: product.id,
            category: product.category?.split("/")[0],
            quantity: item.quantity,
            estimated_price: product.price,
            notes: item.notes
          });

          addedItems.push(convertRepoGroceryItemToService(groceryItem));
        }

        logger.info("Added items to list with batch optimization", "WALMART_SERVICE", { 
          listId, 
          itemCount: addedItems.length,
          batchSize: productIds.length
        });

        return addedItems;
      });

    } catch (error) {
      logger.error("Failed to add items to list", "WALMART_SERVICE", { error });
      throw error;
    } finally {
      // Update list total asynchronously to avoid blocking
      this.updateListTotal(listId).catch(err => 
        logger.error("Failed to update list total", "WALMART_SERVICE", { listId, error: err })
      );
    }
  }

  /**
   * Find substitutions for unavailable products
   */
  async findSubstitutions(
    productId: string, 
    userId: string,
    options?: SubstitutionOptions
  ): Promise<WalmartProduct[]> {
    try {
      // Get user preferences
      const preferences = await this.preferencesRepo.getPreference(userId, "grocery_substitution", null);
      
      // Get original product
      const originalProduct = await this.getProductDetails(productId);
      if (!originalProduct) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Find similar products
      // Use searchProducts as fallback since findSimilarProducts doesn't exist
      const substituteEntities = await this.productRepo.searchProducts(`similar to ${productId}`, { limit: 10 });

      // Convert ProductEntity[] to WalmartProduct[]
      let substitutes = substituteEntities.map(entity => this.transformEntityToProduct(entity));

      // Apply user preferences
      if (preferences) {
        substitutes = this.applyUserPreferences(substitutes, preferences, options);
      }

      // Score and rank substitutions
      const scoredSubstitutes = await this.scoreSubstitutions(
        originalProduct, 
        substitutes,
        options?.similarityThreshold || 0.7
      );

      // Record substitution suggestions
      for (const substitute of scoredSubstitutes.slice(0, 3)) {
        await this.substitutionRepo.create({
          original_product_id: productId,
          substitute_product_id: substitute.id,
          confidence_score: 0.8, // Placeholder - would calculate real score
          price_difference: (substitute.price || 0) - (originalProduct.price || 0),
          reason: "system_generated"
        });
      }

      return scoredSubstitutes;
    } catch (error) {
      logger.error("Failed to find substitutions", "WALMART_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Start a shopping session
   */
  async startShoppingSession(
    userId: string, 
    listId?: string,
    type: "online" | "in_store" | "pickup" | "delivery" = "online"
  ): Promise<ServiceShoppingSession> {
    try {
      const session = await this.sessionRepo.createSession({
        user_id: userId,
        list_id: listId,
        session_type: type,
        status: "active"
      });

      logger.info("Started shopping session", "WALMART_SERVICE", { 
        sessionId: session.id,
        userId,
        type 
      });

      return convertRepoShoppingSessionToService(session);
    } catch (error) {
      logger.error("Failed to start shopping session", "WALMART_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Process checkout for a shopping session
   */
  async processCheckout(sessionId: string): Promise<ServiceShoppingSession> {
    try {
      const session = await this.sessionRepo.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Calculate totals
      const items = await this.itemRepo.getItemsByList(session.list_id!);
      let subtotal = 0;
      let itemsFound = 0;
      let itemsSubstituted = 0;

      for (const item of items) {
        if (item.status === "purchased") {
          subtotal += (item.actual_price || item.estimated_price || 0) * item.quantity;
          itemsFound++;
        } else if (item.status === "substituted") {
          itemsSubstituted++;
        }
      }

      // Update session with totals
      const updatedSession = await this.sessionRepo.updateSession(sessionId, {
        items_total: items.length,
        items_found: itemsFound,
        items_substituted: itemsSubstituted,
        subtotal,
        status: "completed",
        completed_at: new Date().toISOString()
      });

      logger.info("Completed checkout", "WALMART_SERVICE", { 
        sessionId,
        total: subtotal,
        itemsFound 
      });

      return convertRepoShoppingSessionToService(updatedSession);
    } catch (error) {
      logger.error("Failed to process checkout", "WALMART_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(userId: string, context?: any): Promise<WalmartProduct[]> {
    try {
      // Get user preferences and history
      const preferences = await this.preferencesRepo.getPreference(userId, "grocery_substitution", null);
      const recentSessions = await this.sessionRepo.getUserSessions(userId, "completed", 5);
      
      // Build recommendation context
      const recommendationContext = {
        preferences,
        recentPurchases: await this.getRecentPurchases(userId),
        frequentItems: await this.getFrequentItems(userId),
        ...context
      };

      // Use vector search for recommendations
      const recommendations = await this.lookupService.getPersonalizedRecommendations(
        userId,
        recommendationContext
      );

      logger.info("Generated recommendations", "WALMART_SERVICE", { 
        userId,
        count: recommendations.length 
      });

      return recommendations;
    } catch (error) {
      logger.error("Failed to get recommendations", "WALMART_SERVICE", { error });
      return [];
    }
  }

  /**
   * Helper: Check if product needs price update
   */
  private needsPriceUpdate(product: WalmartProduct): boolean {
    // For now, always return true to ensure fresh data
    // In production, this would check against a timestamp field
    return true;
  }

  /**
   * Helper: Merge product results from different sources
   */
  private mergeProductResults(local: WalmartProduct[], web: WalmartProduct[]): WalmartProduct[] {
    const merged = new Map<string, WalmartProduct>();
    
    // Add local results first
    local.forEach(p => merged.set(p.id, p));
    
    // Add web results, preferring newer data
    web.forEach(p => {
      const existing = merged.get(p.id);
      if (!existing || this.needsPriceUpdate(existing)) {
        merged.set(p.id, p);
      }
    });
    
    return Array.from(merged.values());
  }

  /**
   * Helper: Apply user preferences to product list
   */
  private applyUserPreferences(
    products: WalmartProduct[], 
    preferences: ServiceUserPreferences,
    options?: SubstitutionOptions
  ): WalmartProduct[] {
    let filtered = products;

    // Apply brand preferences
    const preferredBrands = options?.preferredBrands || preferences.preferredBrands || [];
    const avoidBrands = options?.avoidBrands || preferences.avoidProducts || [];

    if (avoidBrands.length > 0) {
      filtered = filtered.filter(p => !avoidBrands.includes(p.brand || ""));
    }

    // Sort by preferred brands
    if (preferredBrands.length > 0) {
      filtered.sort((a, b) => {
        const aPreferred = preferredBrands.includes(a.brand || "");
        const bPreferred = preferredBrands.includes(b.brand || "");
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
        return 0;
      });
    }

    // Apply dietary restrictions
    if (preferences.dietaryRestrictions?.length) {
      // This would need more sophisticated filtering based on product attributes
      // For now, just a placeholder
    }

    return filtered;
  }

  /**
   * Helper: Score and rank substitutions
   */
  private async scoreSubstitutions(
    original: WalmartProduct,
    substitutes: WalmartProduct[],
    threshold: number
  ): Promise<WalmartProduct[]> {
    // Simple scoring based on price and rating
    // In production, this would use ML models and vector similarity
    
    const scored = substitutes.map(sub => {
      let score = 0;
      
      // Price similarity (max 0.4)
      const priceDiff = Math.abs((sub.price || 0) - (original.price || 0));
      const priceScore = Math.max(0, 0.4 - (priceDiff / (original.price || 1)) * 0.4);
      score += priceScore;
      
      // Rating score (max 0.3)
      if (sub.ratings?.average) {
        score += (sub.ratings.average / 5) * 0.3;
      }
      
      // Category match (max 0.3)
      if (sub.category === original.category) {
        score += 0.3;
      }
      
      return { ...sub, similarity_score: score } as WalmartProductWithScore;
    });
    
    // Filter by threshold and sort by score
    const filtered = scored
      .filter(s => s.similarity_score >= threshold)
      .sort((a, b) => b.similarity_score - a.similarity_score);
    
    // Remove similarity_score property before returning
    return filtered.map(({ similarity_score, ...product }) => product);
  }

  /**
   * Helper: Update list estimated total
   */
  private async updateListTotal(listId: string): Promise<void> {
    const items = await this.itemRepo.getItemsByList(listId);
    const total = items.reduce((sum, item) => {
      return sum + (item.estimated_price || 0) * item.quantity;
    }, 0);
    
    await this.listRepo.updateList(listId, { estimated_total: total });
  }

  /**
   * Helper: Get recent purchases for user
   */
  private async getRecentPurchases(userId: string): Promise<WalmartProduct[]> {
    const sessions = await this.sessionRepo.getUserSessions(userId, "completed", 3);
    const products: WalmartProduct[] = [];
    
    for (const session of sessions) {
      if (session.list_id) {
        const items = await this.itemRepo.getItemsByList(session.list_id);
        for (const item of items.filter(i => i.status === "purchased" && i.product_id)) {
          const productEntity = await this.productRepo.findById(item.product_id!);
          if (productEntity) {
            const product = this.transformEntityToProduct(productEntity);
            products.push(product);
          }
        }
      }
    }
    
    return products;
  }

  /**
   * Helper: Get frequently purchased items
   */
  private async getFrequentItems(userId: string): Promise<WalmartProduct[]> {
    // This would analyze purchase history to find patterns
    // For now, return recent purchases as placeholder
    return this.getRecentPurchases(userId);
  }

  /**
   * Transform ProductEntity to WalmartProduct
   */
  private transformEntityToProduct(entity: any): WalmartProduct {
    return {
      id: entity.product_id || entity.id,
      name: entity.name,
      brand: entity.brand,
      description: entity.description,
      category: entity.category || "Uncategorized",
      subcategory: entity.subcategory,
      price: entity.price,
      originalPrice: entity.original_price,
      unit: entity.unit || "each",
      size: entity.size,
      imageUrl: entity.image_url,
      thumbnailUrl: entity.thumbnail_url,
      barcode: entity.upc,
      inStock: entity.in_stock,
      stockLevel: entity.stock_quantity,
      location: entity.aisle_location ? { aisle: entity.aisle_location } : undefined,
      ratings: entity.rating && entity.review_count ? {
        average: entity.rating,
        count: entity.review_count
      } : undefined,
      nutritionalInfo: entity.nutritional_info,
    };
  }

  /**
   * Transform database GroceryList to expected type interface
   */
  private transformDatabaseListToType(dbList: any): ServiceGroceryList {
    return {
      id: dbList.id,
      userId: dbList.user_id,
      name: dbList.list_name,
      description: dbList.description,
      items: [], // Will be populated separately
      totalEstimate: dbList.estimated_total || 0,
      createdAt: dbList.created_at ? new Date(dbList.created_at) : new Date(),
      updatedAt: dbList.updated_at ? new Date(dbList.updated_at) : new Date(),
      tags: [],
      isShared: false
    };
  }
}