/**
 * Real User Monitoring (RUM) for React Frontend
 * Tracks user interactions, page load times, and performance metrics
 */

import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

export interface UserMetrics {
  sessionId: string;
  userId?: string;
  userAgent: string;
  timestamp: number;
  url: string;
  referrer?: string;
  loadTime?: number;
  timeToFirstByte?: number;
  domContentLoaded?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
  interactionToNextPaint?: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  networkInfo?: {
    effectiveType: string;
    downlink?: number;
    rtt?: number;
  };
  errorCount: number;
  clickCount: number;
  scrollDepth: number;
  timeOnPage: number;
  customEvents: Array<{
    name: string;
    timestamp: number;
    data?: any;
  }>;
}

export interface BusinessMetrics {
  sessionId: string;
  searchCount: number;
  productViews: number;
  cartInteractions: number;
  checkoutSteps: number;
  nlpQueries: number;
  priceChecks: number;
  filterUse: number;
  conversionEvents: Array<{
    type: 'search' | 'view' | 'add_to_cart' | 'purchase';
    timestamp: number;
    productId?: string;
    value?: number;
  }>;
}

export interface AlertThresholds {
  loadTimeMs: number;
  errorRatePercent: number;
  cumulativeLayoutShift: number;
  firstInputDelayMs: number;
  memoryUsagePercent: number;
  bounceRatePercent: number;
}

class RealUserMonitoring extends EventEmitter {
  private static instance: RealUserMonitoring;
  private userSessions = new Map<string, UserMetrics>();
  private businessMetrics = new Map<string, BusinessMetrics>();
  private alertThresholds: AlertThresholds = {
    loadTimeMs: 3000,
    errorRatePercent: 5,
    cumulativeLayoutShift: 0.1,
    firstInputDelayMs: 100,
    memoryUsagePercent: 90,
    bounceRatePercent: 70,
  };
  private aggregationInterval?: NodeJS.Timeout;
  private initialized = false;

  private constructor() {
    super();
  }

  static getInstance(): RealUserMonitoring {
    if (!RealUserMonitoring.instance) {
      RealUserMonitoring.instance = new RealUserMonitoring();
    }
    return RealUserMonitoring.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('RUM already initialized', 'RUM');
      return;
    }

    // Start aggregation interval
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, 60 * 1000); // Every minute

    this.initialized = true;
    logger.info('Real User Monitoring initialized', 'RUM');
    this.emit('initialized');
  }

  // Record user session metrics
  recordUserMetrics(metrics: Partial<UserMetrics> & { sessionId: string }): void {
    const existing = this.userSessions.get(metrics.sessionId) || {
      sessionId: metrics.sessionId,
      userAgent: '',
      timestamp: Date.now(),
      url: '',
      errorCount: 0,
      clickCount: 0,
      scrollDepth: 0,
      timeOnPage: 0,
      customEvents: [],
    };

    const updated = { ...existing, ...metrics };
    this.userSessions.set(metrics.sessionId, updated);

    // Check for performance alerts
    this.checkPerformanceAlerts(updated);

    logger.debug('User metrics recorded', 'RUM', {
      sessionId: metrics.sessionId,
      url: metrics.url,
      loadTime: metrics.loadTime,
    });
  }

  // Record business-specific metrics
  recordBusinessMetrics(sessionId: string, metrics: Partial<BusinessMetrics>): void {
    const existing = this.businessMetrics.get(sessionId) || {
      sessionId,
      searchCount: 0,
      productViews: 0,
      cartInteractions: 0,
      checkoutSteps: 0,
      nlpQueries: 0,
      priceChecks: 0,
      filterUse: 0,
      conversionEvents: [],
    };

    const updated = { ...existing, ...metrics };
    this.businessMetrics.set(sessionId, updated);

    logger.debug('Business metrics recorded', 'RUM', {
      sessionId,
      searchCount: updated.searchCount,
      productViews: updated.productViews,
    });
  }

  // Record custom events
  recordCustomEvent(sessionId: string, eventName: string, data?: any): void {
    const session = this.userSessions.get(sessionId);
    if (session) {
      session.customEvents.push({
        name: eventName,
        timestamp: Date.now(),
        data,
      });
      this.userSessions.set(sessionId, session);
    }

    logger.debug('Custom event recorded', 'RUM', {
      sessionId,
      eventName,
      data,
    });
  }

  // Record Core Web Vitals
  recordWebVitals(sessionId: string, vitals: {
    fcp?: number;
    lcp?: number;
    cls?: number;
    fid?: number;
    inp?: number;
  }): void {
    const session = this.userSessions.get(sessionId);
    if (session) {
      if (vitals.fcp) session.firstContentfulPaint = vitals.fcp;
      if (vitals.lcp) session.largestContentfulPaint = vitals.lcp;
      if (vitals.cls) session.cumulativeLayoutShift = vitals.cls;
      if (vitals.fid) session.firstInputDelay = vitals.fid;
      if (vitals.inp) session.interactionToNextPaint = vitals.inp;
      
      this.userSessions.set(sessionId, session);
    }

    logger.debug('Web vitals recorded', 'RUM', {
      sessionId,
      vitals,
    });
  }

  // Check for performance alerts
  private checkPerformanceAlerts(metrics: UserMetrics): void {
    const alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical' }> = [];

    // Load time alerts
    if (metrics.loadTime && metrics.loadTime > this.alertThresholds.loadTimeMs) {
      alerts.push({
        type: 'slow_page_load',
        message: `Slow page load detected: ${metrics.loadTime}ms (threshold: ${this.alertThresholds.loadTimeMs}ms)`,
        severity: metrics.loadTime > this.alertThresholds.loadTimeMs * 2 ? 'critical' : 'warning',
      });
    }

    // Core Web Vitals alerts
    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > this.alertThresholds.cumulativeLayoutShift) {
      alerts.push({
        type: 'high_cls',
        message: `High Cumulative Layout Shift: ${metrics.cumulativeLayoutShift} (threshold: ${this.alertThresholds.cumulativeLayoutShift})`,
        severity: 'warning',
      });
    }

    if (metrics.firstInputDelay && metrics.firstInputDelay > this.alertThresholds.firstInputDelayMs) {
      alerts.push({
        type: 'high_fid',
        message: `High First Input Delay: ${metrics.firstInputDelay}ms (threshold: ${this.alertThresholds.firstInputDelayMs}ms)`,
        severity: 'warning',
      });
    }

    // Memory usage alerts
    if (metrics.memoryUsage) {
      const usagePercent = (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
      if (usagePercent > this.alertThresholds.memoryUsagePercent) {
        alerts.push({
          type: 'high_memory_usage',
          message: `High memory usage: ${usagePercent.toFixed(1)}% (threshold: ${this.alertThresholds.memoryUsagePercent}%)`,
          severity: 'critical',
        });
      }
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('performance-alert', {
        ...alert,
        sessionId: metrics.sessionId,
        url: metrics.url,
        userAgent: metrics.userAgent,
        timestamp: Date.now(),
      });
    });
  }

  // Aggregate metrics for reporting
  private aggregateMetrics(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Get recent sessions
    const recentSessions = Array.from(this.userSessions.values())
      .filter(session => session.timestamp > fiveMinutesAgo);

    if (recentSessions.length === 0) {
      return;
    }

    // Calculate aggregate metrics
    const aggregates = {
      timestamp: now,
      totalSessions: recentSessions.length,
      uniqueUsers: new Set(recentSessions.map(s => s.userId).filter(Boolean)).size,
      avgLoadTime: this.calculateAverage(recentSessions.map(s => s.loadTime).filter((time): time is number => typeof time === 'number')),
      avgFCP: this.calculateAverage(recentSessions.map(s => s.firstContentfulPaint).filter((time): time is number => typeof time === 'number')),
      avgLCP: this.calculateAverage(recentSessions.map(s => s.largestContentfulPaint).filter((time): time is number => typeof time === 'number')),
      avgFID: this.calculateAverage(recentSessions.map(s => s.firstInputDelay).filter((time): time is number => typeof time === 'number')),
      avgCLS: this.calculateAverage(recentSessions.map(s => s.cumulativeLayoutShift).filter((cls): cls is number => typeof cls === 'number')),
      errorRate: recentSessions.reduce((sum, s) => sum + s.errorCount, 0) / (recentSessions.length || 1),
      bounceRate: (recentSessions.filter(s => s.timeOnPage < 10000).length / (recentSessions.length || 1)) * 100,
      topPages: this.getTopPages(recentSessions),
      topErrors: this.getTopErrors(recentSessions),
      deviceTypes: this.getDeviceTypeDistribution(recentSessions),
      networkTypes: this.getNetworkTypeDistribution(recentSessions),
    };

    // Check for aggregate alerts
    this.checkAggregateAlerts(aggregates);

    // Emit aggregated metrics
    this.emit('metrics-aggregated', aggregates);

    logger.info('RUM metrics aggregated', 'RUM', {
      sessions: aggregates.totalSessions,
      avgLoadTime: aggregates.avgLoadTime,
      errorRate: aggregates.errorRate,
      bounceRate: aggregates.bounceRate,
    });
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getTopPages(sessions: UserMetrics[]): Array<{ url: string; count: number; avgLoadTime: number }> {
    const pageStats = new Map<string, { count: number; totalLoadTime: number; loadTimes: number[] }>();
    
    sessions.forEach(session => {
      const existing = pageStats.get(session.url) || { count: 0, totalLoadTime: 0, loadTimes: [] };
      existing.count++;
      if (session.loadTime) {
        existing.totalLoadTime += session.loadTime;
        existing.loadTimes.push(session.loadTime);
      }
      pageStats.set(session.url, existing);
    });

    return Array.from(pageStats.entries())
      .map(([url, stats]) => ({
        url,
        count: stats.count,
        avgLoadTime: stats.loadTimes.length > 0 ? stats.totalLoadTime / stats.loadTimes.length : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTopErrors(sessions: UserMetrics[]): Array<{ type: string; count: number }> {
    const errorTypes = new Map<string, number>();
    
    sessions.forEach(session => {
      session.customEvents
        .filter(event => event.name.includes('error'))
        .forEach(error => {
          const count = errorTypes.get(error.name) || 0;
          errorTypes.set(error.name, count + 1);
        });
    });

    return Array.from(errorTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getDeviceTypeDistribution(sessions: UserMetrics[]): Record<string, number> {
    const devices = sessions.reduce((acc, session) => {
      const isMobile = /Mobile|Android|iPhone|iPad/i.test(session.userAgent);
      const isTablet = /iPad|Android(?!.*Mobile)/i.test(session.userAgent);
      const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
      acc[deviceType] = (acc[deviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return devices;
  }

  private getNetworkTypeDistribution(sessions: UserMetrics[]): Record<string, number> {
    const networks = sessions.reduce((acc, session) => {
      const networkType = session.networkInfo?.effectiveType || 'unknown';
      acc[networkType] = (acc[networkType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return networks;
  }

  private checkAggregateAlerts(aggregates: any): void {
    const alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical' }> = [];

    // High error rate
    if (aggregates.errorRate > this.alertThresholds.errorRatePercent / 100) {
      alerts.push({
        type: 'high_error_rate',
        message: `High error rate detected: ${(aggregates.errorRate * 100).toFixed(1)}% (threshold: ${this.alertThresholds.errorRatePercent}%)`,
        severity: 'critical',
      });
    }

    // High bounce rate
    if (aggregates.bounceRate > this.alertThresholds.bounceRatePercent) {
      alerts.push({
        type: 'high_bounce_rate',
        message: `High bounce rate detected: ${aggregates.bounceRate.toFixed(1)}% (threshold: ${this.alertThresholds.bounceRatePercent}%)`,
        severity: 'warning',
      });
    }

    // Slow average load time
    if (aggregates.avgLoadTime > this.alertThresholds.loadTimeMs) {
      alerts.push({
        type: 'slow_avg_load_time',
        message: `Slow average load time: ${aggregates.avgLoadTime.toFixed(0)}ms (threshold: ${this.alertThresholds.loadTimeMs}ms)`,
        severity: 'warning',
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('aggregate-alert', {
        ...alert,
        aggregates,
        timestamp: Date.now(),
      });
    });
  }

  // Get current metrics summary
  getMetricsSummary(timeWindow: number = 3600000): any {
    const cutoff = Date.now() - timeWindow;
    const sessions = Array.from(this.userSessions.values())
      .filter(session => session.timestamp > cutoff);

    const businessData = Array.from(this.businessMetrics.values())
      .filter(metrics => {
        const session = this.userSessions.get(metrics.sessionId);
        return session && session.timestamp > cutoff;
      });

    return {
      timeWindow,
      user_metrics: {
        total_sessions: sessions.length,
        unique_users: new Set(sessions.map(s => s.userId).filter(Boolean)).size,
        avg_load_time: this.calculateAverage(sessions.map(s => s.loadTime).filter((time): time is number => typeof time === 'number')),
        avg_fcp: this.calculateAverage(sessions.map(s => s.firstContentfulPaint).filter((time): time is number => typeof time === 'number')),
        avg_lcp: this.calculateAverage(sessions.map(s => s.largestContentfulPaint).filter((time): time is number => typeof time === 'number')),
        avg_fid: this.calculateAverage(sessions.map(s => s.firstInputDelay).filter((time): time is number => typeof time === 'number')),
        avg_cls: this.calculateAverage(sessions.map(s => s.cumulativeLayoutShift).filter((cls): cls is number => typeof cls === 'number')),
        error_rate: sessions.reduce((sum, s) => sum + s.errorCount, 0) / Math.max(sessions.length, 1),
        bounce_rate: sessions.filter(s => s.timeOnPage < 10000).length / Math.max(sessions.length, 1) * 100,
      },
      business_metrics: {
        total_searches: businessData.reduce((sum, b) => sum + b.searchCount, 0),
        total_product_views: businessData.reduce((sum, b) => sum + b.productViews, 0),
        total_cart_interactions: businessData.reduce((sum, b) => sum + b.cartInteractions, 0),
        total_nlp_queries: businessData.reduce((sum, b) => sum + b.nlpQueries, 0),
        total_price_checks: businessData.reduce((sum, b) => sum + b.priceChecks, 0),
        conversion_rate: this.calculateConversionRate(businessData),
      },
      top_pages: this.getTopPages(sessions),
      device_distribution: this.getDeviceTypeDistribution(sessions),
      network_distribution: this.getNetworkTypeDistribution(sessions),
    };
  }

  private calculateConversionRate(businessData: BusinessMetrics[]): number {
    const totalSessions = businessData.length;
    if (totalSessions === 0) return 0;

    const conversions = businessData.filter(data => 
      data.conversionEvents.some(event => event.type === 'purchase')
    ).length;

    return (conversions / totalSessions) * 100;
  }

  // Update alert thresholds
  updateAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info('RUM alert thresholds updated', 'RUM', thresholds);
  }

  // Clean up old sessions
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [sessionId, session] of this.userSessions.entries()) {
      if (session.timestamp < cutoff) {
        this.userSessions.delete(sessionId);
        this.businessMetrics.delete(sessionId);
      }
    }

    logger.debug('RUM cleanup completed', 'RUM', {
      remaining_sessions: this.userSessions.size,
      cutoff_age_hours: maxAge / (60 * 60 * 1000),
    });
  }

  shutdown(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.initialized = false;
    logger.info('RUM shut down', 'RUM');
  }
}

export const realUserMonitoring = RealUserMonitoring.getInstance();
export { RealUserMonitoring };
