/**
 * Type definitions for Split Screen Grocery Tracker
 * Interfaces for budget tracking, receipt management, and real-time WebSocket events
 */

import type { WalmartProduct } from './walmart-grocery';

// Budget Management Types
export interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  percentage: number;
  color: string;
  icon: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BudgetAlert {
  id: string;
  categoryId: string;
  categoryName: string;
  type: 'warning' | 'danger' | 'info';
  threshold: number;
  currentAmount: number;
  message: string;
  timestamp: Date;
  acknowledged?: boolean;
  autoHide?: boolean;
}

export interface SpendingLog {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  description: string;
  timestamp: Date;
  type: 'expense' | 'budget_allocation' | 'adjustment';
  itemId?: string;
  receiptId?: string;
  metadata?: Record<string, any>;
}

// Receipt Management Types
export interface ReceiptItem {
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
  notes?: string;
  addedAt: Date;
  modifiedAt?: Date;
}

export interface ReceiptSession {
  id: string;
  userId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'saved' | 'completed' | 'cancelled';
  name?: string;
  notes?: string;
  metadata?: {
    location?: string;
    storeName?: string;
    paymentMethod?: string;
    couponsUsed?: string[];
    loyaltyDiscount?: number;
  };
}

export interface ReceiptState {
  currentSession: ReceiptSession | null;
  savedSessions: ReceiptSession[];
  recentItems: ReceiptItem[];
  favoriteItems: ReceiptItem[];
  isLoading: boolean;
  error: string | null;
}

// Search and Product Types
export interface SearchState {
  query: string;
  isSearching: boolean;
  results: WalmartProduct[];
  selectedProduct: WalmartProduct | null;
  filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    onSale?: boolean;
  };
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface ProductSearchOptions {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'price' | 'name' | 'relevance' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

// WebSocket Event Types
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
}

export type WebSocketMessageType =
  | 'item-added'
  | 'item-removed'
  | 'item-updated'
  | 'quantity-changed'
  | 'spending-updated'
  | 'budget-alert'
  | 'budget-updated'
  | 'category-updated'
  | 'session-updated'
  | 'session-saved'
  | 'session-shared'
  | 'price-change'
  | 'product-availability'
  | 'connection-status'
  | 'sync-state';

// WebSocket Event Data Types
export interface ItemAddedEvent {
  item: ReceiptItem;
  sessionId: string;
  totalChange: number;
  categoryImpact: {
    categoryId: string;
    newSpent: number;
    newPercentage: number;
  };
}

export interface SpendingUpdatedEvent {
  categoryId: string;
  categoryName: string;
  oldAmount: number;
  newAmount: number;
  difference: number;
  newPercentage: number;
  alertTriggered?: BudgetAlert;
}

export interface BudgetAlertEvent {
  alert: BudgetAlert;
  triggerEvent: 'threshold_reached' | 'budget_exceeded' | 'manual';
  affectedItems?: string[];
}

export interface PriceChangeEvent {
  productId: string;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  affectedItems: string[];
  savings: number;
}

// Budget Analysis Types
export interface BudgetMetrics {
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationPercentage: number;
  categoriesOverBudget: number;
  categoriesNearLimit: number;
  averageSpendingPerCategory: number;
  projectedMonthEnd: number;
  mostSpentCategory: {
    id: string;
    name: string;
    amount: number;
    percentage: number;
  };
  leastSpentCategory: {
    id: string;
    name: string;
    amount: number;
    percentage: number;
  };
  spendingVelocity: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface CategoryInsight {
  categoryId: string;
  categoryName: string;
  insight: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  actionable: boolean;
  recommendation?: string;
  impact: 'low' | 'medium' | 'high';
}

export interface BudgetRecommendation {
  id: string;
  type: 'reallocation' | 'increase' | 'decrease' | 'optimization';
  title: string;
  description: string;
  fromCategory?: string;
  toCategory?: string;
  suggestedAmount: number;
  potentialSavings?: number;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
}

// Component State Types
export interface GroceryTrackerState {
  searchState: SearchState;
  receiptState: ReceiptState;
  budgetState: {
    monthlyBudget: number;
    categories: BudgetCategory[];
    alerts: BudgetAlert[];
    spendingLogs: SpendingLog[];
    metrics: BudgetMetrics;
    insights: CategoryInsight[];
    recommendations: BudgetRecommendation[];
  };
  uiState: {
    editingBudget: boolean;
    showAlerts: boolean;
    activeView: 'split' | 'receipt-only' | 'budget-only';
    sidebarCollapsed: boolean;
    loading: boolean;
    error: string | null;
  };
  websocketState: {
    connected: boolean;
    reconnecting: boolean;
    lastMessage?: WebSocketMessage;
    messageQueue: WebSocketMessage[];
    subscriptions: string[];
  };
}

// API Response Types
export interface BudgetCategoriesResponse {
  categories: BudgetCategory[];
  total: number;
  success: boolean;
  error?: string;
}

export interface ReceiptSessionResponse {
  session: ReceiptSession;
  success: boolean;
  error?: string;
}

export interface SpendingLogsResponse {
  logs: SpendingLog[];
  total: number;
  page: number;
  totalPages: number;
  success: boolean;
  error?: string;
}

export interface BudgetAlertsResponse {
  alerts: BudgetAlert[];
  unacknowledged: number;
  success: boolean;
  error?: string;
}

// Hook Return Types
export interface UseGroceryTrackerReturn {
  state: GroceryTrackerState;
  actions: {
    // Search actions
    searchProducts: (options: ProductSearchOptions) => Promise<void>;
    clearSearch: () => void;
    selectProduct: (product: WalmartProduct) => void;
    
    // Receipt actions
    addItem: (product: WalmartProduct, quantity?: number) => Promise<void>;
    updateItemQuantity: (itemId: string, quantity: number) => void;
    removeItem: (itemId: string) => void;
    clearReceipt: () => void;
    saveSession: (name?: string) => Promise<void>;
    loadSession: (sessionId: string) => Promise<void>;
    
    // Budget actions
    updateMonthlyBudget: (amount: number) => Promise<void>;
    updateCategoryBudget: (categoryId: string, amount: number) => Promise<void>;
    acknowledgeAlert: (alertId: string) => void;
    dismissAlert: (alertId: string) => void;
    
    // WebSocket actions
    subscribe: (eventType: WebSocketMessageType) => void;
    unsubscribe: (eventType: WebSocketMessageType) => void;
    sendMessage: (message: WebSocketMessage) => void;
  };
  computed: {
    totalItems: number;
    totalCost: number;
    budgetUtilization: number;
    activeAlerts: BudgetAlert[];
    categoriesOverBudget: BudgetCategory[];
    topCategories: BudgetCategory[];
    recentActivity: (ReceiptItem | SpendingLog)[];
  };
}

// Configuration Types
export interface GroceryTrackerConfig {
  defaultBudgetAmount: number;
  taxRate: number;
  categoryAllocations: Record<string, number>;
  alertThresholds: {
    warning: number;
    danger: number;
  };
  websocket: {
    url: string;
    reconnectDelay: number;
    maxReconnectAttempts: number;
  };
  features: {
    enableRealTimePricing: boolean;
    enableBudgetInsights: boolean;
    enableSessionSharing: boolean;
    enableVoiceSearch: boolean;
    enableBarcodeScan: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    animationsEnabled: boolean;
    autoSave: boolean;
    autoSaveInterval: number;
  };
}

// Error Types
export interface GroceryTrackerError {
  code: string;
  message: string;
  category: 'network' | 'validation' | 'budget' | 'receipt' | 'websocket';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  context?: Record<string, any>;
  retryable: boolean;
}

// Export all types for external use
export type {
  WalmartProduct
} from './walmart-grocery';

// Constants
export const DEFAULT_CATEGORY_CONFIG = {
  'Fresh Produce': { color: 'bg-green-500', icon: '🥬', allocation: 0.25 },
  'Dairy & Eggs': { color: 'bg-blue-500', icon: '🥛', allocation: 0.15 },
  'Meat & Seafood': { color: 'bg-red-500', icon: '🥩', allocation: 0.20 },
  'Pantry': { color: 'bg-yellow-500', icon: '🥫', allocation: 0.20 },
  'Snacks': { color: 'bg-purple-500', icon: '🍿', allocation: 0.10 },
  'Other': { color: 'bg-gray-500', icon: '🛒', allocation: 0.10 }
} as const;

export const ALERT_THRESHOLDS = {
  WARNING: 90,
  DANGER: 100,
  INFO: 75
} as const;

export const TAX_RATES = {
  DEFAULT: 0.0875, // 8.75%
  CALIFORNIA: 0.0975,
  TEXAS: 0.0825,
  NEW_YORK: 0.08,
  FLORIDA: 0.06
} as const;