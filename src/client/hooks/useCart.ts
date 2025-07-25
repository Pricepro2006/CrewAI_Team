/**
 * useCart Hook
 * Manages shopping cart state with persistence and real-time updates
 */

import { useCallback, useEffect } from 'react';
import { useGroceryStore } from '../store/groceryStore';
import { api } from '../lib/api';
import type { CartItem, WalmartProduct } from '../../types/walmart-grocery';

interface UseCartResult {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (product: WalmartProduct, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
  loading: boolean;
  error: string | null;
}

export const useCart = (): UseCartResult => {
  const {
    cart,
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart: clearStoreCart,
    loading,
    error,
    setError,
  } = useGroceryStore();

  // Calculate totals
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Add item to cart
  const addItem = useCallback(async (product: WalmartProduct, quantity: number = 1) => {
    try {
      // Optimistically update UI
      addToCart(product, quantity);

      // Sync with backend
      const response = await api.walmartGrocery.cartOperation.mutate({
        userId: cart.userId,
        productId: product.id,
        quantity,
        operation: 'add',
      });

      if (!response.success) {
        throw new Error('Failed to add item to cart');
      }
    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Failed to add item');
      // Revert optimistic update
      removeFromCart(product.id);
    }
  }, [cart.userId, addToCart, removeFromCart, setError]);

  // Update item quantity
  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity < 1 || quantity > 99) return;

    const previousQuantity = getItemQuantity(productId);
    
    try {
      // Optimistically update UI
      updateCartItemQuantity(productId, quantity);

      // Sync with backend
      const response = await api.walmartGrocery.cartOperation.mutate({
        userId: cart.userId,
        productId,
        quantity,
        operation: 'update',
      });

      if (!response.success) {
        throw new Error('Failed to update quantity');
      }
    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
      // Revert optimistic update
      updateCartItemQuantity(productId, previousQuantity);
    }
  }, [cart.userId, updateCartItemQuantity, setError]);

  // Remove item from cart
  const removeItem = useCallback(async (productId: string) => {
    const item = cart.items.find(i => i.productId === productId);
    if (!item) return;

    try {
      // Optimistically update UI
      removeFromCart(productId);

      // Sync with backend
      const response = await api.walmartGrocery.cartOperation.mutate({
        userId: cart.userId,
        productId,
        quantity: 0,
        operation: 'remove',
      });

      if (!response.success) {
        throw new Error('Failed to remove item');
      }
    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Failed to remove item');
      // Revert optimistic update
      if (item.product) {
        addToCart(item.product, item.quantity);
      }
    }
  }, [cart.userId, cart.items, removeFromCart, addToCart, setError]);

  // Clear entire cart
  const clearCart = useCallback(async () => {
    const previousItems = [...cart.items];
    
    try {
      // Optimistically update UI
      clearStoreCart();

      // Sync with backend
      await Promise.all(
        previousItems.map(item =>
          api.walmartGrocery.cartOperation.mutate({
            userId: cart.userId,
            productId: item.productId,
            quantity: 0,
            operation: 'remove',
          })
        )
      );
    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
      // Revert optimistic update
      previousItems.forEach(item => {
        if (item.product) {
          addToCart(item.product, item.quantity);
        }
      });
    }
  }, [cart.userId, cart.items, clearStoreCart, addToCart, setError]);

  // Check if item is in cart
  const isInCart = useCallback((productId: string): boolean => {
    return cart.items.some(item => item.productId === productId);
  }, [cart.items]);

  // Get item quantity
  const getItemQuantity = useCallback((productId: string): number => {
    const item = cart.items.find(i => i.productId === productId);
    return item?.quantity || 0;
  }, [cart.items]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('walmart-cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (parsed.items && Array.isArray(parsed.items)) {
          // Restore cart from localStorage
          parsed.items.forEach((item: CartItem) => {
            if (item.product) {
              addToCart(item.product, item.quantity);
            }
          });
        }
      } catch (err) {
        
      }
    }
  }, []);

  // Save cart to localStorage on changes
  useEffect(() => {
    if (cart.items.length > 0) {
      localStorage.setItem('walmart-cart', JSON.stringify(cart));
    } else {
      localStorage.removeItem('walmart-cart');
    }
  }, [cart]);

  return {
    items: cart.items,
    totalItems,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    isInCart,
    getItemQuantity,
    loading,
    error,
  };
};