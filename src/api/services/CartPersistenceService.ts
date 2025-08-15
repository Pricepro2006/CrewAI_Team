/**
 * Cart Persistence Service
 * Manages shopping cart data persistence and synchronization
 */

import { Logger } from "../../utils/logger.js";
const logger = Logger.getInstance();

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  store?: string;
  addedAt: Date;
  modifiedAt: Date;
}

export interface Cart {
  id: string;
  userId?: string;
  sessionId?: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export class CartPersistenceService {
  private static instance: CartPersistenceService;
  private carts: Map<string, Cart> = new Map();

  static getInstance(): CartPersistenceService {
    if (!CartPersistenceService.instance) {
      CartPersistenceService.instance = new CartPersistenceService();
    }
    return CartPersistenceService.instance;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    try {
      const cart = this.carts.get(cartId);
      if (cart && cart.expiresAt && cart.expiresAt < new Date()) {
        this.carts.delete(cartId);
        return null;
      }
      return cart || null;
    } catch (error) {
      logger.error('Error getting cart:', error);
      throw error;
    }
  }

  async createCart(userId?: string, sessionId?: string): Promise<Cart> {
    try {
      const cart: Cart = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        sessionId,
        items: [],
        totalItems: 0,
        totalPrice: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      this.carts.set(cart.id, cart);
      logger.info(`Created cart ${cart.id}`);
      return cart;
    } catch (error) {
      logger.error('Error creating cart:', error);
      throw error;
    }
  }

  async addItem(cartId: string, item: Omit<CartItem, 'id' | 'addedAt' | 'modifiedAt'>): Promise<Cart> {
    try {
      const cart = this.carts.get(cartId);
      if (!cart) {
        throw new Error(`Cart ${cartId} not found`);
      }

      const existingItemIndex = cart.items.findIndex(i => i.productId === item.productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item
        cart.items[existingItemIndex].quantity += item.quantity;
        cart.items[existingItemIndex].modifiedAt = new Date();
      } else {
        // Add new item
        const newItem: CartItem = {
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          addedAt: new Date(),
          modifiedAt: new Date()
        };
        cart.items.push(newItem);
      }

      this.updateCartTotals(cart);
      cart.updatedAt = new Date();
      
      logger.info(`Added item to cart ${cartId}`);
      return cart;
    } catch (error) {
      logger.error('Error adding item to cart:', error);
      throw error;
    }
  }

  async removeItem(cartId: string, itemId: string): Promise<Cart> {
    try {
      const cart = this.carts.get(cartId);
      if (!cart) {
        throw new Error(`Cart ${cartId} not found`);
      }

      cart.items = cart.items.filter(item => item.id !== itemId);
      this.updateCartTotals(cart);
      cart.updatedAt = new Date();
      
      logger.info(`Removed item ${itemId} from cart ${cartId}`);
      return cart;
    } catch (error) {
      logger.error('Error removing item from cart:', error);
      throw error;
    }
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    try {
      const cart = this.carts.get(cartId);
      if (!cart) {
        throw new Error(`Cart ${cartId} not found`);
      }

      const item = cart.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found in cart`);
      }

      if (quantity <= 0) {
        return this.removeItem(cartId, itemId);
      }

      item.quantity = quantity;
      item.modifiedAt = new Date();
      
      this.updateCartTotals(cart);
      cart.updatedAt = new Date();
      
      logger.info(`Updated item ${itemId} quantity to ${quantity} in cart ${cartId}`);
      return cart;
    } catch (error) {
      logger.error('Error updating item quantity:', error);
      throw error;
    }
  }

  async clearCart(cartId: string): Promise<Cart> {
    try {
      const cart = this.carts.get(cartId);
      if (!cart) {
        throw new Error(`Cart ${cartId} not found`);
      }

      cart.items = [];
      cart.totalItems = 0;
      cart.totalPrice = 0;
      cart.updatedAt = new Date();
      
      logger.info(`Cleared cart ${cartId}`);
      return cart;
    } catch (error) {
      logger.error('Error clearing cart:', error);
      throw error;
    }
  }

  private updateCartTotals(cart: Cart): void {
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  async getCartsByUser(userId: string): Promise<Cart[]> {
    try {
      return Array.from(this.carts.values()).filter(cart => cart.userId === userId);
    } catch (error) {
      logger.error('Error getting carts by user:', error);
      throw error;
    }
  }
}