/**
 * Walmart Grocery WebSocket Event Architecture
 * Real-time event definitions for Walmart grocery operations
 *
 * Integration Coordinator: Event-driven architecture for real-time updates
 */

import type { WebSocketMessage, Timestamp } from "../shared/types/websocket.js";

import type {
  WalmartProduct,
  ShoppingCart,
  CartItem,
  Order,
  OrderStatus,
  Deal,
  WalmartError,
  StoreAvailability,
  TimeSlot,
  RecommendedProduct,
} from "./walmart-grocery.js";

// =====================================================
// Walmart-Specific Event Types
// =====================================================

export type WalmartWebSocketEventType =
  // Product events
  | "walmart.product?.price_change"
  | "walmart.product?.availability_change"
  | "walmart.product?.new_review"
  | "walmart.product?.deal_started"
  | "walmart.product?.deal_ended"
  // Cart events
  | "walmart.cart?.item_added"
  | "walmart.cart?.item_updated"
  | "walmart.cart?.item_removed"
  | "walmart.cart?.price_updated"
  | "walmart.cart?.abandoned_reminder"
  | "walmart.cart?.merged"
  | "walmart.cart?.cleared"
  // Order events
  | "walmart.order?.placed"
  | "walmart.order?.confirmed"
  | "walmart.order?.preparing"
  | "walmart.order?.ready"
  | "walmart.order?.picked_up"
  | "walmart.order?.out_for_delivery"
  | "walmart.order?.delivered"
  | "walmart.order?.cancelled"
  | "walmart.order?.refunded"
  | "walmart.order?.substitution"
  // Store events
  | "walmart.store?.inventory_update"
  | "walmart.store?.hours_change"
  | "walmart.store?.service_update"
  | "walmart.store?.closure"
  // Delivery events
  | "walmart.delivery?.slot_available"
  | "walmart.delivery?.slot_unavailable"
  | "walmart.delivery?.driver_assigned"
  | "walmart.delivery?.eta_update"
  // Search events
  | "walmart.search?.trending"
  | "walmart.search?.suggestion"
  | "walmart.search?.completed"
  // Recommendation events
  | "walmart.recommendation?.generated"
  | "walmart.recommendation?.updated"
  // Deal events
  | "walmart.deal?.new"
  | "walmart.deal?.expiring"
  | "walmart.deal?.activated"
  | "walmart.deal?.expired"
  // Scraping events
  | "walmart.scraping?.started"
  | "walmart.scraping?.progress"
  | "walmart.scraping?.completed"
  | "walmart.scraping?.failed"
  // System events
  | "walmart.sync?.started"
  | "walmart.sync?.completed"
  | "walmart.sync?.failed";

// =====================================================
// Product Event Data
// =====================================================

export interface WalmartProductPriceChangeEvent {
  productId: string;
  product: Partial<WalmartProduct>;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  reason?: "rollback" | "sale" | "clearance" | "regular_price_change";
  effectiveDate: Timestamp;
  expiryDate?: Timestamp;
}

export interface WalmartProductAvailabilityChangeEvent {
  productId: string;
  product: Partial<WalmartProduct>;
  availability: {
    previous: StoreAvailability[];
    current: StoreAvailability[];
  };
  affectedStores: string[];
  reason?: "restock" | "sold_out" | "discontinued" | "seasonal";
}

export interface WalmartProductReviewEvent {
  productId: string;
  reviewId: string;
  rating: number;
  review: {
    title?: string;
    text: string;
    author: string;
    verified: boolean;
  };
  newAverageRating: number;
  totalReviews: number;
}

export interface WalmartProductDealEvent {
  productId: string;
  dealId: string;
  dealType: "started" | "ended";
  deal: Partial<Deal>;
  savings: {
    amount: number;
    percentage: number;
  };
}

// =====================================================
// Cart Event Data
// =====================================================

export interface WalmartCartItemEvent {
  cartId: string;
  userId: string;
  action: "added" | "updated" | "removed";
  item: CartItem;
  previousQuantity?: number;
  cart: {
    itemCount: number;
    subtotal: number;
    total: number;
    savings: number;
  };
}

export interface WalmartCartPriceUpdateEvent {
  cartId: string;
  userId: string;
  items: Array<{
    productId: string;
    oldPrice: number;
    newPrice: number;
    reason: string;
  }>;
  totals: {
    oldSubtotal: number;
    newSubtotal: number;
    oldTotal: number;
    newTotal: number;
  };
}

export interface WalmartCartAbandonedEvent {
  cartId: string;
  userId: string;
  abandonedAt: Timestamp;
  cart: ShoppingCart;
  reminderNumber: number;
  potentialRevenue: number;
}

export interface WalmartCartMergedEvent {
  userId: string;
  sourceCartId: string;
  targetCartId: string;
  mergedItems: CartItem[];
  duplicatesResolved: number;
  newTotal: number;
}

// =====================================================
// Order Event Data
// =====================================================

export interface WalmartOrderStatusEvent {
  orderId: string;
  userId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  timestamp: Timestamp;
  order: Partial<Order>;
  metadata?: {
    location?: string;
    estimatedTime?: Timestamp;
    actualTime?: Timestamp;
  };
}

export interface WalmartOrderSubstitutionEvent {
  orderId: string;
  userId: string;
  originalItem: CartItem;
  substitutedItem: CartItem;
  reason: string;
  priceDifference: number;
  requiresApproval: boolean;
  approvalDeadline?: Timestamp;
}

export interface WalmartOrderDeliveryEvent {
  orderId: string;
  userId: string;
  type: "driver_assigned" | "eta_update" | "delivered";
  driver?: {
    name: string;
    phone?: string;
    vehicleInfo?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    lastUpdate: Timestamp;
  };
  estimatedArrival?: Timestamp;
  proof?: {
    photo?: string;
    signature?: string;
    notes?: string;
  };
}

// =====================================================
// Store Event Data
// =====================================================

export interface WalmartStoreInventoryEvent {
  storeId: string;
  updates: Array<{
    productId: string;
    previousQuantity: number;
    currentQuantity: number;
    status: "in_stock" | "low_stock" | "out_of_stock";
  }>;
  timestamp: Timestamp;
  nextUpdate?: Timestamp;
}

export interface WalmartStoreServiceEvent {
  storeId: string;
  service: string;
  status: "available" | "unavailable" | "limited";
  reason?: string;
  estimatedResolution?: Timestamp;
  affectedOrders?: string[];
}

export interface WalmartStoreClosureEvent {
  storeId: string;
  type: "temporary" | "permanent" | "emergency";
  reason: string;
  closureTime: Timestamp;
  reopenTime?: Timestamp;
  alternativeStores: Array<{
    storeId: string;
    distance: number;
    available: boolean;
  }>;
}

// =====================================================
// Delivery Event Data
// =====================================================

export interface WalmartDeliverySlotEvent {
  type: "available" | "unavailable";
  slots: TimeSlot[];
  storeId: string;
  date: string;
  reason?: string;
  affectedUsers?: number;
}

export interface WalmartDeliveryETAEvent {
  orderId: string;
  userId: string;
  previousETA: Timestamp;
  newETA: Timestamp;
  reason: string;
  driverLocation?: {
    latitude: number;
    longitude: number;
  };
  stopsRemaining?: number;
}

// =====================================================
// Search and Recommendation Event Data
// =====================================================

export interface WalmartSearchTrendingEvent {
  trends: Array<{
    query: string;
    category?: string;
    volume: number;
    change: number;
    relatedProducts: string[];
  }>;
  region?: string;
  timeframe: string;
}

export interface WalmartSearchCompletedEvent {
  userId: string;
  sessionId: string;
  query: string;
  results: {
    count: number;
    categories: string[];
    topProducts: string[];
  };
  executionTime: number;
  cached: boolean;
}

export interface WalmartRecommendationEvent {
  userId: string;
  type: "generated" | "updated";
  recommendations: RecommendedProduct[];
  trigger: string;
  algorithm: string;
  confidence: number;
}

// =====================================================
// Deal Event Data
// =====================================================

export interface WalmartDealNewEvent {
  dealId: string;
  deal: Deal;
  affectedProducts: string[];
  estimatedDemand: number;
  notificationsSent: number;
}

export interface WalmartDealExpiringEvent {
  dealId: string;
  expiresIn: number; // minutes
  deal: Partial<Deal>;
  activeUsers: number;
  potentialLostRevenue: number;
}

export interface WalmartDealActivatedEvent {
  dealId: string;
  userId: string;
  appliedTo: "cart" | "order";
  savings: number;
  stackedWith?: string[];
}

// =====================================================
// Scraping Event Data
// =====================================================

export interface WalmartScrapingProgressEvent {
  taskId: string;
  status: "started" | "in_progress" | "completed" | "failed";
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  type: "product" | "search" | "category" | "deals";
  url?: string;
  itemsProcessed?: number;
  errors?: WalmartError[];
}

// =====================================================
// Sync Event Data
// =====================================================

export interface WalmartSyncEvent {
  syncId: string;
  type: "started" | "completed" | "failed";
  scope: "products" | "inventory" | "prices" | "deals" | "all";
  stats?: {
    itemsProcessed: number;
    itemsUpdated: number;
    itemsAdded: number;
    itemsRemoved: number;
    errors: number;
  };
  duration?: number;
  nextSync?: Timestamp;
  error?: WalmartError;
}

// =====================================================
// Event Message Types
// =====================================================

export type WalmartWebSocketMessage<T = unknown> = WebSocketMessage<T> & {
  type: WalmartWebSocketEventType;
  storeId?: string;
  region?: string;
};

// =====================================================
// Channel Definitions
// =====================================================

export const WALMART_CHANNELS = {
  // Public channels
  PUBLIC_DEALS: "walmart.public?.deals",
  PUBLIC_TRENDING: "walmart.public?.trending",

  // Store-specific channels
  STORE_UPDATES: (storeId: string) => `walmart.store.${storeId}`,
  STORE_INVENTORY: (storeId: string) => `walmart.store.${storeId}.inventory`,
  STORE_DELIVERY: (storeId: string) => `walmart.store.${storeId}.delivery`,

  // User-specific channels
  USER_CART: (userId: string) => `walmart.user.${userId}.cart`,
  USER_ORDERS: (userId: string) => `walmart.user.${userId}.orders`,
  USER_RECOMMENDATIONS: (userId: string) =>
    `walmart.user.${userId}.recommendations`,
  USER_NOTIFICATIONS: (userId: string) =>
    `walmart.user.${userId}.notifications`,

  // Product channels
  PRODUCT_UPDATES: (productId: string) => `walmart.product.${productId}`,
  CATEGORY_UPDATES: (category: string) => `walmart.category.${category}`,

  // System channels
  SYSTEM_HEALTH: "walmart.system?.health",
  SYSTEM_SYNC: "walmart.system?.sync",
  SYSTEM_SCRAPING: "walmart.system?.scraping",
} as const;

// =====================================================
// Event Subscription Types
// =====================================================

export interface WalmartEventSubscription {
  channels: string[];
  events?: WalmartWebSocketEventType[];
  filters?: WalmartEventFilters;
  userId?: string;
  storeIds?: string[];
}

export interface WalmartEventFilters {
  productIds?: string[];
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  dealTypes?: string[];
  orderStatuses?: OrderStatus[];
  regions?: string[];
}

// =====================================================
// Event Handler Types
// =====================================================

export type WalmartEventHandler<T = unknown> = (
  event: WalmartWebSocketMessage<T>,
  context: WalmartEventContext,
) => Promise<void> | void;

export interface WalmartEventContext {
  userId?: string;
  sessionId: string;
  connectionId: string;
  permissions: string[];
  metadata: Record<string, unknown>;
}

// =====================================================
// Event Emitter Configuration
// =====================================================

export interface WalmartEventEmitterConfig {
  maxListeners: number;
  eventTTL: number;
  queueSize: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    multiplier: number;
  };
  persistence: {
    enabled: boolean;
    ttl: number;
    storage: "memory" | "redis" | "database";
  };
}

// =====================================================
// Batch Event Types
// =====================================================

export interface WalmartBatchEvent<T> {
  batchId: string;
  events: WalmartWebSocketMessage<T>[];
  timestamp: Timestamp;
  compressed?: boolean;
  checksum?: string;
}

// =====================================================
// Event Metrics
// =====================================================

export interface WalmartEventMetrics {
  eventType: WalmartWebSocketEventType;
  count: number;
  errorCount: number;
  averageProcessingTime: number;
  lastOccurrence: Timestamp;
  subscribers: number;
}
