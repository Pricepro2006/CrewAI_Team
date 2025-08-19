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
  private nlpMetrics!: NLPParsingMetrics;
  private productMetrics!: ProductMatchingMetrics;
  private priceMetrics!: PriceFetchMetrics;
  private dealMetrics!: DealDetectionMetrics;
  private sessionMetrics!: UserSessionMetrics;
  private websocketMetrics!: WebSocketMetrics;
  private businessMetrics!: BusinessKPIMetrics;

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
    if (this.nlpMetrics) {
      this.nlpMetrics.totalQueries++;
    }
    
    if (success) {
      if (this.nlpMetrics) {
        this.nlpMetrics.successfulParses++;
      }
      this.updateMovingAverage(
        'nlpMetrics.averageConfidence',
        confidence,
        this.nlpMetrics?.successfulParses ?? 1
      );
    } else {
      if (this.nlpMetrics) {
        this.nlpMetrics.failedParses++;
      }
      if (failureReason) {
        if (this.nlpMetrics) {
          this.nlpMetrics.commonFailureReasons[failureReason] = 
            (this.nlpMetrics.commonFailureReasons[failureReason] || 0) + 1;
        }
      }
    }

    this.updateMovingAverage('nlpMetrics.parseTimeMs', parseTime, this.nlpMetrics?.totalQueries ?? 1);

    // Send to Sentry
    try {
      const successRate = (this.nlpMetrics?.successfulParses ?? 0) / (this.nlpMetrics?.totalQueries ?? 1);
      sentryErrorTracker.recordCustomMetric('nlp_parsing_success_rate', successRate, {
        component: 'nlp_processor',
      });
    } catch (error) {
      logger.warn('Failed to send NLP metrics to Sentry', 'GROCERY_METRICS', { error });
    }

    try {
      sentryErrorTracker.recordCustomMetric('nlp_parse_time', parseTime, {
        success: success.toString(),
        component: 'nlp_processor',
      });
    } catch (error) {
      logger.warn('Failed to send NLP parse time to Sentry', 'GROCERY_METRICS', { error });
    }

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
    if (this.productMetrics) {
      this.productMetrics.totalSearches++;
    }

    switch (matchType) {
      case 'exact':
        if (this.productMetrics) {
          this.productMetrics.exactMatches++;
        }
        break;
      case 'fuzzy':
        if (this.productMetrics) {
          this.productMetrics.fuzzyMatches++;
        }
        break;
      case 'none':
        if (this.productMetrics) {
          this.productMetrics.noMatches++;
        }
        break;
    }

    const matchCount = (this.productMetrics?.totalSearches ?? 0) - (this.productMetrics?.noMatches ?? 0);
    this.updateMovingAverage(
      'productMetrics.averageConfidence',
      confidence,
      Math.max(matchCount, 1)
    );

    this.updateMovingAverage(
      'productMetrics.averageSearchTimeMs',
      searchTime,
      this.productMetrics?.totalSearches ?? 1
    );

    // Track search terms
    if (this.productMetrics?.topSearchTerms) {
      this.updateTopList(this.productMetrics.topSearchTerms, searchTerm, 50);
    }

    // Track categories
    if (category) {
      if (this.productMetrics) {
        this.productMetrics.categoryDistribution[category] = 
          (this.productMetrics.categoryDistribution[category] || 0) + 1;
      }
    }

    // Send to Sentry
    const exactMatches = this.productMetrics?.exactMatches ?? 0;
    const fuzzyMatches = this.productMetrics?.fuzzyMatches ?? 0;
    const totalSearches = this.productMetrics?.totalSearches ?? 1;
    const matchRate = (exactMatches + fuzzyMatches) / totalSearches;

    try {
      sentryErrorTracker.recordCustomMetric('product_matching_rate', matchRate, {
        match_type: matchType,
        component: 'product_matcher',
      });

      sentryErrorTracker.recordCustomMetric('product_search_time', searchTime, {
        match_type: matchType,
        component: 'product_matcher',
      });
    } catch (error) {
      logger.warn('Failed to send product metrics to Sentry', 'GROCERY_METRICS', { error });
    }

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
    if (this.priceMetrics) {
      this.priceMetrics.totalRequests++;
    }

    if (success) {
      if (this.priceMetrics) {
        this.priceMetrics.successfulFetches++;
      }
    } else {
      if (this.priceMetrics) {
        this.priceMetrics.failedFetches++;
      }
      if (errorType) {
        if (this.priceMetrics) {
          this.priceMetrics.apiErrorTypes[errorType] = 
            (this.priceMetrics.apiErrorTypes[errorType] || 0) + 1;
        }
      }
    }

    if (priceUnavailable) {
      if (this.priceMetrics) {
        this.priceMetrics.priceUnavailableCount++;
      }
    }

    if (storeId) {
      if (this.priceMetrics) {
        this.priceMetrics.storeAvailability[storeId] = 
          (this.priceMetrics.storeAvailability[storeId] || 0) + (success ? 1 : 0);
      }
    }

    this.updateMovingAverage(
      'priceMetrics.averageResponseTimeMs',
      responseTime,
      this.priceMetrics?.totalRequests ?? 1
    );

    // Send to Sentry
    const successRate = (this.priceMetrics?.successfulFetches ?? 0) / (this.priceMetrics?.totalRequests ?? 1);
    
    try {
      sentryErrorTracker.recordCustomMetric('price_fetch_success_rate', successRate, {
        store_id: storeId,
        component: 'price_fetcher',
      });

      sentryErrorTracker.recordCustomMetric('price_fetch_time', responseTime, {
        success: success.toString(),
        store_id: storeId,
        component: 'price_fetcher',
      });
    } catch (error) {
      logger.warn('Failed to send price metrics to Sentry', 'GROCERY_METRICS', { error });
    }

    this.emit('price-metric', {
      type: 'fetch',
      success,
      responseTime,
      productId,
      storeId: storeId ?? '',
      errorType: errorType ?? '',
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
    if (this.dealMetrics) {
      this.dealMetrics.totalProducts++;
    }
    if (this.dealMetrics) {
      this.dealMetrics.dealsFound += dealsFound;
      this.dealMetrics.falsePositives += falsePositives;
      this.dealMetrics.missedDeals += missedDeals;
    }

    dealTypes.forEach(type => {
      if (this.dealMetrics) {
        this.dealMetrics.dealTypes[type] = (this.dealMetrics.dealTypes[type] || 0) + 1;
      }
    });

    this.updateMovingAverage(
      'dealMetrics.averageSavings',
      averageSavings,
      Math.max(this.dealMetrics?.dealsFound ?? 1, 1)
    );

    this.updateMovingAverage(
      'dealMetrics.detectionTimeMs',
      detectionTime,
      this.dealMetrics?.totalProducts ?? 1
    );

    // Send to Sentry
    const detectionRate = (this.dealMetrics?.dealsFound ?? 0) / (this.dealMetrics?.totalProducts ?? 1);
    
    try {
      sentryErrorTracker.recordCustomMetric('deal_detection_rate', detectionRate, {
        component: 'deal_detector',
      });

      sentryErrorTracker.recordCustomMetric('deal_average_savings', averageSavings, {
        component: 'deal_detector',
      });
    } catch (error) {
      logger.warn('Failed to send deal metrics to Sentry', 'GROCERY_METRICS', { error });
    }

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
    if (this.sessionMetrics) {
      this.sessionMetrics.totalSessions++;
    }

    this.updateMovingAverage(
      'sessionMetrics.averageSessionDuration',
      sessionDuration,
      this.sessionMetrics?.totalSessions ?? 1
    );

    this.updateMovingAverage(
      'sessionMetrics.queriesPerSession',
      queryCount,
      this.sessionMetrics?.totalSessions ?? 1
    );

    if (bounced) {
      if (this.sessionMetrics) {
        this.sessionMetrics.bounceRate = this.calculateRate(
          this.sessionMetrics.bounceRate * (this.sessionMetrics.totalSessions - 1) + 1,
          this.sessionMetrics.totalSessions
        );
      }
    }

    if (converted) {
      if (this.sessionMetrics) {
        this.sessionMetrics.conversionRate = this.calculateRate(
          this.sessionMetrics.conversionRate * (this.sessionMetrics.totalSessions - 1) + 1,
          this.sessionMetrics.totalSessions
        );
      }
    }

    featuresUsed.forEach(feature => {
      if (this.sessionMetrics) {
        this.sessionMetrics.topFeatures[feature] = 
          (this.sessionMetrics.topFeatures[feature] || 0) + 1;
      }
    });

    if (deviceType) {
      if (this.sessionMetrics) {
        this.sessionMetrics.deviceTypes[deviceType] = 
          (this.sessionMetrics.deviceTypes[deviceType] || 0) + 1;
      }
    }

    // Send to Sentry
    try {
      sentryErrorTracker.recordCustomMetric('session_duration', sessionDuration, {
        device_type: deviceType,
        component: 'session_tracker',
      });

      sentryErrorTracker.recordCustomMetric('session_bounce_rate', this.sessionMetrics?.bounceRate ?? 0, {
        component: 'session_tracker',
      });
    } catch (error) {
      logger.warn('Failed to send session metrics to Sentry', 'GROCERY_METRICS', { error });
    }

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
        if (this.websocketMetrics) {
          this.websocketMetrics.totalConnections++;
          this.websocketMetrics.activeConnections++;
        }
        break;
      case 'disconnect':
        if (this.websocketMetrics) {
          this.websocketMetrics.activeConnections = Math.max(0, this.websocketMetrics.activeConnections - 1);
        }
        if (duration) {
          this.updateMovingAverage(
            'websocketMetrics.averageConnectionDuration',
            duration,
            this.websocketMetrics?.totalConnections ?? 1
          );
        }
        break;
      case 'error':
        if (this.websocketMetrics) {
          this.websocketMetrics.connectionErrors++;
        }
        if (this.websocketMetrics) {
          this.websocketMetrics.reconnectionRate = this.calculateRate(
            this.websocketMetrics.connectionErrors,
            this.websocketMetrics.totalConnections
          );
        }
        break;
      case 'message_sent':
        if (this.websocketMetrics) {
          this.websocketMetrics.messagesSent++;
        }
        break;
      case 'message_received':
        if (this.websocketMetrics) {
          this.websocketMetrics.messagesReceived++;
        }
        break;
    }

    // Send to Sentry
    const errorRate = (this.websocketMetrics?.connectionErrors ?? 0) / 
      Math.max(this.websocketMetrics?.totalConnections ?? 1, 1);

    try {
      sentryErrorTracker.recordCustomMetric('websocket_error_rate', errorRate, {
        component: 'websocket',
      });

      sentryErrorTracker.recordCustomMetric('websocket_active_connections', 
        this.websocketMetrics?.activeConnections ?? 0, {
          component: 'websocket',
        });
    } catch (error) {
      logger.warn('Failed to send WebSocket metrics to Sentry', 'GROCERY_METRICS', { error });
    }

    this.emit('websocket-metric', {
      type: eventType,
      connectionId: connectionId ?? '',
      duration: duration ?? 0,
      activeConnections: this.websocketMetrics?.activeConnections ?? 0,
    });

    this.checkWebSocketAlerts();
  }

  // === Business KPI Metrics ===

  updateBusinessKPIs(kpis: Partial<BusinessKPIMetrics>): void {
    Object.assign(this.businessMetrics, kpis);

    // Send key business metrics to Sentry
    try {
      Object.entries(kpis).forEach(([key, value]) => {
        if (typeof value === 'number') {
          sentryErrorTracker.recordCustomMetric(`business_${key}`, value, {
            component: 'business_metrics',
          });
        }
      });
    } catch (error) {
      logger.warn('Failed to send business metrics to Sentry', 'GROCERY_METRICS', { error });
    }

    this.emit('business-metric', { type: 'kpi_update', kpis });
  }

  // === Alert System ===

  private checkNLPAlerts(): void {
    const successRate = (this.nlpMetrics?.successfulParses ?? 0) / (this.nlpMetrics?.totalQueries ?? 1);
    if (successRate < (this.alertThresholds?.nlpSuccessRate ?? 0.85)) {
      this.emit('alert', {
        type: 'nlp_success_rate_low',
        severity: 'warning',
        current: successRate,
        threshold: this.alertThresholds?.nlpSuccessRate ?? 0.85,
        message: `NLP success rate (${(successRate * 100).toFixed(1)}%) is below threshold`,
      });
    }
  }

  private checkProductMatchingAlerts(): void {
    const exactMatches = this.productMetrics?.exactMatches ?? 0;
    const fuzzyMatches = this.productMetrics?.fuzzyMatches ?? 0;
    const totalSearches = this.productMetrics?.totalSearches ?? 1;
    const matchRate = (exactMatches + fuzzyMatches) / totalSearches;
    
    if (matchRate < (this.alertThresholds?.productMatchRate ?? 0.8)) {
      this.emit('alert', {
        type: 'product_match_rate_low',
        severity: 'warning',
        current: matchRate,
        threshold: this.alertThresholds?.productMatchRate ?? 0.8,
        message: `Product match rate (${(matchRate * 100).toFixed(1)}%) is below threshold`,
      });
    }
  }

  private checkPriceAlerts(): void {
    const successRate = (this.priceMetrics?.successfulFetches ?? 0) / (this.priceMetrics?.totalRequests ?? 1);
    if (successRate < (this.alertThresholds?.priceSuccessRate ?? 0.9)) {
      this.emit('alert', {
        type: 'price_success_rate_low',
        severity: 'critical',
        current: successRate,
        threshold: this.alertThresholds?.priceSuccessRate ?? 0.9,
        message: `Price fetch success rate (${(successRate * 100).toFixed(1)}%) is below threshold`,
      });
    }

    const responseTime = this.priceMetrics?.averageResponseTimeMs ?? 0;
    const threshold = this.alertThresholds?.responseTimeMs ?? 2000;
    if (responseTime > threshold) {
      this.emit('alert', {
        type: 'price_response_time_high',
        severity: 'warning',
        current: responseTime,
        threshold: threshold,
        message: `Price fetch response time (${responseTime}ms) exceeds threshold`,
      });
    }
  }

  private checkDealDetectionAlerts(): void {
    const detectionRate = (this.dealMetrics?.dealsFound ?? 0) / (this.dealMetrics?.totalProducts ?? 1);
    if (detectionRate < (this.alertThresholds?.dealDetectionRate ?? 0.7)) {
      this.emit('alert', {
        type: 'deal_detection_rate_low',
        severity: 'warning',
        current: detectionRate,
        threshold: this.alertThresholds?.dealDetectionRate ?? 0.7,
        message: `Deal detection rate (${(detectionRate * 100).toFixed(1)}%) is below threshold`,
      });
    }
  }

  private checkSessionAlerts(): void {
    const bounceRate = this.sessionMetrics?.bounceRate ?? 0;
    const threshold = this.alertThresholds?.sessionBounceRate ?? 0.3;
    if (bounceRate > threshold) {
      this.emit('alert', {
        type: 'session_bounce_rate_high',
        severity: 'warning',
        current: bounceRate,
        threshold: threshold,
        message: `Session bounce rate (${(bounceRate * 100).toFixed(1)}%) exceeds threshold`,
      });
    }
  }

  private checkWebSocketAlerts(): void {
    const errorRate = (this.websocketMetrics?.connectionErrors ?? 0) / 
      Math.max(this.websocketMetrics?.totalConnections ?? 1, 1);
    
    if (errorRate > (this.alertThresholds?.websocketErrorRate ?? 0.05)) {
      this.emit('alert', {
        type: 'websocket_error_rate_high',
        severity: 'critical',
        current: errorRate,
        threshold: this.alertThresholds?.websocketErrorRate ?? 0.05,
        message: `WebSocket error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold`,
      });
    }
  }

  // === Utility Methods ===

  private updateMovingAverage(metricPath: string, newValue: number, count: number): void {
    const pathParts = metricPath.split('.');
    
    let obj: Record<string, any> | undefined;
    switch (pathParts[0]) {
      case 'nlpMetrics':
        obj = this.nlpMetrics;
        break;
      case 'productMetrics':
        obj = this.productMetrics;
        break;
      case 'priceMetrics':
        obj = this.priceMetrics;
        break;
      case 'dealMetrics':
        obj = this.dealMetrics;
        break;
      case 'sessionMetrics':
        obj = this.sessionMetrics;
        break;
      case 'websocketMetrics':
        obj = this.websocketMetrics;
        break;
      case 'businessMetrics':
        obj = this.businessMetrics;
        break;
      default:
        return;
    }

    if (obj && pathParts[1] && count > 0) {
      const currentValue = obj[pathParts[1]] ?? 0;
      obj[pathParts[1]] = ((currentValue * (count - 1)) + newValue) / count;
    }
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
    if ((list?.length ?? 0) > maxItems) {
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
    this.on('alert', (alert: any) => {
      logger.warn(`Metric alert: ${alert.type}`, 'GROCERY_METRICS', alert);
      
      try {
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
      } catch (error) {
        logger.warn('Failed to send alert to Sentry', 'GROCERY_METRICS', { error, alert });
      }
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