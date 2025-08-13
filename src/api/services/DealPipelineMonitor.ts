/**
 * Deal Pipeline Monitoring and Configuration Service
 * Provides comprehensive monitoring, configuration management, and health checks
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import { DealPipelineService } from "./DealPipelineService.js";
import { DealWebSocketService } from "./DealWebSocketService.js";
import { EventEmitter } from "events";
import type Database from "better-sqlite3";

export interface PipelineConfig {
  // Processing intervals (in milliseconds)
  priceUpdateIntervalMs: number;
  dealDetectionIntervalMs: number;
  alertCheckIntervalMs: number;
  
  // Batch processing settings
  maxProductsPerBatch: number;
  maxConcurrentRequests: number;
  delayBetweenRequestsMs: number;
  
  // Deal detection settings
  minSavingsPercentage: number;
  maxDealsPerRun: number;
  enableSeasonalDetection: boolean;
  enableBulkDetection: boolean;
  
  // Notification settings
  enableRealTimeNotifications: boolean;
  batchNotifications: boolean;
  maxNotificationsPerUser: number;
  
  // Data retention
  priceHistoryDays: number;
  dealHistoryDays: number;
  cleanupIntervalHours: number;
  
  // Monitoring settings
  healthCheckIntervalMs: number;
  metricsRetentionDays: number;
  alertThresholds: {
    errorRatePercent: number;
    queueSizeWarning: number;
    queueSizeCritical: number;
    responseTimeWarningMs: number;
    responseTimeCriticalMs: number;
  };
}

export interface PerformanceMetrics {
  // Processing metrics
  pricesUpdatedLastHour: number;
  pricesUpdatedLast24h: number;
  dealsDetectedLastHour: number;
  dealsDetectedLast24h: number;
  alertsTriggeredLastHour: number;
  alertsTriggeredLast24h: number;
  
  // Performance metrics
  avgPriceUpdateTimeMs: number;
  avgDealDetectionTimeMs: number;
  avgAlertProcessingTimeMs: number;
  successRate: number;
  errorRate: number;
  
  // Queue metrics
  currentQueueSize: number;
  avgQueueSize: number;
  maxQueueSize: number;
  queueProcessingRate: number; // items per minute
  
  // Connection metrics
  activeWebSocketConnections: number;
  totalWebSocketMessages: number;
  webSocketMessageDeliveryRate: number;
  
  // Business metrics
  topPerformingCategories: Array<{
    category: string;
    dealCount: number;
    avgSavings: number;
    avgScore: number;
  }>;
  dealTypeDistribution: Record<string, number>;
  avgDealScore: number;
  totalSavingsOffered: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'down';
  services: {
    pipelineService: 'healthy' | 'warning' | 'critical' | 'down';
    priceTracking: 'healthy' | 'warning' | 'critical' | 'down';
    dealDetection: 'healthy' | 'warning' | 'critical' | 'down';
    notifications: 'healthy' | 'warning' | 'critical' | 'down';
    database: 'healthy' | 'warning' | 'critical' | 'down';
  };
  lastCheckedAt: string;
  uptime: number; // in seconds
  errors: string[];
  warnings: string[];
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  service: string;
  message: string;
  details: any;
  threshold?: number;
  currentValue?: number;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  isActive: boolean;
}

export class DealPipelineMonitor extends EventEmitter {
  private static instance: DealPipelineMonitor;
  private db: Database.Database;
  
  // Service references
  private pipelineService: DealPipelineService;
  private webSocketService: DealWebSocketService;
  
  // Configuration
  private config: PipelineConfig;
  
  // Monitoring state
  private startTime: number = Date.now();
  private isMonitoring = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsCollectionTimer?: NodeJS.Timeout;
  
  // Metrics storage
  private metricsHistory: Array<PerformanceMetrics & { timestamp: string }> = [];
  private currentMetrics: PerformanceMetrics;
  private healthStatus: HealthStatus;
  private activeAlerts: Map<string, Alert> = new Map();
  
  // Performance tracking
  private performanceCounters = {
    priceUpdates: { count: 0, totalTime: 0 },
    dealDetections: { count: 0, totalTime: 0 },
    alertProcessing: { count: 0, totalTime: 0 },
    errors: 0,
    successes: 0,
  };

  private constructor() {
    super();
    
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    
    // Initialize with default configuration
    this.config = this.getDefaultConfig();
    
    // Initialize services
    this.pipelineService = DealPipelineService.getInstance(this.config);
    this.webSocketService = DealWebSocketService.getInstance();
    
    // Initialize metrics and health status
    this.currentMetrics = this.getEmptyMetrics();
    this.healthStatus = this.getInitialHealthStatus();
    
    this.initializeDatabase();
    this.loadConfiguration();
    this.setupEventHandlers();
  }

  static getInstance(): DealPipelineMonitor {
    if (!DealPipelineMonitor.instance) {
      DealPipelineMonitor.instance = new DealPipelineMonitor();
    }
    return DealPipelineMonitor.instance;
  }

  /**
   * Start monitoring the pipeline
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn("Pipeline monitoring is already running", "DEAL_MONITOR");
      return;
    }

    try {
      this.isMonitoring = true;
      this.startTime = Date.now();
      
      // Start health checks
      this.healthCheckTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckIntervalMs
      );
      
      // Start metrics collection
      this.metricsCollectionTimer = setInterval(
        () => this.collectMetrics(),
        60 * 1000 // Collect metrics every minute
      );
      
      // Perform initial checks
      await this.performHealthCheck();
      await this.collectMetrics();
      
      logger.info("Pipeline monitoring started", "DEAL_MONITOR", {
        config: this.config
      });
      
      this.emit('monitoring_started', { timestamp: new Date().toISOString() });
      
    } catch (error) {
      logger.error("Failed to start pipeline monitoring", "DEAL_MONITOR", { error });
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      logger.warn("Pipeline monitoring is not running", "DEAL_MONITOR");
      return;
    }

    try {
      this.isMonitoring = false;
      
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      
      if (this.metricsCollectionTimer) {
        clearInterval(this.metricsCollectionTimer);
      }
      
      logger.info("Pipeline monitoring stopped", "DEAL_MONITOR");
      this.emit('monitoring_stopped', { timestamp: new Date().toISOString() });
      
    } catch (error) {
      logger.error("Error stopping pipeline monitoring", "DEAL_MONITOR", { error });
      throw error;
    }
  }

  /**
   * Update configuration
   */
  async updateConfiguration(newConfig: Partial<PipelineConfig>): Promise<void> {
    try {
      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...newConfig };
      
      // Save to database
      await this.saveConfiguration();
      
      // Update pipeline service configuration
      this.pipelineService.updateConfig(this.config);
      
      // Restart timers if intervals changed
      if (newConfig.healthCheckIntervalMs && 
          newConfig.healthCheckIntervalMs !== oldConfig.healthCheckIntervalMs) {
        this.restartHealthCheckTimer();
      }
      
      logger.info("Pipeline configuration updated", "DEAL_MONITOR", {
        changes: newConfig
      });
      
      this.emit('configuration_updated', { oldConfig, newConfig: this.config });
      
    } catch (error) {
      logger.error("Failed to update configuration", "DEAL_MONITOR", { error });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): PipelineConfig {
    return { ...this.config };
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get historical metrics
   */
  getMetricsHistory(hours: number = 24): Array<PerformanceMetrics & { timestamp: string }> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.isActive);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledgedAt = new Date().toISOString();
      await this.saveAlert(alert);
      
      logger.info("Alert acknowledged", "DEAL_MONITOR", { alertId });
      this.emit('alert_acknowledged', { alertId, alert });
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.isActive = false;
      alert.resolvedAt = new Date().toISOString();
      await this.saveAlert(alert);
      
      logger.info("Alert resolved", "DEAL_MONITOR", { alertId });
      this.emit('alert_resolved', { alertId, alert });
    }
  }

  /**
   * Force immediate health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    try {
      const now = new Date().toISOString();
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      // Check each service
      const services = {
        pipelineService: await this.checkPipelineServiceHealth(),
        priceTracking: await this.checkPriceTrackingHealth(),
        dealDetection: await this.checkDealDetectionHealth(),
        notifications: await this.checkNotificationHealth(),
        database: await this.checkDatabaseHealth(),
      };
      
      // Determine overall health
      const serviceStatuses = Object.values(services);
      let overall: HealthStatus['overall'] = 'healthy';
      
      if (serviceStatuses.some(s => s === 'down')) {
        overall = 'down';
      } else if (serviceStatuses.some(s => s === 'critical')) {
        overall = 'critical';
      } else if (serviceStatuses.some(s => s === 'warning')) {
        overall = 'warning';
      }
      
      this.healthStatus = {
        overall,
        services,
        lastCheckedAt: now,
        uptime,
        errors: [],
        warnings: []
      };
      
      // Check for threshold violations and create alerts
      await this.checkThresholds();
      
      // Send health status to WebSocket clients
      this.webSocketService.sendPipelineStatus({
        isRunning: this.pipelineService.getMetrics().isHealthy,
        queueSize: this.currentMetrics.currentQueueSize,
        dealsDetectedLastHour: this.currentMetrics.dealsDetectedLastHour,
        pricesUpdatedLastHour: this.currentMetrics.pricesUpdatedLastHour,
        avgDealScore: this.currentMetrics.avgDealScore,
        successRate: this.currentMetrics.successRate
      });
      
      return this.healthStatus;
      
    } catch (error) {
      logger.error("Health check failed", "DEAL_MONITOR", { error });
      
      this.healthStatus.overall = 'critical';
      this.healthStatus.errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return this.healthStatus;
    }
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    try {
      const pipelineMetrics = this.pipelineService.getMetrics();
      const webSocketStats = this.webSocketService.getStatistics();
      
      // Calculate derived metrics
      const successRate = this.performanceCounters.successes + this.performanceCounters.errors > 0 ?
        (this.performanceCounters.successes / (this.performanceCounters.successes + this.performanceCounters.errors)) * 100 : 100;
      
      const errorRate = 100 - successRate;
      
      // Get business metrics from database
      const businessMetrics = await this.collectBusinessMetrics();
      
      this.currentMetrics = {
        pricesUpdatedLastHour: pipelineMetrics.pricesUpdatedLastHour,
        pricesUpdatedLast24h: await this.getPricesUpdated24h(),
        dealsDetectedLastHour: pipelineMetrics.dealsDetectedLastHour,
        dealsDetectedLast24h: await this.getDealsDetected24h(),
        alertsTriggeredLastHour: pipelineMetrics.alertsTriggeredLastHour,
        alertsTriggeredLast24h: await this.getAlertsTriggered24h(),
        
        avgPriceUpdateTimeMs: pipelineMetrics.avgPriceUpdateTime,
        avgDealDetectionTimeMs: pipelineMetrics.avgDealDetectionTime,
        avgAlertProcessingTimeMs: this.calculateAvgTime(this.performanceCounters.alertProcessing),
        successRate,
        errorRate,
        
        currentQueueSize: pipelineMetrics.queueSize,
        avgQueueSize: await this.getAvgQueueSize(),
        maxQueueSize: await this.getMaxQueueSize(),
        queueProcessingRate: this.calculateQueueProcessingRate(),
        
        activeWebSocketConnections: webSocketStats.activeConnections,
        totalWebSocketMessages: webSocketStats.messagesSent,
        webSocketMessageDeliveryRate: this.calculateMessageDeliveryRate(webSocketStats),
        
        ...businessMetrics
      };
      
      // Store metrics history
      this.metricsHistory.push({
        ...this.currentMetrics,
        timestamp: new Date().toISOString()
      });
      
      // Keep only recent history
      const cutoffTime = new Date(Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000).toISOString();
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
      
      return this.currentMetrics;
      
    } catch (error) {
      logger.error("Failed to collect metrics", "DEAL_MONITOR", { error });
      return this.currentMetrics;
    }
  }

  // Private methods

  private getDefaultConfig(): PipelineConfig {
    return {
      priceUpdateIntervalMs: 30 * 60 * 1000,      // 30 minutes
      dealDetectionIntervalMs: 15 * 60 * 1000,    // 15 minutes
      alertCheckIntervalMs: 5 * 60 * 1000,        // 5 minutes
      maxProductsPerBatch: 10,
      maxConcurrentRequests: 3,
      delayBetweenRequestsMs: 2000,
      minSavingsPercentage: 10,
      maxDealsPerRun: 100,
      enableSeasonalDetection: true,
      enableBulkDetection: true,
      enableRealTimeNotifications: true,
      batchNotifications: false,
      maxNotificationsPerUser: 20,
      priceHistoryDays: 180,
      dealHistoryDays: 30,
      cleanupIntervalHours: 24,
      healthCheckIntervalMs: 5 * 60 * 1000,       // 5 minutes
      metricsRetentionDays: 7,
      alertThresholds: {
        errorRatePercent: 5,
        queueSizeWarning: 100,
        queueSizeCritical: 500,
        responseTimeWarningMs: 5000,
        responseTimeCriticalMs: 15000,
      }
    };
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      pricesUpdatedLastHour: 0,
      pricesUpdatedLast24h: 0,
      dealsDetectedLastHour: 0,
      dealsDetectedLast24h: 0,
      alertsTriggeredLastHour: 0,
      alertsTriggeredLast24h: 0,
      avgPriceUpdateTimeMs: 0,
      avgDealDetectionTimeMs: 0,
      avgAlertProcessingTimeMs: 0,
      successRate: 100,
      errorRate: 0,
      currentQueueSize: 0,
      avgQueueSize: 0,
      maxQueueSize: 0,
      queueProcessingRate: 0,
      activeWebSocketConnections: 0,
      totalWebSocketMessages: 0,
      webSocketMessageDeliveryRate: 0,
      topPerformingCategories: [],
      dealTypeDistribution: {},
      avgDealScore: 0,
      totalSavingsOffered: 0,
    };
  }

  private getInitialHealthStatus(): HealthStatus {
    return {
      overall: 'healthy',
      services: {
        pipelineService: 'healthy',
        priceTracking: 'healthy',
        dealDetection: 'healthy',
        notifications: 'healthy',
        database: 'healthy',
      },
      lastCheckedAt: new Date().toISOString(),
      uptime: 0,
      errors: [],
      warnings: []
    };
  }

  private initializeDatabase(): void {
    try {
      // Configuration table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pipeline_configuration (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // Metrics history table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pipeline_metrics_history (
          id TEXT PRIMARY KEY,
          metrics_data TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )
      `);

      // Alerts table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pipeline_alerts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          service TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          threshold REAL,
          current_value REAL,
          created_at TEXT NOT NULL,
          acknowledged_at TEXT,
          resolved_at TEXT,
          is_active INTEGER DEFAULT 1
        )
      `);

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_timestamp 
        ON pipeline_metrics_history(timestamp DESC)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pipeline_alerts_active 
        ON pipeline_alerts(is_active, created_at DESC)
      `);

      logger.debug("Pipeline monitor database initialized", "DEAL_MONITOR");

    } catch (error) {
      logger.error("Failed to initialize monitor database", "DEAL_MONITOR", { error });
      throw error;
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        SELECT key, value FROM pipeline_configuration
      `);

      const rows = stmt.all() as Array<{ key: string; value: string }>;
      
      for (const row of rows) {
        try {
          const value = JSON.parse(row.value);
          (this.config as any)[row.key] = value;
        } catch (error) {
          logger.warn("Failed to parse config value", "DEAL_MONITOR", { 
            key: row.key, 
            error 
          });
        }
      }

      logger.info("Configuration loaded", "DEAL_MONITOR");

    } catch (error) {
      logger.warn("Failed to load configuration, using defaults", "DEAL_MONITOR", { error });
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      const transaction = this.db.transaction(() => {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO pipeline_configuration (key, value, updated_at)
          VALUES (?, ?, ?)
        `);

        const now = new Date().toISOString();
        
        for (const [key, value] of Object.entries(this.config)) {
          stmt.run(key, JSON.stringify(value), now);
        }
      });

      transaction();

    } catch (error) {
      logger.error("Failed to save configuration", "DEAL_MONITOR", { error });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.pipelineService.on('price_updated', (data) => {
      this.performanceCounters.successes++;
    });

    this.pipelineService.on('deal_detected', (deal) => {
      this.performanceCounters.successes++;
    });

    this.pipelineService.on('error', (data) => {
      this.performanceCounters.errors++;
    });
  }

  private restartHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckIntervalMs
    );
  }

  // Health check methods for individual services

  private async checkPipelineServiceHealth(): Promise<'healthy' | 'warning' | 'critical' | 'down'> {
    try {
      const metrics = this.pipelineService.getMetrics();
      
      if (!metrics.isHealthy) return 'critical';
      if (metrics.errorRate > 10) return 'warning';
      
      return 'healthy';
    } catch (error) {
      return 'down';
    }
  }

  private async checkPriceTrackingHealth(): Promise<'healthy' | 'warning' | 'critical' | 'down'> {
    try {
      // Check if prices have been updated recently
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM price_history_enhanced 
        WHERE recorded_at > datetime('now', '-2 hours')
      `);
      
      const result = stmt.get() as { count: number };
      
      if (result.count === 0) return 'warning';
      return 'healthy';
    } catch (error) {
      return 'down';
    }
  }

  private async checkDealDetectionHealth(): Promise<'healthy' | 'warning' | 'critical' | 'down'> {
    try {
      // Check if deals have been detected recently
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM detected_deals 
        WHERE detected_at > datetime('now', '-4 hours')
      `);
      
      const result = stmt.get() as { count: number };
      
      // It's normal to have periods without deals
      return 'healthy';
    } catch (error) {
      return 'down';
    }
  }

  private async checkNotificationHealth(): Promise<'healthy' | 'warning' | 'critical' | 'down'> {
    try {
      const stats = this.webSocketService.getStatistics();
      
      if (stats.messagesFailed > stats.messagesSent * 0.1) return 'warning'; // >10% failure rate
      return 'healthy';
    } catch (error) {
      return 'down';
    }
  }

  private async checkDatabaseHealth(): Promise<'healthy' | 'warning' | 'critical' | 'down'> {
    try {
      // Test database connectivity
      this.db.prepare('SELECT 1').get();
      return 'healthy';
    } catch (error) {
      return 'down';
    }
  }

  private async checkThresholds(): Promise<void> {
    const thresholds = this.config.alertThresholds;
    
    // Check error rate
    if (this.currentMetrics.errorRate > thresholds.errorRatePercent) {
      await this.createAlert('error', 'pipeline', 
        `Error rate exceeds threshold: ${this.currentMetrics.errorRate.toFixed(1)}%`, 
        { errorRate: this.currentMetrics.errorRate },
        thresholds.errorRatePercent,
        this.currentMetrics.errorRate
      );
    }
    
    // Check queue size
    if (this.currentMetrics.currentQueueSize > thresholds.queueSizeCritical) {
      await this.createAlert('error', 'pipeline',
        `Queue size critical: ${this.currentMetrics.currentQueueSize} items`,
        { queueSize: this.currentMetrics.currentQueueSize },
        thresholds.queueSizeCritical,
        this.currentMetrics.currentQueueSize
      );
    } else if (this.currentMetrics.currentQueueSize > thresholds.queueSizeWarning) {
      await this.createAlert('warning', 'pipeline',
        `Queue size warning: ${this.currentMetrics.currentQueueSize} items`,
        { queueSize: this.currentMetrics.currentQueueSize },
        thresholds.queueSizeWarning,
        this.currentMetrics.currentQueueSize
      );
    }
    
    // Check response times
    if (this.currentMetrics.avgPriceUpdateTimeMs > thresholds.responseTimeCriticalMs) {
      await this.createAlert('error', 'price_tracking',
        `Price update response time critical: ${this.currentMetrics.avgPriceUpdateTimeMs}ms`,
        { responseTime: this.currentMetrics.avgPriceUpdateTimeMs },
        thresholds.responseTimeCriticalMs,
        this.currentMetrics.avgPriceUpdateTimeMs
      );
    } else if (this.currentMetrics.avgPriceUpdateTimeMs > thresholds.responseTimeWarningMs) {
      await this.createAlert('warning', 'price_tracking',
        `Price update response time warning: ${this.currentMetrics.avgPriceUpdateTimeMs}ms`,
        { responseTime: this.currentMetrics.avgPriceUpdateTimeMs },
        thresholds.responseTimeWarningMs,
        this.currentMetrics.avgPriceUpdateTimeMs
      );
    }
  }

  private async createAlert(
    type: 'error' | 'warning' | 'info',
    service: string,
    message: string,
    details: any,
    threshold?: number,
    currentValue?: number
  ): Promise<void> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const alert: Alert = {
      id: alertId,
      type,
      service,
      message,
      details,
      threshold,
      currentValue,
      createdAt: now,
      isActive: true
    };
    
    this.activeAlerts.set(alertId, alert);
    await this.saveAlert(alert);
    
    logger.warn("Pipeline alert created", "DEAL_MONITOR", {
      alertId,
      type,
      service,
      message
    });
    
    this.emit('alert_created', { alertId, alert });
  }

  private async saveAlert(alert: Alert): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO pipeline_alerts (
          id, type, service, message, details, threshold, current_value,
          created_at, acknowledged_at, resolved_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        alert.id,
        alert.type,
        alert.service,
        alert.message,
        JSON.stringify(alert.details),
        alert.threshold,
        alert.currentValue,
        alert.createdAt,
        alert.acknowledgedAt,
        alert.resolvedAt,
        alert.isActive ? 1 : 0
      );

    } catch (error) {
      logger.error("Failed to save alert", "DEAL_MONITOR", { error, alertId: alert.id });
    }
  }

  // Metric calculation helpers

  private calculateAvgTime(counter: { count: number; totalTime: number }): number {
    return counter.count > 0 ? counter.totalTime / counter.count : 0;
  }

  private calculateQueueProcessingRate(): number {
    // This would track items processed per minute
    // For now, return a placeholder
    return 0;
  }

  private calculateMessageDeliveryRate(stats: any): number {
    // Calculate messages per second or minute
    return stats.messagesDelivered / Math.max(1, (Date.now() - this.startTime) / 60000); // per minute
  }

  private async getPricesUpdated24h(): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM price_history_enhanced 
        WHERE recorded_at > datetime('now', '-24 hours')
      `);
      
      return (stmt.get() as { count: number }).count;
    } catch (error) {
      return 0;
    }
  }

  private async getDealsDetected24h(): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM detected_deals 
        WHERE detected_at > datetime('now', '-24 hours')
      `);
      
      return (stmt.get() as { count: number }).count;
    } catch (error) {
      return 0;
    }
  }

  private async getAlertsTriggered24h(): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM deal_notifications 
        WHERE created_at > datetime('now', '-24 hours')
      `);
      
      return (stmt.get() as { count: number }).count;
    } catch (error) {
      return 0;
    }
  }

  private async getAvgQueueSize(): Promise<number> {
    // This would track average queue size over time
    // For now, return current queue size
    return this.currentMetrics.currentQueueSize;
  }

  private async getMaxQueueSize(): Promise<number> {
    // This would track maximum queue size
    // For now, return current queue size
    return this.currentMetrics.currentQueueSize;
  }

  private async collectBusinessMetrics(): Promise<{
    topPerformingCategories: Array<{
      category: string;
      dealCount: number;
      avgSavings: number;
      avgScore: number;
    }>;
    dealTypeDistribution: Record<string, number>;
    avgDealScore: number;
    totalSavingsOffered: number;
  }> {
    try {
      // Top performing categories
      const categoryStmt = this.db.prepare(`
        SELECT 
          category,
          COUNT(*) as deal_count,
          AVG(savings_percentage) as avg_savings,
          AVG(deal_score) as avg_score
        FROM detected_deals 
        WHERE detected_at > datetime('now', '-24 hours')
        AND category IS NOT NULL
        GROUP BY category
        ORDER BY deal_count DESC, avg_score DESC
        LIMIT 10
      `);

      const topCategories = categoryStmt.all() as any[];

      // Deal type distribution
      const typeStmt = this.db.prepare(`
        SELECT 
          deal_type,
          COUNT(*) as count
        FROM detected_deals 
        WHERE detected_at > datetime('now', '-24 hours')
        GROUP BY deal_type
      `);

      const dealTypes = typeStmt.all() as any[];
      const dealTypeDistribution: Record<string, number> = {};
      for (const type of dealTypes) {
        dealTypeDistribution[type.deal_type] = type.count;
      }

      // Overall metrics
      const overallStmt = this.db.prepare(`
        SELECT 
          AVG(deal_score) as avg_score,
          SUM(savings_amount) as total_savings
        FROM detected_deals 
        WHERE detected_at > datetime('now', '-24 hours')
      `);

      const overall = overallStmt.get() as any;

      return {
        topPerformingCategories: topCategories.map(cat => ({
          category: cat.category,
          dealCount: cat.deal_count,
          avgSavings: cat.avg_savings || 0,
          avgScore: cat.avg_score || 0
        })),
        dealTypeDistribution,
        avgDealScore: overall?.avg_score || 0,
        totalSavingsOffered: overall?.total_savings || 0
      };

    } catch (error) {
      logger.warn("Failed to collect business metrics", "DEAL_MONITOR", { error });
      return {
        topPerformingCategories: [],
        dealTypeDistribution: {},
        avgDealScore: 0,
        totalSavingsOffered: 0
      };
    }
  }
}