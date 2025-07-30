/**
 * Product Lookup Service - Advanced product search and matching
 * Uses vector embeddings and semantic search for intelligent product discovery
 */

import { logger } from "../../utils/logger.js";
import { ChromaDBManager } from "../../database/vector/ChromaDBManager.js";
import type {
  WalmartProductRepository,
  ProductEntity,
} from "../../database/repositories/WalmartProductRepository.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import { MasterOrchestrator } from "../../core/orchestration/MasterOrchestrator.js";

interface LookupOptions {
  useVector?: boolean;
  includeSimilar?: boolean;
  maxResults?: number;
  filters?: ProductFilters;
}

interface ProductFilters {
  categories?: string[];
  brands?: string[];
  priceRange?: { min: number; max: number };
  inStock?: boolean;
  minRating?: number;
  attributes?: Record<string, any>;
}

interface SemanticSearchResult {
  product: WalmartProduct;
  score: number;
  matchType: "exact" | "semantic" | "category" | "attribute";
}

export class ProductLookupService {
  private static instance: ProductLookupService;

  private chromadb: ChromaDBManager;
  private productRepo: WalmartProductRepository;
  private orchestrator: MasterOrchestrator;
  private embeddingCache: Map<string, number[]>;

  private constructor() {
    this.chromadb = new ChromaDBManager();
    this.productRepo = getDatabaseManager().walmartProducts;
    this.orchestrator = MasterOrchestrator.getInstance();
    this.embeddingCache = new Map();
  }

  static getInstance(): ProductLookupService {
    if (!ProductLookupService.instance) {
      ProductLookupService.instance = new ProductLookupService();
    }
    return ProductLookupService.instance;
  }

  /**
   * Perform intelligent product lookup
   */
  async lookupProducts(
    query: string,
    options: LookupOptions = {},
  ): Promise<SemanticSearchResult[]> {
    try {
      logger.info("Looking up products", "LOOKUP_SERVICE", { query, options });

      // First try exact match
      const exactMatches = await this.findExactMatches(query, options.filters);

      // If we have enough exact matches and don't need similar, return them
      if (
        exactMatches.length >= (options.maxResults || 10) &&
        !options.includeSimilar
      ) {
        return exactMatches.slice(0, options.maxResults || 10);
      }

      // Use vector search for semantic matching
      let semanticMatches: SemanticSearchResult[] = [];
      if (options.useVector !== false) {
        semanticMatches = await this.performSemanticSearch(query, options);
      }

      // Combine and deduplicate results
      const combined = this.combineResults(exactMatches, semanticMatches);

      // Apply filters
      const filtered = this.applyFilters(combined, options.filters);

      // Sort by relevance score
      const sorted = filtered.sort((a, b) => b.score - a.score);

      return sorted.slice(0, options.maxResults || 10);
    } catch (error) {
      logger.error("Product lookup failed", "LOOKUP_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Find products by attributes
   */
  async findByAttributes(
    attributes: Record<string, any>,
  ): Promise<WalmartProduct[]> {
    try {
      logger.info("Finding products by attributes", "LOOKUP_SERVICE", {
        attributes,
      });

      // Build query from attributes
      const query = this.buildQueryFromAttributes(attributes);

      // Perform lookup
      const results = await this.lookupProducts(query, {
        filters: { attributes },
      });

      return results.map((r) => r.product);
    } catch (error) {
      logger.error("Attribute search failed", "LOOKUP_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(
    userId: string,
    context: any,
  ): Promise<WalmartProduct[]> {
    try {
      logger.info("Generating personalized recommendations", "LOOKUP_SERVICE", {
        userId,
      });

      // Use orchestrator to analyze context and generate recommendations
      const analysisResult = await this.orchestrator.processQuery({
        text: `Generate product recommendations based on user preferences and history`,
        metadata: {
          userId,
          context,
          task: "recommendation",
        },
      });

      // Extract product IDs from analysis
      const recommendedIds = this.extractProductIds(analysisResult.response);

      // Fetch full product details
      const products: WalmartProduct[] = [];
      for (const id of recommendedIds) {
        try {
          const productEntity = await this.productRepo.findById(id);
          const product = productEntity
            ? this.transformToWalmartProduct(productEntity)
            : null;
          if (product) products.push(product);
        } catch (error) {
          // Skip invalid IDs
        }
      }

      // If not enough direct recommendations, use semantic search
      if (products.length < 10) {
        const semanticQuery = this.buildRecommendationQuery(context);
        const additional = await this.performSemanticSearch(semanticQuery, {
          maxResults: 10 - products.length,
        });

        products.push(...additional.map((r) => r.product));
      }

      return products;
    } catch (error) {
      logger.error("Failed to generate recommendations", "LOOKUP_SERVICE", {
        error,
      });
      return [];
    }
  }

  /**
   * Match products from text (e.g., shopping list)
   */
  async matchProductsFromText(text: string): Promise<
    Array<{
      item: string;
      matches: WalmartProduct[];
      confidence: number;
    }>
  > {
    try {
      logger.info("Matching products from text", "LOOKUP_SERVICE");

      // Parse items from text
      const items = this.parseShoppingItems(text);
      const results = [];

      for (const item of items) {
        const matches = await this.lookupProducts(item.name, {
          maxResults: 3,
          includeSimilar: true,
        });

        results.push({
          item: item.original,
          matches: matches.map((m) => m.product),
          confidence: matches[0]?.score || 0,
        });
      }

      return results;
    } catch (error) {
      logger.error("Failed to match products from text", "LOOKUP_SERVICE", {
        error,
      });
      throw error;
    }
  }

  /**
   * Find exact matches
   */
  private async findExactMatches(
    query: string,
    filters?: ProductFilters,
  ): Promise<SemanticSearchResult[]> {
    const products = await this.productRepo.searchProducts(query, 20);

    return products.map((productEntity) => {
      // Transform ProductEntity to WalmartProduct
      const product = this.transformToWalmartProduct(productEntity);

      // Calculate match score based on how well the query matches
      const nameMatch = product.name
        .toLowerCase()
        .includes(query.toLowerCase());
      const brandMatch = product.brand
        ?.toLowerCase()
        .includes(query.toLowerCase());
      const score = nameMatch ? 1.0 : brandMatch ? 0.8 : 0.5;

      return {
        product,
        score,
        matchType: "exact" as const,
      };
    });
  }

  /**
   * Perform semantic search using vector embeddings
   */
  private async performSemanticSearch(
    query: string,
    options: LookupOptions,
  ): Promise<SemanticSearchResult[]> {
    try {
      // Get or create embedding for query
      const queryEmbedding = await this.getEmbedding(query);

      // Search in vector database
      const collection = await this.chromadb.getCollection("walmart_products");
      if (!collection) {
        logger.warn("Walmart products collection not found", "LOOKUP_SERVICE");
        return [];
      }

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: options.maxResults || 10,
        where: this.buildChromaFilters(options.filters),
      });

      // Transform results
      const semanticResults: SemanticSearchResult[] = [];

      if (results.ids?.[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const productId = results.ids[0][i];
          if (!productId) continue; // Type guard for possibly undefined

          const score = results.distances
            ? 1 - (results.distances[0]?.[i] || 0)
            : 0.5;

          try {
            const productEntity = await this.productRepo.findById(productId);
            const product = productEntity
              ? this.transformToWalmartProduct(productEntity)
              : null;
            if (product) {
              semanticResults.push({
                product,
                score,
                matchType: "semantic",
              });
            }
          } catch (error) {
            // Skip if product not found
          }
        }
      }

      return semanticResults;
    } catch (error) {
      logger.error("Semantic search failed", "LOOKUP_SERVICE", { error });
      return [];
    }
  }

  /**
   * Get or generate embedding for text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text)!;
    }

    try {
      // Use orchestrator to generate embedding
      const result = await this.orchestrator.processQuery({
        text: `Generate embedding for: ${text}`,
        metadata: {
          task: "embedding",
          dimension: 384, // Standard embedding size
        },
      });

      // Parse embedding from response
      const embedding = this.parseEmbedding(result.response);

      // Cache it
      this.embeddingCache.set(text, embedding);

      // Limit cache size
      if (this.embeddingCache.size > 1000) {
        const firstKey = this.embeddingCache.keys().next().value;
        if (firstKey !== undefined) {
          this.embeddingCache.delete(firstKey);
        }
      }

      return embedding;
    } catch (error) {
      logger.error("Failed to generate embedding", "LOOKUP_SERVICE", { error });
      // Return random embedding as fallback
      return Array.from({ length: 384 }, () => Math.random());
    }
  }

  /**
   * Combine and deduplicate results
   */
  private combineResults(
    exact: SemanticSearchResult[],
    semantic: SemanticSearchResult[],
  ): SemanticSearchResult[] {
    const seen = new Set<string>();
    const combined: SemanticSearchResult[] = [];

    // Add exact matches first (higher priority)
    for (const result of exact) {
      if (!seen.has(result.product.id)) {
        seen.add(result.product.id);
        combined.push(result);
      }
    }

    // Add semantic matches
    for (const result of semantic) {
      if (!seen.has(result.product.id)) {
        seen.add(result.product.id);
        combined.push(result);
      }
    }

    return combined;
  }

  /**
   * Apply filters to results
   */
  private applyFilters(
    results: SemanticSearchResult[],
    filters?: ProductFilters,
  ): SemanticSearchResult[] {
    if (!filters) return results;

    return results.filter((result) => {
      const product = result.product;

      // Category filter
      if (filters.categories?.length) {
        const hasCategory = filters.categories.some(
          (cat) => {
            if (!product.category) return false;
            if (typeof product.category === 'string') {
              return product.category.includes(cat);
            }
            return product.category.name?.includes(cat) ||
                   product.category.path?.includes(cat);
          }
        );
        if (!hasCategory) return false;
      }

      // Brand filter
      if (filters.brands?.length) {
        if (!product.brand || !filters.brands.includes(product.brand)) {
          return false;
        }
      }

      // Price filter
      if (filters.priceRange) {
        const price = typeof product.price === 'object' 
          ? (product.price.regular || 0)
          : (product.price || 0);
        if (price < filters.priceRange.min || price > filters.priceRange.max) {
          return false;
        }
      }

      // Stock filter
      if (filters.inStock !== undefined) {
        if (product.availability.inStock !== filters.inStock) {
          return false;
        }
      }

      // Rating filter
      if (filters.minRating) {
        if (
          !product.ratings?.average ||
          product.ratings.average < filters.minRating
        ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Build ChromaDB filter object
   */
  private buildChromaFilters(
    filters?: ProductFilters,
  ): Record<string, any> | undefined {
    if (!filters) return undefined;

    const where: Record<string, any> = {};

    if (filters.categories?.length) {
      where.category = { $in: filters.categories };
    }

    if (filters.brands?.length) {
      where.brand = { $in: filters.brands };
    }

    if (filters.inStock !== undefined) {
      where.in_stock = filters.inStock;
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  /**
   * Build query from attributes
   */
  private buildQueryFromAttributes(attributes: Record<string, any>): string {
    const parts: string[] = [];

    if (attributes.name) parts.push(attributes.name);
    if (attributes.brand) parts.push(attributes.brand);
    if (attributes.category) parts.push(attributes.category);
    if (attributes.flavor) parts.push(attributes.flavor);
    if (attributes.size) parts.push(attributes.size);

    return parts.join(" ");
  }

  /**
   * Extract product IDs from LLM response
   */
  private extractProductIds(response: string): string[] {
    const ids: string[] = [];

    // Look for patterns like "product_id: XXX" or "id: XXX"
    const idPattern = /(?:product_)?id:\s*([A-Za-z0-9-]+)/gi;
    let match;

    while ((match = idPattern.exec(response)) !== null) {
      if (match[1]) {
        ids.push(match[1]);
      }
    }

    return ids;
  }

  /**
   * Build recommendation query from context
   */
  private buildRecommendationQuery(context: any): string {
    const parts: string[] = [];

    if (context.preferences?.preferred_brands) {
      parts.push(...context.preferences.preferred_brands);
    }

    if (context.recentSearches?.length) {
      parts.push(...context.recentSearches.slice(0, 3));
    }

    if (context.categories?.length) {
      parts.push(...context.categories);
    }

    return parts.join(" ") || "popular grocery items";
  }

  /**
   * Parse shopping items from text
   */
  private parseShoppingItems(text: string): Array<{
    original: string;
    name: string;
    quantity?: number;
    unit?: string;
  }> {
    const lines = text.split(/[\n,;]/);
    const items = [];

    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned) continue;

      // Parse quantity if present
      const quantityMatch = cleaned.match(
        /^(\d+(?:\.\d+)?)\s*([a-z]+)?\s+(.+)$/i,
      );

      if (quantityMatch && quantityMatch[3]) {
        items.push({
          original: cleaned,
          name: quantityMatch[3] || cleaned,
          quantity: parseFloat(quantityMatch[1] || "1"),
          unit: quantityMatch[2] || "each",
        });
      } else {
        items.push({
          original: cleaned,
          name: cleaned,
        });
      }
    }

    return items;
  }

  /**
   * Parse embedding from LLM response
   */
  private parseEmbedding(response: string): number[] {
    try {
      // Look for array pattern in response
      const arrayMatch = response.match(/\[[\d.,\s-]+\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
    } catch (error) {
      // Fallback
    }

    // Generate random embedding as fallback
    return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
  }

  /**
   * Transform ProductEntity to WalmartProduct
   */
  private transformToWalmartProduct(entity: ProductEntity): WalmartProduct {
    return {
      id: entity.product_id,
      walmartId: entity.product_id,
      upc: entity.upc,
      name: entity.name || "",
      brand: entity.brand || "",
      category: {
        id: "1",
        name:
          typeof entity.category_path === "string"
            ? entity.category_path
            : "Uncategorized",
        path:
          typeof entity.category_path === "string"
            ? [entity.category_path]
            : ["Uncategorized"],
        level: 1,
      },
      description: entity.description || "",
      shortDescription: entity.description || "",
      price: {
        currency: "USD",
        regular: entity.current_price || 0,
        sale: entity.regular_price,
        unit: entity.unit_price,
        unitOfMeasure: entity.unit_measure || "each",
        wasPrice: entity.regular_price,
      },
      images:
        entity.large_image_url || entity.thumbnail_url
          ? [
              {
                id: "1",
                url: entity.large_image_url || entity.thumbnail_url || "",
                type: "primary" as const,
                alt: entity.name || "",
              },
            ]
          : [],
      availability: {
        inStock: entity.in_stock !== false,
        stockLevel: entity.in_stock
          ? ("in_stock" as const)
          : ("out_of_stock" as const),
        quantity: entity.stock_level,
        onlineOnly: entity.online_only,
        instoreOnly: entity.store_only,
      },
      ratings: entity.average_rating
        ? {
            average: entity.average_rating,
            count: entity.review_count || 0,
            distribution: {
              5: 0,
              4: 0,
              3: 0,
              2: 0,
              1: 0,
            },
          }
        : undefined,
      nutritionFacts: entity.nutritional_info,
      ingredients:
        typeof entity.ingredients === "string"
          ? [entity.ingredients]
          : entity.ingredients,
      allergens: entity.allergens?.map((allergen) => ({
        type: allergen.toLowerCase() as any,
        contains: true,
        mayContain: false,
      })),
      metadata: {
        source: "api" as const,
        lastScraped: entity.last_updated_at,
        confidence: 0.9,
        dealEligible: true,
      },
      createdAt: entity.first_seen_at || new Date().toISOString(),
      updatedAt: entity.last_updated_at || new Date().toISOString(),
    };
  }
}
