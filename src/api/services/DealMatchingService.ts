/**
 * Deal Matching Service - Matches Walmart products with existing deals
 * Analyzes pricing, identifies savings opportunities, and tracks deal performance
 */

import { logger } from "../../utils/logger.js";
import { DealDataService } from "./DealDataService.js";
import type { WalmartProductRepository } from "../../database/repositories/WalmartProductRepository.js";
import { getWalmartDatabaseManager } from "../../database/WalmartDatabaseManager.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { Deal, DealItem } from "../types/deal.types.js";

// =====================================================
// Deal Matching Types
// =====================================================

export type MatchType = "exact" | "similar" | "category";

export interface DealMatch {
  product: WalmartProduct;
  deal: Deal;
  dealItem: DealItem;
  savings: number;
  savingsPercent: number;
  matchConfidence: number;
  matchType: MatchType;
}

export interface DealAnalysis {
  totalSavings: number;
  averageSavingsPercent: number;
  bestDeals: DealMatch[];
  expiringDeals: DealMatch[];
  categoryBreakdown: Record<
    string,
    {
      count: number;
      totalSavings: number;
    }
  >;
}

export interface ScoredDealItem {
  item: DealItem;
  score: number;
}

export interface DealMatchCacheEntry {
  matches: DealMatch[];
  timestamp: number;
}

export class DealMatchingService {
  private static instance: DealMatchingService;

  private dealService: DealDataService;
  private productRepo: WalmartProductRepository;
  private matchCache: Map<string, DealMatch[]>;

  private constructor() {
    this.dealService = DealDataService.getInstance();
    this.productRepo = getWalmartDatabaseManager().walmartProducts;
    this.matchCache = new Map();
  }

  static getInstance(): DealMatchingService {
    if (!DealMatchingService.instance) {
      DealMatchingService.instance = new DealMatchingService();
    }
    return DealMatchingService.instance;
  }

  /**
   * Find deals for a specific product
   */
  async findDealsForProduct(productId: string): Promise<DealMatch[]> {
    try {
      // Check cache first
      const cacheKey = `product:${productId}`;
      if (this?.matchCache?.has(cacheKey)) {
        return this?.matchCache?.get(cacheKey)!;
      }

      logger.info("Finding deals for product", "DEAL_MATCHING", { productId });

      const productEntity = await this?.productRepo?.findByProductId(productId);
      if (!productEntity) {
        throw new Error(`Product not found: ${productId}`);
      }
      const repoProduct = this?.productRepo?.entityToProduct(productEntity);
      const product = this.convertToTypesProduct(repoProduct);

      // Search for exact matches by SKU/UPC
      const exactMatches = await this.findExactMatches(product);

      // Search for similar products in deals
      const similarMatches = await this.findSimilarMatches(product);

      // Search by category
      const categoryMatches = await this.findCategoryMatches(product);

      // Combine and deduplicate
      const allMatches = this.combineAndRankMatches(
        exactMatches,
        similarMatches,
        categoryMatches,
      );

      // Cache results
      this?.matchCache?.set(cacheKey, allMatches);

      // Clear old cache entries
      if (this?.matchCache?.size > 1000) {
        const firstKey = this?.matchCache?.keys().next().value;
        if (firstKey) {
          this?.matchCache?.delete(firstKey);
        }
      }

      return allMatches;
    } catch (error) {
      logger.error("Failed to find deals for product", "DEAL_MATCHING", {
        error,
      });
      throw error;
    }
  }

  /**
   * Find deals for multiple products (e.g., shopping cart)
   */
  async findDealsForProducts(
    productIds: string[],
  ): Promise<Map<string, DealMatch[]>> {
    try {
      logger.info("Finding deals for multiple products", "DEAL_MATCHING", {
        count: productIds?.length || 0,
      });

      const results = new Map<string, DealMatch[]>();

      // Process in batches for efficiency
      const batchSize = 10;
      for (let i = 0; i < productIds?.length || 0; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch?.map((id: string) => this.findDealsForProduct(id)),
        );

        batch.forEach((id, index) => {
          results.set(id, batchResults[index] || []);
        });
      }

      return results;
    } catch (error) {
      logger.error("Failed to find deals for products", "DEAL_MATCHING", {
        error,
      });
      throw error;
    }
  }

  /**
   * Analyze deals for a shopping list
   */
  async analyzeShoppingListDeals(productIds: string[]): Promise<DealAnalysis> {
    try {
      logger.info("Analyzing deals for shopping list", "DEAL_MATCHING");

      const dealMap = await this.findDealsForProducts(productIds);

      let totalSavings = 0;
      let totalProducts = 0;
      const allDeals: DealMatch[] = [];
      const categoryBreakdown: Record<
        string,
        { count: number; totalSavings: number }
      > = {};

      // Aggregate all deals
      dealMap.forEach((deals, productId) => {
        if (deals && deals?.length || 0 > 0) {
          // Take the best deal for each product
          const bestDeal = deals[0];
          if (bestDeal) {
            allDeals.push(bestDeal);
            totalSavings += bestDeal.savings || 0;
            totalProducts++;

            // Update category breakdown
            const category =
              typeof bestDeal.product?.category === "object"
                ? bestDeal?.product?.category.name
                : bestDeal.product?.category || "Other";
            if (!categoryBreakdown[category]) {
              categoryBreakdown[category] = { count: 0, totalSavings: 0 };
            }
            categoryBreakdown[category].count++;
            categoryBreakdown[category].totalSavings += bestDeal.savings || 0;
          }
        }
      });

      // Find best deals (top 5 by savings)
      const bestDeals = allDeals
        .sort((a, b) => b.savings - a.savings)
        .slice(0, 5);

      // Find expiring deals (within 7 days)
      const expiringDeals = allDeals
        .filter((match: DealMatch) => {
          const daysUntilExpiry = this.getDaysUntilExpiry(match.deal);
          return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
        })
        .sort((a, b) => {
          const aDays = this.getDaysUntilExpiry(a.deal);
          const bDays = this.getDaysUntilExpiry(b.deal);
          return aDays - bDays;
        });

      const averageSavingsPercent =
        totalProducts > 0
          ? allDeals.reduce((sum: number, d: DealMatch) => sum + d.savingsPercent, 0) /
            totalProducts
          : 0;

      return {
        totalSavings,
        averageSavingsPercent,
        bestDeals,
        expiringDeals,
        categoryBreakdown,
      };
    } catch (error) {
      logger.error("Failed to analyze shopping list deals", "DEAL_MATCHING", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get trending deals
   */
  async getTrendingDeals(
    category?: string,
    limit: number = 10,
  ): Promise<DealMatch[]> {
    try {
      logger.info("Getting trending deals", "DEAL_MATCHING", {
        category,
        limit,
      });

      // Get recent deals
      const recentDeals = await this?.dealService?.getRecentDeals(24); // Last 24 hours

      const matches: DealMatch[] = [];

      for (const deal of recentDeals) {
        if (!deal.items?.length) continue;

        // Filter by category if specified
        if (category) {
          const hasCategory = deal?.items?.some((item: DealItem) =>
            item.product_family?.toLowerCase().includes(category.toLowerCase()),
          );
          if (!hasCategory) continue;
        }

        // Get the best deal item
        const bestItem = deal?.items?.reduce((best: DealItem, item: DealItem) => {
          const itemDiscount = this.calculateDiscount(
            item.dealer_net_price,
            item.msrp || item.dealer_net_price * 1.2,
          );
          const bestDiscount = this.calculateDiscount(
            best.dealer_net_price,
            best.msrp || best.dealer_net_price * 1.2,
          );
          return itemDiscount > bestDiscount ? item : best;
        });

        // Try to match with Walmart product
        const product = await this.findWalmartProduct(bestItem);
        if (product) {
          matches.push({
            product,
            deal,
            dealItem: bestItem,
            savings:
              (typeof product.price === "object"
                ? product?.price?.wasPrice || product?.price?.regular || 0
                : product.price || 0) - bestItem.dealer_net_price,
            savingsPercent: this.calculateDiscount(
              bestItem.dealer_net_price,
              typeof product.price === "object"
                ? product?.price?.wasPrice || product?.price?.regular || 0
                : product.price || 0,
            ),
            matchConfidence: 0.8,
            matchType: "similar",
          });
        }
      }

      // Sort by savings and return top results
      return matches.sort((a, b) => b.savings - a.savings).slice(0, limit);
    } catch (error) {
      logger.error("Failed to get trending deals", "DEAL_MATCHING", { error });
      return [];
    }
  }

  /**
   * Find exact matches by SKU/UPC
   */
  private async findExactMatches(
    product: WalmartProduct,
  ): Promise<DealMatch[]> {
    const matches: DealMatch[] = [];

    try {
      // Search by SKU
      if (product.upc) {
        // For now, we'll use a placeholder approach
        // TODO: Implement proper SKU search in DealDataService
        const dealsBySku: Deal[] = [];

        for (const deal of dealsBySku) {
          const matchingItem = deal.items?.find(
            (item: DealItem) => item.part_number === product.upc,
          );

          if (matchingItem) {
            matches.push(
              this.createDealMatch(product, deal, matchingItem, "exact"),
            );
          }
        }
      }

      // Search by UPC/Barcode
      if (product.upc) {
        // TODO: Implement proper UPC search in DealDataService
        const dealsByUpc: Deal[] = [];

        for (const deal of dealsByUpc) {
          const matchingItem = deal.items?.find((item: DealItem) =>
            item.description?.includes(product.upc!),
          );

          if (matchingItem) {
            matches.push(
              this.createDealMatch(product, deal, matchingItem, "exact"),
            );
          }
        }
      }
    } catch (error) {
      logger.error("Error finding exact matches", "DEAL_MATCHING", { error });
    }

    return matches;
  }

  /**
   * Find similar product matches
   */
  private async findSimilarMatches(
    product: WalmartProduct,
  ): Promise<DealMatch[]> {
    const matches: DealMatch[] = [];

    try {
      // Get recent deals and filter by product name
      const recentDeals = await this?.dealService?.getRecentDeals(168); // Last week
      const nameSearch = recentDeals
        .filter((deal: Deal) =>
          deal.items?.some((item: DealItem) =>
            item.description
              ?.toLowerCase()
              .includes(product?.name?.toLowerCase()),
          ),
        )
        .slice(0, 10);

      for (const deal of nameSearch) {
        if (!deal.items?.length) continue;

        // Find best matching item
        const scoredItems = deal?.items?.map((item: DealItem) => ({
          item,
          score: this.calculateSimilarity(product, item),
        }));

        const bestMatch = scoredItems
          .filter((s: ScoredDealItem) => s.score > 0.6)
          .sort((a: ScoredDealItem, b: ScoredDealItem) => b.score - a.score)[0];

        if (bestMatch) {
          matches.push(
            this.createDealMatch(product, deal, bestMatch.item, "similar"),
          );
        }
      }
    } catch (error) {
      logger.error("Error finding similar matches", "DEAL_MATCHING", { error });
    }

    return matches;
  }

  /**
   * Find matches by category
   */
  private async findCategoryMatches(
    product: WalmartProduct,
  ): Promise<DealMatch[]> {
    const matches: DealMatch[] = [];

    try {
      if (!product.category) return matches;

      const category =
        typeof product.category === "string"
          ? product.category
          : product?.category?.name;

      // Map Walmart categories to deal product families
      const familyMapping: Record<string, string[]> = {
        Electronics: ["Computers", "Monitors", "Accessories"],
        Grocery: ["Food", "Beverages", "Snacks"],
        Home: ["Furniture", "Appliances", "Decor"],
        Office: ["Printers", "Supplies", "Furniture"],
      };

      const families = category
        ? familyMapping[category] || [category]
        : ["General"];

      for (const family of families) {
        // Get recent deals and filter by product family
        const recentDeals = await this?.dealService?.getRecentDeals(168); // Last week
        const categoryDeals = recentDeals
          .filter((deal: Deal) =>
            deal.items?.some((item: DealItem) =>
              item.product_family?.toLowerCase().includes(family.toLowerCase()),
            ),
          )
          .slice(0, 5);

        for (const deal of categoryDeals) {
          if (!deal.items?.length) continue;

          // Find items that might match
          const relevantItems = deal?.items?.filter(
            (item: DealItem) => item.product_family === family,
          );

          for (const item of relevantItems.slice(0, 2)) {
            matches.push(this.createDealMatch(product, deal, item, "category"));
          }
        }
      }
    } catch (error) {
      logger.error("Error finding category matches", "DEAL_MATCHING", {
        error,
      });
    }

    return matches;
  }

  /**
   * Create a deal match object
   */
  private createDealMatch(
    product: WalmartProduct,
    deal: Deal,
    dealItem: DealItem,
    matchType: "exact" | "similar" | "category",
  ): DealMatch {
    const walmartPrice =
      typeof product.price === "object"
        ? product?.price?.regular || 0
        : product.price || 0;
    const dealPrice = dealItem?.dealer_net_price;
    const savings = Math.max(0, walmartPrice - dealPrice);
    const savingsPercent =
      walmartPrice > 0 ? (savings / walmartPrice) * 100 : 0;

    // Calculate match confidence
    let matchConfidence = 0.5;
    if (matchType === "exact") matchConfidence = 1.0;
    else if (matchType === "similar") matchConfidence = 0.8;
    else if (matchType === "category") matchConfidence = 0.6;

    return {
      product,
      deal,
      dealItem,
      savings,
      savingsPercent,
      matchConfidence,
      matchType,
    };
  }

  /**
   * Calculate similarity between product and deal item
   */
  private calculateSimilarity(product: WalmartProduct, item: DealItem): number {
    let score = 0;
    let factors = 0;

    // Name similarity
    if (product.name && item.description) {
      const nameSimilarity = this.stringSimilarity(
        product?.name?.toLowerCase(),
        item?.description?.toLowerCase(),
      );
      score += nameSimilarity * 0.4;
      factors += 0.4;
    }

    // Brand match
    if (product.brand && item.description?.includes(product.brand)) {
      score += 0.3;
      factors += 0.3;
    }

    // Category/family match
    if (product.category && item.product_family) {
      const categoryName =
        typeof product.category === "string"
          ? product.category
          : product?.category?.name;
      const categoryMatch = categoryName
        .toLowerCase()
        .includes(item?.product_family?.toLowerCase());
      if (categoryMatch) {
        score += 0.3;
        factors += 0.3;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Simple string similarity calculation
   */
  private stringSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);

    let matches = 0;
    for (const word1 of words1) {
      if (
        words2.some((word2: string) => word2.includes(word1) || word1.includes(word2))
      ) {
        matches++;
      }
    }

    return matches / Math.max(words1?.length || 0, words2?.length || 0);
  }

  /**
   * Calculate discount percentage
   */
  private calculateDiscount(salePrice: number, originalPrice: number): number {
    if (originalPrice <= 0) return 0;
    return ((originalPrice - salePrice) / originalPrice) * 100;
  }

  /**
   * Get days until deal expiry
   */
  private getDaysUntilExpiry(deal: Deal): number {
    if (!deal.end_date) return -1;

    const endDate = new Date(deal.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Try to find a Walmart product for a deal item
   */
  private async findWalmartProduct(
    item: DealItem,
  ): Promise<WalmartProduct | null> {
    try {
      // Search by part number
      if (item.part_number) {
        const products = await this?.productRepo?.searchProducts(
          item.part_number,
          1,
        );
        if (products?.length || 0 > 0) {
          const productEntity = products[0];
          return productEntity
            ? this.convertToTypesProduct(
                this?.productRepo?.entityToProduct(productEntity),
              )
            : null;
        }
      }

      // Search by description
      if (item.description) {
        const products = await this?.productRepo?.searchProducts(
          item.description,
          1,
        );
        if (products?.length || 0 > 0) {
          const productEntity = products[0];
          return productEntity
            ? this.convertToTypesProduct(
                this?.productRepo?.entityToProduct(productEntity),
              )
            : null;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Combine and rank matches from different sources
   */
  private combineAndRankMatches(
    exact: DealMatch[],
    similar: DealMatch[],
    category: DealMatch[],
  ): DealMatch[] {
    const allMatches = [...exact, ...similar, ...category];

    // Deduplicate by deal ID + item part number
    const seen = new Set<string>();
    const unique = allMatches?.filter((match: DealMatch) => {
      const key = `${match?.deal?.id}:${match?.dealItem?.part_number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by confidence and savings
    return unique.sort((a, b) => {
      // First by match confidence
      if (a.matchConfidence !== b.matchConfidence) {
        return b.matchConfidence - a.matchConfidence;
      }
      // Then by savings amount
      return b.savings - a.savings;
    });
  }

  /**
   * Convert repository WalmartProduct to types WalmartProduct
   */
  private convertToTypesProduct(
    repoProduct: import("../../database/repositories/WalmartProductRepository.js").WalmartProduct,
  ): WalmartProduct {
    return {
      id: repoProduct.product_id,
      walmartId: repoProduct.product_id,
      upc: repoProduct.upc,
      name: repoProduct.name || "",
      brand: repoProduct.brand || "",
      category: {
        id: "1",
        name:
          typeof repoProduct.category_path === "string"
            ? repoProduct.category_path
            : "Uncategorized",
        path:
          typeof repoProduct.category_path === "string"
            ? [repoProduct.category_path]
            : ["Uncategorized"],
        level: 1,
      },
      description: repoProduct.description || "",
      shortDescription: repoProduct.description || "",
      price: {
        currency: "USD",
        regular: repoProduct.current_price || 0,
        sale: repoProduct.regular_price,
        unit: repoProduct.unit_price,
        unitOfMeasure: repoProduct.unit_measure || "each",
        wasPrice: repoProduct.regular_price,
      },
      images: [
        {
          id: "1",
          url: repoProduct.large_image_url || repoProduct.thumbnail_url || "",
          type: "primary" as const,
          alt: repoProduct.name || "",
        },
      ],
      availability: {
        inStock: repoProduct.in_stock !== false,
        stockLevel: repoProduct.in_stock
          ? ("in_stock" as const)
          : ("out_of_stock" as const),
        quantity: repoProduct.stock_level,
        onlineOnly: repoProduct.online_only,
        instoreOnly: repoProduct.store_only,
      },
      ratings: repoProduct.average_rating
        ? {
            average: repoProduct.average_rating,
            count: repoProduct.review_count || 0,
            distribution: {
              5: 0,
              4: 0,
              3: 0,
              2: 0,
              1: 0,
            },
          }
        : undefined,
      nutritionFacts: repoProduct.nutritional_info,
      ingredients:
        typeof repoProduct.ingredients === "string"
          ? [repoProduct.ingredients]
          : repoProduct.ingredients,
      allergens: repoProduct.allergens?.map((allergen: string) => ({
        type: allergen.toLowerCase() as 'milk' | 'eggs' | 'fish' | 'shellfish' | 'tree_nuts' | 'peanuts' | 'wheat' | 'soybeans' | 'sesame',
        contains: true,
        mayContain: false,
      })),
      metadata: {
        source: "api" as const,
        lastScraped: repoProduct.last_updated_at,
        confidence: 0.9,
        dealEligible: true,
      },
      createdAt: repoProduct.first_seen_at || new Date().toISOString(),
      updatedAt: repoProduct.last_updated_at || new Date().toISOString(),
    };
  }
}
