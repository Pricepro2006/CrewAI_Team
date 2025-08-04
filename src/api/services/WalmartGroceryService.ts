/**
 * Walmart Grocery Service - Core business logic for Walmart grocery operations
 * Handles product search, cart management, list operations, and substitutions
 */

import { logger } from "../../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import type { WalmartProductRepository, SubstitutionRepository, UserPreferencesRepository } from "../../database/repositories/WalmartProductRepository.js";
import type { GroceryListRepository, GroceryItemRepository, ShoppingSessionRepository } from "../../database/repositories/GroceryRepository.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import { BrightDataScraper } from "./BrightDataScraper.js";
import { ProductLookupService } from "./ProductLookupService.js";
import { DealMatchingService } from "./DealMatchingService.js";
import { ChromaDBManager } from "../../database/vector/ChromaDBManager.js";
import type { 
  WalmartProduct
} from "../../types/walmart-grocery.js";
import type { 
  GroceryList as RepoGroceryList,
  GroceryItem as RepoGroceryItem,
  ShoppingSession as RepoShoppingSession
} from "../../database/repositories/GroceryRepository.js";
import type { UserPreferences } from "../../database/repositories/WalmartProductRepository.js";

export interface ServiceSearchOptions {
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
const convertRepoGroceryItemToService = (repoItem: RepoGroceryItem): RepoGroceryItem => repoItem;

const convertRepoShoppingSessionToService = (repoSession: RepoShoppingSession): RepoShoppingSession => repoSession;

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
  async searchProducts(options: ServiceSearchOptions): Promise<WalmartProduct[]> {
    try {
      logger.info("Searching products", "WALMART_SERVICE", { options });

      // First check local database
      let localResults = await this.productRepo.searchProducts(options.query, options.limit || 20);

      // Apply filters
      if (options.category) {
        localResults = localResults.filter(p => 
          p.category_path?.includes(options.category!) || 
          p.department?.includes(options.category!)
        );
      }

      if (options.inStockOnly) {
        localResults = localResults.filter(p => p.in_stock);
      }

      if (options.priceRange) {
        localResults = localResults.filter(p => {
          const price = p.current_price || 0;
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
          await this.productRepo.upsertProduct(this.convertToRepoProduct(product));
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
          await this.productRepo.upsertProduct(this.convertToRepoProduct(webProduct));
          return webProduct;
        }
        return null;
      }

      // Check if we need real-time update
      if (includeRealTime && this.needsPriceUpdate(product)) {
        const updatedProduct = await this.scraper.getProductDetails(productId);
        if (updatedProduct) {
          await this.productRepo.upsertProduct(this.convertToRepoProduct(updatedProduct));
          
          // Record price history if price changed
          const updatedPrice = typeof updatedProduct.price === 'object' 
            ? updatedProduct.price.regular 
            : updatedProduct.price;
          if (updatedPrice !== (product as any).current_price) {
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
  async createGroceryList(userId: string, name: string, description?: string): Promise<RepoGroceryList> {
    try {
      const list = await this.listRepo.createList({
        id: uuidv4(),  // Generate ID here
        user_id: userId,
        list_name: name,
        description,
        list_type: "shopping",
        status: "active"
      } as RepoGroceryList);

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
  async addItemsToList(listId: string, items: CartItem[]): Promise<RepoGroceryItem[]> {
    try {
      if (items.length === 0) return [];

      // OPTIMIZATION: Batch fetch all products at once instead of N queries
      const productIds = items.map(item => item.productId);
      const products = await this.productRepo.findByIds(productIds);
      const productMap = new Map(products.map(p => [p.product_id, p]));

      // Use database transaction for consistency
      return await this.productRepo.transaction(async () => {
        const addedItems: RepoGroceryItem[] = [];

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
            id: uuidv4(),  // Generate ID here
            list_id: listId,
            item_name: product.name,
            product_id: product.product_id,
            category: product.category_path,
            quantity: item.quantity,
            estimated_price: product.current_price,
            notes: item.notes
          } as RepoGroceryItem);

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
      const preferences = await this.preferencesRepo.getPreferences(userId);
      
      // Get original product
      const originalProduct = await this.getProductDetails(productId);
      if (!originalProduct) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Find similar products
      // Use searchProducts as fallback since findSimilarProducts doesn't exist
      const substituteEntities = await this.productRepo.searchProducts(`similar to ${productId}`, 10);

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
        await this.substitutionRepo.recordSubstitution({
          id: '', // Will be generated by recordSubstitution
          original_product_id: productId,
          substitute_product_id: substitute.id,
          similarity_score: 0.8, // Placeholder - would calculate real score
          price_difference: Number(substitute.price || 0) - Number(originalProduct.price || 0),
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
  ): Promise<RepoShoppingSession> {
    try {
      const session = await this.sessionRepo.createSession({
        id: uuidv4(),  // Generate ID here
        user_id: userId,
        list_id: listId,
        session_type: type,
        status: "active",
        started_at: new Date().toISOString()
      } as RepoShoppingSession);

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
  async processCheckout(sessionId: string): Promise<RepoShoppingSession> {
    try {
      const session = await this.sessionRepo.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Calculate totals
      const items = await this.itemRepo.getListItems(session.list_id!);
      let subtotal = 0;
      let itemsFound = 0;
      let itemsSubstituted = 0;

      for (const item of items) {
        if (item.status === "purchased") {
          subtotal += (item.actual_price || item.estimated_price || 0) * (item.quantity || 1);
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
      const preferences = await this.preferencesRepo.getPreferences(userId);
      // Get recent sessions - using available methods
      const activeSession = await this.sessionRepo.getActiveSession(userId);
      const recentSessions = activeSession ? [activeSession] : [];
      
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
    preferences: UserPreferences,
    options?: SubstitutionOptions
  ): WalmartProduct[] {
    let filtered = products;

    // Apply brand preferences
    const preferredBrands = options?.preferredBrands || preferences.preferred_brands || [];
    const avoidBrands = options?.avoidBrands || preferences.avoided_brands || [];

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
    if (preferences.dietary_restrictions?.length) {
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
      const priceDiff = Math.abs(Number(sub.price || 0) - Number(original.price || 0));
      const priceScore = Math.max(0, 0.4 - (priceDiff / Number(original.price || 1)) * 0.4);
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
    const items = await this.itemRepo.getListItems(listId);
    const total = items.reduce((sum, item) => {
      return sum + Number(item.estimated_price || 0) * Number(item.quantity || 1);
    }, 0);
    
    await this.listRepo.updateList(listId, { estimated_total: total });
  }

  /**
   * Helper: Get recent purchases for user
   */
  private async getRecentPurchases(userId: string): Promise<WalmartProduct[]> {
    const session = await this.sessionRepo.getSession(userId);
    const products: WalmartProduct[] = [];
    
    if (session && session.list_id) {
        const items = await this.itemRepo.getListItems(session.list_id);
        for (const item of items.filter(i => i.status === "purchased" && i.product_id)) {
          const productEntity = await this.productRepo.findById(item.product_id!);
          if (productEntity) {
            const product = this.transformEntityToProduct(productEntity);
            products.push(product);
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
      id: entity.product_id || entity.id || uuidv4(),
      walmartId: entity.walmart_id || entity.product_id || entity.id,
      name: entity.name,
      brand: entity.brand,
      description: entity.description,
      category: {
        id: entity.category_id || "uncategorized",
        name: entity.category || "Uncategorized",
        path: [entity.category || "Uncategorized"],
        level: 1,
      },
      subcategory: entity.subcategory,
      price: {
        currency: "USD",
        regular: entity.price || 0,
        sale: entity.sale_price,
        unit: entity.unit_price,
        unitOfMeasure: entity.unit || "each",
      },
      images: entity.image_url ? [{
        id: "primary",
        url: entity.image_url,
        type: "primary" as const,
      }] : [],
      availability: {
        inStock: entity.in_stock ?? true,
        stockLevel: entity.stock_quantity > 0 ? "in_stock" as const : "out_of_stock" as const,
        quantity: entity.stock_quantity,
      },
      metadata: {
        source: "api" as const,
        lastScraped: new Date().toISOString(),
      },
      // Additional properties for compatibility
      unit: entity.unit || "each",
      size: entity.size,
      imageUrl: entity.image_url,
      thumbnailUrl: entity.thumbnail_url,
      barcode: entity.upc,
      inStock: entity.in_stock ?? true,
      stockLevel: entity.stock_quantity,
      location: entity.aisle_location || undefined,
      ratings: entity.rating && entity.review_count ? {
        average: entity.rating,
        count: entity.review_count,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        reviews: [],
      } : undefined,
      nutritionalInfo: entity.nutritional_info,
      createdAt: entity.created_at || new Date().toISOString(),
      updatedAt: entity.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Convert types WalmartProduct to repository WalmartProduct
   */
  private convertToRepoProduct(product: WalmartProduct): import("../../database/repositories/WalmartProductRepository.js").WalmartProduct {
    return {
      id: product.id,
      product_id: product.walmartId,
      name: product.name,
      brand: product.brand,
      description: product.description,
      category_path: typeof product.category === 'object' ? product.category.name : product.category,
      department: typeof product.category === 'object' && product.category.path ? product.category.path[0] : undefined,
      current_price: typeof product.price === 'object' ? product.price.regular : product.price,
      regular_price: typeof product.price === 'object' ? product.price.wasPrice : undefined,
      unit_price: typeof product.price === 'object' ? product.price.unit : undefined,
      unit_measure: typeof product.price === 'object' ? product.price.unitOfMeasure : undefined,
      in_stock: product.availability.inStock,
      stock_level: product.availability.quantity,
      online_only: product.availability.onlineOnly,
      store_only: product.availability.instoreOnly,
      upc: product.upc,
      large_image_url: product.images[0]?.url,
      thumbnail_url: product.images[0]?.url,
      average_rating: product.ratings?.average,
      review_count: product.ratings?.count,
      nutritional_info: product.nutritionFacts,
      ingredients: Array.isArray(product.ingredients) ? product.ingredients.join(', ') : product.ingredients,
      allergens: product.allergens?.map(a => typeof a === 'string' ? a : a.type),
      first_seen_at: product.createdAt,
      last_updated_at: product.updatedAt,
      last_checked_at: new Date().toISOString()
    };
  }

  /**
   * Transform database GroceryList to expected type interface
   */
  private transformDatabaseListToType(dbList: any): RepoGroceryList {
    return {
      id: dbList.id,
      user_id: dbList.user_id,
      list_name: dbList.list_name,
      description: dbList.description,
      items: [], // Will be populated separately
      totalEstimate: dbList.estimated_total || 0,
      created_at: dbList.created_at || new Date().toISOString(),
      updated_at: dbList.updated_at || new Date().toISOString(),
      tags: [],
      isShared: false
    };
  }
}