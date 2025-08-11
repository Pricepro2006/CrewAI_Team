/**
 * BrightData MCP Integration Service
 * Wraps MCP tool calls for fetching real Walmart data
 */

import { logger } from '../utils/logger.js';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface WalmartProduct {
  id?: string;
  product_id: string;
  name: string;
  brand?: string;
  description?: string;
  category_path?: string;
  department?: string;
  current_price: number;
  regular_price?: number;
  unit_price?: number;
  unit_measure?: string;
  in_stock: boolean;
  stock_level?: number;
  upc?: string;
  sku?: string;
  manufacturer?: string;
  rating?: number;
  review_count?: number;
  image_url?: string;
  thumbnail_url?: string;
  large_image_url?: string;
}

export interface StoreAvailability {
  storeId: string;
  storeName: string;
  inStock: boolean;
  quantity?: number;
  price?: number;
}

export interface BrightDataResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

class BrightDataMCPService {
  private db: Database.Database;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor(dbPath: string = './data/walmart_grocery.db') {
    this.db = new Database(dbPath);
    logger.info('BrightDataMCPService initialized', 'BRIGHTDATA_MCP');
  }

  /**
   * Fetch a single Walmart product by URL with retry logic
   */
  async fetchWalmartProduct(url: string, retries: number = 3): Promise<WalmartProduct | null> {
    try {
      await this.enforceRateLimit();
      
      // Check cache first
      const cached = this.getFromCache(url);
      if (cached) {
        logger.info('Returning cached product', 'BRIGHTDATA_MCP', { url });
        return cached;
      }

      logger.info('Fetching Walmart product', 'BRIGHTDATA_MCP', { url });
      
      // Implement retry logic
      let lastError: any = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // In production, this would call the actual MCP tool
          // For now, we'll simulate the response structure
          const response = await this.simulateMCPCallWithRetry('web_data_walmart_product', { url }, attempt);
          
          if (response.success && response.data) {
            const product = this.mapResponseToProduct(response.data);
            this.addToCache(url, product);
            logger.info('Successfully fetched product', 'BRIGHTDATA_MCP', { url, attempt });
            return product;
          }
        } catch (error) {
          lastError = error;
          logger.warn(`Attempt ${attempt} failed`, 'BRIGHTDATA_MCP', { url, error });
          
          if (attempt < retries) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            logger.info(`Retrying in ${delay}ms...`, 'BRIGHTDATA_MCP');
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      logger.error('All retry attempts failed', 'BRIGHTDATA_MCP', { url, lastError });
      return null;
    } catch (error) {
      logger.error('Failed to fetch Walmart product', 'BRIGHTDATA_MCP', { error, url });
      return null;
    }
  }

  /**
   * Search for Walmart products by query and ZIP code with retry logic
   */
  async searchWalmartProducts(query: string, zip: string = '29301', limit: number = 10, retries: number = 3): Promise<WalmartProduct[]> {
    try {
      await this.enforceRateLimit();
      
      const cacheKey = `search:${query}:${zip}:${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.info('Returning cached search results', 'BRIGHTDATA_MCP', { query, zip });
        return cached;
      }

      logger.info('Searching Walmart products', 'BRIGHTDATA_MCP', { query, zip, limit });
      
      // Implement retry logic for search
      let lastError: any = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Simulate search using MCP
          const searchQuery = `site:walmart.com ${query} near ${zip}`;
          const response = await this.simulateMCPCallWithRetry('search_engine', { 
            query: searchQuery,
            engine: 'google',
            maxResults: limit 
          }, attempt);
          
          if (response.success && response.data) {
            const products = await this.fetchProductsFromSearchResults(response.data);
            this.addToCache(cacheKey, products);
            logger.info('Search successful', 'BRIGHTDATA_MCP', { query, attempt, found: products.length });
            return products;
          }
        } catch (error) {
          lastError = error;
          logger.warn(`Search attempt ${attempt} failed`, 'BRIGHTDATA_MCP', { query, error });
          
          if (attempt < retries) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            logger.info(`Retrying search in ${delay}ms...`, 'BRIGHTDATA_MCP');
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      logger.error('All search attempts failed', 'BRIGHTDATA_MCP', { query, zip, lastError });
      return [];
    } catch (error) {
      logger.error('Failed to search Walmart products', 'BRIGHTDATA_MCP', { error, query, zip });
      return [];
    }
  }

  /**
   * Get bulk prices for multiple products
   */
  async getBulkPrices(productIds: string[]): Promise<Map<string, number>> {
    try {
      await this.enforceRateLimit();
      
      const prices = new Map<string, number>();
      
      // Batch fetch with rate limiting
      for (const productId of productIds) {
        const url = `https://www.walmart.com/ip/${productId}`;
        const product = await this.fetchWalmartProduct(url);
        
        if (product && product.current_price) {
          prices.set(productId, product.current_price);
        }
      }
      
      logger.info('Fetched bulk prices', 'BRIGHTDATA_MCP', { 
        requested: productIds.length,
        fetched: prices.size 
      });
      
      return prices;
    } catch (error) {
      logger.error('Failed to get bulk prices', 'BRIGHTDATA_MCP', { error });
      return new Map();
    }
  }

  /**
   * Check store availability for a product
   */
  async getStoreAvailability(productId: string, storeId: string): Promise<StoreAvailability | null> {
    try {
      await this.enforceRateLimit();
      
      const cacheKey = `availability:${productId}:${storeId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      logger.info('Checking store availability', 'BRIGHTDATA_MCP', { productId, storeId });
      
      // Simulate availability check
      const availability: StoreAvailability = {
        storeId,
        storeName: this.getStoreName(storeId),
        inStock: Math.random() > 0.3, // 70% chance of being in stock
        quantity: Math.floor(Math.random() * 50),
        price: undefined // Would come from real API
      };
      
      this.addToCache(cacheKey, availability);
      return availability;
    } catch (error) {
      logger.error('Failed to check store availability', 'BRIGHTDATA_MCP', { error });
      return null;
    }
  }

  /**
   * Save product to database
   */
  async saveProductToDatabase(product: WalmartProduct): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO walmart_products (
          id, product_id, name, brand, description, category_path,
          department, current_price, regular_price, unit_price, unit_measure,
          in_stock, stock_level, upc, sku, manufacturer,
          average_rating, review_count, thumbnail_url, large_image_url,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const id = product.id || uuidv4();
      const now = new Date().toISOString();
      
      stmt.run(
        id,
        product.product_id,
        product.name,
        product.brand || null,
        product.description || null,
        product.category_path || null,
        product.department || null,
        product.current_price,
        product.regular_price || product.current_price,
        product.unit_price || null,
        product.unit_measure || null,
        product.in_stock ? 1 : 0,
        product.stock_level || 0,
        product.upc || null,
        product.sku || null,
        product.manufacturer || null,
        product.rating || null,
        product.review_count || null,
        product.thumbnail_url || product.image_url || null,
        product.large_image_url || product.image_url || null,
        now,
        now
      );

      logger.info('Product saved to database', 'BRIGHTDATA_MCP', { 
        productId: product.product_id,
        name: product.name 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to save product to database', 'BRIGHTDATA_MCP', { error });
      return false;
    }
  }

  /**
   * Batch import products
   */
  async batchImportProducts(products: WalmartProduct[]): Promise<number> {
    let imported = 0;
    
    for (const product of products) {
      if (await this.saveProductToDatabase(product)) {
        imported++;
      }
    }
    
    logger.info('Batch import completed', 'BRIGHTDATA_MCP', {
      total: products.length,
      imported
    });
    
    return imported;
  }

  // Private helper methods

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.CACHE_TTL) {
        return cached.data;
      }
      this.cache.delete(key);
    }
    
    return null;
  }

  private addToCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private async simulateMCPCall(tool: string, params: any): Promise<BrightDataResponse> {
    // In production, this would make actual MCP tool calls
    // For now, we'll return simulated responses
    
    logger.info('Simulating MCP call', 'BRIGHTDATA_MCP', { tool, params });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      data: this.getMockData(tool, params),
      timestamp: new Date().toISOString()
    };
  }
  
  private async simulateMCPCallWithRetry(tool: string, params: any, attempt: number): Promise<BrightDataResponse> {
    // Simulate occasional failures for retry testing (10% failure rate on first attempt)
    if (attempt === 1 && Math.random() < 0.1) {
      throw new Error('Simulated network error for retry testing');
    }
    
    return this.simulateMCPCall(tool, params);
  }

  private getMockData(tool: string, params: any): any {
    // Return mock data based on tool type
    if (tool === 'web_data_walmart_product') {
      return {
        product_id: 'WM_' + Math.floor(100000 + Math.random() * 900000),
        title: 'Sample Product',
        price: Math.random() * 20 + 1,
        in_stock: true,
        rating: 4.2,
        review_count: Math.floor(Math.random() * 1000)
      };
    }
    
    if (tool === 'search_engine') {
      return {
        results: Array(5).fill(null).map(() => ({
          url: `https://www.walmart.com/ip/product/${Math.random().toString(36).substr(2, 9)}`,
          title: 'Product Result',
          description: 'Product description'
        }))
      };
    }
    
    return {};
  }

  private mapResponseToProduct(data: any): WalmartProduct {
    return {
      product_id: data.product_id || `WM_${Date.now()}`,
      name: data.title || data.name || 'Unknown Product',
      brand: data.brand || 'Great Value',
      description: data.description || '',
      category_path: data.category || '',
      department: data.department || 'General',
      current_price: data.price || 0,
      regular_price: data.original_price || data.price || 0,
      unit_price: data.unit_price,
      unit_measure: data.unit || 'each',
      in_stock: data.in_stock !== false,
      stock_level: data.stock_quantity || 0,
      upc: data.upc,
      sku: data.sku,
      manufacturer: data.manufacturer || data.brand,
      rating: data.rating,
      review_count: data.review_count || 0,
      image_url: data.image_url || data.thumbnail,
      thumbnail_url: data.thumbnail,
      large_image_url: data.large_image
    };
  }

  private async fetchProductsFromSearchResults(searchData: any): Promise<WalmartProduct[]> {
    const products: WalmartProduct[] = [];
    
    if (searchData.results && Array.isArray(searchData.results)) {
      for (const result of searchData.results.slice(0, 5)) {
        if (result.url && result.url.includes('walmart.com')) {
          const product = await this.fetchWalmartProduct(result.url);
          if (product) {
            products.push(product);
          }
        }
      }
    }
    
    return products;
  }

  private getStoreName(storeId: string): string {
    const stores: Record<string, string> = {
      '1326': 'Walmart Supercenter - Spartanburg, SC',
      '5432': 'Walmart Neighborhood Market - Spartanburg, SC',
      '3669': 'Walmart - Spartanburg, SC'
    };
    
    return stores[storeId] || `Walmart Store #${storeId}`;
  }

  close(): void {
    this.db.close();
    this.cache.clear();
    logger.info('BrightDataMCPService closed', 'BRIGHTDATA_MCP');
  }
}

export default BrightDataMCPService;