/**
 * Walmart Grocery Agent Type Definitions
 * Defines all types related to Walmart grocery shopping functionality
 */

// Product types
export interface WalmartProduct {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  category: string;
  subcategory?: string;
  department?: string;
  price: number;
  originalPrice?: number;
  savings?: number;
  unit: string;
  size?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  barcode?: string;
  inStock: boolean;
  stockLevel?: number;
  storeId?: string;
  location?: {
    aisle?: string;
    section?: string;
    shelf?: string;
  };
  ratings?: {
    average: number;
    count: number;
  };
  nutritionalInfo?: Record<string, any>;
  allergens?: string[];
  isOrganic?: boolean;
  isGlutenFree?: boolean;
  isVegan?: boolean;
}

// Search options
export interface SearchOptions {
  query: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  storeId?: string;
  sortBy?: 'price_low' | 'price_high' | 'relevance' | 'rating' | 'newest';
  dietary?: string[];
  limit?: number;
  offset?: number;
}

// Grocery list types
export interface GroceryList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  items: GroceryItem[];
  totalEstimate: number;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  isShared?: boolean;
  sharedWith?: string[];
}

export interface GroceryItem {
  id: string;
  listId: string;
  productId: string;
  product?: WalmartProduct;
  quantity: number;
  notes?: string;
  isPurchased: boolean;
  addedAt: Date;
  purchasedAt?: Date;
  customItem?: boolean;
  customName?: string;
  estimatedPrice?: number;
}

// Shopping session types
export interface ShoppingSession {
  id: string;
  userId: string;
  listId?: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  currentLocation?: {
    aisle?: string;
    section?: string;
  };
  itemsScanned: number;
  totalAmount: number;
  storeId: string;
}

// Cart types
export interface ShoppingCart {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  fees: number;
  discounts: number;
  total: number;
  appliedCoupons?: Coupon[];
  appliedDeals?: DealMatch[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;
  product?: WalmartProduct;
  quantity: number;
  price: number;
  discountedPrice?: number;
  appliedDeals?: string[];
  addedAt: Date;
}

// Deal matching types
export type DealType = 'percentage' | 'fixed' | 'bogo' | 'bundle' | 'FLASH_SALE' | 'CLEARANCE' | 'BUNDLE' | 'PRICE_DROP';

export interface DealMatch {
  dealId: string;
  dealName: string;
  dealType: DealType;
  discount: number;
  requirements?: {
    minQuantity?: number;
    minAmount?: number;
    validProducts?: string[];
  };
  savings: number;
  validUntil?: Date;
  product?: WalmartProduct;
  productId?: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount: number;
  type: 'percentage' | 'fixed';
  minPurchase?: number;
  validUntil: Date;
  isStackable: boolean;
}

// Substitution types
export interface SubstitutionOptions {
  maxPriceDifference?: number;
  preferSameBrand?: boolean;
  preferLargerSize?: boolean;
  dietaryRestrictions?: string[];
  maxResults?: number;
}

export interface Substitution {
  originalProductId: string;
  substituteProductId: string;
  reason: string;
  priceDifference: number;
  sizeComparison?: string;
  confidence: number;
}

// User preferences
export interface UserPreferences {
  userId: string;
  preferredBrands?: string[];
  dietaryRestrictions?: string[];
  allergens?: string[];
  budgetLimit?: number;
  preferOrganic?: boolean;
  preferGeneric?: boolean;
  avoidProducts?: string[];
  favoriteProducts?: string[];
  defaultStoreId?: string;
  deliveryPreferences?: {
    preferredDays?: string[];
    preferredTimes?: string[];
    leaveAtDoor?: boolean;
  };
}

// Price tracking
export interface PriceHistory {
  productId: string;
  prices: PricePoint[];
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  currentTrend: 'rising' | 'falling' | 'stable';
}

export interface PricePoint {
  price: number;
  date: Date;
  wasOnSale: boolean;
  salePercentage?: number;
}

// Order types
export interface Order {
  id: string;
  userId: string;
  orderNumber?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  fees: number;
  deliveryFee?: number;
  tip?: number;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  orderDate: Date;
  createdAt: Date;
  updatedAt?: Date;
  deliveryDate?: Date;
  deliverySlot?: string;
  deliveryAddress?: Address | string;
  paymentMethod?: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  product: WalmartProduct;
  quantity: number;
  price: number;
  substituted?: boolean;
  substitutionId?: string;
}

export interface Address {
  street: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  instructions?: string;
}

export interface DeliverySlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  price: number;
  type: 'standard' | 'express' | 'scheduled' | 'pickup' | 'delivery';
}

export interface DeliveryOptions {
  type: 'pickup' | 'delivery';
  address?: Address;
  instructions?: string;
  timeSlot?: DeliverySlot;
  recurring?: RecurringSchedule;
}

export interface RecurringSchedule {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date;
  active: boolean;
}

// Analytics types
export interface ShoppingAnalytics {
  userId: string;
  period: 'week' | 'month' | 'year';
  totalSpent: number;
  totalSaved: number;
  itemsPurchased: number;
  favoriteCategories: CategoryCount[];
  favoriteBrands: BrandCount[];
  priceComparison: {
    vsLastPeriod: number;
    vsAverage: number;
  };
  savingsBreakdown: {
    coupons: number;
    deals: number;
    substitutions: number;
  };
}

export interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

export interface BrandCount {
  brand: string;
  count: number;
  percentage: number;
}

// Notification types
export interface DealNotification extends DealMatch {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  originalPrice?: number;
  currentPrice?: number;
  category: string;
  isNew?: boolean;
  expiresAt?: Date;
  productName?: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  productId: string;
  targetPrice: number;
  currentPrice: number;
  created: Date;
  triggered?: Date;
  status: 'active' | 'triggered' | 'expired';
}

export interface DealAlert {
  id: string;
  userId: string;
  category?: string;
  keywords?: string[];
  minDiscount?: number;
  created: Date;
  expiresAt?: Date;
}

export interface AlertSettings {
  enabled: boolean;
  minSavings: number;
  minPercentage: number;
  categories: string[];
  alertTypes: ('flash-sale' | 'clearance' | 'bundle' | 'price-drop')[];
  frequency: 'instant' | 'hourly' | 'daily';
}

// API Response types
export interface WalmartApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    timestamp: Date;
    requestId: string;
    cached?: boolean;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}