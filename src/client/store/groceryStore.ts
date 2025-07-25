/**
 * Grocery Store - Zustand store for Walmart grocery state management
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  WalmartProduct,
  CartItem,
  GroceryList,
  GroceryItem,
  ShoppingCart,
  UserPreferences,
  PriceAlert,
  Order,
} from '../../types/walmart-grocery';

interface GroceryState {
  // Cart State
  cart: ShoppingCart;
  addToCart: (product: WalmartProduct, quantity: number) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  
  // Grocery Lists
  lists: GroceryList[];
  currentListId: string | null;
  createList: (name: string, description?: string) => GroceryList;
  updateList: (listId: string, updates: Partial<GroceryList>) => void;
  deleteList: (listId: string) => void;
  setCurrentList: (listId: string | null) => void;
  addToList: (listId: string, product: WalmartProduct, quantity: number) => void;
  removeFromList: (listId: string, itemId: string) => void;
  
  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  
  // Price Alerts
  priceAlerts: PriceAlert[];
  createPriceAlert: (productId: string, targetPrice: number) => void;
  deletePriceAlert: (alertId: string) => void;
  
  // Order History
  orders: Order[];
  addOrder: (order: Order) => void;
  
  // Search History
  searchHistory: string[];
  addSearchTerm: (term: string) => void;
  clearSearchHistory: () => void;
  
  // UI State
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Utility functions
  reset: () => void;
}

const defaultCart: ShoppingCart = {
  id: 'default-cart',
  userId: 'current-user', // This should come from auth
  items: [],
  subtotal: 0,
  tax: 0,
  fees: 0,
  discounts: 0,
  total: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultPreferences: UserPreferences = {
  userId: 'current-user',
  preferredBrands: [],
  dietaryRestrictions: [],
  allergens: [],
  preferOrganic: false,
  preferGeneric: false,
  avoidProducts: [],
  favoriteProducts: [],
};

export const useGroceryStore = create<GroceryState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        cart: defaultCart,
        lists: [],
        currentListId: null,
        preferences: defaultPreferences,
        priceAlerts: [],
        orders: [],
        searchHistory: [],
        loading: false,
        error: null,

        // Cart Actions
        addToCart: (product: WalmartProduct, quantity: number) => {
          set((state: GroceryState) => {
            const existingItem = state.cart.items.find(
              item => item.productId === product.id
            );

            if (existingItem) {
              // Update quantity if item already exists
              const updatedItems = state.cart.items.map(item =>
                item.productId === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              );
              
              return {
                cart: {
                  ...state.cart,
                  items: updatedItems,
                  updatedAt: new Date(),
                },
              };
            } else {
              // Add new item
              const newItem: CartItem = {
                productId: product.id,
                product,
                quantity,
                price: product.price,
                addedAt: new Date(),
              };
              
              return {
                cart: {
                  ...state.cart,
                  items: [...state.cart.items, newItem],
                  updatedAt: new Date(),
                },
              };
            }
          });
        },

        updateCartItemQuantity: (productId: string, quantity: number) => {
          set((state: GroceryState) => ({
            cart: {
              ...state.cart,
              items: state.cart.items.map((item: CartItem) =>
                item.productId === productId
                  ? { ...item, quantity }
                  : item
              ),
              updatedAt: new Date(),
            },
          }));
        },

        removeFromCart: (productId: string) => {
          set((state: GroceryState) => ({
            cart: {
              ...state.cart,
              items: state.cart.items.filter(item => item.productId !== productId),
              updatedAt: new Date(),
            },
          }));
        },

        clearCart: () => {
          set({
            cart: {
              ...defaultCart,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        },

        // Grocery List Actions
        createList: (name, description) => {
          const newList: GroceryList = {
            id: `list-${Date.now()}`,
            userId: 'current-user',
            name,
            description,
            items: [],
            totalEstimate: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          set((state) => ({
            lists: [...state.lists, newList],
          }));

          return newList;
        },

        updateList: (listId, updates) => {
          set((state) => ({
            lists: state.lists.map(list =>
              list.id === listId
                ? { ...list, ...updates, updatedAt: new Date() }
                : list
            ),
          }));
        },

        deleteList: (listId) => {
          set((state) => ({
            lists: state.lists.filter(list => list.id !== listId),
            currentListId: state.currentListId === listId ? null : state.currentListId,
          }));
        },

        setCurrentList: (listId) => {
          set({ currentListId: listId });
        },

        addToList: (listId, product, quantity) => {
          set((state) => ({
            lists: state.lists.map(list => {
              if (list.id !== listId) return list;

              const newItem: GroceryItem = {
                id: `item-${Date.now()}`,
                listId,
                productId: product.id,
                product,
                quantity,
                isPurchased: false,
                addedAt: new Date(),
              };

              return {
                ...list,
                items: [...list.items, newItem],
                totalEstimate: list.totalEstimate + (product.price * quantity),
                updatedAt: new Date(),
              };
            }),
          }));
        },

        removeFromList: (listId, itemId) => {
          set((state) => ({
            lists: state.lists.map(list => {
              if (list.id !== listId) return list;

              const item = list.items.find(i => i.id === itemId);
              if (!item) return list;

              return {
                ...list,
                items: list.items.filter(i => i.id !== itemId),
                totalEstimate: list.totalEstimate - ((item.product?.price || 0) * item.quantity),
                updatedAt: new Date(),
              };
            }),
          }));
        },

        // User Preferences
        updatePreferences: (updates) => {
          set((state) => ({
            preferences: { ...state.preferences, ...updates },
          }));
        },

        // Price Alerts
        createPriceAlert: (productId, targetPrice) => {
          const newAlert: PriceAlert = {
            id: `alert-${Date.now()}`,
            userId: 'current-user',
            productId,
            targetPrice,
            currentPrice: 0, // This should be fetched
            created: new Date(),
            status: 'active',
          };

          set((state) => ({
            priceAlerts: [...state.priceAlerts, newAlert],
          }));
        },

        deletePriceAlert: (alertId) => {
          set((state) => ({
            priceAlerts: state.priceAlerts.filter(alert => alert.id !== alertId),
          }));
        },

        // Order History
        addOrder: (order) => {
          set((state) => ({
            orders: [order, ...state.orders],
          }));
        },

        // Search History
        addSearchTerm: (term) => {
          set((state) => {
            const filtered = state.searchHistory.filter(t => t !== term);
            return {
              searchHistory: [term, ...filtered].slice(0, 10), // Keep last 10
            };
          });
        },

        clearSearchHistory: () => {
          set({ searchHistory: [] });
        },

        // UI State
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),

        // Reset store
        reset: () => {
          set({
            cart: defaultCart,
            lists: [],
            currentListId: null,
            preferences: defaultPreferences,
            priceAlerts: [],
            orders: [],
            searchHistory: [],
            loading: false,
            error: null,
          });
        },
      }),
      {
        name: 'walmart-grocery-store',
        partialize: (state) => ({
          cart: state.cart,
          lists: state.lists,
          currentListId: state.currentListId,
          preferences: state.preferences,
          priceAlerts: state.priceAlerts,
          searchHistory: state.searchHistory,
        }),
      }
    )
  )
);