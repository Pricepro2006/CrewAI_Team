/**
 * Grocery Data Service - Unified data access layer for grocery agent
 * Coordinates between SQLite repositories and ChromaDB collections
 */

import { getDatabaseManager } from "../DatabaseManager.js";
import {
  GroceryListRepository,
  GroceryItemRepository,
  ShoppingSessionRepository,
  type GroceryList,
  type GroceryItem,
  type ShoppingSession,
} from "../repositories/GroceryRepository.js";
import {
  WalmartProductRepository,
  SubstitutionRepository,
  UserPreferencesRepository,
  type WalmartProduct,
  type GrocerySubstitution,
  type UserPreferences,
} from "../repositories/WalmartProductRepository.js";
import { GroceryVectorCollections } from "../vector/GroceryVectorCollections.js";
import { logger } from "../../utils/logger.js";

export interface CreateListParams {
  userId: string;
  listName: string;
  description?: string;
  items?: Array<{
    name: string;
    quantity?: number;
    brand?: string;
    notes?: string;
  }>;
  budgetLimit?: number;
  isRecurring?: boolean;
  recurrencePattern?: any;
}

export interface AddItemParams {
  listId: string;
  itemName: string;
  quantity?: number;
  unit?: string;
  brandPreference?: string;
  priority?: "essential" | "high" | "normal" | "low";
  notes?: string;
}

export interface ProductSearchParams {
  query: string;
  category?: string;
  priceRange?: "budget" | "mid" | "premium";
  dietaryTags?: string[];
  inStockOnly?: boolean;
  limit?: number;
}

export interface StartShoppingParams {
  userId: string;
  listId?: string;
  sessionType?: "online" | "in_store" | "pickup" | "delivery";
  fulfillmentType?: string;
  deliveryAddress?: string;
}

export class GroceryDataService {
  private dbManager = getDatabaseManager();
  private listRepo: GroceryListRepository;
  private itemRepo: GroceryItemRepository;
  private sessionRepo: ShoppingSessionRepository;
  private productRepo: WalmartProductRepository;
  private substitutionRepo: SubstitutionRepository;
  private preferencesRepo: UserPreferencesRepository;
  private vectorCollections: GroceryVectorCollections;

  constructor() {
    const db = this.dbManager.getSQLiteDatabase();

    // Initialize repositories
    this.listRepo = new GroceryListRepository(db);
    this.itemRepo = new GroceryItemRepository(db);
    this.sessionRepo = new ShoppingSessionRepository(db);
    this.productRepo = new WalmartProductRepository(db);
    this.substitutionRepo = new SubstitutionRepository(db);
    this.preferencesRepo = new UserPreferencesRepository(db);

    // Initialize vector collections
    this.vectorCollections = new GroceryVectorCollections(
      this.dbManager.getVectorDatabase(),
    );
  }

  /**
   * Initialize the grocery data service
   */
  async initialize(): Promise<void> {
    logger.info("Initializing Grocery Data Service...", "GROCERY_SERVICE");

    try {
      // Initialize vector collections
      await this.vectorCollections.initializeCollections();

      logger.info(
        "Grocery Data Service initialized successfully",
        "GROCERY_SERVICE",
      );
    } catch (error) {
      logger.error(
        `Failed to initialize Grocery Data Service: ${error}`,
        "GROCERY_SERVICE",
      );
      throw error;
    }
  }

  /**
   * Create a new grocery list with items
   */
  async createGroceryList(params: CreateListParams): Promise<{
    list: GroceryList;
    items: GroceryItem[];
  }> {
    // Create the list
    const list = await this.listRepo.createList({
      id: crypto.randomUUID(),
      user_id: params.userId,
      list_name: params.listName,
      description: params.description,
      budget_limit: params.budgetLimit,
      is_recurring: params.isRecurring,
      recurrence_pattern: params.recurrencePattern,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      total_items: 0,
      completed_items: 0,
      estimated_total: 0,
      actual_total: 0
    });

    // Add items if provided
    const items: GroceryItem[] = [];
    if (params.items && params?.items?.length > 0) {
      for (const itemData of params.items) {
        const item = await this.itemRepo.addItem({
          id: crypto.randomUUID(),
          list_id: list.id,
          item_name: itemData.name,
          quantity: itemData.quantity || 1,
          unit: 'unit',
          brand_preference: itemData.brand,
          notes: itemData.notes,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        items.push(item);

        // Try to match with Walmart product
        await this.matchItemToProduct(item);
      }

      // Update list total
      await this.itemRepo.updateListTotal(list.id);
    }

    logger.info(
      `Created grocery list ${list.id} with ${items?.length || 0} items`,
      "GROCERY_SERVICE",
    );
    return { list, items };
  }

  /**
   * Add item to existing list
   */
  async addItemToList(params: AddItemParams): Promise<GroceryItem> {
    const item = await this.itemRepo.addItem({
      id: crypto.randomUUID(),
      list_id: params.listId,
      item_name: params.itemName,
      quantity: params.quantity || 1,
      unit: params.unit || 'unit',
      brand_preference: params.brandPreference,
      priority: params.priority || 'normal',
      notes: params.notes,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Try to match with Walmart product
    await this.matchItemToProduct(item);

    // Update list total
    await this.itemRepo.updateListTotal(params.listId);

    return item;
  }

  /**
   * Match grocery item to Walmart product
   */
  private async matchItemToProduct(item: GroceryItem): Promise<void> {
    try {
      // Search for matching products
      const searchQuery = item.brand_preference
        ? `${item.brand_preference} ${item.item_name}`
        : item.item_name;

      const products = await this.productRepo.searchProducts(searchQuery, 5);

      if (products?.length || 0 > 0) {
        // Use the first match for now (could be improved with better matching logic)
        const bestMatch = products[0];
        
        if (bestMatch) {
          await this.itemRepo.updateItem(item.id, {
            product_id: bestMatch.product_id,
            category: bestMatch.category_path?.split("/")[0],
            estimated_price: bestMatch.current_price,
          });

          logger.info(
            `Matched item ${item.item_name} to product ${bestMatch.name}`,
            "GROCERY_SERVICE",
          );
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to match item ${item.item_name}: ${error}`,
        "GROCERY_SERVICE",
      );
    }
  }

  /**
   * Search for products with filters
   */
  async searchProducts(params: ProductSearchParams): Promise<WalmartProduct[]> {
    // First try database search
    const dbResults = await this.productRepo.searchProducts(
      params.query,
      params.limit || 20,
    );

    // Then enhance with vector search for better results
    const vectorResults = await this.vectorCollections.searchSimilarProducts(
      params.query,
      {
        category: params.category,
        priceRange: params.priceRange,
        dietaryTags: params.dietaryTags,
      },
      params.limit || 20,
    );

    // Merge results, prioritizing database results
    const productIds = new Set<string>();
    const mergedResults: WalmartProduct[] = [];

    for (const product of dbResults) {
      if (!productIds.has(product.product_id)) {
        productIds.add(product.product_id);
        mergedResults.push(product);
      }
    }

    // Add vector search results not in database results
    for (const vectorResult of vectorResults) {
      if (!productIds.has(vectorResult.product_id)) {
        try {
          const product = await this.productRepo.getProduct(
            vectorResult.product_id,
          );
          if (params.inStockOnly && !product.in_stock) continue;
          mergedResults.push(product);
        } catch (error) {
          // Product not in database, skip
        }
      }
    }

    return mergedResults.slice(0, params.limit || 20);
  }

  /**
   * Start a shopping session
   */
  async startShoppingSession(
    params: StartShoppingParams,
  ): Promise<ShoppingSession> {
    // Get active session if exists
    const activeSession = await this.sessionRepo.getActiveSession(
      params.userId,
    );
    if (activeSession) {
      logger.info(
        `Returning existing active session ${activeSession.id}`,
        "GROCERY_SERVICE",
      );
      return activeSession;
    }

    // Get list items count if list provided
    let itemsTotal = 0;
    if (params.listId) {
      const items = await this.itemRepo.getListItems(params.listId);
      itemsTotal = items.filter((item: any) => item.status === "pending").length;
    }

    // Create new session
    const session = await this.sessionRepo.createSession({
      id: crypto.randomUUID(),
      user_id: params.userId,
      list_id: params.listId,
      session_type: params.sessionType || 'online',
      items_total: itemsTotal,
      fulfillment_type: params.fulfillmentType,
      delivery_address: params.deliveryAddress,
      status: 'active',
      started_at: new Date().toISOString(),
      items_found: 0,
      items_unavailable: 0,
      items_substituted: 0
    });

    logger.info(`Started shopping session ${session.id}`, "GROCERY_SERVICE");
    return session;
  }

  /**
   * Add item to cart during shopping
   */
  async addToCart(
    sessionId: string,
    itemId: string,
    actualPrice?: number,
  ): Promise<void> {
    // Mark item as in cart
    await this.itemRepo.markAsCart(itemId);

    // Update session progress
    const session = await this.sessionRepo.getSession(sessionId);
    await this.sessionRepo.updateProgress(sessionId, {
      itemsFound: (session.items_found || 0) + 1,
    });

    // Record price if different from estimated
    if (actualPrice !== undefined) {
      const item = await this.itemRepo.getItem(itemId);
      if (item.product_id) {
        await this.productRepo.recordPriceHistory(
          item.product_id,
          actualPrice,
          actualPrice < (item.estimated_price || 0),
        );
      }
    }
  }

  /**
   * Handle item unavailable
   */
  async handleItemUnavailable(
    sessionId: string,
    itemId: string,
    findSubstitute: boolean = true,
  ): Promise<GrocerySubstitution | null> {
    const item = await this.itemRepo.getItem(itemId);

    if (!findSubstitute || !item.product_id) {
      await this.itemRepo.updateItem(itemId, { status: "unavailable" });

      const session = await this.sessionRepo.getSession(sessionId);
      await this.sessionRepo.updateProgress(sessionId, {
        itemsUnavailable: (session.items_unavailable || 0) + 1,
      });

      return null;
    }

    // Find substitutions
    const substitutions = await this.vectorCollections.findSubstitutions(
      item.product_id,
    );

    if (substitutions?.length || 0 === 0) {
      await this.itemRepo.updateItem(itemId, { status: "unavailable" });
      return null;
    }

    // Use the best substitution
    const bestSub = substitutions[0];
    if (!bestSub) {
      return null;
    }
    const substituteProduct = await this.productRepo.getProduct(
      bestSub.substitute_id,
    );

    // Create substitution item
    const subItem = await this.itemRepo.addItem({
      id: crypto.randomUUID(),
      list_id: item.list_id,
      item_name: substituteProduct.name,
      brand_preference: substituteProduct.brand,
      product_id: substituteProduct.product_id,
      quantity: item.quantity,
      unit: item.unit || 'unit',
      estimated_price: substituteProduct.current_price,
      priority: item.priority || 'normal',
      notes: `Substitute for ${item.item_name}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Mark original as substituted
    await this.itemRepo.substituteItem(itemId, subItem.id);

    // Record substitution
    const substitution = await this.substitutionRepo.recordSubstitution({
      id: crypto.randomUUID(),
      original_product_id: item.product_id,
      substitute_product_id: substituteProduct.product_id,
      reason: bestSub?.reason,
      similarity_score: bestSub?.similarity,
      price_difference: bestSub?.price_difference,
      user_id: (await this.sessionRepo.getSession(sessionId)).user_id,
      created_at: new Date().toISOString()
    });

    // Update session progress
    const session = await this.sessionRepo.getSession(sessionId);
    await this.sessionRepo.updateProgress(sessionId, {
      itemsSubstituted: (session.items_substituted || 0) + 1,
    });

    return substitution;
  }

  /**
   * Complete shopping session
   */
  async completeShoppingSession(
    sessionId: string,
    orderDetails: {
      orderNumber?: string;
      subtotal: number;
      tax: number;
      deliveryFee?: number;
      tip?: number;
      savings?: number;
    },
  ): Promise<ShoppingSession> {
    // Update session with final details
    await this.sessionRepo.updateSession(sessionId, {
      subtotal: orderDetails.subtotal,
      tax_amount: orderDetails.tax,
      delivery_fee: orderDetails.deliveryFee,
      tip_amount: orderDetails.tip,
      total_amount:
        orderDetails.subtotal +
        orderDetails.tax +
        (orderDetails.deliveryFee || 0) +
        (orderDetails.tip || 0),
      savings_amount: orderDetails.savings,
    });

    // Complete the session
    const completedSession = await this.sessionRepo.completeSession(
      sessionId,
      orderDetails.orderNumber,
    );

    // If there was a list, mark purchased items and complete it
    if (completedSession.list_id) {
      const items = await this.itemRepo.getListItems(completedSession.list_id);

      for (const item of items) {
        if (item.status === "in_cart") {
          await this.itemRepo.markAsPurchased(item.id);
        }
      }

      // Complete the list
      await this.listRepo.completeList(
        completedSession.list_id,
        completedSession.total_amount,
      );
    }

    // Store shopping pattern for future recommendations
    if (completedSession.list_id) {
      await this.storeShoppingPattern(completedSession);
    }

    logger.info(`Completed shopping session ${sessionId}`, "GROCERY_SERVICE");
    return completedSession;
  }

  /**
   * Store shopping pattern for recommendations
   */
  private async storeShoppingPattern(session: ShoppingSession): Promise<void> {
    if (!session.list_id) return;

    try {
      const items = await this.itemRepo.getListItems(
        session.list_id,
        "purchased",
      );
      const itemNames = items.map((item: any) => item.item_name);

      await this.vectorCollections.storeShoppingPattern({
        pattern_id: `pattern_${session.id}`,
        user_id: session.user_id,
        pattern_type: "weekly", // Could be determined by analyzing frequency
        common_items: itemNames,
        shopping_frequency: 4, // Could be calculated from user history
        average_spend: session.total_amount || 0,
      });
    } catch (error) {
      logger.warn(
        `Failed to store shopping pattern: ${error}`,
        "GROCERY_SERVICE",
      );
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return await this.preferencesRepo.getPreferences(userId);
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const existing = await this.preferencesRepo.getPreferences(userId);

    if (!existing) {
      // Create new preferences
      return await this.preferencesRepo.upsertPreferences({
        id: preferences.id || crypto.randomUUID(),
        ...preferences,
        user_id: userId,
      });
    }

    // Update existing
    return await this.preferencesRepo.upsertPreferences({
      ...existing,
      ...preferences,
      user_id: userId,
    });
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(
    userId: string,
    currentListId?: string,
  ): Promise<{
    frequentItems: string[];
    newProducts: WalmartProduct[];
    dealsOfTheWeek: WalmartProduct[];
  }> {
    // Get user preferences
    const preferences = await this.preferencesRepo.getPreferences(userId);

    // Get current list items if provided
    let currentItems: string[] = [];
    if (currentListId) {
      const items = await this.itemRepo.getListItems(currentListId);
      currentItems = items.map((item: any) => item.item_name);
    }

    // Get frequent items from shopping patterns
    const frequentItems = await this.vectorCollections.getUserRecommendations(
      userId,
      currentItems,
    );

    // Get new products based on preferences
    const newProducts: WalmartProduct[] = [];
    if (preferences?.preferred_brands) {
      for (const brand of Object.values(preferences.preferred_brands)) {
        const products = await this.productRepo.searchProducts(
          brand as string,
          3,
        );
        newProducts.push(...products);
      }
    }

    // Get deals (products with price drops)
    const dealsOfTheWeek: WalmartProduct[] = [];
    // This would require tracking price changes over time
    // For now, returning empty array

    return {
      frequentItems: frequentItems.slice(0, 10),
      newProducts: newProducts.slice(0, 5),
      dealsOfTheWeek: dealsOfTheWeek.slice(0, 5),
    };
  }
}

// Export singleton instance
let groceryDataService: GroceryDataService | null = null;

export function getGroceryDataService(): GroceryDataService {
  if (!groceryDataService) {
    groceryDataService = new GroceryDataService();
  }
  return groceryDataService;
}
