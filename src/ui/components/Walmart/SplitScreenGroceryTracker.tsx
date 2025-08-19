import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Save,
  Share2,
  ShoppingCart,
  DollarSign,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calculator,
  Target,
  Bell,
  Edit3,
  Eye,
  BarChart3,
  PieChart,
  Zap,
  Search,
  X,
  Calendar,
  Receipt,
  CreditCard
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Progress } from '../../../components/ui/progress';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../../client/lib/api';
import type { WalmartProduct } from '../../../types/walmart-grocery';

// Types based on backend API contract
interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  percentage: number;
  color: string;
  icon: string;
}

interface BudgetAlert {
  id: string;
  categoryId: string;
  categoryName: string;
  type: 'warning' | 'danger' | 'info';
  threshold: number;
  currentAmount: number;
  message: string;
  timestamp: Date;
}

interface ReceiptItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalPrice?: number;
  imageUrl: string;
  inStock: boolean;
  unit: string;
  sku?: string;
}

interface ReceiptSession {
  id: string;
  userId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'saved' | 'completed';
}

interface SpendingLog {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  timestamp: Date;
  type: 'expense' | 'budget_allocation';
}

interface SearchState {
  query: string;
  isSearching: boolean;
  results: WalmartProduct[];
  selectedProduct: WalmartProduct | null;
}

interface WebSocketMessage {
  type: 'item-added' | 'spending-updated' | 'alert' | 'budget-updated' | 'session-updated';
  data: any;
}

// Category configuration with colors and icons
const CATEGORY_CONFIG: Record<string, { color: string; icon: string; allocation: number }> = {
  'Fresh Produce': { color: 'bg-green-500', icon: '🥬', allocation: 0.25 },
  'Dairy & Eggs': { color: 'bg-blue-500', icon: '🥛', allocation: 0.15 },
  'Meat & Seafood': { color: 'bg-red-500', icon: '🥩', allocation: 0.20 },
  'Pantry': { color: 'bg-yellow-500', icon: '🥫', allocation: 0.20 },
  'Snacks': { color: 'bg-purple-500', icon: '🍿', allocation: 0.10 },
  'Other': { color: 'bg-gray-500', icon: '🛒', allocation: 0.10 }
};

export const SplitScreenGroceryTracker: React.FC = () => {
  // State management
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    isSearching: false,
    results: [],
    selectedProduct: null
  });
  
  const [receiptSession, setReceiptSession] = useState<ReceiptSession | null>(null);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState(monthlyBudget.toString());
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [spendingLogs, setSpendingLogs] = useState<SpendingLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const alertTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  
  // WebSocket connection
  const { client: wsClient, isConnected } = useWebSocket({
    onConnect: () => console.log('📡 Connected to grocery tracker WebSocket'),
    onDisconnect: () => console.log('📡 Disconnected from grocery tracker WebSocket'),
    onError: (error) => console.error('📡 WebSocket error:', error)
  });
  
  // Mock tRPC hooks (to be replaced with actual API endpoints)
  const searchProductsMutation = {
    mutateAsync: async (query: string): Promise<WalmartProduct[]> => {
      // Mock implementation - replace with actual tRPC call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return [
        {
          productId: 'prod_1',
          name: 'Organic Bananas (3 lbs)',
          category: 'Fresh Produce',
          price: 2.98,
          originalPrice: 3.48,
          imageUrl: '/api/placeholder/150/150',
          inStock: true,
          unit: 'bag',
          sku: 'BAN001',
          description: 'Fresh organic bananas'
        }
      ];
    },
    isPending: searchState.isSearching
  };
  
  const addReceiptItemMutation = {
    mutateAsync: async (item: Omit<ReceiptItem, 'id'>) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true, itemId: `item_${Date.now()}` };
    },
    isPending: false
  };
  
  const updateBudgetCategoriesMutation = {
    mutateAsync: async (categories: BudgetCategory[]) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    },
    isPending: false
  };
  
  // Initialize budget categories
  useEffect(() => {
    const initializeCategories = () => {
      const categories: BudgetCategory[] = Object.entries(CATEGORY_CONFIG).map(([name, config]) => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        allocated: monthlyBudget * config.allocation,
        spent: 0,
        percentage: 0,
        color: config.color,
        icon: config.icon
      }));
      setBudgetCategories(categories);
    };
    
    initializeCategories();
  }, [monthlyBudget]);
  
  // Initialize receipt session
  useEffect(() => {
    const initSession: ReceiptSession = {
      id: `session_${Date.now()}`,
      userId: 'current_user',
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      itemCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };
    setReceiptSession(initSession);
  }, []);
  
  // WebSocket message handling
  useEffect(() => {
    if (!wsClient || !isConnected) return;
    
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      switch (message.type) {
        case 'item-added':
          // Handle real-time item additions
          break;
        case 'spending-updated':
          // Handle spending updates
          break;
        case 'alert':
          // Handle budget alerts
          const alert: BudgetAlert = message.data;
          setBudgetAlerts(prev => [...prev, alert]);
          showAlertNotification(alert);
          break;
        case 'budget-updated':
          // Handle budget changes
          break;
        case 'session-updated':
          // Handle session updates
          break;
      }
    };
    
    // Note: Actual WebSocket subscription would be implemented here
    console.log('🔔 WebSocket message handler registered');
    
  }, [wsClient, isConnected]);
  
  // Product search functionality
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchState(prev => ({ ...prev, results: [] }));
      return;
    }
    
    setSearchState(prev => ({ ...prev, isSearching: true, query }));
    
    try {
      const results = await searchProductsMutation.mutateAsync(query);
      setSearchState(prev => ({
        ...prev,
        results,
        isSearching: false
      }));
    } catch (error) {
      console.error('Search failed:', error);
      setError('Failed to search products');
      setSearchState(prev => ({ ...prev, isSearching: false }));
    }
  }, [searchProductsMutation]);
  
  // Add item to receipt
  const addItemToReceipt = useCallback(async (product: WalmartProduct, quantity: number = 1) => {
    if (!receiptSession) return;
    
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
      sku: product.sku
    };
    
    try {
      await addReceiptItemMutation.mutateAsync(receiptItem);
      
      const updatedSession: ReceiptSession = {
        ...receiptSession,
        items: [...receiptSession.items, receiptItem],
        itemCount: receiptSession.items.length + 1,
        updatedAt: new Date()
      };
      
      // Recalculate totals
      const subtotal = updatedSession.items.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * 0.0875; // 8.75% tax rate
      const total = subtotal + tax;
      
      updatedSession.subtotal = subtotal;
      updatedSession.tax = tax;
      updatedSession.total = total;
      
      setReceiptSession(updatedSession);
      
      // Update category spending
      updateCategorySpending(product.category, receiptItem.totalPrice);
      
      // Clear search
      setSearchState(prev => ({ ...prev, query: '', results: [], selectedProduct: null }));
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
      
    } catch (error) {
      console.error('Failed to add item:', error);
      setError('Failed to add item to receipt');
    }
  }, [receiptSession, addReceiptItemMutation]);
  
  // Update category spending
  const updateCategorySpending = useCallback((categoryName: string, amount: number) => {
    setBudgetCategories(prev => prev.map(cat => {
      if (cat.name === categoryName) {
        const newSpent = cat.spent + amount;
        const newPercentage = cat.allocated > 0 ? (newSpent / cat.allocated) * 100 : 0;
        
        // Check for budget alerts
        if (newPercentage >= 90 && cat.percentage < 90) {
          const alert: BudgetAlert = {
            id: `alert_${Date.now()}`,
            categoryId: cat.id,
            categoryName: cat.name,
            type: newPercentage >= 100 ? 'danger' : 'warning',
            threshold: newPercentage >= 100 ? 100 : 90,
            currentAmount: newSpent,
            message: newPercentage >= 100 
              ? `Budget exceeded for ${cat.name}! You're over by $${(newSpent - cat.allocated).toFixed(2)}`
              : `Approaching budget limit for ${cat.name}. ${(100 - newPercentage).toFixed(1)}% remaining.`,
            timestamp: new Date()
          };
          setBudgetAlerts(prev => [...prev, alert]);
          showAlertNotification(alert);
        }
        
        return {
          ...cat,
          spent: newSpent,
          percentage: newPercentage
        };
      }
      return cat;
    }));
  }, []);
  
  // Show alert notification
  const showAlertNotification = useCallback((alert: BudgetAlert) => {
    setShowAlerts(true);
    
    // Auto-hide alert after 5 seconds
    const timeout = setTimeout(() => {
      setBudgetAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 5000);
    
    alertTimeoutRef.current.push(timeout);
  }, []);
  
  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, newQuantity: number) => {
    if (!receiptSession) return;
    
    const updatedItems = receiptSession.items.map(item => {
      if (item.id === itemId) {
        const updatedItem = {
          ...item,
          quantity: Math.max(0, newQuantity),
          totalPrice: item.unitPrice * Math.max(0, newQuantity)
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
    const tax = subtotal * 0.0875;
    const total = subtotal + tax;
    
    setReceiptSession({
      ...receiptSession,
      items: updatedItems,
      itemCount: updatedItems.length,
      subtotal,
      tax,
      total,
      updatedAt: new Date()
    });
  }, [receiptSession, updateCategorySpending]);
  
  // Remove item from receipt
  const removeItem = useCallback((itemId: string) => {
    if (!receiptSession) return;
    
    const itemToRemove = receiptSession.items.find(item => item.id === itemId);
    if (!itemToRemove) return;
    
    // Update category spending (subtract)
    updateCategorySpending(itemToRemove.category, -itemToRemove.totalPrice);
    
    const updatedItems = receiptSession.items.filter(item => item.id !== itemId);
    const subtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.0875;
    const total = subtotal + tax;
    
    setReceiptSession({
      ...receiptSession,
      items: updatedItems,
      itemCount: updatedItems.length,
      subtotal,
      tax,
      total,
      updatedAt: new Date()
    });
  }, [receiptSession, updateCategorySpending]);
  
  // Update monthly budget
  const handleBudgetUpdate = useCallback(async () => {
    const newBudget = parseFloat(newBudgetAmount);
    if (isNaN(newBudget) || newBudget <= 0) {
      setError('Please enter a valid budget amount');
      return;
    }
    
    setMonthlyBudget(newBudget);
    setEditingBudget(false);
    
    // Recalculate category allocations
    const updatedCategories = budgetCategories.map(cat => {
      const categoryConfig = CATEGORY_CONFIG[cat.name];
      const newAllocated = newBudget * (categoryConfig?.allocation || 0.1);
      const newPercentage = newAllocated > 0 ? (cat.spent / newAllocated) * 100 : 0;
      
      return {
        ...cat,
        allocated: newAllocated,
        percentage: newPercentage
      };
    });
    
    try {
      await updateBudgetCategoriesMutation.mutateAsync(updatedCategories);
      setBudgetCategories(updatedCategories);
    } catch (error) {
      console.error('Failed to update budget:', error);
      setError('Failed to update budget categories');
    }
  }, [newBudgetAmount, budgetCategories, updateBudgetCategoriesMutation]);
  
  // Clear receipt
  const clearReceipt = useCallback(() => {
    if (!receiptSession) return;
    
    setReceiptSession({
      ...receiptSession,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      itemCount: 0,
      updatedAt: new Date()
    });
    
    // Reset category spending
    setBudgetCategories(prev => prev.map(cat => ({
      ...cat,
      spent: 0,
      percentage: 0
    })));
  }, [receiptSession]);
  
  // Calculate overall budget metrics
  const overallMetrics = useMemo(() => {
    const totalSpent = budgetCategories.reduce((sum, cat) => sum + cat.spent, 0);
    const remaining = monthlyBudget - totalSpent;
    const percentage = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
    const mostSpentCategory = budgetCategories.reduce((max, cat) => 
      cat.spent > max.spent ? cat : max, budgetCategories[0] || { spent: 0, name: 'None' });
    
    return {
      totalSpent,
      remaining,
      percentage,
      mostSpentCategory: mostSpentCategory?.name || 'None',
      isOverBudget: totalSpent > monthlyBudget
    };
  }, [budgetCategories, monthlyBudget]);
  
  // Get progress bar color based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  // Group items by category for display
  const groupedItems = useMemo(() => {
    if (!receiptSession) return {};
    
    return receiptSession.items.reduce((groups, item) => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {} as Record<string, ReceiptItem[]>);
  }, [receiptSession]);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      alertTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  if (!receiptSession) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing grocery tracker...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Grocery Tracker</h1>
            <Badge variant="secondary" className="ml-2">
              {receiptSession.itemCount} items
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-1" />
              Save Session
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-6 mt-4 rounded">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <div className="mx-6 mt-4 space-y-2">
          {budgetAlerts.slice(-3).map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border-l-4 ${
                alert.type === 'danger' ? 'bg-red-50 border-red-500' :
                alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className={`h-4 w-4 ${
                    alert.type === 'danger' ? 'text-red-500' :
                    alert.type === 'warning' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    alert.type === 'danger' ? 'text-red-800' :
                    alert.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {alert.message}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBudgetAlerts(prev => prev.filter(a => a.id !== alert.id))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Main Content - Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE - Grocery Receipt */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col">
          {/* Product Search */}
          <div className="p-6 bg-white border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search products to add..."
                value={searchState.query}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchState(prev => ({ ...prev, query }));
                  if (query.length > 2) {
                    handleSearch(query);
                  }
                }}
                className="pl-10 pr-4"
                disabled={searchState.isSearching}
              />
              {searchState.isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            
            {/* Search Results */}
            {searchState.results.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto border rounded-lg bg-white">
                {searchState.results.map(product => (
                  <div
                    key={product.productId}
                    className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => addItemToReceipt(product)}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </h4>
                        <p className="text-xs text-gray-500">{product.category}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-green-600">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-xs text-gray-500 line-through">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Receipt Items */}
          <div className="flex-1 overflow-y-auto bg-white">
            {receiptSession.items.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Receipt className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
                  <p className="text-gray-600">Search for products above to start building your list</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{CATEGORY_CONFIG[category]?.icon || '🛒'}</span>
                      <h3 className="font-semibold text-gray-800">{category}</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {items.length} items
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                            <p className="text-sm text-gray-600">
                              ${item.unitPrice.toFixed(2)} per {item.unit}
                            </p>
                            {item.originalPrice && item.originalPrice > item.unitPrice && (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-green-600">
                                  Save ${(item.originalPrice - item.unitPrice).toFixed(2)}
                                </Badge>
                              </div>
                            )}
                          </div>
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              ${item.totalPrice.toFixed(2)}
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Receipt Totals */}
          {receiptSession.items.length > 0 && (
            <div className="border-t border-gray-200 bg-white p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${receiptSession.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (8.75%):</span>
                  <span className="font-medium">${receiptSession.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>${receiptSession.total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={clearReceipt} className="flex-1">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
                <Button className="flex-1">
                  <CreditCard className="h-4 w-4 mr-1" />
                  Checkout
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* RIGHT PANE - Budget Tracker */}
        <div className="w-1/2 bg-white flex flex-col">
          {/* Budget Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">Budget Tracker</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>This Month</span>
              </div>
            </div>
            
            {/* Monthly Budget */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Monthly Budget</span>
                  </div>
                  {editingBudget ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={newBudgetAmount}
                        onChange={(e) => setNewBudgetAmount(e.target.value)}
                        className="w-24 h-8 text-right"
                        step="0.01"
                        min="0"
                      />
                      <Button size="sm" onClick={handleBudgetUpdate}>
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingBudget(false);
                          setNewBudgetAmount(monthlyBudget.toString());
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingBudget(true)}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      ${monthlyBudget.toFixed(2)}
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Progress
                    value={Math.min(overallMetrics.percentage, 100)}
                    className="h-3"
                  />
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Spent: <span className="font-medium">${overallMetrics.totalSpent.toFixed(2)}</span>
                    </span>
                    <span className={overallMetrics.isOverBudget ? "text-red-600 font-medium" : "text-gray-600"}>
                      {overallMetrics.isOverBudget ? "Over budget: " : "Remaining: "}
                      <span className="font-medium">${Math.abs(overallMetrics.remaining).toFixed(2)}</span>
                    </span>
                  </div>
                  
                  {overallMetrics.percentage >= 90 && (
                    <div className={`flex items-center gap-2 p-2 rounded text-sm ${
                      overallMetrics.isOverBudget ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        {overallMetrics.isOverBudget
                          ? "You've exceeded your monthly budget!"
                          : "You're approaching your budget limit"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Category Breakdown */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">Category Breakdown</h3>
              <div className="text-sm text-gray-600">
                Most spent: <span className="font-medium text-gray-800">{overallMetrics.mostSpentCategory}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {budgetCategories.map(category => (
                <Card key={category.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{category.icon}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{category.name}</h4>
                          <p className="text-sm text-gray-600">
                            ${category.spent.toFixed(2)} / ${category.allocated.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          category.percentage >= 100 ? 'text-red-600' :
                          category.percentage >= 90 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {category.percentage.toFixed(1)}%
                        </div>
                        {category.percentage >= 100 && (
                          <div className="text-xs text-red-600">
                            Over by ${(category.spent - category.allocated).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="relative">
                      <Progress
                        value={Math.min(category.percentage, 100)}
                        className="h-2"
                      />
                      <div
                        className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${
                          getProgressColor(category.percentage)
                        }`}
                        style={{
                          width: `${Math.min(category.percentage, 100)}%`
                        }}
                      />
                    </div>
                    
                    {/* Progress indicators */}
                    <div className="flex justify-between mt-2">
                      <div className="flex items-center gap-1">
                        {category.percentage >= 90 && (
                          <div className={`w-2 h-2 rounded-full ${
                            category.percentage >= 100 ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                        )}
                        {category.percentage < 90 && (
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {category.percentage < 100
                          ? `$${(category.allocated - category.spent).toFixed(2)} left`
                          : 'Budget exceeded'
                        }
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Budget Insights */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Budget Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget utilization:</span>
                    <span className="font-medium">{overallMetrics.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Categories over 90%:</span>
                    <span className="font-medium">
                      {budgetCategories.filter(cat => cat.percentage >= 90).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average per category:</span>
                    <span className="font-medium">
                      ${(overallMetrics.totalSpent / budgetCategories.length).toFixed(2)}
                    </span>
                  </div>
                  
                  {overallMetrics.percentage < 80 && (
                    <div className="p-2 bg-green-50 rounded text-green-700 text-xs">
                      <Target className="h-3 w-3 inline mr-1" />
                      You're doing great! Keep up the good spending habits.
                    </div>
                  )}
                  
                  {overallMetrics.percentage >= 80 && overallMetrics.percentage < 90 && (
                    <div className="p-2 bg-yellow-50 rounded text-yellow-700 text-xs">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Consider reviewing your remaining purchases this month.
                    </div>
                  )}
                  
                  {overallMetrics.percentage >= 90 && (
                    <div className="p-2 bg-red-50 rounded text-red-700 text-xs">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      You're close to or over budget. Consider adjusting your spending.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};