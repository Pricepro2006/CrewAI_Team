/**
 * BrightData Scraper Service - Web scraping integration for Walmart products
 * Uses BrightData SDK for reliable product data extraction
 */

import { logger } from "../../utils/logger";
import type { WalmartProduct } from "../../types/walmart-grocery";

interface ScraperConfig {
  apiKey: string;
  apiSecret?: string;
  timeout?: number;
  retries?: number;
}

interface SearchFilters {
  category?: string;
  priceRange?: { min: number; max: number };
  inStock?: boolean;
  brand?: string;
  rating?: number;
}

interface ScrapedProduct {
  id: string;
  name: string;
  price: number;
  regularPrice?: number;
  brand?: string;
  category?: string;
  inStock: boolean;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  description?: string;
  specifications?: Record<string, any>;
}

export class BrightDataScraper {
  private static instance: BrightDataScraper;
  private config: ScraperConfig;
  private brightDataClient: any; // Would be actual BrightData SDK client

  private constructor() {
    this.config = {
      apiKey: process.env.BRIGHTDATA_API_KEY || "",
      apiSecret: process.env.BRIGHTDATA_API_SECRET,
      timeout: 30000,
      retries: 3
    };

    // Initialize BrightData client
    this.initializeClient();
  }

  static getInstance(): BrightDataScraper {
    if (!BrightDataScraper.instance) {
      BrightDataScraper.instance = new BrightDataScraper();
    }
    return BrightDataScraper.instance;
  }

  private initializeClient(): void {
    try {
      // In production, this would initialize the actual BrightData SDK
      // For now, we'll use a mock implementation
      this.brightDataClient = {
        scrape: async (options: any) => this.mockScrape(options)
      };

      logger.info("BrightData scraper initialized", "BRIGHTDATA");
    } catch (error) {
      logger.error("Failed to initialize BrightData client", "BRIGHTDATA", { error });
      throw error;
    }
  }

  /**
   * Search Walmart products
   */
  async searchWalmartProducts(options: {
    query: string;
    limit?: number;
    page?: number;
    filters?: SearchFilters;
  }): Promise<WalmartProduct[]> {
    try {
      logger.info("Searching Walmart products", "BRIGHTDATA", { 
        query: options.query,
        limit: options.limit 
      });

      const scrapeOptions = {
        url: `https://www.walmart.com/search?q=${encodeURIComponent(options.query)}`,
        platform: "walmart",
        searchKeyword: options.query,
        maxProducts: options.limit || 20,
        filters: this.buildSearchFilters(options.filters)
      };

      const results = await this.executeWithRetry(async () => {
        return await this.brightDataClient.scrape(scrapeOptions);
      });

      return this.transformSearchResults(results);
    } catch (error) {
      logger.error("Failed to search Walmart products", "BRIGHTDATA", { error });
      throw error;
    }
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(productId: string): Promise<WalmartProduct | null> {
    try {
      logger.info("Fetching product details", "BRIGHTDATA", { productId });

      const scrapeOptions = {
        url: `https://www.walmart.com/ip/${productId}`,
        platform: "walmart",
        extractDetails: true
      };

      const result = await this.executeWithRetry(async () => {
        return await this.brightDataClient.scrape(scrapeOptions);
      });

      if (!result) return null;

      return this.transformProductDetails(result);
    } catch (error) {
      logger.error("Failed to get product details", "BRIGHTDATA", { error, productId });
      return null;
    }
  }

  /**
   * Monitor price changes for multiple products
   */
  async monitorPrices(productIds: string[]): Promise<Map<string, number>> {
    try {
      logger.info("Monitoring prices", "BRIGHTDATA", { 
        count: productIds.length 
      });

      const priceMap = new Map<string, number>();
      
      // Batch process for efficiency
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(id => this.getProductPrice(id))
        );

        batch.forEach((id, index) => {
          if (batchResults[index] !== null) {
            priceMap.set(id, batchResults[index]!);
          }
        });
      }

      return priceMap;
    } catch (error) {
      logger.error("Failed to monitor prices", "BRIGHTDATA", { error });
      throw error;
    }
  }

  /**
   * Get product availability by store
   */
  async checkStoreAvailability(productId: string, zipCode: string): Promise<{
    online: boolean;
    stores: Array<{
      storeId: string;
      name: string;
      distance: number;
      inStock: boolean;
      quantity?: number;
    }>;
  }> {
    try {
      logger.info("Checking store availability", "BRIGHTDATA", { 
        productId, 
        zipCode 
      });

      const scrapeOptions = {
        url: `https://www.walmart.com/ip/${productId}`,
        platform: "walmart",
        checkAvailability: true,
        zipCode
      };

      const result = await this.executeWithRetry(async () => {
        return await this.brightDataClient.scrape(scrapeOptions);
      });

      return this.transformAvailabilityData(result);
    } catch (error) {
      logger.error("Failed to check availability", "BRIGHTDATA", { error });
      throw error;
    }
  }

  /**
   * Scrape category listings
   */
  async scrapeCategoryProducts(categoryPath: string, limit: number = 50): Promise<WalmartProduct[]> {
    try {
      logger.info("Scraping category products", "BRIGHTDATA", { 
        category: categoryPath,
        limit 
      });

      const scrapeOptions = {
        url: `https://www.walmart.com/browse/${categoryPath}`,
        platform: "walmart",
        maxProducts: limit,
        extractDetails: false
      };

      const results = await this.executeWithRetry(async () => {
        return await this.brightDataClient.scrape(scrapeOptions);
      });

      return this.transformSearchResults(results);
    } catch (error) {
      logger.error("Failed to scrape category", "BRIGHTDATA", { error });
      throw error;
    }
  }

  /**
   * Get product reviews
   */
  async getProductReviews(productId: string, limit: number = 10): Promise<Array<{
    rating: number;
    title: string;
    comment: string;
    author: string;
    date: string;
    verified: boolean;
  }>> {
    try {
      logger.info("Fetching product reviews", "BRIGHTDATA", { productId });

      const scrapeOptions = {
        url: `https://www.walmart.com/reviews/product/${productId}`,
        platform: "walmart",
        extractReviews: true,
        maxReviews: limit
      };

      const result = await this.executeWithRetry(async () => {
        return await this.brightDataClient.scrape(scrapeOptions);
      });

      return this.transformReviews(result);
    } catch (error) {
      logger.error("Failed to get reviews", "BRIGHTDATA", { error });
      return [];
    }
  }

  /**
   * Helper: Execute with retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Scrape attempt ${attempt} failed`, "BRIGHTDATA", { error });
        
        if (attempt < this.config.retries!) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Helper: Build search filters
   */
  private buildSearchFilters(filters?: SearchFilters): Record<string, any> {
    if (!filters) return {};

    const brightDataFilters: Record<string, any> = {};

    if (filters.category) {
      brightDataFilters.category = filters.category;
    }

    if (filters.priceRange) {
      brightDataFilters.minPrice = filters.priceRange.min;
      brightDataFilters.maxPrice = filters.priceRange.max;
    }

    if (filters.inStock !== undefined) {
      brightDataFilters.availability = filters.inStock ? "in_stock" : "all";
    }

    if (filters.brand) {
      brightDataFilters.brand = filters.brand;
    }

    if (filters.rating) {
      brightDataFilters.minRating = filters.rating;
    }

    return brightDataFilters;
  }

  /**
   * Helper: Transform search results to WalmartProduct format
   */
  private transformSearchResults(results: any[]): WalmartProduct[] {
    return results.map(item => this.transformToWalmartProduct(item));
  }

  /**
   * Helper: Transform product details
   */
  private transformProductDetails(data: any): WalmartProduct {
    return this.transformToWalmartProduct(data, true);
  }

  /**
   * Helper: Transform scraped data to WalmartProduct
   */
  private transformToWalmartProduct(data: any, detailed: boolean = false): WalmartProduct {
    return {
      id: data.id || data.productId || "",
      walmartId: data.id || data.productId || "",
      upc: data.upc,
      ean: data.ean,
      gtin: data.gtin,
      name: data.name || data.title || "",
      brand: data.brand || "",
      category: {
        id: 'unknown',
        name: data.category || data.categoryPath || "Uncategorized",
        path: data.categoryPath ? data.categoryPath.split('/') : ["Uncategorized"],
        level: 1
      },
      subcategory: data.subcategory,
      description: detailed ? data.description || "" : "",
      shortDescription: data.shortDescription,
      price: {
        currency: 'USD',
        regular: data.price || data.currentPrice || 0,
        sale: data.salePrice,
        unit: data.unitPrice,
        unitOfMeasure: data.unitMeasure || "each",
        pricePerUnit: data.pricePerUnit,
        wasPrice: data.wasPrice,
        rollback: data.rollback || false,
        clearance: data.clearance || false
      },
      images: [{
        id: '1',
        url: data.largeImageUrl || data.imageUrl || "",
        type: 'primary' as const,
        alt: data.name || data.title
      }],
      nutritionFacts: detailed ? data.nutritionalInfo : undefined,
      ingredients: detailed ? data.ingredients : undefined,
      allergens: detailed ? (data.allergens || []).map((allergen: string) => ({
        type: allergen.toLowerCase() as any,
        contains: true,
        mayContain: false
      })) : undefined,
      specifications: detailed ? data.specifications : undefined,
      availability: {
        inStock: data.inStock !== false,
        stockLevel: data.inStock ? 'in_stock' as const : 'out_of_stock' as const,
        quantity: data.stockLevel,
        locations: data.aisleLocation ? [{
          storeId: 'unknown',
          storeName: 'Walmart',
          inStock: data.inStock !== false,
          aisle: data.aisleLocation
        }] : undefined
      },
      ratings: (data.rating || data.averageRating) ? {
        average: data.rating || data.averageRating,
        count: data.reviewCount || 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      } : undefined,
      variants: [],
      bundleComponents: [],
      metadata: {
        source: 'scrape' as const,
        lastScraped: new Date().toISOString(),
        confidence: 0.8,
        dealEligible: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Helper: Get just the price for a product
   */
  private async getProductPrice(productId: string): Promise<number | null> {
    try {
      const details = await this.getProductDetails(productId);
      if (!details?.price) return null;
      
      // Handle both number and ProductPrice object
      if (typeof details.price === 'number') {
        return details.price;
      } else if (details.price && typeof details.price === 'object' && 'regular' in details.price) {
        return details.price.regular;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Transform availability data
   */
  private transformAvailabilityData(data: any): {
    online: boolean;
    stores: Array<{
      storeId: string;
      name: string;
      distance: number;
      inStock: boolean;
      quantity?: number;
    }>;
  } {
    return {
      online: data.onlineAvailable || false,
      stores: (data.stores || []).map((store: any) => ({
        storeId: store.id,
        name: store.name,
        distance: store.distance,
        inStock: store.inStock,
        quantity: store.quantity
      }))
    };
  }

  /**
   * Helper: Transform review data
   */
  private transformReviews(data: any): Array<{
    rating: number;
    title: string;
    comment: string;
    author: string;
    date: string;
    verified: boolean;
  }> {
    return (data.reviews || []).map((review: any) => ({
      rating: review.rating,
      title: review.title || "",
      comment: review.comment || review.text || "",
      author: review.author || "Anonymous",
      date: review.date || new Date().toISOString(),
      verified: review.verifiedPurchase || false
    }));
  }

  /**
   * Mock implementation for development
   */
  private async mockScrape(options: any): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (options.searchKeyword) {
      // Mock search results
      return Array.from({ length: 5 }, (_, i) => ({
        id: `mock-${i + 1}`,
        name: `${options.searchKeyword} Product ${i + 1}`,
        price: Math.floor(Math.random() * 100) + 10,
        regularPrice: Math.floor(Math.random() * 120) + 20,
        brand: ["Great Value", "Marketside", "Equate"][i % 3],
        category: "Grocery",
        inStock: Math.random() > 0.2,
        rating: 3.5 + Math.random() * 1.5,
        reviewCount: Math.floor(Math.random() * 1000),
        imageUrl: `https://via.placeholder.com/150?text=Product${i + 1}`
      }));
    } else if (options.extractDetails) {
      // Mock product details
      return {
        id: options.url.split("/").pop(),
        name: "Mock Product Details",
        price: 24.99,
        regularPrice: 29.99,
        brand: "Great Value",
        category: "Grocery/Pantry/Snacks",
        description: "This is a mock product description for testing purposes.",
        inStock: true,
        rating: 4.2,
        reviewCount: 156,
        specifications: {
          weight: "16 oz",
          dimensions: "6 x 4 x 2 inches",
          manufacturer: "Walmart Inc."
        }
      };
    }

    return null;
  }
}