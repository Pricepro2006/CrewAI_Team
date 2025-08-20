/**
 * TypeScript interfaces for Walmart Grocery Agent components
 * Comprehensive type definitions for API integration and component props
 */

// Core Data Types
export interface WalmartProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  savings?: number;
  inStock: boolean;
  imageUrl: string;
  category: string;
  unit: string;
  description?: string;
  brand?: string;
  storeId?: string;
  storeName?: string;
  lastUpdated?: string;
  priceHistory?: PriceHistoryPoint[];
  nutritionInfo?: NutritionInfo;
  availability?: ProductAvailability;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  source?: string;
}

export interface NutritionInfo {
  calories?: number;
  servingSize?: string;
  ingredients?: string[];
  allergens?: string[];
  nutritionFacts?: Record<string, unknown>;
}

export interface ProductAvailability {
  inStock: boolean;
  quantity?: number;
  estimatedRestockDate?: string;
  storeLocation?: string;
}

// Search and Query Types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sortBy?: 'price' | 'name' | 'relevance' | 'savings';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  category?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  brands?: string[];
  stores?: string[];
}

export interface SearchResult {
  query: string;
  totalResults: number;
  products: WalmartProduct[];
  filters?: SearchFilters;
  timestamp: Date;
  suggestions?: string[];
  metadata?: SearchMetadata;
}

export interface SearchMetadata {
  processingTime: number;
  source: 'api' | 'cache' | 'hybrid';
  confidence: number;
  alternatives?: string[];
}

// NLP Processing Types
export interface NLPQuery {
  text: string;
  sessionId?: string;
  userId?: string;
  context?: NLPContext;
}

export interface NLPContext {
  previousQueries?: string[];
  currentCart?: CartItem[];
  userPreferences?: UserPreferences;
  location?: UserLocation;
}

export interface NLPResult {
  intent: NLPIntent;
  entities: NLPEntity[];
  confidence: number;
  processedQuery: string;
  suggestedActions?: SuggestedAction[];
  productMatches?: WalmartProduct[];
  clarificationNeeded?: boolean;
  clarificationQuestions?: string[];
}

export interface NLPIntent {
  type: 'search' | 'add_to_cart' | 'compare' | 'price_check' | 'availability' | 'nutrition' | 'substitute';
  confidence: number;
  parameters?: Record<string, unknown>;
}

export interface NLPEntity {
  type: 'product' | 'brand' | 'category' | 'price' | 'quantity' | 'store';
  value: string;
  confidence: number;
  position?: {
    start: number;
    end: number;
  };
}

export interface SuggestedAction {
  type: 'search' | 'add_to_cart' | 'view_product' | 'compare' | 'set_alert';
  label: string;
  data: unknown;
  confidence: number;
}

// Cart and List Management Types
export interface CartItem {
  id: string;
  productId: string;
  product: WalmartProduct;
  quantity: number;
  addedAt: Date;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface GroceryList {
  id: string;
  name: string;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean;
  collaborators?: string[];
  budget?: number;
  totalCost: number;
  estimatedSavings: number;
  status: 'active' | 'completed' | 'archived';
  dueDate?: Date;
  tags?: string[];
}

// User Preferences and Profile Types
export interface UserPreferences {
  favoriteStores?: string[];
  dietaryRestrictions?: string[];
  preferredBrands?: string[];
  budgetAlerts?: boolean;
  priceAlertThreshold?: number;
  preferredUnits?: Record<string, string>;
  shoppingHistory?: ShoppingHistoryItem[];
}

export interface ShoppingHistoryItem {
  productId: string;
  purchaseDate: Date;
  quantity: number;
  price: number;
  store: string;
}

export interface UserLocation {
  zipCode: string;
  city?: string;
  state?: string;
  nearbyStores?: StoreInfo[];
}

export interface StoreInfo {
  id: string;
  name: string;
  address: string;
  distance?: number;
  isOpen?: boolean;
  hours?: StoreHours[];
}

export interface StoreHours {
  day: string;
  open: string;
  close: string;
}

// Price Alert Types
export interface PriceAlert {
  id: string;
  productId: string;
  product: WalmartProduct;
  targetPrice: number;
  currentPrice: number;
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
  userId: string;
  notificationMethod: 'email' | 'push' | 'sms';
}

// WebSocket Types
export interface WSMessage {
  type: 'nlp_processing' | 'nlp_result' | 'cart_update' | 'price_update' | 'product_match' | 'error' | 'notification';
  data: unknown;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export interface WSNLPProcessingData {
  status: 'started' | 'processing' | 'completed' | 'error';
  query: string;
  progress?: number;
  stage?: string;
}

export interface WSPriceUpdateData {
  productId: string;
  oldPrice: number;
  newPrice: number;
  store: string;
  timestamp: string;
}

export interface WSCartUpdateData {
  action: 'add' | 'remove' | 'update' | 'clear';
  item?: CartItem;
  items?: CartItem[];
  totalCost: number;
}

// Component Props Types
export interface WalmartAgentProps {
  initialTab?: 'shopping' | 'hybrid-search' | 'list-tracker' | 'price-history' | 'live-pricing';
  userId?: string;
  className?: string;
}

export interface NLPSearchProps {
  onSearch: (query: string) => void;
  onResult: (result: NLPResult) => void;
  isProcessing?: boolean;
  placeholder?: string;
  showSuggestions?: boolean;
  showHistory?: boolean;
  className?: string;
}

export interface ProductListProps {
  products: WalmartProduct[];
  selectedItems?: Set<string>;
  onToggleSelection?: (productId: string) => void;
  onAddToCart?: (product: WalmartProduct, quantity: number) => void;
  onSetPriceAlert?: (productId: string, targetPrice: number) => void;
  loading?: boolean;
  virtualized?: boolean;
  itemHeight?: number;
  className?: string;
}

export interface GroceryListProps {
  list?: GroceryList;
  onUpdateList?: (list: GroceryList) => void;
  onAddItem?: (item: CartItem) => void;
  onRemoveItem?: (itemId: string) => void;
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
  budget?: number;
  onUpdateBudget?: (budget: number) => void;
  className?: string;
}

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface SearchAPIResponse extends APIResponse<SearchResult> {
  data: SearchResult;
}

export interface NLPAPIResponse extends APIResponse<NLPResult> {
  data: NLPResult;
}

export interface ProductAPIResponse extends APIResponse<WalmartProduct> {
  data: WalmartProduct;
}

// Error Types
export interface WalmartError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

// Stats and Analytics Types
export interface WalmartStats {
  productsTracked: number;
  savedThisMonth: number;
  activeAlerts: number;
  totalSearches: number;
  averageOrderValue: number;
  topCategories: CategoryStats[];
  priceChanges: PriceChangeStats;
}

export interface CategoryStats {
  category: string;
  itemCount: number;
  totalSpent: number;
  averagePrice: number;
}

export interface PriceChangeStats {
  increased: number;
  decreased: number;
  unchanged: number;
  totalTracked: number;
}

// Service Health Types
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  errors?: string[];
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceHealth[];
  timestamp: string;
}

// Performance and Monitoring Types
export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  connections: number;
  requestsPerMinute: number;
}

// List Total Calculation Types
export interface ListTotalCalculation {
  subtotal: number;
  tax: number;
  fees: number;
  discounts: number;
  total: number;
  itemCount: number;
  estimatedWeight: number;
  itemSavings?: number;
  couponSavings?: number;
  loyaltyDiscounts?: number;
  bulkSavings?: number;
}

// Product Item Types for Lists
export interface ProductItem extends WalmartProduct {
  quantity?: number;
  selected?: boolean;
  notes?: string;
  addedDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

// Additional utility types for enhanced components
export interface ExtendedWalmartProduct extends WalmartProduct {
  rating?: number;
  reviewCount?: number;
  deliveryInfo?: {
    available: boolean;
    estimatedDays: number;
    cost?: number;
  };
  nutritionalInfo?: NutritionInfo;
  substitutes?: WalmartProduct[];
  trend?: 'up' | 'down' | 'stable';
  priceChange?: number;
  currentPrice?: number;
}

// Connection status types for WebSocket components
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// Enhanced search query types
export interface EnhancedSearchQuery extends SearchQuery {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  brand?: string;
  minRating?: number;
}