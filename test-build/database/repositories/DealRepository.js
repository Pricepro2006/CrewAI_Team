/**
 * Deal Repository - Handles all deal-related database operations
 * Implements the real business logic for deal data management
 */
import { BaseRepository } from "./BaseRepository.js";
import { logger } from "../../utils/logger.js";
export class DealRepository extends BaseRepository {
    constructor(db) {
        super(db, "deals");
    }
    /**
     * Create a new deal with validation
     */
    async createDeal(dealData) {
        // Validate deal ID format (8 digits)
        if (!/^\d{8}$/.test(dealData.deal_id)) {
            throw new Error("Deal ID must be exactly 8 digits");
        }
        // Check for existing deal ID
        const existingDeal = await this.findByDealId(dealData.deal_id);
        if (existingDeal) {
            throw new Error(`Deal with ID ${dealData.deal_id} already exists`);
        }
        // Validate end date
        const endDate = new Date(dealData.end_date);
        if (isNaN(endDate.getTime())) {
            throw new Error("Invalid end date format");
        }
        const dealToCreate = {
            ...dealData,
            status: dealData.status || "active",
            version: dealData.version || 1,
            currency: dealData.currency || "USD",
        };
        return this.create(dealToCreate);
    }
    /**
     * Find deal by deal ID (8-digit ID)
     */
    async findByDealId(dealId) {
        return this.findOne({ deal_id: dealId });
    }
    /**
     * Find deals by customer
     */
    async findByCustomer(customerName) {
        return this.findAll({
            where: { customer_name: customerName },
            orderBy: "end_date",
            orderDirection: "DESC",
        });
    }
    /**
     * Find active deals
     */
    async findActiveDeals() {
        return this.findAll({
            where: { status: "active" },
            orderBy: "end_date",
            orderDirection: "ASC",
        });
    }
    /**
     * Find expired deals
     */
    async findExpiredDeals() {
        const today = new Date().toISOString().split("T")[0];
        const query = `
      SELECT * FROM ${this.tableName}
      WHERE end_date < ? OR status = 'expired'
      ORDER BY end_date DESC
    `;
        return this.executeQuery(query, [today]);
    }
    /**
     * Find deals expiring soon
     */
    async findDealsExpiringSoon(days = 30) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        const futureDateStr = futureDate.toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];
        const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'active' 
        AND end_date BETWEEN ? AND ?
      ORDER BY end_date ASC
    `;
        return this.executeQuery(query, [today, futureDateStr]);
    }
    /**
     * Find deals by sales representative
     */
    async findBySalesRep(salesRep) {
        return this.findAll({
            where: { sales_rep: salesRep },
            orderBy: "end_date",
            orderDirection: "DESC",
        });
    }
    /**
     * Update deal status and handle business logic
     */
    async updateDealStatus(dealId, status) {
        const deal = await this.findById(dealId);
        if (!deal) {
            throw new Error(`Deal not found: ${dealId}`);
        }
        // Business logic for status changes
        const updateData = { status };
        // If marking as expired, record the current date
        if (status === "expired" && deal.status !== "expired") {
            logger.info(`Deal ${deal.deal_id} marked as expired`, "DEAL_REPO");
        }
        return this.update(dealId, updateData);
    }
    /**
     * Get comprehensive deal information with items
     */
    async getDealWithItems(dealId) {
        const deal = await this.findByDealId(dealId);
        if (!deal) {
            return null;
        }
        // Get deal items
        const itemRepo = new DealItemRepository(this.db);
        const items = await itemRepo.findByDealId(dealId);
        // Calculate metadata
        const now = new Date();
        const endDate = new Date(deal.end_date);
        const daysUntilExpiration = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = endDate < now || deal.status === "expired";
        // Calculate total value and family distribution
        let totalValue = 0;
        const itemsByFamily = {};
        for (const item of items) {
            // Calculate final price if not set
            let itemPrice = item.final_price;
            if (!itemPrice && item.product_family) {
                itemPrice = this.calculateItemPrice(item.dealer_net_price, item.product_family);
            }
            else {
                itemPrice = item.dealer_net_price;
            }
            totalValue += itemPrice * item.remaining_quantity;
            // Count by family
            const family = item.product_family || "Unknown";
            itemsByFamily[family] = (itemsByFamily[family] || 0) + 1;
        }
        return {
            deal,
            items,
            metadata: {
                totalItems: items?.length || 0,
                totalValue: Math.round(totalValue * 100) / 100,
                daysUntilExpiration,
                isExpired,
                itemsByFamily,
            },
        };
    }
    /**
     * Calculate item price based on product family rules
     */
    calculateItemPrice(dealerNetPrice, productFamily) {
        // IPG products: 4% markup
        // PSG products: no markup
        switch (productFamily.toUpperCase()) {
            case "IPG":
                return Math.round(dealerNetPrice * 1.04 * 100) / 100;
            case "PSG":
                return dealerNetPrice;
            default:
                return dealerNetPrice;
        }
    }
    /**
     * Get deal statistics
     */
    async getDealStatistics() {
        const total = await this.count();
        const active = await this.count({ status: "active" });
        const expired = await this.count({ status: "expired" });
        const pending = await this.count({ status: "pending" });
        const cancelled = await this.count({ status: "cancelled" });
        // Total value of active deals
        const valueQuery = `
      SELECT SUM(total_value) as total_value
      FROM ${this.tableName}
      WHERE status = 'active' AND total_value IS NOT NULL
    `;
        const valueResult = this.executeQuery(valueQuery, [], "get");
        const totalValue = valueResult?.total_value || 0;
        // Expiring soon (next 30 days)
        const expiringSoonDeals = await this.findDealsExpiringSoon(30);
        const expiringSoon = expiringSoonDeals?.length || 0;
        // By region
        const regionQuery = `
      SELECT region, COUNT(*) as count
      FROM ${this.tableName}
      WHERE region IS NOT NULL AND status = 'active'
      GROUP BY region
    `;
        const regionResults = this.executeQuery(regionQuery);
        const byRegion = {};
        regionResults.forEach((r) => (byRegion[r.region] = r.count));
        // By sales rep
        const salesRepQuery = `
      SELECT sales_rep, COUNT(*) as count
      FROM ${this.tableName}
      WHERE sales_rep IS NOT NULL AND status = 'active'
      GROUP BY sales_rep
    `;
        const salesRepResults = this.executeQuery(salesRepQuery);
        const bySalesRep = {};
        salesRepResults.forEach((r) => (bySalesRep[r.sales_rep] = r.count));
        return {
            total,
            active,
            expired,
            pending,
            cancelled,
            totalValue,
            expiringSoon,
            byRegion,
            bySalesRep,
        };
    }
    /**
     * Search deals by customer name, deal ID, or sales rep
     */
    async searchDeals(searchTerm, options = {}) {
        return this.search(searchTerm, ["customer_name", "deal_id", "sales_rep", "deal_name"], options);
    }
}
/**
 * Deal Item Repository
 */
export class DealItemRepository extends BaseRepository {
    constructor(db) {
        super(db, "deal_items");
    }
    /**
     * Create deal item with validation
     */
    async createDealItem(itemData) {
        // Validate quantities
        if (itemData.original_quantity < 0 || itemData.remaining_quantity < 0) {
            throw new Error("Quantities cannot be negative");
        }
        if (itemData.remaining_quantity > itemData.original_quantity) {
            throw new Error("Remaining quantity cannot exceed original quantity");
        }
        // Calculate final price based on product family
        let finalPrice = itemData.dealer_net_price;
        if (itemData.product_family) {
            finalPrice = this.calculatePrice(itemData.dealer_net_price, itemData.product_family);
        }
        const itemToCreate = {
            ...itemData,
            reserved_quantity: 0,
            final_price: finalPrice,
        };
        return this.create(itemToCreate);
    }
    /**
     * Find items by deal ID
     */
    async findByDealId(dealId) {
        return this.findAll({
            where: { deal_id: dealId },
            orderBy: "product_number",
            orderDirection: "ASC",
        });
    }
    /**
     * Find item by deal ID and product number
     */
    async findByDealAndProduct(dealId, productNumber) {
        return this.findOne({
            deal_id: dealId,
            product_number: productNumber,
        });
    }
    /**
     * Find items by product family
     */
    async findByProductFamily(productFamily) {
        return this.findAll({ where: { product_family: productFamily } });
    }
    /**
     * Update remaining quantity
     */
    async updateRemainingQuantity(itemId, newQuantity) {
        if (newQuantity < 0) {
            throw new Error("Remaining quantity cannot be negative");
        }
        const item = await this.findById(itemId);
        if (!item) {
            throw new Error(`Deal item not found: ${itemId}`);
        }
        if (newQuantity > item.original_quantity) {
            throw new Error("Remaining quantity cannot exceed original quantity");
        }
        return this.update(itemId, { remaining_quantity: newQuantity });
    }
    /**
     * Reserve quantity for an item
     */
    async reserveQuantity(itemId, quantity) {
        const item = await this.findById(itemId);
        if (!item) {
            throw new Error(`Deal item not found: ${itemId}`);
        }
        const newReservedQuantity = item.reserved_quantity + quantity;
        if (newReservedQuantity > item.remaining_quantity) {
            throw new Error("Cannot reserve more than remaining quantity");
        }
        return this.update(itemId, { reserved_quantity: newReservedQuantity });
    }
    /**
     * Calculate pricing based on product family
     */
    calculatePrice(dealerNetPrice, productFamily) {
        switch (productFamily.toUpperCase()) {
            case "IPG":
                return Math.round(dealerNetPrice * 1.04 * 100) / 100;
            case "PSG":
                return dealerNetPrice;
            default:
                return dealerNetPrice;
        }
    }
    /**
     * Get item statistics
     */
    async getItemStatistics() {
        const totalItems = await this.count();
        // Quantity statistics
        const quantityQuery = `
      SELECT 
        SUM(original_quantity) as total_original,
        SUM(remaining_quantity) as total_remaining,
        SUM(reserved_quantity) as total_reserved
      FROM ${this.tableName}
    `;
        const quantityResult = this.executeQuery(quantityQuery, [], "get");
        const totalOriginalQuantity = quantityResult?.total_original || 0;
        const totalRemainingQuantity = quantityResult?.total_remaining || 0;
        const totalReservedQuantity = quantityResult?.total_reserved || 0;
        // By product family
        const familyQuery = `
      SELECT 
        product_family,
        COUNT(*) as count,
        SUM(remaining_quantity) as total_quantity,
        SUM(remaining_quantity * final_price) as total_value
      FROM ${this.tableName}
      WHERE product_family IS NOT NULL
      GROUP BY product_family
    `;
        const familyResults = this.executeQuery(familyQuery);
        const byProductFamily = {};
        familyResults.forEach((r) => {
            byProductFamily[r.product_family] = {
                count: r.count,
                totalQuantity: r.total_quantity,
                totalValue: r.total_value || 0,
            };
        });
        return {
            totalItems,
            totalOriginalQuantity,
            totalRemainingQuantity,
            totalReservedQuantity,
            byProductFamily,
        };
    }
    /**
     * Search items by product number or description
     */
    async searchItems(searchTerm, options = {}) {
        return this.search(searchTerm, ["product_number", "product_name", "description"], options);
    }
}
/**
 * Product Family Repository
 */
export class ProductFamilyRepository extends BaseRepository {
    constructor(db) {
        super(db, "product_families");
    }
    /**
     * Find product family by code
     */
    async findByCode(familyCode) {
        return this.findOne({ family_code: familyCode });
    }
    /**
     * Find active product families
     */
    async findActiveFamily() {
        return this.findAll({ where: { is_active: true } });
    }
    /**
     * Create product family with validation
     */
    async createProductFamily(familyData) {
        // Check for existing code
        const existingFamily = await this.findByCode(familyData.family_code);
        if (existingFamily) {
            throw new Error(`Product family with code ${familyData.family_code} already exists`);
        }
        const familyToCreate = {
            ...familyData,
            pricing_multiplier: familyData.pricing_multiplier || 1.0,
            pricing_rules: familyData.pricing_rules
                ? JSON.stringify(familyData.pricing_rules)
                : undefined,
            is_active: true,
        };
        return this.create(familyToCreate);
    }
    /**
     * Update pricing multiplier
     */
    async updatePricingMultiplier(familyId, multiplier) {
        if (multiplier <= 0) {
            throw new Error("Pricing multiplier must be positive");
        }
        return this.update(familyId, { pricing_multiplier: multiplier });
    }
}
