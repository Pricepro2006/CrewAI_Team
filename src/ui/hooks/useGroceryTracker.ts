/**
 * Custom hook for Split Screen Grocery Tracker
 * Manages state, WebSocket connections, and API interactions
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { api } from '../../client/lib/api';
import type {
  GroceryTrackerState,
  UseGroceryTrackerReturn,
  ReceiptItem,
  ReceiptSession,
  BudgetCategory,
  BudgetAlert,
  SpendingLog,
  SearchState,
  WebSocketMessage,
  WebSocketMessageType,
  ProductSearchOptions,
  BudgetMetrics,
  CategoryInsight,
  DEFAULT_CATEGORY_CONFIG,
  ALERT_THRESHOLDS,
  TAX_RATES
} from '../../types/grocery-tracker';
import type { WalmartProduct } from '../../types/walmart-grocery';

interface UseGroceryTrackerOptions {
  userId?: string;
  initialBudget?: number;
  taxRate?: number;
  autoSave?: boolean;
  autoSaveInterval?: number;
  enableWebSocket?: boolean;
  onError?: (error: Error) => void;
  onBudgetAlert?: (alert: BudgetAlert) => void;
  onItemAdded?: (item: ReceiptItem) => void;
}

export const useGroceryTracker = (options: UseGroceryTrackerOptions = {}): UseGroceryTrackerReturn => {
  const {
    userId = 'default-user',
    initialBudget = 500,
    taxRate = TAX_RATES.DEFAULT,
    autoSave = true,
    autoSaveInterval = 30000, // 30 seconds
    enableWebSocket = true,
    onError,
    onBudgetAlert,
    onItemAdded
  } = options;
  
  // Refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveStateRef = useRef<string>('');
  
  // Core state
  const [state, setState] = useState<GroceryTrackerState>({
    searchState: {
      query: '',
      isSearching: false,
      results: [],
      selectedProduct: null,
      filters: {},
      pagination: {
        page: 1,
        totalPages: 1,
        totalItems: 0
      }
    },
    receiptState: {
      currentSession: null,
      savedSessions: [],
      recentItems: [],
      favoriteItems: [],
      isLoading: false,
      error: null
    },
    budgetState: {
      monthlyBudget: initialBudget,
      categories: [],
      alerts: [],
      spendingLogs: [],
      metrics: {
        totalAllocated: 0,
        totalSpent: 0,
        totalRemaining: 0,
        utilizationPercentage: 0,
        categoriesOverBudget: 0,
        categoriesNearLimit: 0,
        averageSpendingPerCategory: 0,
        projectedMonthEnd: 0,
        mostSpentCategory: { id: '', name: '', amount: 0, percentage: 0 },
        leastSpentCategory: { id: '', name: '', amount: 0, percentage: 0 },
        spendingVelocity: { daily: 0, weekly: 0, monthly: 0 }
      },
      insights: [],
      recommendations: []
    },
    uiState: {
      editingBudget: false,
      showAlerts: false,
      activeView: 'split',
      sidebarCollapsed: false,
      loading: false,
      error: null
    },
    websocketState: {
      connected: false,
      reconnecting: false,
      messageQueue: [],
      subscriptions: []
    }
  });
  
  // WebSocket connection
  const { client: wsClient, isConnected, connectionStatus } = useWebSocket({
    onConnect: () => {
      setState(prev => ({
        ...prev,
        websocketState: {
          ...prev.websocketState,
          connected: true,
          reconnecting: false
        }
      }));
    },
    onDisconnect: () => {
      setState(prev => ({
        ...prev,
        websocketState: {
          ...prev.websocketState,
          connected: false
        }
      }));
    },
    onError: (error) => {
      setState(prev => ({
        ...prev,
        uiState: {
          ...prev.uiState,
          error: `WebSocket error: ${error.message}`
        }
      }));
      onError?.(error);
    }
  });
  
  // Mock tRPC hooks - Replace with actual tRPC endpoints
  const searchProductsMutation = {
    mutateAsync: async (options: ProductSearchOptions): Promise<{ products: WalmartProduct[], total: number }> => {
      // Mock implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        products: [
          {
            productId: `prod_${Date.now()}`,
            name: `Search result for "${options.query}"`,
            category: options.category || 'Fresh Produce',
            price: Math.round(Math.random() * 10 * 100) / 100,
            originalPrice: Math.round(Math.random() * 15 * 100) / 100,
            imageUrl: '/api/placeholder/150/150',
            inStock: true,
            unit: 'each',
            sku: `SKU${Math.random().toString(36).substr(2, 6)}`,
            description: `Mock product for ${options.query}`
          }
        ],
        total: 1
      };
    },
    isPending: false
  };
  
  const addReceiptItemMutation = {
    mutateAsync: async (item: Omit<ReceiptItem, 'id' | 'addedAt'>) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { success: true, itemId: `item_${Date.now()}` };
    },
    isPending: false
  };
  
  const updateBudgetMutation = {
    mutateAsync: async (budget: number) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    },
    isPending: false
  };
  
  const saveSessionMutation = {
    mutateAsync: async (session: ReceiptSession) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, sessionId: session.id };
    },
    isPending: false
  };
  
  // Initialize categories on mount
  useEffect(() => {
    const initializeCategories = () => {
      const categories: BudgetCategory[] = Object.entries(DEFAULT_CATEGORY_CONFIG).map(([name, config]) => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        allocated: initialBudget * config.allocation,
        spent: 0,
        percentage: 0,
        color: config.color,
        icon: config.icon,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      setState(prev => ({
        ...prev,
        budgetState: {
          ...prev.budgetState,
          categories
        }
      }));
    };
    
    initializeCategories();
  }, [initialBudget]);
  
  // Initialize receipt session
  useEffect(() => {
    const initSession: ReceiptSession = {
      id: `session_${Date.now()}_${userId}`,
      userId,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      itemCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };
    
    setState(prev => ({
      ...prev,
      receiptState: {
        ...prev.receiptState,
        currentSession: initSession
      }
    }));
  }, [userId]);
  
  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !state.receiptState.currentSession) return;
    
    const currentStateString = JSON.stringify({
      session: state.receiptState.currentSession,
      budget: state.budgetState
    });
    
    if (currentStateString !== lastSaveStateRef.current) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (state.receiptState.currentSession) {
          void saveSessionMutation.mutateAsync(state.receiptState.currentSession);
          lastSaveStateRef.current = currentStateString;
        }
      }, autoSaveInterval);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.receiptState.currentSession, state.budgetState, autoSave, autoSaveInterval, saveSessionMutation]);
  
  // WebSocket message handling
  useEffect(() => {
    if (!wsClient || !isConnected || !enableWebSocket) return;
    
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      setState(prev => ({
        ...prev,
        websocketState: {
          ...prev.websocketState,
          lastMessage: message,
          messageQueue: [...prev.websocketState.messageQueue.slice(-49), message] // Keep last 50 messages
        }
      }));
      
      // Handle different message types
      switch (message.type) {
        case 'budget-alert':
          const alert = message.data as BudgetAlert;
          setState(prev => ({
            ...prev,
            budgetState: {
              ...prev.budgetState,
              alerts: [...prev.budgetState.alerts, alert]
            },
            uiState: {
              ...prev.uiState,
              showAlerts: true
            }
          }));
          onBudgetAlert?.(alert);
          break;
          
        case 'item-added':
          // Handle real-time item additions from other clients
          break;
          
        case 'spending-updated':
          // Handle spending updates
          break;
          
        case 'price-change':
          // Handle price changes for items in cart
          break;
      }
    };
    
    // Note: Actual WebSocket subscription would be implemented here
    console.log('🔔 WebSocket message handler registered');
    
  }, [wsClient, isConnected, enableWebSocket, onBudgetAlert]);
  
  // Search products
  const searchProducts = useCallback(async (options: ProductSearchOptions) => {
    setState(prev => ({
      ...prev,
      searchState: {
        ...prev.searchState,
        isSearching: true,
        query: options.query,
        filters: {
          category: options.category,
          minPrice: options.minPrice,
          maxPrice: options.maxPrice,
          inStock: options.inStock,
          onSale: options.onSale
        }
      }
    }));
    
    try {
      const { products, total } = await searchProductsMutation.mutateAsync(options);
      
      setState(prev => ({
        ...prev,
        searchState: {
          ...prev.searchState,
          isSearching: false,
          results: products,
          pagination: {
            ...prev.searchState.pagination,
            totalItems: total,
            totalPages: Math.ceil(total / (options.limit || 20))
          }
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        searchState: {
          ...prev.searchState,
          isSearching: false,
          results: []
        },
        uiState: {
          ...prev.uiState,
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
      onError?.(error as Error);
    }
  }, [searchProductsMutation, onError]);
  
  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchState: {
        ...prev.searchState,
        query: '',
        results: [],
        selectedProduct: null,
        filters: {}
      }
    }));
  }, []);
  
  // Select product
  const selectProduct = useCallback((product: WalmartProduct) => {
    setState(prev => ({
      ...prev,
      searchState: {
        ...prev.searchState,
        selectedProduct: product
      }
    }));
  }, []);
  
  // Add item to receipt
  const addItem = useCallback(async (product: WalmartProduct, quantity: number = 1) => {
    if (!state.receiptState.currentSession) return;
    
    const receiptItem: ReceiptItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: product.productId,
      name: product.name,
      category: product.category,
      quantity,
      unitPrice: product.price,
      totalPrice: product.price * quantity,
      originalPrice: product.originalPrice,
      imageUrl: product.imageUrl,
      inStock: product.inStock,
      unit: product.unit || 'each',
      sku: product.sku,
      addedAt: new Date()
    };
    
    try {
      await addReceiptItemMutation.mutateAsync(receiptItem);
      
      const updatedItems = [...state.receiptState.currentSession.items, receiptItem];
      const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      const updatedSession: ReceiptSession = {
        ...state.receiptState.currentSession,
        items: updatedItems,
        itemCount: updatedItems.length,
        subtotal,
        tax,
        total,
        updatedAt: new Date()
      };
      
      setState(prev => ({
        ...prev,
        receiptState: {
          ...prev.receiptState,
          currentSession: updatedSession
        }
      }));
      
      // Update category spending and check for alerts
      updateCategorySpending(product.category, receiptItem.totalPrice);
      onItemAdded?.(receiptItem);
      
      // Clear search selection
      setState(prev => ({
        ...prev,
        searchState: {
          ...prev.searchState,
          selectedProduct: null,
          query: ''
        }
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        uiState: {
          ...prev.uiState,
          error: error instanceof Error ? error.message : 'Failed to add item'
        }
      }));
      onError?.(error as Error);
    }
  }, [state.receiptState.currentSession, addReceiptItemMutation, taxRate, onItemAdded, onError]);
  
  // Update category spending
  const updateCategorySpending = useCallback((categoryName: string, amount: number) => {
    setState(prev => {
      const updatedCategories = prev.budgetState.categories.map(cat => {
        if (cat.name === categoryName) {
          const newSpent = cat.spent + amount;
          const newPercentage = cat.allocated > 0 ? (newSpent / cat.allocated) * 100 : 0;
          
          // Check for budget alerts
          if (newPercentage >= ALERT_THRESHOLDS.WARNING && cat.percentage < ALERT_THRESHOLDS.WARNING) {
            const alert: BudgetAlert = {
              id: `alert_${Date.now()}_${cat.id}`,
              categoryId: cat.id,
              categoryName: cat.name,
              type: newPercentage >= ALERT_THRESHOLDS.DANGER ? 'danger' : 'warning',
              threshold: newPercentage >= ALERT_THRESHOLDS.DANGER ? ALERT_THRESHOLDS.DANGER : ALERT_THRESHOLDS.WARNING,
              currentAmount: newSpent,
              message: newPercentage >= ALERT_THRESHOLDS.DANGER 
                ? `Budget exceeded for ${cat.name}! You're over by $${(newSpent - cat.allocated).toFixed(2)}`
                : `Approaching budget limit for ${cat.name}. ${(100 - newPercentage).toFixed(1)}% remaining.`,
              timestamp: new Date(),
              acknowledged: false,
              autoHide: true
            };
            
            // Add alert to state
            setTimeout(() => {
              setState(prev => ({
                ...prev,
                budgetState: {
                  ...prev.budgetState,
                  alerts: [...prev.budgetState.alerts, alert]
                },
                uiState: {
                  ...prev.uiState,
                  showAlerts: true
                }
              }));
              onBudgetAlert?.(alert);
            }, 100);
          }
          
          return {
            ...cat,
            spent: newSpent,
            percentage: newPercentage,
            updatedAt: new Date()
          };
        }
        return cat;
      });
      
      return {
        ...prev,
        budgetState: {
          ...prev.budgetState,
          categories: updatedCategories
        }
      };
    });
  }, [onBudgetAlert]);
  
  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (!state.receiptState.currentSession) return;
    
    setState(prev => {
      if (!prev.receiptState.currentSession) return prev;
      
      const updatedItems = prev.receiptState.currentSession.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = {
            ...item,
            quantity: Math.max(0, quantity),
            totalPrice: item.unitPrice * Math.max(0, quantity),
            modifiedAt: new Date()
          };
          
          // Update category spending (calculate difference)
          const spendingDiff = updatedItem.totalPrice - item.totalPrice;
          if (spendingDiff !== 0) {
            updateCategorySpending(item.category, spendingDiff);
          }
          
          return updatedItem;
        }
        return item;
      }).filter(item => item.quantity > 0);
      
      const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      const updatedSession: ReceiptSession = {
        ...prev.receiptState.currentSession,
        items: updatedItems,
        itemCount: updatedItems.length,
        subtotal,
        tax,
        total,
        updatedAt: new Date()
      };
      
      return {
        ...prev,
        receiptState: {
          ...prev.receiptState,
          currentSession: updatedSession
        }
      };
    });
  }, [state.receiptState.currentSession, taxRate, updateCategorySpending]);
  
  // Remove item
  const removeItem = useCallback((itemId: string) => {
    if (!state.receiptState.currentSession) return;
    
    const itemToRemove = state.receiptState.currentSession.items.find(item => item.id === itemId);
    if (!itemToRemove) return;
    
    // Update category spending (subtract)
    updateCategorySpending(itemToRemove.category, -itemToRemove.totalPrice);
    
    setState(prev => {
      if (!prev.receiptState.currentSession) return prev;
      
      const updatedItems = prev.receiptState.currentSession.items.filter(item => item.id !== itemId);
      const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      const updatedSession: ReceiptSession = {
        ...prev.receiptState.currentSession,
        items: updatedItems,
        itemCount: updatedItems.length,
        subtotal,
        tax,
        total,
        updatedAt: new Date()
      };
      
      return {
        ...prev,
        receiptState: {
          ...prev.receiptState,
          currentSession: updatedSession
        }
      };
    });
  }, [state.receiptState.currentSession, taxRate, updateCategorySpending]);
  
  // Clear receipt
  const clearReceipt = useCallback(() => {
    if (!state.receiptState.currentSession) return;
    
    setState(prev => {
      if (!prev.receiptState.currentSession) return prev;
      
      const clearedSession: ReceiptSession = {
        ...prev.receiptState.currentSession,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
        updatedAt: new Date()
      };
      
      // Reset category spending
      const resetCategories = prev.budgetState.categories.map(cat => ({
        ...cat,
        spent: 0,
        percentage: 0,
        updatedAt: new Date()
      }));
      
      return {
        ...prev,
        receiptState: {
          ...prev.receiptState,
          currentSession: clearedSession
        },
        budgetState: {
          ...prev.budgetState,
          categories: resetCategories,
          alerts: [] // Clear alerts when clearing receipt
        }
      };
    });
  }, [state.receiptState.currentSession]);
  
  // Save session
  const saveSession = useCallback(async (name?: string) => {
    if (!state.receiptState.currentSession) return;
    
    const sessionToSave: ReceiptSession = {
      ...state.receiptState.currentSession,
      name: name || `Session ${new Date().toLocaleDateString()}`,
      status: 'saved',
      updatedAt: new Date()
    };
    
    try {
      await saveSessionMutation.mutateAsync(sessionToSave);
      
      setState(prev => ({
        ...prev,
        receiptState: {
          ...prev.receiptState,
          savedSessions: [...prev.receiptState.savedSessions, sessionToSave]
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        uiState: {
          ...prev.uiState,
          error: error instanceof Error ? error.message : 'Failed to save session'
        }
      }));
      onError?.(error as Error);
    }
  }, [state.receiptState.currentSession, saveSessionMutation, onError]);
  
  // Load session
  const loadSession = useCallback(async (sessionId: string) => {
    // Mock implementation - replace with actual API call
    setState(prev => ({
      ...prev,
      receiptState: {
        ...prev.receiptState,
        isLoading: true
      }
    }));
    
    // This would be replaced with actual API call
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        receiptState: {
          ...prev.receiptState,
          isLoading: false
        }
      }));
    }, 1000);
  }, []);
  
  // Update monthly budget
  const updateMonthlyBudget = useCallback(async (amount: number) => {
    try {
      await updateBudgetMutation.mutateAsync(amount);
      
      setState(prev => {
        const updatedCategories = prev.budgetState.categories.map(cat => {
          const categoryConfig = DEFAULT_CATEGORY_CONFIG[cat.name as keyof typeof DEFAULT_CATEGORY_CONFIG];
          const newAllocated = amount * (categoryConfig?.allocation || 0.1);
          const newPercentage = newAllocated > 0 ? (cat.spent / newAllocated) * 100 : 0;
          
          return {
            ...cat,
            allocated: newAllocated,
            percentage: newPercentage,
            updatedAt: new Date()
          };
        });
        
        return {
          ...prev,
          budgetState: {
            ...prev.budgetState,
            monthlyBudget: amount,
            categories: updatedCategories
          }
        };
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        uiState: {
          ...prev.uiState,
          error: error instanceof Error ? error.message : 'Failed to update budget'
        }
      }));
      onError?.(error as Error);
    }
  }, [updateBudgetMutation, onError]);
  
  // Update category budget
  const updateCategoryBudget = useCallback(async (categoryId: string, amount: number) => {
    setState(prev => ({
      ...prev,
      budgetState: {
        ...prev.budgetState,
        categories: prev.budgetState.categories.map(cat => 
          cat.id === categoryId 
            ? {
                ...cat,
                allocated: amount,
                percentage: amount > 0 ? (cat.spent / amount) * 100 : 0,
                updatedAt: new Date()
              }
            : cat
        )
      }
    }));
  }, []);
  
  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setState(prev => ({
      ...prev,
      budgetState: {
        ...prev.budgetState,
        alerts: prev.budgetState.alerts.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        )
      }
    }));
  }, []);
  
  // Dismiss alert
  const dismissAlert = useCallback((alertId: string) => {
    setState(prev => ({
      ...prev,
      budgetState: {
        ...prev.budgetState,
        alerts: prev.budgetState.alerts.filter(alert => alert.id !== alertId)
      }
    }));
  }, []);
  
  // WebSocket subscription management
  const subscribe = useCallback((eventType: WebSocketMessageType) => {
    setState(prev => ({
      ...prev,
      websocketState: {
        ...prev.websocketState,
        subscriptions: [...prev.websocketState.subscriptions, eventType]
      }
    }));
  }, []);
  
  const unsubscribe = useCallback((eventType: WebSocketMessageType) => {
    setState(prev => ({
      ...prev,
      websocketState: {
        ...prev.websocketState,
        subscriptions: prev.websocketState.subscriptions.filter(sub => sub !== eventType)
      }
    }));
  }, []);
  
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!wsClient || !isConnected) {
      setState(prev => ({
        ...prev,
        websocketState: {
          ...prev.websocketState,
          messageQueue: [...prev.websocketState.messageQueue, message]
        }
      }));
      return;
    }
    
    // Send message via WebSocket
    // Note: Actual implementation would use tRPC WebSocket mutation
    console.log('Sending WebSocket message:', message);
  }, [wsClient, isConnected]);
  
  // Computed values
  const computed = useMemo(() => {
    const currentSession = state.receiptState.currentSession;
    const categories = state.budgetState.categories;
    const alerts = state.budgetState.alerts;
    
    return {
      totalItems: currentSession?.itemCount || 0,
      totalCost: currentSession?.total || 0,
      budgetUtilization: state.budgetState.monthlyBudget > 0 
        ? (categories.reduce((sum, cat) => sum + cat.spent, 0) / state.budgetState.monthlyBudget) * 100 
        : 0,
      activeAlerts: alerts.filter(alert => !alert.acknowledged),
      categoriesOverBudget: categories.filter(cat => cat.percentage >= 100),
      topCategories: [...categories].sort((a, b) => b.spent - a.spent).slice(0, 3),
      recentActivity: [
        ...(currentSession?.items || []).slice(-5),
        ...state.budgetState.spendingLogs.slice(-5)
      ].sort((a, b) => {
        const aTime = 'addedAt' in a ? a.addedAt : a.timestamp;
        const bTime = 'addedAt' in b ? b.addedAt : b.timestamp;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })
    };
  }, [state]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    state,
    actions: {
      searchProducts,
      clearSearch,
      selectProduct,
      addItem,
      updateItemQuantity,
      removeItem,
      clearReceipt,
      saveSession,
      loadSession,
      updateMonthlyBudget,
      updateCategoryBudget,
      acknowledgeAlert,
      dismissAlert,
      subscribe,
      unsubscribe,
      sendMessage
    },
    computed
  };
};