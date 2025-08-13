/**
 * useCart Hook
 * Manages shopping cart state with persistence and real-time updates
 */

import { useCallback, useEffect } from "react";
import { useGroceryStore } from "../store/groceryStore.js";
// TODO: Replace with proper tRPC hooks
// import { api } from '../lib/api.js';
import type { CartItem, WalmartProduct } from "../../types/walmart-grocery.js";

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
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Add item to cart
  const addItem = useCallback(
    async (product: WalmartProduct, quantity: number = 1) => {
      try {
        // Optimistically update UI
        addToCart(product, quantity);

        // TODO: Replace with proper tRPC mutation
        // const response = await api.walmartGrocery.cartOperation.mutate({
        //   userId: cart.userId,
        //   productId: product.id,
        //   quantity,
        //   operation: 'add',
        // });

        // Mock successful response for now
        const response = { success: true };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add item");
        // Revert optimistic update
        removeFromCart(product.id);
      }
    },
    [cart.userId, addToCart, removeFromCart, setError],
  );

  // Update item quantity
  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (quantity < 1 || quantity > 99) return;

      const previousQuantity = getItemQuantity(productId);

      try {
        // Optimistically update UI
        updateCartItemQuantity(productId, quantity);

        // TODO: Replace with proper tRPC mutation
        // Mock successful response for now
        const response = { success: true };
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update quantity",
        );
        // Revert optimistic update
        updateCartItemQuantity(productId, previousQuantity);
      }
    },
    [cart.userId, updateCartItemQuantity, setError],
  );

  // Remove item from cart
  const removeItem = useCallback(
    async (productId: string) => {
      const item = cart.items.find((i) => i.productId === productId);
      if (!item) return;

      try {
        // Optimistically update UI
        removeFromCart(productId);

        // TODO: Replace with proper tRPC mutation
        // Mock successful response for now
        const response = { success: true };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove item");
        // Revert optimistic update
        if (item.product) {
          addToCart(item.product, item.quantity);
        }
      }
    },
    [cart.userId, cart.items, removeFromCart, addToCart, setError],
  );

  // Clear entire cart
  const clearCart = useCallback(async () => {
    const previousItems = [...cart.items];

    try {
      // Optimistically update UI
      clearStoreCart();

      // TODO: Replace with proper tRPC mutations
      // Mock successful responses for now
      await Promise.resolve();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear cart");
      // Revert optimistic update
      previousItems.forEach((item) => {
        if (item.product) {
          addToCart(item.product, item.quantity);
        }
      });
    }
  }, [cart.userId, cart.items, clearStoreCart, addToCart, setError]);

  // Check if item is in cart
  const isInCart = useCallback(
    (productId: string): boolean => {
      return cart.items.some((item) => item.productId === productId);
    },
    [cart.items],
  );

  // Get item quantity
  const getItemQuantity = useCallback(
    (productId: string): number => {
      const item = cart.items.find((i) => i.productId === productId);
      return item?.quantity || 0;
    },
    [cart.items],
  );

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("walmart-cart");
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
        // Ignore localStorage parsing errors
      }
    }
  }, []);

  // Save cart to localStorage on changes
  useEffect(() => {
    if (cart.items.length > 0) {
      localStorage.setItem("walmart-cart", JSON.stringify(cart));
    } else {
      localStorage.removeItem("walmart-cart");
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
