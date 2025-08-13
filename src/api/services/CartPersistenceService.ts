/**
 * Cart Persistence Service
 * Handles cart storage, session management, and user cart merging
 */

import { EventEmitter } from "events";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
import type { 
  ShoppingCart, 
  CartItem, 
  WalmartProduct 
} from "../../types/walmart-grocery.js";

interface CartOperation {
  type: "add" | "update" | "remove" | "clear" | "merge";
  productId?: string;
  quantity?: number;
  metadata?: any;
}

interface CartSession {
  sessionId: string;
  userId?: string;
  cartId: string;
  expiresAt: Date;
}

export interface CartStats {
  totalItems: number;
  uniqueProducts: number;
  totalValue: number;
  averageItemValue: number;
  abandonmentRate: number;
  conversionRate: number;
}

export class CartPersistenceService extends EventEmitter {
  private db: Database.Database;
  private sessionTimeout: number = 30 * 24 * 60 * 60 * 1000; // 30 days
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(dbPath: string = "./data/walmart_grocery.db") {
    super();
    this.db = new Database(dbPath);
    this.initializeService();
  }

  private initializeService(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCarts();
    }, 60 * 60 * 1000);

    logger.info("Cart Persistence Service initialized", "CART");
  }

  /**
   * Get or create cart for session/user
   */
  async getOrCreateCart(sessionId: string, userId?: string): Promise<ShoppingCart> {
    try {
      let cart = this.getActiveCart(sessionId, userId);
      
      if (!cart) {
        cart = await this.createCart(sessionId, userId);
      } else if (userId && !cart.userId) {
        // User logged in - merge session cart to user cart
        cart = await this.mergeSessionToUserCart(sessionId, userId);
      }
      
      return cart;
    } catch (error) {
      logger.error("Error getting/creating cart", "CART", { error, sessionId, userId });
      throw error;
    }
  }

  /**
   * Get active cart for session or user
   */
  private getActiveCart(sessionId: string, userId?: string): ShoppingCart | null {
    const query = userId
      ? `SELECT * FROM shopping_carts 
         WHERE (user_id = ? OR session_id = ?) 
         AND status = 'active' 
         ORDER BY user_id DESC 
         LIMIT 1`
      : `SELECT * FROM shopping_carts 
         WHERE session_id = ? 
         AND status = 'active' 
         LIMIT 1`;
    
    const params = userId ? [userId, sessionId] : [sessionId];
    const cartRow = this.db.prepare(query).get(...params) as any;
    
    if (!cartRow) return null;
    
    return this.buildCartFromRow(cartRow);
  }

  /**
   * Create new cart
   */
  private async createCart(sessionId: string, userId?: string): Promise<ShoppingCart> {
    const cartId = `cart-${uuidv4()}`;
    const expiresAt = new Date(Date.now() + this.sessionTimeout);
    
    const stmt = this.db.prepare(`
      INSERT INTO shopping_carts (
        id, user_id, session_id, status, expires_at, metadata
      ) VALUES (?, ?, ?, 'active', ?, ?)
    `);
    
    stmt.run(
      cartId,
      userId || null,
      sessionId,
      expiresAt.toISOString(),
      JSON.stringify({ source: "web", version: "1.0" })
    );
    
    this.emit("cart:created", { cartId, sessionId, userId });
    logger.info("Cart created", "CART", { cartId, sessionId, userId });
    
    return {
      id: cartId,
      userId: userId || "guest",
      items: [],
      subtotal: 0,
      tax: 0,
      fees: {},
      discounts: [],
      total: 0,
      savedForLater: [],
      metadata: { sessionId },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Merge session cart into user cart when user logs in
   */
  private async mergeSessionToUserCart(
    sessionId: string, 
    userId: string
  ): Promise<ShoppingCart> {
    const sessionCart = this.getActiveCart(sessionId);
    const userCart = this.getActiveCart("", userId);
    
    if (!sessionCart) {
      return userCart || await this.createCart(sessionId, userId);
    }
    
    if (!userCart) {
      // Just update session cart to be user cart
      this.db.prepare(`
        UPDATE shopping_carts 
        SET user_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(userId, sessionCart.id);
      
      sessionCart.userId = userId;
      return sessionCart;
    }
    
    // Merge items from session cart to user cart
    const sessionItems = this.getCartItems(sessionCart.id);
    
    for (const item of sessionItems) {
      await this.addOrUpdateItem(userCart.id, item.productId, item.quantity, {
        mergedFrom: sessionCart.id,
        ...item.metadata
      });
    }
    
    // Mark session cart as merged
    this.db.prepare(`
      UPDATE shopping_carts 
      SET status = 'merged', merged_from = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(userCart.id, sessionCart.id);
    
    this.emit("cart:merged", { 
      fromCartId: sessionCart.id, 
      toCartId: userCart.id, 
      userId 
    });
    
    logger.info("Carts merged", "CART", { 
      sessionCartId: sessionCart.id, 
      userCartId: userCart.id 
    });
    
    return this.getActiveCart(sessionId, userId)!;
  }

  /**
   * Add or update item in cart
   */
  async addOrUpdateItem(
    cartId: string,
    productId: string,
    quantity: number,
    metadata?: any
  ): Promise<CartItem> {
    try {
      // Get product details (mock for now, should fetch from product service)
      const product = await this.getProductDetails(productId);
      
      const existingItem = this.db.prepare(`
        SELECT * FROM cart_items 
        WHERE cart_id = ? AND product_id = ?
      `).get(cartId, productId) as any;
      
      if (existingItem) {
        // Update quantity
        const newQuantity = quantity;
        
        if (newQuantity <= 0) {
          return await this.removeItem(cartId, productId);
        }
        
        this.db.prepare(`
          UPDATE cart_items 
          SET quantity = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE cart_id = ? AND product_id = ?
        `).run(
          newQuantity,
          JSON.stringify({ ...JSON.parse(existingItem.metadata || "{}"), ...metadata }),
          cartId,
          productId
        );
        
        this.emit("cart:item:updated", { cartId, productId, quantity: newQuantity });
      } else {
        // Add new item
        const itemId = `item-${uuidv4()}`;
        
        this.db.prepare(`
          INSERT INTO cart_items (
            id, cart_id, product_id, product_name, product_image,
            quantity, unit_price, sale_price, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          itemId,
          cartId,
          productId,
          product.name,
          product.imageUrl,
          quantity,
          product.originalPrice || product.price,
          product.price,
          JSON.stringify(metadata || {})
        );
        
        this.emit("cart:item:added", { cartId, productId, quantity });
      }
      
      return this.getCartItem(cartId, productId)!;
    } catch (error) {
      logger.error("Error adding/updating cart item", "CART", { 
        error, 
        cartId, 
        productId, 
        quantity 
      });
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(cartId: string, productId: string): Promise<any> {
    const item = this.getCartItem(cartId, productId);
    
    if (!item) {
      throw new Error("Item not found in cart");
    }
    
    this.db.prepare(`
      DELETE FROM cart_items 
      WHERE cart_id = ? AND product_id = ?
    `).run(cartId, productId);
    
    this.emit("cart:item:removed", { cartId, productId });
    
    return item;
  }

  /**
   * Clear all items from cart
   */
  async clearCart(cartId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM cart_items WHERE cart_id = ?
    `).run(cartId);
    
    this.db.prepare(`
      UPDATE shopping_carts 
      SET items_count = 0, subtotal = 0, total = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(cartId);
    
    this.emit("cart:cleared", { cartId });
    logger.info("Cart cleared", "CART", { cartId });
  }

  /**
   * Convert cart to order
   */
  async convertCart(cartId: string, orderId: string): Promise<void> {
    this.db.prepare(`
      UPDATE shopping_carts 
      SET status = 'converted', converted_at = CURRENT_TIMESTAMP, 
          metadata = json_set(metadata, '$.orderId', ?)
      WHERE id = ?
    `).run(orderId, cartId);
    
    this.emit("cart:converted", { cartId, orderId });
    logger.info("Cart converted to order", "CART", { cartId, orderId });
  }

  /**
   * Get cart items
   */
  private getCartItems(cartId: string): CartItem[] {
    const items = this.db.prepare(`
      SELECT * FROM cart_items 
      WHERE cart_id = ? 
      ORDER BY added_at DESC
    `).all(cartId) as any[];
    
    return items.map(item => ({
      id: item.id,
      productId: item.product_id,
      product: {
        id: item.product_id,
        name: item.product_name,
        price: item.sale_price || item.unit_price,
        originalPrice: item.unit_price,
        imageUrl: item.product_image,
      } as WalmartProduct,
      quantity: item.quantity,
      price: item.sale_price || item.unit_price,
      addedAt: item.added_at,
      updatedAt: item.updated_at,
      metadata: JSON.parse(item.metadata || "{}"),
    }));
  }

  /**
   * Get single cart item
   */
  private getCartItem(cartId: string, productId: string): CartItem | null {
    const item = this.db.prepare(`
      SELECT * FROM cart_items 
      WHERE cart_id = ? AND product_id = ?
    `).get(cartId, productId) as any;
    
    if (!item) return null;
    
    return {
      id: item.id,
      productId: item.product_id,
      product: {
        id: item.product_id,
        name: item.product_name,
        price: item.sale_price || item.unit_price,
        originalPrice: item.unit_price,
        imageUrl: item.product_image,
      } as WalmartProduct,
      quantity: item.quantity,
      price: item.sale_price || item.unit_price,
      addedAt: item.added_at,
      updatedAt: item.updated_at,
      metadata: JSON.parse(item.metadata || "{}"),
    };
  }

  /**
   * Build cart object from database row
   */
  private buildCartFromRow(row: any): ShoppingCart {
    const items = this.getCartItems(row.id);
    
    return {
      id: row.id,
      userId: row.user_id || "guest",
      items,
      subtotal: row.subtotal || 0,
      tax: row.tax || 0,
      fees: {},
      discounts: [],
      total: row.total || row.subtotal || 0,
      savedForLater: [],
      metadata: JSON.parse(row.metadata || "{}"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get product details (mock implementation)
   */
  private async getProductDetails(productId: string): Promise<WalmartProduct> {
    // Try to get from database first
    const product = this.db.prepare(`
      SELECT * FROM walmart_products WHERE product_id = ?
    `).get(productId) as any;
    
    if (product) {
      return {
        id: product.product_id,
        name: product.name,
        price: product.current_price,
        originalPrice: product.regular_price,
        imageUrl: product.image_url || product.thumbnail_url,
        category: product.department,
        brand: product.brand,
        inStock: Boolean(product.in_stock),
      } as WalmartProduct;
    }
    
    // Fallback mock data
    return {
      id: productId,
      name: `Product ${productId}`,
      price: 9.99,
      imageUrl: "/api/placeholder/100/100",
    } as WalmartProduct;
  }

  /**
   * Save item for later
   */
  async saveForLater(
    cartId: string, 
    productId: string, 
    userId: string
  ): Promise<void> {
    const item = this.getCartItem(cartId, productId);
    
    if (!item) {
      throw new Error("Item not found in cart");
    }
    
    // Add to saved items
    this.db.prepare(`
      INSERT OR REPLACE INTO saved_items (
        id, user_id, product_id, product_name, product_image, 
        price, metadata, moved_from_cart
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      `saved-${uuidv4()}`,
      userId,
      productId,
      item.product?.name || "",
      item.product?.imageUrl || "",
      item.price,
      JSON.stringify(item.metadata || {})
    );
    
    // Remove from cart
    await this.removeItem(cartId, productId);
    
    this.emit("cart:item:saved", { cartId, productId, userId });
  }

  /**
   * Move saved item back to cart
   */
  async moveToCart(
    userId: string, 
    productId: string, 
    cartId: string
  ): Promise<void> {
    const savedItem = this.db.prepare(`
      SELECT * FROM saved_items 
      WHERE user_id = ? AND product_id = ?
    `).get(userId, productId) as any;
    
    if (!savedItem) {
      throw new Error("Saved item not found");
    }
    
    // Add to cart
    await this.addOrUpdateItem(cartId, productId, 1, 
      JSON.parse(savedItem.metadata || "{}")
    );
    
    // Remove from saved
    this.db.prepare(`
      DELETE FROM saved_items 
      WHERE user_id = ? AND product_id = ?
    `).run(userId, productId);
    
    this.emit("cart:item:moved", { userId, productId, cartId });
  }

  /**
   * Get cart statistics
   */
  getCartStats(period: "day" | "week" | "month" = "day"): CartStats {
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }[period];
    
    const since = new Date(Date.now() - periodMs).toISOString();
    
    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT c.id) as total_carts,
        COUNT(DISTINCT CASE WHEN c.status = 'converted' THEN c.id END) as converted_carts,
        COUNT(DISTINCT CASE WHEN c.status = 'abandoned' THEN c.id END) as abandoned_carts,
        AVG(c.items_count) as avg_items,
        AVG(c.total) as avg_value
      FROM shopping_carts c
      WHERE c.created_at >= ?
    `).get(since) as any;
    
    const itemStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(DISTINCT product_id) as unique_products
      FROM cart_items ci
      JOIN shopping_carts c ON ci.cart_id = c.id
      WHERE c.created_at >= ?
    `).get(since) as any;
    
    return {
      totalItems: itemStats.total_items || 0,
      uniqueProducts: itemStats.unique_products || 0,
      totalValue: (stats.total_carts || 0) * (stats.avg_value || 0),
      averageItemValue: stats.avg_value || 0,
      abandonmentRate: stats.total_carts > 0 
        ? (stats.abandoned_carts / stats.total_carts) * 100 
        : 0,
      conversionRate: stats.total_carts > 0 
        ? (stats.converted_carts / stats.total_carts) * 100 
        : 0,
    };
  }

  /**
   * Clean up expired carts
   */
  private cleanupExpiredCarts(): void {
    const result = this.db.prepare(`
      UPDATE shopping_carts 
      SET status = 'abandoned' 
      WHERE status = 'active' 
      AND expires_at < CURRENT_TIMESTAMP
    `).run();
    
    if (result.changes > 0) {
      logger.info(`Marked ${result.changes} carts as abandoned`, "CART");
    }
  }

  /**
   * Track recently viewed product
   */
  async trackProductView(
    productId: string,
    sessionId: string,
    userId?: string,
    interactionType: string = "view"
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO recently_viewed (
        user_id, session_id, product_id, interaction_type
      ) VALUES (?, ?, ?, ?)
    `).run(userId || null, sessionId, productId, interactionType);
  }

  /**
   * Get recently viewed products
   */
  getRecentlyViewed(
    sessionId: string, 
    userId?: string, 
    limit: number = 10
  ): string[] {
    const query = userId
      ? `SELECT DISTINCT product_id 
         FROM recently_viewed 
         WHERE user_id = ? OR session_id = ?
         ORDER BY viewed_at DESC 
         LIMIT ?`
      : `SELECT DISTINCT product_id 
         FROM recently_viewed 
         WHERE session_id = ?
         ORDER BY viewed_at DESC 
         LIMIT ?`;
    
    const params = userId ? [userId, sessionId, limit] : [sessionId, limit];
    const rows = this.db.prepare(query).all(...params) as any[];
    
    return rows.map(row => row.product_id);
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.db.close();
    logger.info("Cart Persistence Service shut down", "CART");
  }
}