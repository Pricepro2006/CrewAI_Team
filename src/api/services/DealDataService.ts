/**
 * Deal Data Service
 * Handles deal data operations with real database queries and integrations
 */

import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import { wsService } from "./WebSocketService.js";
import appConfig from "../../config/app.config.js";

export interface Deal {
  id: string;
  dealId: string; // 8-digit deal ID
  customer: string;
  endDate: string;
  version: number;
  status: "active" | "expired" | "pending";
  totalValue?: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealItem {
  id: string;
  dealId: string;
  productNumber: string; // SKU
  productFamily: string;
  remainingQuantity: number;
  dealerNetPrice: number;
  listPrice?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealResponse {
  deal: Deal;
  items: DealItem[];
  metadata: {
    totalItems: number;
    totalValue: number;
    daysUntilExpiration: number;
    isExpired: boolean;
  };
}

export class DealDataService {
  private db: Database.Database;
  private static instance: DealDataService;

  constructor(dbPath?: string) {
    const databasePath = dbPath || appConfig.database.path;
    this.db = new Database(databasePath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    logger.info("Initializing deal data database", "DEAL_DATA");

    // Enable performance optimizations
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 10000");
    this.db.pragma("temp_store = MEMORY");
    this.db.pragma("foreign_keys = ON");

    // Create deals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        deal_id TEXT UNIQUE NOT NULL,
        customer TEXT NOT NULL,
        end_date TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending')),
        total_value REAL,
        currency TEXT DEFAULT 'USD',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create deal items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deal_items (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL,
        product_number TEXT NOT NULL,
        product_family TEXT,
        remaining_quantity INTEGER DEFAULT 0,
        dealer_net_price REAL NOT NULL,
        list_price REAL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deal_id) REFERENCES deals(deal_id) ON DELETE CASCADE
      );
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_deals_deal_id ON deals(deal_id);
      CREATE INDEX IF NOT EXISTS idx_deals_customer ON deals(customer);
      CREATE INDEX IF NOT EXISTS idx_deals_end_date ON deals(end_date);
      CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
      CREATE INDEX IF NOT EXISTS idx_deal_items_deal_id ON deal_items(deal_id);
      CREATE INDEX IF NOT EXISTS idx_deal_items_product_number ON deal_items(product_number);
      CREATE INDEX IF NOT EXISTS idx_deal_items_product_family ON deal_items(product_family);
    `);

    // Seed sample deal data if empty
    this.seedSampleData();

    logger.info("Deal data database initialized successfully", "DEAL_DATA");
  }

  private seedSampleData(): void {
    const countStmt = this.db.prepare("SELECT COUNT(*) as count FROM deals");
    const count = (countStmt.get() as any).count;

    if (count === 0) {
      logger.info("Seeding sample deal data", "DEAL_DATA");

      const sampleDeals = [
        {
          dealId: "45791720",
          customer: "ACME CORPORATION",
          endDate: "2025-12-31",
          totalValue: 125000.0,
        },
        {
          dealId: "44892156",
          customer: "TECH SOLUTIONS INC",
          endDate: "2025-08-15",
          totalValue: 89500.0,
        },
        {
          dealId: "46123789",
          customer: "GLOBAL SYSTEMS LLC",
          endDate: "2025-06-30",
          totalValue: 256800.0,
        },
      ];

      const sampleItems = [
        // Deal 45791720 items
        {
          dealId: "45791720",
          productNumber: "7ED25UT",
          productFamily: "IPG",
          remainingQuantity: 150,
          dealerNetPrice: 125.99,
          listPrice: 149.99,
          description: "Enterprise Storage Unit",
        },
        {
          dealId: "45791720",
          productNumber: "9VD15AA",
          productFamily: "PSG",
          remainingQuantity: 75,
          dealerNetPrice: 89.5,
          listPrice: 109.99,
          description: "Network Switch",
        },
        {
          dealId: "45791720",
          productNumber: "4XDJ3UT#ABA",
          productFamily: "IPG",
          remainingQuantity: 200,
          dealerNetPrice: 45.75,
          listPrice: 59.99,
          description: "Memory Module",
        },

        // Deal 44892156 items
        {
          dealId: "44892156",
          productNumber: "2XHJ8UT",
          productFamily: "PSG",
          remainingQuantity: 100,
          dealerNetPrice: 299.99,
          listPrice: 349.99,
          description: "Server Blade",
        },
        {
          dealId: "44892156",
          productNumber: "5TW10AA",
          productFamily: "IPG",
          remainingQuantity: 50,
          dealerNetPrice: 189.0,
          listPrice: 229.99,
          description: "Graphics Card",
        },

        // Deal 46123789 items
        {
          dealId: "46123789",
          productNumber: "8QR45CV",
          productFamily: "IPG",
          remainingQuantity: 300,
          dealerNetPrice: 67.25,
          listPrice: 89.99,
          description: "Storage Drive",
        },
        {
          dealId: "46123789",
          productNumber: "1ZX23MN",
          productFamily: "PSG",
          remainingQuantity: 25,
          dealerNetPrice: 1250.0,
          listPrice: 1499.99,
          description: "Enterprise Router",
        },
      ];

      // Insert deals
      const insertDeal = this.db.prepare(`
        INSERT INTO deals (id, deal_id, customer, end_date, total_value)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const deal of sampleDeals) {
        insertDeal.run(
          uuidv4(),
          deal.dealId,
          deal.customer,
          deal.endDate,
          deal.totalValue,
        );
      }

      // Insert deal items
      const insertItem = this.db.prepare(`
        INSERT INTO deal_items (id, deal_id, product_number, product_family, remaining_quantity, dealer_net_price, list_price, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of sampleItems) {
        insertItem.run(
          uuidv4(),
          item.dealId,
          item.productNumber,
          item.productFamily,
          item.remainingQuantity,
          item.dealerNetPrice,
          item.listPrice,
          item.description,
        );
      }

      logger.info("Sample deal data seeded successfully", "DEAL_DATA");
    }
  }

  /**
   * Get a deal by deal ID with all items
   */
  async getDeal(dealId: string): Promise<DealResponse | null> {
    try {
      // Get deal information
      const dealStmt = this.db.prepare(`
        SELECT * FROM deals WHERE deal_id = ?
      `);
      const dealResult = dealStmt.get(dealId) as any;

      if (!dealResult) {
        return null;
      }

      // Get deal items
      const itemsStmt = this.db.prepare(`
        SELECT * FROM deal_items WHERE deal_id = ?
        ORDER BY product_number
      `);
      const itemsResults = itemsStmt.all(dealId) as any[];

      // Calculate metadata
      const now = new Date();
      const endDate = new Date(dealResult.end_date);
      const daysUntilExpiration = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isExpired = endDate < now;

      const deal: Deal = {
        id: dealResult.id,
        dealId: dealResult.deal_id,
        customer: dealResult.customer,
        endDate: dealResult.end_date,
        version: dealResult.version,
        status: isExpired ? "expired" : dealResult.status,
        totalValue: dealResult.total_value,
        currency: dealResult.currency,
        createdAt: dealResult.created_at,
        updatedAt: dealResult.updated_at,
      };

      const items: DealItem[] = itemsResults.map((item) => ({
        id: item.id,
        dealId: item.deal_id,
        productNumber: item.product_number,
        productFamily: item.product_family,
        remainingQuantity: item.remaining_quantity,
        dealerNetPrice: item.dealer_net_price,
        listPrice: item.list_price,
        description: item.description,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      const totalValue = items.reduce(
        (sum, item) => sum + item.dealerNetPrice * item.remainingQuantity,
        0,
      );

      return {
        deal,
        items,
        metadata: {
          totalItems: items.length,
          totalValue,
          daysUntilExpiration,
          isExpired,
        },
      };
    } catch (error) {
      logger.error(`Failed to get deal ${dealId}: ${error}`, "DEAL_DATA");
      throw error;
    }
  }

  /**
   * Get deal item by product number and deal ID
   */
  async getDealItem(
    dealId: string,
    productNumber: string,
  ): Promise<DealItem | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM deal_items 
        WHERE deal_id = ? AND product_number = ?
      `);
      const result = stmt.get(dealId, productNumber) as any;

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        dealId: result.deal_id,
        productNumber: result.product_number,
        productFamily: result.product_family,
        remainingQuantity: result.remaining_quantity,
        dealerNetPrice: result.dealer_net_price,
        listPrice: result.list_price,
        description: result.description,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      logger.error(
        `Failed to get deal item ${productNumber} from deal ${dealId}: ${error}`,
        "DEAL_DATA",
      );
      throw error;
    }
  }

  /**
   * Calculate pricing with IPG/PSG logic
   */
  calculatePrice(dealerNetPrice: number, productFamily: string): number {
    try {
      if (productFamily === "IPG") {
        return Math.round(dealerNetPrice * 1.04 * 100) / 100; // IPG: Dealer net � 1.04
      } else {
        return dealerNetPrice; // PSG: Dealer net unchanged
      }
    } catch (error) {
      logger.error(`Failed to calculate price: ${error}`, "DEAL_DATA");
      return dealerNetPrice;
    }
  }

  /**
   * Analyze deals for specific products
   */
  async analyzeDealForProducts(
    productIds: string[],
    customerId?: string,
  ): Promise<any> {
    try {
      const deals: any[] = [];
      let totalSavings = 0;

      // Find deals containing these products
      const placeholders = productIds.map(() => "?").join(",");
      let query = `
        SELECT DISTINCT d.*, di.* 
        FROM deals d
        JOIN deal_items di ON d.deal_id = di.deal_id
        WHERE di.product_number IN (${placeholders})
        AND d.status = 'active'
        AND date(d.end_date) >= date('now')
      `;

      const params = [...productIds];

      if (customerId) {
        query += " AND d.customer = ?";
        params.push(customerId);
      }

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as any[];

      // Group by deal
      const dealMap = new Map<string, any>();

      results.forEach((row) => {
        if (!dealMap.has(row.deal_id)) {
          dealMap.set(row.deal_id, {
            dealId: row.deal_id,
            customer: row.customer,
            endDate: row.end_date,
            items: [],
            totalValue: 0,
          });
        }

        const deal = dealMap.get(row.deal_id);
        const discountPrice = this.calculatePrice(
          row.dealer_net_price,
          row.product_family,
        );
        const savings = (row.list_price || 0) - discountPrice;

        deal.items.push({
          productNumber: row.product_number,
          dealerNetPrice: row.dealer_net_price,
          discountPrice,
          listPrice: row.list_price,
          savings,
          remainingQuantity: row.remaining_quantity,
        });

        deal.totalValue += discountPrice * row.remaining_quantity;
        totalSavings += savings * row.remaining_quantity;
      });

      return {
        deals: Array.from(dealMap.values()),
        totalSavings,
        productIds,
        customerId,
      };
    } catch (error) {
      logger.error("Failed to analyze deals for products", "DEAL_DATA", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get recent deals (for notifications)
   */
  async getRecentDeals(hoursAgo: number = 24): Promise<any[]> {
    try {
      // Validate input
      if (!Number.isInteger(hoursAgo) || hoursAgo < 0 || hoursAgo > 8760) {
        // Max 1 year
        throw new Error(
          "hoursAgo must be a positive integer between 0 and 8760",
        );
      }

      const stmt = this.db.prepare(`
        SELECT * FROM deals 
        WHERE datetime(created_at) >= datetime('now', ? || ' hours')
        ORDER BY created_at DESC
      `);

      const results = stmt.all(`-${hoursAgo}`) as any[];

      return results.map((deal) => ({
        id: deal.deal_id,
        customer: deal.customer,
        endDate: deal.end_date,
        status: deal.status,
        createdAt: deal.created_at,
        products: this.getDealProducts(deal.deal_id),
      }));
    } catch (error) {
      logger.error("Failed to get recent deals", "DEAL_DATA", { error });
      throw error;
    }
  }

  /**
   * Get products for a deal
   */
  private getDealProducts(dealId: string): string[] {
    try {
      const stmt = this.db.prepare(`
        SELECT product_number FROM deal_items WHERE deal_id = ?
      `);
      const results = stmt.all(dealId) as any[];
      return results.map((r) => r.product_number);
    } catch (error) {
      logger.error("Failed to get deal products", "DEAL_DATA", { error });
      return [];
    }
  }

  /**
   * Get deal details (simplified)
   */
  async getDealDetails(dealId: string): Promise<any> {
    const dealResponse = await this.getDeal(dealId);
    if (!dealResponse) return null;

    return {
      dealId: dealResponse.deal.dealId,
      customer: dealResponse.deal.customer,
      endDate: dealResponse.deal.endDate,
      totalValue: dealResponse.metadata.totalValue,
      itemCount: dealResponse.metadata.totalItems,
      daysUntilExpiration: dealResponse.metadata.daysUntilExpiration,
      products: dealResponse.items.map((item) => ({
        sku: item.productNumber,
        price: this.calculatePrice(item.dealerNetPrice, item.productFamily),
        quantity: item.remainingQuantity,
      })),
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DealDataService {
    if (!DealDataService.instance) {
      DealDataService.instance = new DealDataService();
    }
    return DealDataService.instance;
  }

  async close(): Promise<void> {
    try {
      this.db.close();
      logger.info("Deal data database connection closed", "DEAL_DATA");
    } catch (error) {
      logger.error(`Failed to close deal data database: ${error}`, "DEAL_DATA");
      throw error;
    }
  }
}
