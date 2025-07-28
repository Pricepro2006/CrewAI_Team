/**
 * Walmart Grocery Agent TypeScript Interfaces
 * Comprehensive type definitions for all Walmart grocery-related functionality
 *
 * Integration Coordinator: Type-safe data models for the Walmart grocery ecosystem
 */

import type {
  Timestamp,
  ApiResponse,
  TimestampedEntity,
  PaginationRequest,
  PaginationResponse,
} from "../shared/types/index.js";

// =====================================================
// Core Product Types
// =====================================================

export interface WalmartProduct extends TimestampedEntity {
  id: string;
  walmartId: string;
  upc?: string;
  ean?: string;
  gtin?: string;
  name: string;
  brand: string;
  category: ProductCategory;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  price: ProductPrice;
  images: ProductImage[];
  nutritionFacts?: NutritionFacts;
  ingredients?: string[];
  allergens?: Allergen[];
  specifications?: ProductSpecification[];
  availability: ProductAvailability;
  ratings?: ProductRatings;
  variants?: ProductVariant[];
  bundleComponents?: BundleComponent[];
  metadata: ProductMetadata;
  
  // Additional properties for service compatibility
  unit?: string;
  size?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  barcode?: string;
  inStock?: boolean;
  stockLevel?: number;
  stock?: number;
  originalPrice?: number;
  averageRating?: number;
  reviewCount?: number;
  location?: string;
  nutritionalInfo?: any;
}

export interface ProductCategory {
  id: string;
  name: string;
  path: string[];
  level: number;
  parentId?: string;
}

export interface ProductPrice {
  currency: string;
  regular: number;
  sale?: number;
  unit?: number;
  unitOfMeasure?: string;
  pricePerUnit?: string;
  wasPrice?: number;
  rollback?: boolean;
  clearance?: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface ProductImage {
  id: string;
  url: string;
  type: "primary" | "secondary" | "thumbnail" | "zoom";
  width?: number;
  height?: number;
  alt?: string;
}

export interface NutritionFacts {
  servingSize: string;
  servingsPerContainer?: number;
  calories: number;
  nutrients: Nutrient[];
}

export interface Nutrient {
  name: string;
  amount: number;
  unit: string;
  dailyValue?: number;
}

export interface Allergen {
  type: AllergenType;
  contains: boolean;
  mayContain: boolean;
}

export type AllergenType =
  | "milk"
  | "eggs"
  | "fish"
  | "shellfish"
  | "tree_nuts"
  | "peanuts"
  | "wheat"
  | "soybeans"
  | "sesame";

export interface ProductSpecification {
  name: string;
  value: string;
  group?: string;
}

export interface ProductAvailability {
  inStock: boolean;
  stockLevel?: "in_stock" | "low_stock" | "out_of_stock";
  quantity?: number;
  nextAvailable?: Timestamp;
  locations?: StoreAvailability[];
  onlineOnly?: boolean;
  instoreOnly?: boolean;
}

export interface StoreAvailability {
  storeId: string;
  storeName: string;
  inStock: boolean;
  quantity?: number;
  aisle?: string;
  price?: ProductPrice;
}

export interface ProductRatings {
  average: number;
  count: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  reviews?: Review[];
}

export interface Review {
  id: string;
  rating: number;
  title?: string;
  text: string;
  author: string;
  date: Timestamp;
  verified: boolean;
  helpful: number;
  unhelpful: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  type: string;
  value: string;
  productId: string;
  priceDelta?: number;
  available: boolean;
}

export interface BundleComponent {
  productId: string;
  quantity: number;
  required: boolean;
}

export interface ProductMetadata {
  source: "api" | "scrape" | "manual";
  lastScraped?: Timestamp;
  confidence?: number;
  dealEligible?: boolean;
  substitutes?: string[];
  relatedProducts?: string[];
  tags?: string[];
}

// =====================================================
// Shopping Cart Types
// =====================================================

export interface ShoppingCart extends TimestampedEntity {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  fees: CartFees;
  discounts: Discount[];
  total: number;
  savedForLater: CartItem[];
  metadata: CartMetadata;
}

export interface CartItem {
  id: string;
  productId: string;
  product?: WalmartProduct;
  quantity: number;
  price: number;
  originalPrice?: number;
  savings?: number;
  substitutionPreference?: SubstitutionPreference;
  notes?: string;
  addedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SubstitutionPreference {
  allow: boolean;
  preferences?: {
    brandOnly?: boolean;
    sizeFlexibility?: "exact" | "smaller_ok" | "larger_ok" | "any";
    maxPriceDifference?: number;
  };
}

export interface CartFees {
  delivery?: number;
  service?: number;
  tip?: number;
  bags?: number;
  other?: Record<string, number>;
}

export interface Discount {
  id: string;
  type: "coupon" | "promo" | "deal" | "loyalty" | "employee";
  code?: string;
  description: string;
  amount: number;
  percentage?: number;
  appliedTo: "cart" | "item" | "shipping";
  itemIds?: string[];
  conditions?: DiscountConditions;
}

export interface DiscountConditions {
  minPurchase?: number;
  maxDiscount?: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
  firstTimeOnly?: boolean;
  combinable?: boolean;
}

export interface CartMetadata {
  sessionId?: string;
  deviceType?: string;
  abandoned?: boolean;
  reminderSent?: boolean;
  source?: "web" | "mobile" | "api";
  experienceType?: "pickup" | "delivery" | "shipping";
}

// =====================================================
// Order Management Types
// =====================================================

export interface Order extends TimestampedEntity {
  id: string;
  orderId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  payment: PaymentInfo;
  fulfillment: FulfillmentInfo;
  totals: OrderTotals;
  timeline: OrderEvent[];
  customer: CustomerInfo;
  metadata: OrderMetadata;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "in_transit"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

export interface OrderItem extends CartItem {
  status: "pending" | "confirmed" | "substituted" | "unavailable" | "refunded";
  substitution?: {
    originalProductId: string;
    reason: string;
    priceDifference: number;
  };
  fulfillmentMethod?: "pickup" | "delivery" | "shipping";
}

export interface PaymentInfo {
  method: PaymentMethod;
  status: "pending" | "authorized" | "captured" | "failed" | "refunded";
  amount: number;
  transactionId?: string;
  last4?: string;
  cardType?: string;
}

export type PaymentMethod =
  | "credit_card"
  | "debit_card"
  | "walmart_pay"
  | "paypal"
  | "ebt"
  | "gift_card"
  | "cash";

export interface FulfillmentInfo {
  method: "pickup" | "delivery" | "shipping";
  status: FulfillmentStatus;
  location?: StoreLocation;
  address?: DeliveryAddress;
  scheduledTime?: TimeSlot;
  actualTime?: Timestamp;
  tracking?: TrackingInfo;
}

export type FulfillmentStatus =
  | "scheduled"
  | "preparing"
  | "ready"
  | "in_transit"
  | "delivered"
  | "failed";

export interface StoreLocation {
  storeId: string;
  name: string;
  address: Address;
  phone: string;
  hours: StoreHours[];
  services: string[];
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface DeliveryAddress extends Address {
  instructions?: string;
  type?: "residential" | "business";
  accessCode?: string;
}

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  price?: number;
}

export interface TrackingInfo {
  carrier?: string;
  trackingNumber?: string;
  status: string;
  estimatedDelivery?: Timestamp;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  timestamp: Timestamp;
  status: string;
  location?: string;
  description: string;
}

export interface OrderTotals {
  subtotal: number;
  tax: number;
  fees: Record<string, number>;
  discounts: number;
  tip?: number;
  total: number;
  savings: number;
}

export interface OrderEvent {
  timestamp: Timestamp;
  type: string;
  description: string;
  actor?: "system" | "customer" | "shopper" | "support";
  metadata?: Record<string, unknown>;
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  walmartRewards?: {
    number: string;
    points: number;
    tier: string;
  };
}

export interface OrderMetadata {
  source: "web" | "mobile" | "api" | "in_store";
  deviceId?: string;
  ipAddress?: string;
  experienceVersion?: string;
  abTests?: Record<string, string>;
}

// =====================================================
// Store and Inventory Types
// =====================================================

export interface Store {
  id: string;
  number: string;
  name: string;
  type: "supercenter" | "neighborhood_market" | "express";
  location: StoreLocation;
  services: StoreService[];
  departments: Department[];
  features: string[];
  metrics?: StoreMetrics;
}

export interface StoreService {
  name: string;
  available: boolean;
  hours?: StoreHours[];
  fees?: Record<string, number>;
}

export interface StoreHours {
  dayOfWeek: number;
  open: string;
  close: string;
  special?: string;
}

export interface Department {
  id: string;
  name: string;
  aisles: string[];
  categories: string[];
}

export interface StoreMetrics {
  averageRating?: number;
  totalOrders?: number;
  fulfillmentRate?: number;
  averageWaitTime?: number;
}

// =====================================================
// Search and Discovery Types
// =====================================================

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sort?: SortOptions;
  pagination?: PaginationRequest;
  context?: SearchContext;
}

export interface SearchFilters {
  categories?: string[];
  brands?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  ratings?: number;
  availability?: "all" | "in_stock" | "online" | "store";
  dietary?: DietaryFilter[];
  features?: string[];
  storeId?: string;
}

export type DietaryFilter =
  | "organic"
  | "gluten_free"
  | "vegan"
  | "vegetarian"
  | "kosher"
  | "halal"
  | "non_gmo"
  | "sugar_free"
  | "lactose_free";

export interface SortOptions {
  field: "price" | "rating" | "popularity" | "name" | "newest";
  direction: "asc" | "desc";
}

export interface SearchContext {
  userId?: string;
  location?: {
    zipCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  previousQueries?: string[];
  sessionId?: string;
}

export interface SearchResults extends PaginationResponse<WalmartProduct> {
  query: string;
  suggestions?: SearchSuggestion[];
  facets?: SearchFacet[];
  relatedSearches?: string[];
  spellCheck?: {
    original: string;
    corrected: string;
    confidence: number;
  };
}

export interface SearchSuggestion {
  text: string;
  type: "product" | "category" | "brand" | "query";
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface SearchFacet {
  name: string;
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

// =====================================================
// Recommendations and Personalization Types
// =====================================================

export interface RecommendationRequest {
  userId: string;
  type: RecommendationType;
  context?: RecommendationContext;
  limit?: number;
}

export type RecommendationType =
  | "personalized"
  | "trending"
  | "deals"
  | "new_arrivals"
  | "frequently_bought"
  | "similar_items"
  | "cart_based"
  | "reorder";

export interface RecommendationContext {
  currentCart?: string[];
  viewingProduct?: string;
  category?: string;
  occasion?: string;
  dietary?: DietaryFilter[];
  budget?: number;
}

export interface RecommendationResponse {
  type: RecommendationType;
  products: RecommendedProduct[];
  reasoning?: string;
  metadata?: {
    algorithm: string;
    confidence: number;
    personalized: boolean;
  };
}

export interface RecommendedProduct extends WalmartProduct {
  recommendationScore: number;
  reason: string;
  tags?: string[];
}

// =====================================================
// Deals and Promotions Types
// =====================================================

export interface Deal {
  id: string;
  type: DealType;
  title: string;
  description: string;
  terms?: string[];
  products: DealProduct[];
  discount: DealDiscount;
  validity: DealValidity;
  restrictions?: DealRestrictions;
  metadata: DealMetadata;
}

export type DealType =
  | "rollback"
  | "clearance"
  | "bundle"
  | "bogo"
  | "percentage_off"
  | "dollar_off"
  | "loyalty"
  | "seasonal";

export interface DealProduct {
  productId: string;
  originalPrice: number;
  dealPrice: number;
  savings: number;
  quantity?: number;
}

export interface DealDiscount {
  type: "percentage" | "fixed" | "bogo" | "bundle";
  value: number;
  conditions?: string[];
}

export interface DealValidity {
  startDate: Timestamp;
  endDate: Timestamp;
  daysRemaining?: number;
  limitedTime?: boolean;
  whileSuppliesLast?: boolean;
}

export interface DealRestrictions {
  minPurchase?: number;
  maxQuantity?: number;
  memberOnly?: boolean;
  firstTimeOnly?: boolean;
  categories?: string[];
  excludedItems?: string[];
}

export interface DealMetadata {
  featured: boolean;
  priority: number;
  tags: string[];
  performance?: {
    views: number;
    conversions: number;
    revenue: number;
  };
}

// =====================================================
// Analytics and Reporting Types
// =====================================================

export interface UserAnalytics {
  userId: string;
  period: AnalyticsPeriod;
  shopping: ShoppingAnalytics;
  savings: SavingsAnalytics;
  preferences: PreferenceAnalytics;
  behavior: BehaviorAnalytics;
}

export interface AnalyticsPeriod {
  start: Timestamp;
  end: Timestamp;
  granularity: "day" | "week" | "month" | "year";
}

export interface ShoppingAnalytics {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  frequentCategories: CategoryCount[];
  frequentProducts: ProductCount[];
  preferredFulfillment: Record<string, number>;
}

export interface CategoryCount {
  category: string;
  count: number;
  spending: number;
}

export interface ProductCount {
  productId: string;
  name: string;
  count: number;
  lastOrdered: Timestamp;
}

export interface SavingsAnalytics {
  totalSaved: number;
  couponsUsed: number;
  dealsUtilized: number;
  rollbackSavings: number;
  loyaltySavings: number;
  savingsRate: number;
}

export interface PreferenceAnalytics {
  dietaryPreferences: DietaryFilter[];
  brandPreferences: BrandPreference[];
  priceRanges: Record<string, { min: number; max: number }>;
  shoppingTimes: TimePreference[];
}

export interface BrandPreference {
  brand: string;
  affinity: number;
  categories: string[];
}

export interface TimePreference {
  dayOfWeek: number;
  hourOfDay: number;
  frequency: number;
}

export interface BehaviorAnalytics {
  searchPatterns: SearchPattern[];
  cartAbandonment: {
    rate: number;
    averageValue: number;
    commonReasons: string[];
  };
  browsingHistory: BrowsingEvent[];
  conversionFunnel: ConversionStep[];
}

export interface SearchPattern {
  query: string;
  frequency: number;
  leadToConversion: boolean;
  relatedProducts: string[];
}

export interface BrowsingEvent {
  productId: string;
  timestamp: Timestamp;
  duration: number;
  action: "view" | "add_to_cart" | "save" | "purchase";
}

export interface ConversionStep {
  step: string;
  count: number;
  dropoffRate: number;
  averageTime: number;
}

// =====================================================
// Integration Event Types
// =====================================================

export interface WalmartEvent {
  id: string;
  type: WalmartEventType;
  timestamp: Timestamp;
  userId?: string;
  data: unknown;
  metadata?: EventMetadata;
}

export type WalmartEventType =
  | "product.viewed"
  | "product.searched"
  | "cart.updated"
  | "cart.abandoned"
  | "order.placed"
  | "order.updated"
  | "order.delivered"
  | "deal.activated"
  | "recommendation.clicked"
  | "substitution.accepted"
  | "substitution.rejected";

export interface EventMetadata {
  source: string;
  version: string;
  correlationId?: string;
  sessionId?: string;
  deviceId?: string;
}

// =====================================================
// Error Types
// =====================================================

export interface WalmartError {
  code: WalmartErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Timestamp;
  retryable?: boolean;
  retryAfter?: number;
}

export type WalmartErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "INVALID_QUANTITY"
  | "PRICE_CHANGED"
  | "CART_EXPIRED"
  | "PAYMENT_FAILED"
  | "DELIVERY_UNAVAILABLE"
  | "STORE_CLOSED"
  | "RATE_LIMITED"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_REQUEST"
  | "SERVER_ERROR";

// =====================================================
// API Response Types
// =====================================================

export type WalmartApiResponse<T> = ApiResponse<T> & {
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: Timestamp;
  };
};

// =====================================================
// Utility Types
// =====================================================

export type DeepPartialWalmart<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartialWalmart<T[P]> : T[P];
};

export type WalmartEntityMap = {
  product: WalmartProduct;
  cart: ShoppingCart;
  order: Order;
  store: Store;
  deal: Deal;
  user: CustomerInfo;
};
