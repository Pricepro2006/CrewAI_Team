/**
 * Hybrid Search Service - Combines database and external search
 * Provides comprehensive product discovery with past purchases and new products
 */

import { logger } from "../../utils/logger.js";
import { WalmartGroceryService } from "./WalmartGroceryService.js";
import { BrightDataScraper } from "./BrightDataScraper.js";
import { getWalmartDatabaseManager } from "../../database/WalmartDatabaseManager.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";

export interface HybridSearchResult {
  pastPurchases: WalmartProduct[];
  newProducts: WalmartProduct[];
  recommendedProducts: WalmartProduct[];
  totalResults: number;
  searchMetadata: {
    query: string;
    executionTime: number;
    sources: string[];
    filters: any;
  };
}

export interface SearchOptions {
  query: string;
  userId?: string;
  includeExternal?: boolean;
  includePastPurchases?: boolean;
  includeRecommendations?: boolean;
  category?: string;
  priceRange?: { min: number; max: number };
  inStockOnly?: boolean;
  limit?: number;
  sortBy?: "relevance" | "price" | "rating" | "purchase_frequency";
}

export class HybridSearchService {
  private static instance: HybridSearchService;
  private groceryService: WalmartGroceryService;
  private scraper: BrightDataScraper;
  private dbManager: ReturnType<typeof getWalmartDatabaseManager>;

  private constructor() {
    this.groceryService = WalmartGroceryService.getInstance();
    this.scraper = BrightDataScraper.getInstance();
    this.dbManager = getWalmartDatabaseManager();
  }

  static getInstance(): HybridSearchService {
    if (!HybridSearchService.instance) {
      HybridSearchService.instance = new HybridSearchService();
    }
    return HybridSearchService.instance;
  }

  /**
   * Perform comprehensive hybrid search
   */
  async search(options: SearchOptions): Promise<HybridSearchResult> {
    const startTime = Date.now();
    const sources: string[] = [];
    
    try {
      logger.info("Starting hybrid search", "HYBRID_SEARCH", { options });

      // Initialize result structure
      const result: HybridSearchResult = {
        pastPurchases: [],
        newProducts: [],
        recommendedProducts: [],
        totalResults: 0,
        searchMetadata: {
          query: options.query,
          executionTime: 0,
          sources: [],
          filters: {
            category: options.category,
            priceRange: options.priceRange,
            inStockOnly: options.inStockOnly,
          },
        },
      };

      // Execute searches in parallel for better performance
      const searchPromises: Promise<any>[] = [];

      // 1. Search past purchases from order history
      if (options.includePastPurchases !== false && options.userId) {
        searchPromises.push(
          this.searchPastPurchases(options.userId, options.query, options)
            .then(products => {
              result.pastPurchases = products;
              sources.push("purchase_history");
            })
            .catch(error => {
              logger.error("Past purchases search failed", "HYBRID_SEARCH", { error });
            })
        );
      }

      // 2. Search local database for known products
      searchPromises.push(
        this.searchLocalDatabase(options)
          .then(products => {
            // Separate into past purchases and new products
            if (options.userId) {
              const purchasedIds = new Set(result.pastPurchases.map(p => p.id));
              products.forEach(product => {
                if (!purchasedIds.has(product.id)) {
                  result.newProducts.push(product);
                }
              });
            } else {
              result.newProducts = products;
            }
            sources.push("local_database");
          })
          .catch(error => {
            logger.error("Local database search failed", "HYBRID_SEARCH", { error });
          })
      );

      // 3. Search external sources for new products
      if (options.includeExternal !== false) {
        searchPromises.push(
          this.searchExternal(options)
            .then(products => {
              // Deduplicate and add to new products
              const existingIds = new Set([
                ...result.pastPurchases.map(p => p.id),
                ...result.newProducts.map(p => p.id),
              ]);
              
              products.forEach(product => {
                if (!existingIds.has(product.id)) {
                  result.newProducts.push(product);
                }
              });
              sources.push("external_search");
            })
            .catch(error => {
              logger.error("External search failed", "HYBRID_SEARCH", { error });
            })
        );
      }

      // 4. Get personalized recommendations
      if (options.includeRecommendations !== false && options.userId) {
        searchPromises.push(
          this.getRecommendations(options.userId, options.query)
            .then(products => {
              result.recommendedProducts = products;
              sources.push("recommendations");
            })
            .catch(error => {
              logger.error("Recommendations failed", "HYBRID_SEARCH", { error });
            })
        );
      }

      // Wait for all searches to complete
      await Promise.all(searchPromises);

      // Apply sorting
      result.pastPurchases = this.sortProducts(result.pastPurchases, options.sortBy);
      result.newProducts = this.sortProducts(result.newProducts, options.sortBy);
      
      // Apply limit
      if (options.limit) {
        result.pastPurchases = result.pastPurchases.slice(0, Math.floor(options.limit / 2));
        result.newProducts = result.newProducts.slice(0, Math.ceil(options.limit / 2));
        result.recommendedProducts = result.recommendedProducts.slice(0, 5);
      }

      // Calculate totals
      result.totalResults = 
        result.pastPurchases.length + 
        result.newProducts.length + 
        result.recommendedProducts.length;

      // Update metadata
      result.searchMetadata.executionTime = Date.now() - startTime;
      result.searchMetadata.sources = sources;

      logger.info("Hybrid search completed", "HYBRID_SEARCH", {
        totalResults: result.totalResults,
        executionTime: result.searchMetadata.executionTime,
        sources,
      });

      return result;

    } catch (error) {
      logger.error("Hybrid search failed", "HYBRID_SEARCH", { error });
      throw error;
    }
  }

  /**
   * Search past purchases from order history
   */
  private async searchPastPurchases(
    userId: string, 
    query: string, 
    options: SearchOptions
  ): Promise<WalmartProduct[]> {
    try {
      // Get order history
      const orders = await this.dbManager.orders.getOrdersByUserId(userId);
      const productIds = new Set<string>();
      const purchaseFrequency = new Map<string, number>();

      // Extract product IDs and calculate frequency
      for (const order of orders) {
        const items = await this.dbManager.orderItems.getOrderItems(order.id);
        for (const item of items) {
          if (item.product_id) {
            productIds.add(item.product_id);
            purchaseFrequency.set(
              item.product_id, 
              (purchaseFrequency.get(item.product_id) || 0) + 1
            );
          }
        }
      }

      // Get product details
      const products: WalmartProduct[] = [];
      for (const productId of productIds) {
        const product = await this.groceryService.getProductDetails(productId, false);
        if (product && this.matchesQuery(product, query)) {
          // Add purchase frequency for sorting
          (product as any).purchaseFrequency = purchaseFrequency.get(productId);
          products.push(product);
        }
      }

      // Apply filters
      return this.applyFilters(products, options);

    } catch (error) {
      logger.error("Failed to search past purchases", "HYBRID_SEARCH", { error });
      return [];
    }
  }

  /**
   * Search local database
   */
  private async searchLocalDatabase(options: SearchOptions): Promise<WalmartProduct[]> {
    try {
      const results = await this.groceryService.searchProducts({
        query: options.query,
        category: options.category,
        priceRange: options.priceRange,
        inStockOnly: options.inStockOnly,
        limit: options.limit ? options.limit * 2 : 40, // Get more for filtering
      });

      return results;
    } catch (error) {
      logger.error("Failed to search local database", "HYBRID_SEARCH", { error });
      return [];
    }
  }

  /**
   * Search external sources using web scraping
   */
  private async searchExternal(options: SearchOptions): Promise<WalmartProduct[]> {
    try {
      // Use BrightData or other external search
      const results = await this.scraper.searchWalmartProducts({
        query: options.query,
        limit: options.limit || 20,
        filters: {
          category: options.category,
          priceRange: options.priceRange,
          inStock: options.inStockOnly,
        },
      });

      // Store new products in database for future use
      for (const product of results) {
        await this.dbManager.walmartProducts.upsertProduct(product as any);
      }

      return results;
    } catch (error) {
      logger.error("Failed to search external sources", "HYBRID_SEARCH", { error });
      return [];
    }
  }

  /**
   * Get personalized recommendations based on search context
   */
  private async getRecommendations(userId: string, query: string): Promise<WalmartProduct[]> {
    try {
      // Get user preferences
      const preferences = await this.dbManager.userPreferences.getPreferences(userId);
      
      // Get frequently purchased items
      const frequentItems = await this.getFrequentlyPurchasedItems(userId);
      
      // Get complementary products based on query
      const recommendations: WalmartProduct[] = [];
      
      // If searching for milk, recommend cereal, cookies, etc.
      const complementaryMap: Record<string, string[]> = {
        milk: ["cereal", "cookies", "coffee", "bread"],
        bread: ["butter", "jam", "peanut butter", "cheese"],
        eggs: ["bacon", "bread", "cheese", "butter"],
        chicken: ["rice", "vegetables", "seasoning", "sauce"],
        pasta: ["sauce", "cheese", "garlic bread", "salad"],
      };

      const queryLower = query.toLowerCase();
      for (const [key, complements] of Object.entries(complementaryMap)) {
        if (queryLower.includes(key)) {
          for (const complement of complements.slice(0, 2)) {
            const products = await this.searchLocalDatabase({
              query: complement,
              limit: 2,
            });
            recommendations.push(...products);
          }
          break;
        }
      }

      // Add frequently purchased items that match preferences
      if (preferences && frequentItems.length > 0) {
        const filtered = frequentItems
          .filter(item => !preferences.avoided_brands?.includes(item.brand || ""))
          .slice(0, 3);
        recommendations.push(...filtered);
      }

      // Deduplicate
      const uniqueMap = new Map<string, WalmartProduct>();
      recommendations.forEach(p => uniqueMap.set(p.id, p));
      
      return Array.from(uniqueMap.values()).slice(0, 5);

    } catch (error) {
      logger.error("Failed to get recommendations", "HYBRID_SEARCH", { error });
      return [];
    }
  }

  /**
   * Get frequently purchased items for a user
   */
  private async getFrequentlyPurchasedItems(userId: string): Promise<WalmartProduct[]> {
    try {
      const orders = await this.dbManager.orders.getOrdersByUserId(userId);
      const productFrequency = new Map<string, number>();

      for (const order of orders) {
        const items = await this.dbManager.orderItems.getOrderItems(order.id);
        for (const item of items) {
          if (item.product_id) {
            productFrequency.set(
              item.product_id,
              (productFrequency.get(item.product_id) || 0) + 1
            );
          }
        }
      }

      // Sort by frequency and get top items
      const sortedProducts = Array.from(productFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const products: WalmartProduct[] = [];
      for (const [productId] of sortedProducts) {
        const product = await this.groceryService.getProductDetails(productId, false);
        if (product) {
          products.push(product);
        }
      }

      return products;
    } catch (error) {
      logger.error("Failed to get frequently purchased items", "HYBRID_SEARCH", { error });
      return [];
    }
  }

  /**
   * Check if product matches search query
   */
  private matchesQuery(product: WalmartProduct, query: string): boolean {
    const queryLower = query.toLowerCase();
    const name = product.name?.toLowerCase() || "";
    const brand = product.brand?.toLowerCase() || "";
    const category = typeof product.category === 'string' 
      ? product.category.toLowerCase() 
      : product.category?.name?.toLowerCase() || "";
    const description = product.description?.toLowerCase() || "";

    return (
      name.includes(queryLower) ||
      brand.includes(queryLower) ||
      category.includes(queryLower) ||
      description.includes(queryLower)
    );
  }

  /**
   * Apply filters to product list
   */
  private applyFilters(products: WalmartProduct[], options: SearchOptions): WalmartProduct[] {
    let filtered = [...products];

    if (options.category) {
      filtered = filtered.filter(p => {
        const category = typeof p.category === 'string' ? p.category : p.category?.name;
        return category?.toLowerCase().includes(options.category!.toLowerCase());
      });
    }

    if (options.priceRange) {
      filtered = filtered.filter(p => {
        const price = typeof p.price === 'number' ? p.price : p.price?.regular || 0;
        return price >= options.priceRange!.min && price <= options.priceRange!.max;
      });
    }

    if (options.inStockOnly) {
      filtered = filtered.filter(p => p.availability?.inStock !== false);
    }

    return filtered;
  }

  /**
   * Sort products based on criteria
   */
  private sortProducts(
    products: WalmartProduct[], 
    sortBy?: SearchOptions['sortBy']
  ): WalmartProduct[] {
    const sorted = [...products];

    switch (sortBy) {
      case "price":
        sorted.sort((a, b) => {
          const priceA = typeof a.price === 'number' ? a.price : a.price?.regular || 0;
          const priceB = typeof b.price === 'number' ? b.price : b.price?.regular || 0;
          return priceA - priceB;
        });
        break;

      case "rating":
        sorted.sort((a, b) => {
          const ratingA = a.ratings?.average || 0;
          const ratingB = b.ratings?.average || 0;
          return ratingB - ratingA;
        });
        break;

      case "purchase_frequency":
        sorted.sort((a, b) => {
          const freqA = (a as any).purchaseFrequency || 0;
          const freqB = (b as any).purchaseFrequency || 0;
          return freqB - freqA;
        });
        break;

      case "relevance":
      default:
        // Keep original order (already sorted by relevance from search)
        break;
    }

    return sorted;
  }

  /**
   * Quick search for autocomplete/suggestions
   */
  async quickSearch(query: string, limit: number = 5): Promise<string[]> {
    try {
      const products = await this.searchLocalDatabase({
        query,
        limit: limit * 2,
      });

      // Extract unique product names for suggestions
      const suggestions = new Set<string>();
      products.forEach(p => {
        suggestions.add(p.name);
        if (p.brand) {
          suggestions.add(`${p.brand} ${p.name}`);
        }
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      logger.error("Quick search failed", "HYBRID_SEARCH", { error });
      return [];
    }
  }
}