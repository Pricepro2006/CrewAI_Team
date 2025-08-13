import { EventEmitter } from 'node:events';
import { sentryErrorTracker } from './SentryErrorTracker.js';
import { logger } from '../utils/logger.js';

// Metric interfaces
export interface NLPParsingMetrics {
  totalQueries: number;
  successfulParses: number;
  failedParses: number;
  averageConfidence: number;
  commonFailureReasons: Record<string, number>;
  parseTimeMs: number;
}

export interface ProductMatchingMetrics {
  totalSearches: number;
  exactMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  averageConfidence: number;
  averageSearchTimeMs: number;
  topSearchTerms: Array<{ term: string; count: number }>;
  categoryDistribution: Record<string, number>;
}

export interface PriceFetchMetrics {
  totalRequests: number;
  successfulFetches: number;
  failedFetches: number;
  averageResponseTimeMs: number;
  priceUnavailableCount: number;
  storeAvailability: Record<string, number>;
  apiErrorTypes: Record<string, number>;
}

export interface DealDetectionMetrics {
  totalProducts: number;
  dealsFound: number;
  dealTypes: Record<string, number>;
  averageSavings: number;
  detectionTimeMs: number;
  falsePositives: number;
  missedDeals: number;
}

export interface UserSessionMetrics {
  totalSessions: number;
  averageSessionDuration: number;
  queriesPerSession: number;
  bounceRate: number;
  conversionRate: number;
  topFeatures: Record<string, number>;
  deviceTypes: Record<string, number>;
}

export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionErrors: number;
  messagesSent: number;
  messagesReceived: number;
  averageConnectionDuration: number;
  reconnectionRate: number;
}

export interface BusinessKPIMetrics {
  totalUsers: number;
  activeUsers: number;
  listCreationRate: number;
  itemAdditionRate: number;
  purchaseCompletionRate: number;
  customerSatisfactionScore: number;
  revenueImpact: number;
}

export class GroceryAgentMetrics extends EventEmitter {
  private nlpMetrics: NLPParsingMetrics;
  private productMetrics: ProductMatchingMetrics;
  private priceMetrics: PriceFetchMetrics;
  private dealMetrics: DealDetectionMetrics;
  private sessionMetrics: UserSessionMetrics;
  private websocketMetrics: WebSocketMetrics;
  private businessMetrics: BusinessKPIMetrics;

  private metricSnapshots: Array<{
    timestamp: Date;
    snapshot: Record<string, any>;
  }> = [];

  private alertThresholds = {
    nlpSuccessRate: 0.85, // 85% minimum success rate
    productMatchRate: 0.8, // 80% minimum match rate
    priceSuccessRate: 0.9, // 90% minimum price fetch success
    dealDetectionRate: 0.7, // 70% minimum deal detection
    sessionBounceRate: 0.3, // 30% maximum bounce rate
    websocketErrorRate: 0.05, // 5% maximum error rate
    responseTimeMs: 2000, // 2s maximum response time
  };

  constructor() {
    super();
    this.initializeMetrics();
    this.setupPeriodicSnapshots();
    this.setupAlertMonitoring();
  }

  private initializeMetrics(): void {
    this.nlpMetrics = {
      totalQueries: 0,
      successfulParses: 0,
      failedParses: 0,
      averageConfidence: 0,
      commonFailureReasons: {},
      parseTimeMs: 0,
    };

    this.productMetrics = {
      totalSearches: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      noMatches: 0,
      averageConfidence: 0,
      averageSearchTimeMs: 0,
      topSearchTerms: [],
      categoryDistribution: {},
    };

    this.priceMetrics = {
      totalRequests: 0,
      successfulFetches: 0,
      failedFetches: 0,
      averageResponseTimeMs: 0,
      priceUnavailableCount: 0,
      storeAvailability: {},
      apiErrorTypes: {},
    };

    this.dealMetrics = {
      totalProducts: 0,
      dealsFound: 0,
      dealTypes: {},
      averageSavings: 0,
      detectionTimeMs: 0,
      falsePositives: 0,
      missedDeals: 0,
    };

    this.sessionMetrics = {
      totalSessions: 0,
      averageSessionDuration: 0,
      queriesPerSession: 0,
      bounceRate: 0,
      conversionRate: 0,
      topFeatures: {},
      deviceTypes: {},
    };

    this.websocketMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      connectionErrors: 0,
      messagesSent: 0,
      messagesReceived: 0,
      averageConnectionDuration: 0,
      reconnectionRate: 0,
    };

    this.businessMetrics = {
      totalUsers: 0,
      activeUsers: 0,
      listCreationRate: 0,
      itemAdditionRate: 0,
      purchaseCompletionRate: 0,
      customerSatisfactionScore: 0,
      revenueImpact: 0,
    };
  }

  // === NLP Parsing Metrics ===

  recordNLPParsing(
    success: boolean,
    confidence: number,
    parseTime: number,
    query?: string,
    failureReason?: string
  ): void {
    this.nlpMetrics.totalQueries++;
    
    if (success) {
      this.nlpMetrics.successfulParses++;
      this.updateMovingAverage(
        'nlpMetrics.averageConfidence',
        confidence,
        this.nlpMetrics.successfulParses
      );
    } else {
      this.nlpMetrics.failedParses++;
      if (failureReason) {
        this.nlpMetrics.commonFailureReasons[failureReason] = 
          (this.nlpMetrics.commonFailureReasons[failureReason] || 0) + 1;
      }
    }

    this.updateMovingAverage('nlpMetrics.parseTimeMs', parseTime, this.nlpMetrics.totalQueries);

    // Send to Sentry
    sentryErrorTracker.recordCustomMetric('nlp_parsing_success_rate', 
      this.nlpMetrics.successfulParses / this.nlpMetrics.totalQueries, {
        component: 'nlp_processor',
      });

    sentryErrorTracker.recordCustomMetric('nlp_parse_time', parseTime, {
      success: success.toString(),
      component: 'nlp_processor',
    });

    this.emit('nlp-metric', {
      type: 'parsing',
      success,
      confidence,
      parseTime,
      query,
      failureReason,
    });

    this.checkNLPAlerts();
  }

  // === Product Matching Metrics ===

  recordProductMatching(
    matchType: 'exact' | 'fuzzy' | 'none',
    confidence: number,
    searchTime: number,
    searchTerm: string,
    category?: string
  ): void {
    this.productMetrics.totalSearches++;

    switch (matchType) {
      case 'exact':
        this.productMetrics.exactMatches++;
        break;
      case 'fuzzy':
        this.productMetrics.fuzzyMatches++;
        break;
      case 'none':
        this.productMetrics.noMatches++;
        break;
    }

    this.updateMovingAverage(
      'productMetrics.averageConfidence',
      confidence,
      this.productMetrics.totalSearches - this.productMetrics.noMatches
    );

    this.updateMovingAverage(
      'productMetrics.averageSearchTimeMs',
      searchTime,
      this.productMetrics.totalSearches
    );

    // Track search terms
    this.updateTopList(this.productMetrics.topSearchTerms, searchTerm, 50);

    // Track categories
    if (category) {
      this.productMetrics.categoryDistribution[category] = 
        (this.productMetrics.categoryDistribution[category] || 0) + 1;
    }

    // Send to Sentry
    const matchRate = (this.productMetrics.exactMatches + this.productMetrics.fuzzyMatches) / 
      this.productMetrics.totalSearches;

    sentryErrorTracker.recordCustomMetric('product_matching_rate', matchRate, {
      match_type: matchType,
      component: 'product_matcher',
    });

    sentryErrorTracker.recordCustomMetric('product_search_time', searchTime, {
      match_type: matchType,
      component: 'product_matcher',
    });

    this.emit('product-metric', {
      type: 'matching',
      matchType,
      confidence,
      searchTime,
      searchTerm,
      category,
    });

    this.checkProductMatchingAlerts();
  }

  // === Price Fetching Metrics ===

  recordPriceFetch(
    success: boolean,
    responseTime: number,
    productId: string,
    storeId?: string,
    errorType?: string,
    priceUnavailable = false
  ): void {
    this.priceMetrics.totalRequests++;

    if (success) {
      this.priceMetrics.successfulFetches++;
    } else {
      this.priceMetrics.failedFetches++;
      if (errorType) {
        this.priceMetrics.apiErrorTypes[errorType] = 
          (this.priceMetrics.apiErrorTypes[errorType] || 0) + 1;
      }
    }

    if (priceUnavailable) {
      this.priceMetrics.priceUnavailableCount++;
    }

    if (storeId) {
      this.priceMetrics.storeAvailability[storeId] = 
        (this.priceMetrics.storeAvailability[storeId] || 0) + (success ? 1 : 0);
    }

    this.updateMovingAverage(
      'priceMetrics.averageResponseTimeMs',
      responseTime,
      this.priceMetrics.totalRequests
    );

    // Send to Sentry
    const successRate = this.priceMetrics.successfulFetches / this.priceMetrics.totalRequests;
    
    sentryErrorTracker.recordCustomMetric('price_fetch_success_rate', successRate, {
      store_id: storeId,
      component: 'price_fetcher',
    });

    sentryErrorTracker.recordCustomMetric('price_fetch_time', responseTime, {
      success: success.toString(),
      store_id: storeId,
      component: 'price_fetcher',
    });

    this.emit('price-metric', {
      type: 'fetch',
      success,
      responseTime,
      productId,
      storeId,
      errorType,
      priceUnavailable,
    });

    this.checkPriceAlerts();
  }

  // === Deal Detection Metrics ===

  recordDealDetection(
    dealsFound: number,
    dealTypes: string[],
    detectionTime: number,
    averageSavings: number,
    falsePositives = 0,
    missedDeals = 0
  ): void {
    this.dealMetrics.totalProducts++;
    this.dealMetrics.dealsFound += dealsFound;
    this.dealMetrics.falsePositives += falsePositives;
    this.dealMetrics.missedDeals += missedDeals;

    dealTypes.forEach(type => {
      this.dealMetrics.dealTypes[type] = (this.dealMetrics.dealTypes[type] || 0) + 1;
    });

    this.updateMovingAverage(
      'dealMetrics.averageSavings',
      averageSavings,
      this.dealMetrics.dealsFound || 1
    );

    this.updateMovingAverage(
      'dealMetrics.detectionTimeMs',
      detectionTime,
      this.dealMetrics.totalProducts
    );

    // Send to Sentry
    const detectionRate = this.dealMetrics.dealsFound / this.dealMetrics.totalProducts;
    
    sentryErrorTracker.recordCustomMetric('deal_detection_rate', detectionRate, {
      component: 'deal_detector',
    });

    sentryErrorTracker.recordCustomMetric('deal_average_savings', averageSavings, {
      component: 'deal_detector',
    });

    this.emit('deal-metric', {
      type: 'detection',
      dealsFound,
      dealTypes,
      detectionTime,
      averageSavings,
      falsePositives,
      missedDeals,
    });

    this.checkDealDetectionAlerts();
  }

  // === User Session Metrics ===

  recordUserSession(
    sessionDuration: number,
    queryCount: number,
    bounced: boolean,
    converted: boolean,
    featuresUsed: string[],
    deviceType?: string
  ): void {
    this.sessionMetrics.totalSessions++;

    this.updateMovingAverage(
      'sessionMetrics.averageSessionDuration',
      sessionDuration,
      this.sessionMetrics.totalSessions
    );

    this.updateMovingAverage(
      'sessionMetrics.queriesPerSession',
      queryCount,
      this.sessionMetrics.totalSessions
    );

    if (bounced) {
      this.sessionMetrics.bounceRate = this.calculateRate(
        this.sessionMetrics.bounceRate * (this.sessionMetrics.totalSessions - 1) + 1,
        this.sessionMetrics.totalSessions
      );
    }

    if (converted) {
      this.sessionMetrics.conversionRate = this.calculateRate(
        this.sessionMetrics.conversionRate * (this.sessionMetrics.totalSessions - 1) + 1,
        this.sessionMetrics.totalSessions
      );
    }

    featuresUsed.forEach(feature => {
      this.sessionMetrics.topFeatures[feature] = 
        (this.sessionMetrics.topFeatures[feature] || 0) + 1;
    });

    if (deviceType) {
      this.sessionMetrics.deviceTypes[deviceType] = 
        (this.sessionMetrics.deviceTypes[deviceType] || 0) + 1;
    }

    // Send to Sentry
    sentryErrorTracker.recordCustomMetric('session_duration', sessionDuration, {
      device_type: deviceType,
      component: 'session_tracker',
    });

    sentryErrorTracker.recordCustomMetric('session_bounce_rate', this.sessionMetrics.bounceRate, {
      component: 'session_tracker',
    });

    this.emit('session-metric', {
      type: 'session',
      sessionDuration,
      queryCount,
      bounced,
      converted,
      featuresUsed,
      deviceType,
    });

    this.checkSessionAlerts();
  }

  // === WebSocket Metrics ===

  recordWebSocketEvent(
    eventType: 'connect' | 'disconnect' | 'error' | 'message_sent' | 'message_received',
    connectionId?: string,
    duration?: number
  ): void {
    switch (eventType) {
      case 'connect':
        this.websocketMetrics.totalConnections++;
        this.websocketMetrics.activeConnections++;
        break;
      case 'disconnect':
        this.websocketMetrics.activeConnections = Math.max(0, this.websocketMetrics.activeConnections - 1);
        if (duration) {
          this.updateMovingAverage(
            'websocketMetrics.averageConnectionDuration',
            duration,
            this.websocketMetrics.totalConnections
          );
        }
        break;
      case 'error':
        this.websocketMetrics.connectionErrors++;
        this.websocketMetrics.reconnectionRate = this.calculateRate(
          this.websocketMetrics.connectionErrors,
          this.websocketMetrics.totalConnections
        );
        break;
      case 'message_sent':
        this.websocketMetrics.messagesSent++;
        break;
      case 'message_received':
        this.websocketMetrics.messagesReceived++;
        break;
    }

    // Send to Sentry
    const errorRate = this.websocketMetrics.connectionErrors / 
      (this.websocketMetrics.totalConnections || 1);

    sentryErrorTracker.recordCustomMetric('websocket_error_rate', errorRate, {
      component: 'websocket',
    });

    sentryErrorTracker.recordCustomMetric('websocket_active_connections', 
      this.websocketMetrics.activeConnections, {
        component: 'websocket',
      });

    this.emit('websocket-metric', {
      type: eventType,
      connectionId,
      duration,
      activeConnections: this.websocketMetrics.activeConnections,
    });

    this.checkWebSocketAlerts();
  }

  // === Business KPI Metrics ===

  updateBusinessKPIs(kpis: Partial<BusinessKPIMetrics>): void {
    Object.assign(this.businessMetrics, kpis);

    // Send key business metrics to Sentry
    Object.entries(kpis).forEach(([key, value]) => {
      if (typeof value === 'number') {
        sentryErrorTracker.recordCustomMetric(`business_${key}`, value, {
          component: 'business_metrics',
        });
      }
    });

    this.emit('business-metric', { type: 'kpi_update', kpis });
  }

  // === Alert System ===

  private checkNLPAlerts(): void {
    const successRate = this.nlpMetrics.successfulParses / this.nlpMetrics.totalQueries;
    if (successRate < this.alertThresholds.nlpSuccessRate) {
      this.emit('alert', {
        type: 'nlp_success_rate_low',
        severity: 'warning',
        current: successRate,
        threshold: this.alertThresholds.nlpSuccessRate,
        message: `NLP success rate (${(successRate * 100).toFixed(1)}%) is below threshold`,
      });
    }
  }

  private checkProductMatchingAlerts(): void {
    const matchRate = (this.productMetrics.exactMatches + this.productMetrics.fuzzyMatches) / 
      this.productMetrics.totalSearches;
    
    if (matchRate < this.alertThresholds.productMatchRate) {
      this.emit('alert', {
        type: 'product_match_rate_low',
        severity: 'warning',
        current: matchRate,
        threshold: this.alertThresholds.productMatchRate,
        message: `Product match rate (${(matchRate * 100).toFixed(1)}%) is below threshold`,
      });
    }
  }

  private checkPriceAlerts(): void {
    const successRate = this.priceMetrics.successfulFetches / this.priceMetrics.totalRequests;
    if (successRate < this.alertThresholds.priceSuccessRate) {
      this.emit('alert', {
        type: 'price_success_rate_low',
        severity: 'critical',
        current: successRate,
        threshold: this.alertThresholds.priceSuccessRate,
        message: `Price fetch success rate (${(successRate * 100).toFixed(1)}%) is below threshold`,
      });
    }

    if (this.priceMetrics.averageResponseTimeMs > this.alertThresholds.responseTimeMs) {
      this.emit('alert', {
        type: 'price_response_time_high',
        severity: 'warning',
        current: this.priceMetrics.averageResponseTimeMs,
        threshold: this.alertThresholds.responseTimeMs,
        message: `Price fetch response time (${this.priceMetrics.averageResponseTimeMs}ms) exceeds threshold`,
      });
    }
  }

  private checkDealDetectionAlerts(): void {
    const detectionRate = this.dealMetrics.dealsFound / this.dealMetrics.totalProducts;
    if (detectionRate < this.alertThresholds.dealDetectionRate) {
      this.emit('alert', {
        type: 'deal_detection_rate_low',
        severity: 'warning',
        current: detectionRate,
        threshold: this.alertThresholds.dealDetectionRate,
        message: `Deal detection rate (${(detectionRate * 100).toFixed(1)}%) is below threshold`,
      });
    }
  }

  private checkSessionAlerts(): void {
    if (this.sessionMetrics.bounceRate > this.alertThresholds.sessionBounceRate) {
      this.emit('alert', {
        type: 'session_bounce_rate_high',
        severity: 'warning',
        current: this.sessionMetrics.bounceRate,
        threshold: this.alertThresholds.sessionBounceRate,
        message: `Session bounce rate (${(this.sessionMetrics.bounceRate * 100).toFixed(1)}%) exceeds threshold`,
      });
    }
  }

  private checkWebSocketAlerts(): void {
    const errorRate = this.websocketMetrics.connectionErrors / 
      (this.websocketMetrics.totalConnections || 1);
    
    if (errorRate > this.alertThresholds.websocketErrorRate) {
      this.emit('alert', {
        type: 'websocket_error_rate_high',
        severity: 'critical',
        current: errorRate,
        threshold: this.alertThresholds.websocketErrorRate,
        message: `WebSocket error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold`,
      });
    }
  }

  // === Utility Methods ===

  private updateMovingAverage(metricPath: string, newValue: number, count: number): void {
    const pathParts = metricPath.split('.');
    const obj = pathParts[0] === 'nlpMetrics' ? this.nlpMetrics :
                pathParts[0] === 'productMetrics' ? this.productMetrics :
                pathParts[0] === 'priceMetrics' ? this.priceMetrics :
                pathParts[0] === 'dealMetrics' ? this.dealMetrics :
                pathParts[0] === 'sessionMetrics' ? this.sessionMetrics :
                pathParts[0] === 'websocketMetrics' ? this.websocketMetrics :
                this.businessMetrics;

    const currentValue = (obj as any)[pathParts[1]] || 0;
    (obj as any)[pathParts[1]] = ((currentValue * (count - 1)) + newValue) / count;
  }

  private updateTopList(
    list: Array<{ term: string; count: number }>, 
    term: string, 
    maxItems: number
  ): void {
    const existing = list.find(item => item.term === term);
    if (existing) {
      existing.count++;
    } else {
      list.push({ term, count: 1 });
    }

    // Sort and trim
    list.sort((a, b) => b.count - a.count);
    if (list.length > maxItems) {
      list.splice(maxItems);
    }
  }

  private calculateRate(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
  }

  private setupPeriodicSnapshots(): void {
    // Take snapshots every 15 minutes
    setInterval(() => {
      const snapshot = this.exportAllMetrics();
      this.metricSnapshots.push({
        timestamp: new Date(),
        snapshot,
      });

      // Keep only last 96 snapshots (24 hours with 15min intervals)
      if (this.metricSnapshots.length > 96) {
        this.metricSnapshots.splice(0, this.metricSnapshots.length - 96);
      }

      logger.info('Metrics snapshot taken', 'GROCERY_METRICS', {
        timestamp: new Date().toISOString(),
        metricsCount: Object.keys(snapshot).length,
      });
    }, 15 * 60 * 1000);
  }

  private setupAlertMonitoring(): void {
    // Listen for alerts and forward to external systems
    this.on('alert', (alert) => {
      logger.warn(`Metric alert: ${alert.type}`, 'GROCERY_METRICS', alert);
      
      sentryErrorTracker.captureError(
        new Error(`Metric alert: ${alert.message}`),
        {
          component: 'grocery_metrics',
          operation: 'alert_monitoring',
        },
        alert.severity === 'critical' ? 'error' : 'warning',
        {
          alert_type: alert.type,
          current_value: alert.current?.toString(),
          threshold_value: alert.threshold?.toString(),
        }
      );
    });
  }

  // === Export Methods ===

  exportAllMetrics(): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      nlp: { ...this.nlpMetrics },
      product: { ...this.productMetrics },
      price: { ...this.priceMetrics },
      deal: { ...this.dealMetrics },
      session: { ...this.sessionMetrics },
      websocket: { ...this.websocketMetrics },
      business: { ...this.businessMetrics },
    };
  }

  getMetricSnapshots(hours = 24): Array<{ timestamp: Date; snapshot: Record<string, any> }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricSnapshots.filter(s => s.timestamp >= cutoff);
  }

  updateAlertThresholds(newThresholds: Partial<typeof this.alertThresholds>): void {
    Object.assign(this.alertThresholds, newThresholds);
    logger.info('Alert thresholds updated', 'GROCERY_METRICS', {
      thresholds: this.alertThresholds,
    });
  }

  reset(): void {
    this.initializeMetrics();
    this.metricSnapshots = [];
    logger.info('Metrics reset', 'GROCERY_METRICS');
  }
}

// Singleton instance
export const groceryAgentMetrics = new GroceryAgentMetrics();