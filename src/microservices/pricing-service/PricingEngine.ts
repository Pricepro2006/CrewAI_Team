/**
 * Pricing Engine for Walmart Grocery Agent
 * Handles price calculations, promotions, and bulk pricing
 */

import { logger } from "../../utils/logger.js";
import Database from "better-sqlite3";
import path from "path";

interface PriceRequest {
  productId: string;
  quantity: number;
  customerId?: string;
}

interface PriceResult {
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  totalPrice: number;
  discount?: number;
  finalPrice: number;
  currency: string;
}

interface Promotion {
  id: string;
  name: string;
  type: "percentage" | "fixed" | "bogo";
  value: number;
  productIds: string[];
  startDate: string;
  endDate: string;
}

export class PricingEngine {
  private db: Database.Database | null = null;
  private promotions: Map<string, Promotion> = new Map();

  constructor() {
    this.initializeDatabase();
    this.loadPromotions();
  }

  private initializeDatabase() {
    try {
      const dbPath = path.join(process.cwd(), "data", "walmart_grocery.db");
      this.db = new Database(dbPath);
      logger.info(`Connected to Walmart database at ${dbPath}`, "PRICING_ENGINE");
    } catch (error) {
      logger.error(`Database connection error: ${error}`, "PRICING_ENGINE");
    }
  }

  private loadPromotions() {
    // Mock promotions for testing
    this.promotions.set("MILK_PROMO", {
      id: "MILK_PROMO",
      name: "Milk Sale - 10% Off",
      type: "percentage",
      value: 10,
      productIds: ["prod_001", "prod_002", "prod_003", "prod_004", "prod_005"],
      startDate: "2025-08-01",
      endDate: "2025-08-31"
    });

    this.promotions.set("BULK_DISCOUNT", {
      id: "BULK_DISCOUNT",
      name: "Buy 3+ Get 5% Off",
      type: "percentage",
      value: 5,
      productIds: ["*"], // All products
      startDate: "2025-08-01",
      endDate: "2025-12-31"
    });

    logger.info(`Loaded ${this.promotions.size} promotions`, "PRICING_ENGINE");
  }

  /**
   * Calculate price for a single product
   */
  async calculatePrice(request: PriceRequest): Promise<PriceResult> {
    const { productId, quantity, customerId } = request;

    // Get product from database
    const product = this.getProduct(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const basePrice = product.current_price || 0;
    const totalPrice = basePrice * quantity;

    // Check for promotions
    let discount = 0;
    let finalPrice = totalPrice;

    // Apply milk promotion if applicable
    const milkPromo = this.promotions.get("MILK_PROMO");
    if (milkPromo && milkPromo.productIds.includes(productId)) {
      discount = totalPrice * (milkPromo.value / 100);
    }

    // Apply bulk discount if quantity >= 3
    if (quantity >= 3) {
      const bulkPromo = this.promotions.get("BULK_DISCOUNT");
      if (bulkPromo) {
        const bulkDiscount = totalPrice * (bulkPromo.value / 100);
        discount = Math.max(discount, bulkDiscount); // Use better discount
      }
    }

    finalPrice = totalPrice - discount;

    return {
      productId,
      productName: product.name,
      basePrice,
      quantity,
      totalPrice,
      discount: discount > 0 ? discount : undefined,
      finalPrice,
      currency: "USD"
    };
  }

  /**
   * Calculate prices for multiple items
   */
  async calculateBulkPricing(items: PriceRequest[]): Promise<PriceResult[]> {
    const results: PriceResult[] = [];

    for (const item of items) {
      try {
        const result = await this.calculatePrice(item);
        results.push(result);
      } catch (error) {
        logger.error(`Error calculating price for ${item.productId}: ${error}`, "PRICING_ENGINE");
        // Add error result
        results.push({
          productId: item.productId,
          productName: "Unknown",
          basePrice: 0,
          quantity: item.quantity,
          totalPrice: 0,
          finalPrice: 0,
          currency: "USD"
        });
      }
    }

    return results;
  }

  /**
   * Get active promotions
   */
  async getActivePromotions(): Promise<Promotion[]> {
    const now = new Date().toISOString().split('T')[0];
    const active: Promotion[] = [];

    for (const [_, promo] of this.promotions) {
      if (promo.startDate <= now && promo.endDate >= now) {
        active.push(promo);
      }
    }

    return active;
  }

  /**
   * Get product from database
   */
  private getProduct(productId: string): any {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, name, current_price, unit, in_stock
        FROM walmart_products
        WHERE id = ?
      `);
      
      return stmt.get(productId);
    } catch (error) {
      logger.error(`Error fetching product ${productId}: ${error}`, "PRICING_ENGINE");
      
      // Return mock data as fallback
      const mockProducts: Record<string, any> = {
        "prod_001": { id: "prod_001", name: "Great Value Whole Milk", current_price: 3.98, unit: "gallon", in_stock: true },
        "prod_002": { id: "prod_002", name: "Fairlife 2% Milk", current_price: 4.98, unit: "52 oz", in_stock: true },
        "prod_003": { id: "prod_003", name: "Horizon Organic Whole Milk", current_price: 5.98, unit: "gallon", in_stock: true },
        "prod_004": { id: "prod_004", name: "Lactaid Whole Milk", current_price: 5.48, unit: "96 oz", in_stock: true },
        "prod_005": { id: "prod_005", name: "Great Value 2% Milk", current_price: 3.78, unit: "gallon", in_stock: true }
      };

      return mockProducts[productId] || null;
    }
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(productId: string, days: number = 30): Promise<any[]> {
    if (!this.db) {
      // Return mock history
      const mockHistory = [];
      const basePrice = 3.98;
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        mockHistory.push({
          date: date.toISOString().split('T')[0],
          price: basePrice + (Math.random() * 0.5 - 0.25) // ±$0.25 variation
        });
      }
      return mockHistory;
    }

    try {
      const stmt = this.db.prepare(`
        SELECT date, price
        FROM price_history
        WHERE product_id = ?
        AND date >= date('now', '-' || ? || ' days')
        ORDER BY date DESC
      `);
      
      return stmt.all(productId, days);
    } catch (error) {
      logger.error(`Error fetching price history: ${error}`, "PRICING_ENGINE");
      return [];
    }
  }
}