/**
 * Type definitions for Price Alert System
 */

export interface DealAlert {
  id: string;
  userId: string;
  
  // Alert identification and metadata
  alertName: string;
  alertDescription?: string;
  alertType: 'price_drop' | 'stock_alert' | 'sale_alert' | 'coupon_alert' | 'seasonal_alert' | 'custom';
  
  // Product targeting
  productName?: string;
  productBrand?: string;
  productCategory?: string;
  upcCode?: string;
  sku?: string;
  keywords?: string[];
  exactMatchRequired?: boolean;
  
  // Price thresholds and conditions
  targetPrice?: number;
  priceDropPercentage?: number;
  priceDropAmount?: number;
  maximumAcceptablePrice?: number;
  minimumQualityThreshold?: number;
  
  // Store and availability preferences
  preferredStores?: string[];
  excludedStores?: string[];
  onlineDealsIncluded?: boolean;
  inStoreDealsIncluded?: boolean;
  requireImmediateAvailability?: boolean;
  
  // Alert timing and frequency
  alertFrequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  alertDays?: string[];
  
  // Alert status and lifecycle
  status?: 'active' | 'paused' | 'expired' | 'fulfilled' | 'cancelled';
  priority?: number;
  maxAlertsPerDay?: number;
  alertsSentToday?: number;
  lastResetDate?: string;
  
  // Expiration and auto-management
  expirationDate?: string;
  autoExpireAfterDays?: number;
  autoPauseIfNotFoundDays?: number;
  autoDeleteAfterFulfillment?: boolean;
  
  // Notification preferences
  notificationMethods?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
  
  // Advanced conditions
  conditions?: any;
  seasonalRestrictions?: any;
  quantityRequirements?: any;
  
  // Tracking and analytics
  timesTriggered?: number;
  timesClicked?: number;
  timesPurchased?: number;
  totalSavingsGenerated?: number;
  lastTriggeredAt?: string;
  lastPriceSeen?: number;
  lastAvailabilityCheck?: string;
  
  // Learning and optimization
  effectivenessScore?: number;
  userSatisfactionRating?: number;
  autoOptimizationEnabled?: boolean;
  
  // Metadata and customization
  tags?: string[];
  notes?: string;
  customWebhookUrl?: string;
  metadata?: any;
  
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface DealNotification {
  id: string;
  alertId: string;
  userId: string;
  
  // Notification details
  notificationType: 'email' | 'push' | 'sms' | 'webhook' | 'in_app';
  subject?: string;
  messageContent?: string;
  
  // Deal information
  productName: string;
  productBrand?: string;
  productCategory?: string;
  storeName?: string;
  originalPrice?: number;
  salePrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  
  // Availability and urgency
  availabilityStatus?: 'available' | 'limited' | 'low_stock' | 'out_of_stock';
  urgencyLevel?: 'low' | 'normal' | 'high' | 'urgent';
  dealExpiresAt?: string;
  stockLevel?: number;
  
  // Delivery status
  sentAt: string;
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  deliveryAttemptCount?: number;
  deliveredAt?: string;
  readAt?: string;
  clickedAt?: string;
  
  // User interaction
  wasClicked?: boolean;
  wasPurchased?: boolean;
  purchaseAmount?: number;
  userFeedback?: string;
  userRating?: number;
  
  // External references
  dealUrl?: string;
  couponCode?: string;
  promotionId?: string;
  externalDealId?: string;
  
  // Error handling
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  
  // Metadata
  deviceType?: string;
  locationContext?: any;
  metadata?: any;
  
  createdAt: string;
  updatedAt: string;
}

export interface TrackedDeal {
  id: string;
  sourceId: string;
  
  // Deal identification
  externalDealId?: string;
  dealUrl?: string;
  productName: string;
  productBrand?: string;
  productCategory?: string;
  upcCode?: string;
  sku?: string;
  
  // Store and availability
  storeName: string;
  storeLocation?: string;
  availabilityStatus?: 'available' | 'limited' | 'out_of_stock' | 'unknown';
  stockQuantity?: number;
  
  // Pricing
  currentPrice: number;
  originalPrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  priceHistory?: Array<{ date: string; price: number }>;
  
  // Timing
  dealStartsAt?: string;
  dealExpiresAt?: string;
  lastUpdatedAt?: string;
  isExpired?: boolean;
  
  // Quality and metadata
  dealQualityScore?: number;
  popularityScore?: number;
  tags?: string[];
  description?: string;
  
  // Analytics
  matchingAlertsCount?: number;
  notificationsSent?: number;
  clicksGenerated?: number;
  purchasesGenerated?: number;
  
  // Validation
  isValidated?: boolean;
  validationConfidence?: number;
  validationNotes?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface PriceChangeEvent {
  productId: string;
  productName: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  percentageChange: number;
  timestamp: string;
  storeName?: string;
  triggeredAlerts?: string[];
}

export interface AlertAnalytics {
  totalAlerts: number;
  activeAlerts: number;
  totalTriggers: number;
  totalClicks: number;
  totalPurchases: number;
  totalSavings: number;
  avgEffectiveness: number;
}

export interface CreateAlertRequest {
  alertName: string;
  alertType: DealAlert['alertType'];
  productName?: string;
  productBrand?: string;
  productCategory?: string;
  upcCode?: string;
  targetPrice?: number;
  priceDropPercentage?: number;
  priceDropAmount?: number;
  alertFrequency?: DealAlert['alertFrequency'];
  notificationMethods?: string[];
  conditions?: any;
}

export interface UpdateAlertRequest {
  alertName?: string;
  alertDescription?: string;
  targetPrice?: number;
  priceDropPercentage?: number;
  priceDropAmount?: number;
  alertFrequency?: DealAlert['alertFrequency'];
  notificationMethods?: string[];
  status?: DealAlert['status'];
  priority?: number;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  webhookEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  alertDays?: string[];
  maxAlertsPerDay?: number;
}