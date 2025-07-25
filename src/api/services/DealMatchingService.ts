/**
 * Deal Matching Service - Matches Walmart products with existing deals
 * Analyzes pricing, identifies savings opportunities, and tracks deal performance
 */

import { logger } from "../../utils/logger";
import { DealDataService } from "./DealDataService";
import { WalmartProductRepository } from "../../database/repositories/WalmartProductRepository";
import { getDatabaseManager } from "../../database/DatabaseManager";
import type { WalmartProduct } from "../../types/walmart-grocery";
import type { Deal, DealItem } from "../types/deal.types";

interface DealMatch {
  product: WalmartProduct;
  deal: Deal;
  dealItem: DealItem;
  savings: number;
  savingsPercent: number;
  matchConfidence: number;
  matchType: "exact" | "similar" | "category";
}

interface DealAnalysis {
  totalSavings: number;
  averageSavingsPercent: number;
  bestDeals: DealMatch[];
  expiringDeals: DealMatch[];
  categoryBreakdown: Record<string, {
    count: number;
    totalSavings: number;
  }>;
}

export class DealMatchingService {
  private static instance: DealMatchingService;
  
  private dealService: DealDataService;
  private productRepo: WalmartProductRepository;
  private matchCache: Map<string, DealMatch[]>;

  private constructor() {
    this.dealService = DealDataService.getInstance();
    this.productRepo = getDatabaseManager().walmartProducts;
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
      if (this.matchCache.has(cacheKey)) {
        return this.matchCache.get(cacheKey)!;
      }

      logger.info("Finding deals for product", "DEAL_MATCHING", { productId });

      const productEntity = await this.productRepo.findByProductId(productId);
      if (!productEntity) {
        throw new Error(`Product not found: ${productId}`);
      }
      const product = this.productRepo.entityToProduct(productEntity);

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
        categoryMatches
      );

      // Cache results
      this.matchCache.set(cacheKey, allMatches);
      
      // Clear old cache entries
      if (this.matchCache.size > 1000) {
        const firstKey = this.matchCache.keys().next().value;
        if (firstKey) {
          this.matchCache.delete(firstKey);
        }
      }

      return allMatches;
    } catch (error) {
      logger.error("Failed to find deals for product", "DEAL_MATCHING", { error });
      throw error;
    }
  }

  /**
   * Find deals for multiple products (e.g., shopping cart)
   */
  async findDealsForProducts(productIds: string[]): Promise<Map<string, DealMatch[]>> {
    try {
      logger.info("Finding deals for multiple products", "DEAL_MATCHING", { 
        count: productIds.length 
      });

      const results = new Map<string, DealMatch[]>();

      // Process in batches for efficiency
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(id => this.findDealsForProduct(id))
        );

        batch.forEach((id, index) => {
          results.set(id, batchResults[index] || []);
        });
      }

      return results;
    } catch (error) {
      logger.error("Failed to find deals for products", "DEAL_MATCHING", { error });
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
      const categoryBreakdown: Record<string, { count: number; totalSavings: number }> = {};

      // Aggregate all deals
      dealMap.forEach((deals, productId) => {
        if (deals && deals.length > 0) {
          // Take the best deal for each product
          const bestDeal = deals[0];
          if (bestDeal) {
            allDeals.push(bestDeal);
            totalSavings += bestDeal.savings || 0;
            totalProducts++;

            // Update category breakdown
            const category = bestDeal.product?.category?.split("/")[0] || "Other";
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
        .filter(match => {
          const daysUntilExpiry = this.getDaysUntilExpiry(match.deal);
          return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
        })
        .sort((a, b) => {
          const aDays = this.getDaysUntilExpiry(a.deal);
          const bDays = this.getDaysUntilExpiry(b.deal);
          return aDays - bDays;
        });

      const averageSavingsPercent = totalProducts > 0
        ? allDeals.reduce((sum, d) => sum + d.savingsPercent, 0) / totalProducts
        : 0;

      return {
        totalSavings,
        averageSavingsPercent,
        bestDeals,
        expiringDeals,
        categoryBreakdown
      };
    } catch (error) {
      logger.error("Failed to analyze shopping list deals", "DEAL_MATCHING", { error });
      throw error;
    }
  }

  /**
   * Get trending deals
   */
  async getTrendingDeals(category?: string, limit: number = 10): Promise<DealMatch[]> {
    try {
      logger.info("Getting trending deals", "DEAL_MATCHING", { category, limit });

      // Get recent deals
      const recentDeals = await this.dealService.getRecentDeals(24); // Last 24 hours
      
      const matches: DealMatch[] = [];

      for (const deal of recentDeals) {
        if (!deal.items?.length) continue;

        // Filter by category if specified
        if (category) {
          const hasCategory = deal.items.some((item: any) => 
            item.product_family?.toLowerCase().includes(category.toLowerCase())
          );
          if (!hasCategory) continue;
        }

        // Get the best deal item
        const bestItem = deal.items.reduce((best: any, item: any) => {
          const itemDiscount = this.calculateDiscount(
            item.dealer_net_price,
            item.msrp || item.dealer_net_price * 1.2
          );
          const bestDiscount = this.calculateDiscount(
            best.dealer_net_price,
            best.msrp || best.dealer_net_price * 1.2
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
            savings: (product.originalPrice || product.price || 0) - bestItem.dealer_net_price,
            savingsPercent: this.calculateDiscount(
              bestItem.dealer_net_price,
              product.originalPrice || product.price || 0
            ),
            matchConfidence: 0.8,
            matchType: "similar"
          });
        }
      }

      // Sort by savings and return top results
      return matches
        .sort((a, b) => b.savings - a.savings)
        .slice(0, limit);
    } catch (error) {
      logger.error("Failed to get trending deals", "DEAL_MATCHING", { error });
      return [];
    }
  }

  /**
   * Find exact matches by SKU/UPC
   */
  private async findExactMatches(product: WalmartProduct): Promise<DealMatch[]> {
    const matches: DealMatch[] = [];

    try {
      // Search by SKU
      if (product.barcode) {
        // For now, we'll use a placeholder approach
        // TODO: Implement proper SKU search in DealDataService
        const dealsBySku: any[] = [];

        for (const deal of dealsBySku) {
          const matchingItem = deal.items?.find((item: any) => 
            item.part_number === product.barcode
          );

          if (matchingItem) {
            matches.push(this.createDealMatch(
              product,
              deal,
              matchingItem,
              "exact"
            ));
          }
        }
      }

      // Search by UPC/Barcode
      if (product.barcode) {
        // TODO: Implement proper UPC search in DealDataService
        const dealsByUpc: any[] = [];

        for (const deal of dealsByUpc) {
          const matchingItem = deal.items?.find((item: any) => 
            item.description?.includes(product.barcode!)
          );

          if (matchingItem) {
            matches.push(this.createDealMatch(
              product,
              deal,
              matchingItem,
              "exact"
            ));
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
  private async findSimilarMatches(product: WalmartProduct): Promise<DealMatch[]> {
    const matches: DealMatch[] = [];

    try {
      // Get recent deals and filter by product name
      const recentDeals = await this.dealService.getRecentDeals(168); // Last week
      const nameSearch = recentDeals.filter((deal: any) => 
        deal.items?.some((item: any) => 
          item.description?.toLowerCase().includes(product.name.toLowerCase())
        )
      ).slice(0, 10);

      for (const deal of nameSearch) {
        if (!deal.items?.length) continue;

        // Find best matching item
        const scoredItems = deal.items.map((item: any) => ({
          item,
          score: this.calculateSimilarity(product, item)
        }));

        const bestMatch = scoredItems
          .filter((s: any) => s.score > 0.6)
          .sort((a: any, b: any) => b.score - a.score)[0];

        if (bestMatch) {
          matches.push(this.createDealMatch(
            product,
            deal,
            bestMatch.item,
            "similar"
          ));
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
  private async findCategoryMatches(product: WalmartProduct): Promise<DealMatch[]> {
    const matches: DealMatch[] = [];

    try {
      if (!product.category) return matches;

      const category = product.category.split("/")[0];
      
      // Map Walmart categories to deal product families
      const familyMapping: Record<string, string[]> = {
        "Electronics": ["Computers", "Monitors", "Accessories"],
        "Grocery": ["Food", "Beverages", "Snacks"],
        "Home": ["Furniture", "Appliances", "Decor"],
        "Office": ["Printers", "Supplies", "Furniture"]
      };

      const families = category ? (familyMapping[category] || [category]) : ["General"];

      for (const family of families) {
        // Get recent deals and filter by product family
        const recentDeals = await this.dealService.getRecentDeals(168); // Last week
        const categoryDeals = recentDeals.filter((deal: any) => 
          deal.items?.some((item: any) => 
            item.product_family?.toLowerCase().includes(family.toLowerCase())
          )
        ).slice(0, 5);

        for (const deal of categoryDeals) {
          if (!deal.items?.length) continue;

          // Find items that might match
          const relevantItems = deal.items.filter((item: any) => 
            item.product_family === family
          );

          for (const item of relevantItems.slice(0, 2)) {
            matches.push(this.createDealMatch(
              product,
              deal,
              item,
              "category"
            ));
          }
        }
      }
    } catch (error) {
      logger.error("Error finding category matches", "DEAL_MATCHING", { error });
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
    matchType: "exact" | "similar" | "category"
  ): DealMatch {
    const walmartPrice = product.price || 0;
    const dealPrice = dealItem.dealer_net_price;
    const savings = Math.max(0, walmartPrice - dealPrice);
    const savingsPercent = walmartPrice > 0 
      ? (savings / walmartPrice) * 100 
      : 0;

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
      matchType
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
        product.name.toLowerCase(),
        item.description.toLowerCase()
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
      const categoryMatch = product.category
        .toLowerCase()
        .includes(item.product_family.toLowerCase());
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
      if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        matches++;
      }
    }

    return matches / Math.max(words1.length, words2.length);
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
  private async findWalmartProduct(item: DealItem): Promise<WalmartProduct | null> {
    try {
      // Search by part number
      if (item.part_number) {
        const products = await this.productRepo.searchProducts(item.part_number, { limit: 1 });
        if (products.length > 0) {
          const productEntity = products[0];
          return productEntity ? this.productRepo.entityToProduct(productEntity) : null;
        }
      }

      // Search by description
      if (item.description) {
        const products = await this.productRepo.searchProducts(item.description, { limit: 1 });
        if (products.length > 0) {
          const productEntity = products[0];
          return productEntity ? this.productRepo.entityToProduct(productEntity) : null;
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
    category: DealMatch[]
  ): DealMatch[] {
    const allMatches = [...exact, ...similar, ...category];
    
    // Deduplicate by deal ID + item part number
    const seen = new Set<string>();
    const unique = allMatches.filter(match => {
      const key = `${match.deal.id}:${match.dealItem.part_number}`;
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
}