/**
 * Grocery Store - Zustand store for Walmart grocery state management
 * Optimized for performance with selective updates and computed values
 */

import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  WalmartProduct,
  CartItem,
  GroceryList,
  GroceryItem,
  ShoppingCart,
  UserPreferences,
  PriceAlert,
  Order,
} from "../../types/walmart-grocery.js";

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
  addToList: (
    listId: string,
    product: WalmartProduct,
    quantity: number,
  ) => void;
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

  // Computed getters (readonly)
  readonly cartItemCount: number;
  readonly cartTotal: number;
  readonly favoriteProductIds: Set<string>;
  
  // Performance optimized actions
  batchUpdateCart: (updates: Array<{ productId: string; quantity: number }>) => void;
  
  // Utility functions
  reset: () => void;
}

const defaultCart: ShoppingCart = {
  id: "default-cart",
  userId: "current-user", // This should come from auth
  items: [],
  subtotal: 0,
  tax: 0,
  fees: {},
  discounts: [],
  total: 0,
  savedForLater: [],
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultPreferences: UserPreferences = {
  id: "pref-current-user",
  user_id: "current-user",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  preferredBrands: [],
  dietaryRestrictions: [],
  allergens: [],
  preferOrganic: false,
  preferGeneric: false,
  avoidProducts: [],
  favoriteProducts: [],
};

export const useGroceryStore = create<GroceryState>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
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

        // Computed values
        get cartItemCount(): number {
          const state = get();
          return state.cart?.items?.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) ?? 0;
        },
        
        get cartTotal(): number {
          const state = get();
          return state.cart?.items?.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0) ?? 0;
        },
        
        get favoriteProductIds(): Set<string> {
          const state = get();
          return new Set(state.preferences.favoriteProducts || []);
        },

        // Performance optimized batch update
        batchUpdateCart: (updates: Array<{ productId: string; quantity: number }>) => {
          set((state) => {
            if (!state.cart?.items) return;
            updates.forEach(({ productId, quantity }) => {
              const existingItem = state.cart.items.find(item => item.productId === productId);
              if (existingItem) {
                if (quantity <= 0) {
                  state.cart.items = state.cart.items.filter(item => item.productId !== productId);
                } else {
                  existingItem.quantity = quantity;
                  existingItem.updatedAt = new Date().toISOString();
                }
              }
            });
            state.cart.updatedAt = new Date().toISOString();
          });
        },

        // Cart Actions (optimized with Immer)
        addToCart: (product: WalmartProduct, quantity: number) => {
          set((state) => {
            if (!state.cart?.items) return;
            
            const existingItem = state.cart.items.find(
              (item) => item.productId === product.id,
            );

            if (existingItem) {
              // Update quantity if item already exists
              existingItem.quantity += quantity;
              existingItem.updatedAt = new Date().toISOString();
            } else {
              // Add new item
              const productPrice = typeof product.price === 'number' 
                ? product.price 
                : (product.price as any)?.regular ?? 0;
              
              const newItem: CartItem = {
                id: `item-${product.id}-${Date.now()}`,
                productId: product.id,
                product,
                quantity,
                price: productPrice,
                addedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              state.cart.items.push(newItem);
            }
            
            state.cart.updatedAt = new Date().toISOString();
          });
        },

        updateCartItemQuantity: (productId: string, quantity: number) => {
          set((state) => {
            if (!state.cart?.items) return;
            
            const item = state.cart.items.find(item => item.productId === productId);
            if (item) {
              if (quantity <= 0) {
                state.cart.items = state.cart.items.filter(item => item.productId !== productId);
              } else {
                item.quantity = quantity;
                item.updatedAt = new Date().toISOString();
              }
              state.cart.updatedAt = new Date().toISOString();
            }
          });
        },

        removeFromCart: (productId: string) => {
          set((state) => {
            if (state.cart?.items) {
              state.cart.items = state.cart.items.filter(
                (item) => item.productId !== productId,
              );
              state.cart.updatedAt = new Date().toISOString();
            }
          });
        },

        clearCart: () => {
          set((state) => {
            state.cart = {
              ...defaultCart,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          });
        },

        // Grocery List Actions
        createList: (name: string, description?: string): GroceryList => {
          const newList: GroceryList = {
            id: `list-${Date.now()}`,
            user_id: "current-user",
            list_name: name,
            description,
            list_type: "shopping",
            status: "active",
            items: [],
            estimated_total: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set((state: any) => ({
            lists: [...state.lists, newList],
          }));

          return newList;
        },

        updateList: (listId: string, updates: Partial<GroceryList>) => {
          set((state) => ({
            lists: state.lists.map((list) =>
              list.id === listId
                ? { ...list, ...updates, updatedAt: new Date().toISOString() }
                : list,
            ),
          }));
        },

        deleteList: (listId: string) => {
          set((state) => ({
            lists: state.lists.filter((list) => list.id !== listId),
            currentListId:
              state.currentListId === listId ? null : state.currentListId,
          }));
        },

        setCurrentList: (listId: string | null) => {
          set({ currentListId: listId });
        },

        addToList: (listId: string, product: WalmartProduct, quantity: number) => {
          set((state) => ({
            lists: state.lists.map((list) => {
              if (list.id !== listId) return list;

              const productPrice = typeof product.price === 'number' 
                ? product.price 
                : (product.price as any)?.regular ?? 0;
              const productCategory = typeof product.category === 'string' 
                ? product.category 
                : (product.category as any)?.name ?? 'Uncategorized';
              
              const newItem: GroceryItem = {
                id: `item-${Date.now()}`,
                list_id: listId,
                item_name: product.name,
                product_id: product.id,
                brand: product.brand ?? '',
                category: productCategory,
                quantity,
                estimated_price: productPrice,
                status: "pending",
                product,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              const currentTotal = list.estimated_total || 0;
              return {
                ...list,
                items: [...(list.items || []), newItem],
                estimated_total: currentTotal + productPrice * quantity,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },

        removeFromList: (listId: string, itemId: string) => {
          set((state) => ({
            lists: state.lists.map((list) => {
              if (list.id !== listId) return list;

              const items = list.items || [];
              const item = items.find((i) => i.id === itemId);
              if (!item) return list;

              const itemPrice = typeof item.product?.price === 'number' 
                ? item.product.price 
                : (item.product?.price as any)?.regular ?? 0;

              return {
                ...list,
                items: items.filter((i) => i.id !== itemId),
                estimated_total:
                  (list.estimated_total || 0) - itemPrice * item.quantity,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },

        // User Preferences
        updatePreferences: (updates: Partial<UserPreferences>) => {
          set((state) => ({
            preferences: { ...state.preferences, ...updates },
          }));
        },

        // Price Alerts
        createPriceAlert: (productId: string, targetPrice: number) => {
          const newAlert: PriceAlert = {
            id: `alert-${Date.now()}`,
            userId: "current-user",
            productId,
            targetPrice,
            currentPrice: 0, // This should be fetched
            createdAt: new Date().toISOString(),
            active: true,
          };

          set((state) => ({
            priceAlerts: [...state.priceAlerts, newAlert],
          }));
        },

        deletePriceAlert: (alertId: string) => {
          set((state) => ({
            priceAlerts: state.priceAlerts.filter(
              (alert) => alert.id !== alertId,
            ),
          }));
        },

        // Order History
        addOrder: (order: Order) => {
          set((state) => ({
            orders: [order, ...state.orders],
          }));
        },

        // Search History
        addSearchTerm: (term: string) => {
          set((state) => {
            const filtered = state.searchHistory.filter((t) => t !== term);
            return {
              searchHistory: [term, ...filtered].slice(0, 10), // Keep last 10
            };
          });
        },

        clearSearchHistory: () => {
          set({ searchHistory: [] });
        },

        // UI State
        setLoading: (loading: boolean) => set({ loading }),
        setError: (error: string | null) => set({ error }),

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
        })),
        {
        name: "walmart-grocery-store",
        partialize: (state) => ({
          cart: state.cart,
          lists: state.lists,
          currentListId: state.currentListId,
          preferences: state.preferences,
          priceAlerts: state.priceAlerts,
          searchHistory: state.searchHistory,
        }),
      },
      ),
    ),
  ),
);

