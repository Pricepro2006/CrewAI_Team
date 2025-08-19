/**
 * MemoryMonitoringService - Centralized memory monitoring for all microservices
 * 
 * Features:
 * - Real-time memory tracking across all services
 * - Aggregated metrics and dashboards
 * - Alert generation and notification
 * - Memory leak detection across services
 * - Automated recovery coordination
 * - Performance profiling and reporting
 * 
 * @module MemoryMonitoringService
 */

import express from 'express';
import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Redis } from 'ioredis';
import { MemoryManager } from './MemoryManager.js';
import type { MemoryMetrics, LeakDetectionResult } from './MemoryManager.js';
import { logger } from '../utils/logger.js';
import { metrics as promMetrics } from '../api/monitoring/metrics.js';
import { WebSocket, WebSocketServer } from 'ws';

const execAsync = promisify(exec);

interface ServiceMemoryProfile {
  service: string;
  pid?: number;
  maxMemory: number; // MB
  currentMemory?: number; // MB
  memoryPercent?: number;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  lastUpdate: number;
  restarts: number;
  leaks: number;
  uptime?: number;
  gcStats?: {
    count: number;
    totalDuration: number;
    lastGC?: number;
  };
}

interface AlertRule {
  id: string;
  service: string;
  metric: 'memory' | 'cpu' | 'restart' | 'leak';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  action: 'log' | 'notify' | 'restart' | 'scale';
  cooldown: number; // milliseconds
  lastTriggered?: number;
}

interface MemoryReport {
  timestamp: number;
  totalMemoryUsed: number;
  totalMemoryLimit: number;
  services: ServiceMemoryProfile[];
  alerts: Alert[];
  recommendations: string[];
}

interface Alert {
  id: string;
  timestamp: number;
  service: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric?: any;
  resolved: boolean;
}

export class MemoryMonitoringService extends EventEmitter {
  private static instance: MemoryMonitoringService;
  
  private app: express.Application;
  private redis: Redis;
  private wss?: WebSocketServer;
  private services = new Map<string, ServiceMemoryProfile>();
  private memoryManagers = new Map<string, MemoryManager>();
  private alerts = new Map<string, Alert>();
  private alertRules: AlertRule[] = [];
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private reportInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  
  // Configuration
  private readonly MONITORING_INTERVAL = 10000; // 10 seconds
  private readonly REPORT_INTERVAL = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour
  private readonly METRICS_RETENTION = 86400000; // 24 hours
  private readonly REPORT_DIR = './memory-reports';
  
  // Service definitions
  private readonly SERVICE_CONFIGS = [
    { name: 'cache-warmer', maxMemory: 256, port: 3006 },
    { name: 'pricing-service', maxMemory: 512, port: 3003 },
    { name: 'nlp-queue', maxMemory: 384, port: 3005 },
    { name: 'api-server', maxMemory: 1024, port: 3000 },
    { name: 'websocket-gateway', maxMemory: 512, port: 3001 }
  ];
  
  private constructor() {
    super();
    
    this.app = express();
    this.app.use(express.json());
    
    // Initialize Redis for metrics storage
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_METRICS_DB || '3'),
      retryStrategy: (times: number) => Math.min(times * 100, 3000)
    });
    
    // Initialize service profiles
    this.initializeServices();
    
    // Setup default alert rules
    this.setupDefaultAlertRules();
    
    // Setup API routes
    this.setupRoutes();
    
    // Create report directory
    this.ensureReportDirectory();
  }
  
  static getInstance(): MemoryMonitoringService {
    if (!MemoryMonitoringService.instance) {
      MemoryMonitoringService.instance = new MemoryMonitoringService();
    }
    return MemoryMonitoringService.instance;
  }
  
  /**
   * Initialize service profiles
   */
  private initializeServices(): void {
    for (const config of this.SERVICE_CONFIGS) {
      this.services.set(config.name, {
        service: config.name,
        maxMemory: config.maxMemory,
        status: 'offline',
        lastUpdate: Date.now(),
        restarts: 0,
        leaks: 0
      });
      
      // Initialize memory manager for each service
      const memoryManager = MemoryManager.getInstance({
        service: config.name,
        maxHeapSize: config.maxMemory,
        warningThreshold: 0.7,
        criticalThreshold: 0.85,
        gcInterval: 60000,
        heapSnapshotOnCritical: true,
        enableAutoGC: true,
        enableMemoryProfiling: true,
        snapshotDir: './memory-snapshots',
        restartOnOOM: true,
        maxRestarts: 3,
        restartCooldown: 300000
      });
      
      this.setupMemoryManagerListeners(config.name, memoryManager);
      this?.memoryManagers?.set(config.name, memoryManager);
    }
  }
  
  /**
   * Setup memory manager event listeners
   */
  private setupMemoryManagerListeners(service: string, manager: MemoryManager): void {
    manager.on('metrics', (metrics: MemoryMetrics) => {
      this.updateServiceMetrics(service, metrics);
    });
    
    manager.on('leak-detected', (result: LeakDetectionResult) => {
      this.handleLeakDetection(service, result);
    });
    
    manager.on('critical-pressure', (metrics: MemoryMetrics) => {
      this.handleCriticalPressure(service, metrics);
    });
    
    manager.on('warning-pressure', (metrics: MemoryMetrics) => {
      this.handleWarningPressure(service, metrics);
    });
    
    manager.on('restart-initiated', (data: any) => {
      this.handleServiceRestart(service, data);
    });
    
    manager.on('snapshot-taken', (data: any) => {
      logger.info('Heap snapshot taken', 'MEMORY_MONITOR', {
        service,
        filepath: data.filepath,
        reason: data.reason
      });
    });
  }
  
  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    this.alertRules = [
      // Memory alerts
      {
        id: 'memory-warning',
        service: '*',
        metric: 'memory',
        threshold: 0.7,
        severity: 'warning',
        action: 'notify',
        cooldown: 300000 // 5 minutes
      },
      {
        id: 'memory-critical',
        service: '*',
        metric: 'memory',
        threshold: 0.85,
        severity: 'critical',
        action: 'restart',
        cooldown: 600000 // 10 minutes
      },
      // Leak detection
      {
        id: 'memory-leak',
        service: '*',
        metric: 'leak',
        threshold: 5, // MB per minute
        severity: 'critical',
        action: 'notify',
        cooldown: 1800000 // 30 minutes
      },
      // Restart alerts
      {
        id: 'excessive-restarts',
        service: '*',
        metric: 'restart',
        threshold: 3,
        severity: 'critical',
        action: 'scale',
        cooldown: 3600000 // 1 hour
      }
    ];
  }
  
  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this?.app.get('/health', (req, res) => {
      const healthy = Array.from(this?.services?.values())
        .filter(s => s.status !== 'offline').length > 0;
      
      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'unhealthy',
        services: Array.from(this?.services?.values()),
        activeAlerts: Array.from(this?.alerts?.values()).filter(a => !a.resolved).length
      });
    });
    
    // Get all service metrics
    this?.app.get('/metrics', async (req, res) => {
      const metrics = await this.collectAllMetrics();
      res.json(metrics);
      return;
    });
    
    // Get service-specific metrics
    this?.app.get('/metrics/:service', async (req, res) => {
      const { service } = req.params;
      const profile = this?.services?.get(service);
      
      if (!profile) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      
      const manager = this?.memoryManagers?.get(service);
      const stats = manager?.getStatistics();
      
      res.json({
        profile,
        statistics: stats,
        metrics: await this.getServiceMetricsHistory(service)
      });
      return;
    });
    
    // Get alerts
    this?.app.get('/alerts', (req, res) => {
      const { resolved = 'false' } = req.query;
      const showResolved = resolved === 'true';
      
      const alerts = Array.from(this?.alerts?.values())
        .filter(a => showResolved || !a.resolved)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      res.json(alerts);
    });
    
    // Resolve alert
    this?.app.post('/alerts/:id/resolve', (req, res) => {
      const { id } = req.params;
      const alert = this?.alerts?.get(id);
      
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      
      alert.resolved = true;
      return res.json({ success: true, alert });
    });
    
    // Force garbage collection
    this?.app.post('/gc/:service', (req, res) => {
      const { service } = req.params;
      const manager = this?.memoryManagers?.get(service);
      
      if (!manager) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      manager.forceGC();
      return res.json({ success: true, message: 'Garbage collection triggered' });
    });
    
    // Take heap snapshot
    this?.app.post('/snapshot/:service', (req, res) => {
      const { service } = req.params;
      const { reason = 'manual' } = req.body;
      const manager = this?.memoryManagers?.get(service);
      
      if (!manager) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      
      try {
        const filepath = manager.takeHeapSnapshot(reason);
        res.json({ success: true, filepath });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return;
    });
    
    // Get memory report
    this?.app.get('/report', async (req, res) => {
      const report = await this.generateReport();
      res.json(report);
    });
    
    // Restart service
    this?.app.post('/restart/:service', async (req, res) => {
      const { service } = req.params;
      
      try {
        await this.restartService(service);
        res.json({ success: true, message: `Service ${service} restart initiated` });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Update alert rules
    this?.app.post('/alert-rules', (req, res) => {
      const { rules } = req.body;
      
      if (!Array.isArray(rules)) {
        res.status(400).json({ error: 'Rules must be an array' });
        return;
      }
      
      this.alertRules = rules;
      res.json({ success: true, rules: this.alertRules });
      return;
    });
  }
  
  /**
   * Start monitoring
   */
  async start(port: number = 3007): Promise<void> {
    if (this.isRunning) return;
    
    // Start Express server
    await new Promise<void>((resolve: any) => {
      const server = this?.app.listen(port, () => {
        logger.info(`Memory Monitoring Service started on port ${port}`, 'MEMORY_MONITOR');
        resolve();
      });
      
      // Setup WebSocket server for real-time updates
      this.wss = new WebSocketServer({ server, path: '/ws' });
      this.setupWebSocket();
    });
    
    // Start monitoring intervals
    this.monitoringInterval = setInterval(() => {
      this.monitorAllServices();
    }, this.MONITORING_INTERVAL);
    
    this.reportInterval = setInterval(() => {
      this.generateAndSaveReport();
    }, this.REPORT_INTERVAL);
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.CLEANUP_INTERVAL);
    
    this.isRunning = true;
    
    // Initial monitoring
    await this.monitorAllServices();
  }
  
  /**
   * Setup WebSocket for real-time updates
   */
  private setupWebSocket(): void {
    if (!this.wss) return;
    
    this?.wss?.on('connection', (ws: WebSocket) => {
      logger.debug('WebSocket client connected', 'MEMORY_MONITOR');
      
      // Send initial state
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          services: Array.from(this?.services?.values()),
          alerts: Array.from(this?.alerts?.values()).filter(a => !a.resolved)
        }
      }));
      
      // Handle client messages
      ws.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('Invalid WebSocket message', 'MEMORY_MONITOR', { error });
        }
      });
      
      ws.on('close', () => {
        logger.debug('WebSocket client disconnected', 'MEMORY_MONITOR');
      });
    });
  }
  
  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        // Client subscribes to specific service updates
        ws.send(JSON.stringify({
          type: 'subscribed',
          service: data.service
        }));
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
        
      default:
        logger.warn('Unknown WebSocket message type', 'MEMORY_MONITOR', { type: data.type });
    }
  }
  
  /**
   * Broadcast update to all WebSocket clients
   */
  private broadcastUpdate(type: string, data: any): void {
    if (!this.wss) return;
    
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    this?.wss?.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  /**
   * Monitor all services
   */
  private async monitorAllServices(): Promise<void> {
    const promises = this?.SERVICE_CONFIGS?.map(async (config: any) => {
      try {
        await this.monitorService(config.name, config.port);
      } catch (error) {
        logger.error(`Failed to monitor service ${config.name}`, 'MEMORY_MONITOR', { error });
      }
    });
    
    await Promise.all(promises);
    
    // Check alert rules
    this.checkAlertRules();
    
    // Broadcast updates
    this.broadcastUpdate('metrics', {
      services: Array.from(this?.services?.values())
    });
  }
  
  /**
   * Monitor a specific service
   */
  private async monitorService(service: string, port: number): Promise<void> {
    const profile = this?.services?.get(service);
    if (!profile) return;
    
    try {
      // Try to get metrics from service health endpoint
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update profile
        profile.status = 'healthy';
        profile.lastUpdate = Date.now();
        
        // Get process info
        const processInfo = await this.getProcessInfo(service);
        if (processInfo) {
          profile.pid = processInfo.pid;
          profile.currentMemory = processInfo.memory;
          profile.memoryPercent = processInfo.memory / profile.maxMemory;
          profile.uptime = processInfo.uptime;
          
          // Determine status based on memory usage
          if (profile.memoryPercent >= 0.85) {
            profile.status = 'critical';
          } else if (profile.memoryPercent >= 0.7) {
            profile.status = 'warning';
          }
        }
        
        // Store metrics in Redis
        await this.storeMetrics(service, profile);
        
        // Update Prometheus metrics
        promMetrics.gauge(`memory_usage_mb`, profile.currentMemory || 0, { service });
        promMetrics.gauge(`memory_percent`, profile.memoryPercent || 0, { service });
        
      } else {
        profile.status = 'offline';
        profile.lastUpdate = Date.now();
      }
      
    } catch (error) {
      profile.status = 'offline';
      profile.lastUpdate = Date.now();
      logger.debug(`Service ${service} appears to be offline`, 'MEMORY_MONITOR');
    }
  }
  
  /**
   * Get process info for a service
   */
  private async getProcessInfo(service: string): Promise<{
    pid: number;
    memory: number;
    cpu: number;
    uptime: number;
  } | null> {
    try {
      // Use systemctl to get service info
      const { stdout } = await execAsync(`systemctl show walmart-${service} --property=MainPID,MemoryCurrent,CPUUsageNSec`);
      
      const lines = stdout.trim().split('\n');
      const info: any = {};
      
      for (const line of lines) {
        const [key, value] = line.split('=');
        if (key && value) {
          info[key] = value;
        }
      }
      
      if (info.MainPID && info.MainPID !== '0') {
        // Get detailed process info
        const { stdout: psOutput } = await execAsync(`ps -o pid,rss,pcpu,etimes -p ${info.MainPID} --no-headers`);
        const [pid, rss, cpu, uptime] = psOutput.trim().split(/\s+/);
        
        return {
          pid: parseInt(pid || '0'),
          memory: parseInt(rss || '0') / 1024, // Convert KB to MB
          cpu: parseFloat(cpu || '0'),
          uptime: parseInt(uptime || '0') * 1000 // Convert to milliseconds
        };
      }
      
    } catch (error) {
      // Fallback to checking by port
      try {
        const port = this.getServicePort(service);
        if (port === undefined) return null;
        const { stdout } = await execAsync(`lsof -i -P -n | grep LISTEN | grep :${port}`);
        const parts = stdout.trim().split(/\s+/);
        const pid = parseInt(parts[1] || '0');
        
        if (pid) {
          const { stdout: psOutput } = await execAsync(`ps -o pid,rss,pcpu,etimes -p ${pid} --no-headers`);
          const [, rss, cpu, uptime] = psOutput.trim().split(/\s+/);
          
          return {
            pid,
            memory: parseInt(rss || '0') / 1024,
            cpu: parseFloat(cpu || '0'),
            uptime: parseInt(uptime || '0') * 1000
          };
        }
      } catch {
        // Process not found
      }
    }
    
    return null;
  }
  
  /**
   * Get service port
   */
  private getServicePort(service: string): number | undefined {
    const config = this?.SERVICE_CONFIGS?.find(c => c.name === service);
    return config?.port;
  }
  
  /**
   * Update service metrics
   */
  private updateServiceMetrics(service: string, metrics: MemoryMetrics): void {
    const profile = this?.services?.get(service);
    if (!profile) return;
    
    profile.currentMemory = metrics.heapUsed / 1024 / 1024; // Convert to MB
    profile.memoryPercent = metrics.heapUsedPercent;
    profile.lastUpdate = metrics.timestamp;
    
    if (metrics.isCritical) {
      profile.status = 'critical';
    } else if (metrics.isWarning) {
      profile.status = 'warning';
    } else {
      profile.status = 'healthy';
    }
    
    if (metrics.gcCount > 0) {
      profile.gcStats = {
        count: metrics.gcCount,
        totalDuration: metrics.gcDuration,
        lastGC: Date.now()
      };
    }
    
    // Broadcast update
    this.broadcastUpdate('service-update', { service, profile });
  }
  
  /**
   * Handle leak detection
   */
  private handleLeakDetection(service: string, result: LeakDetectionResult): void {
    const profile = this?.services?.get(service);
    if (!profile) return;
    
    profile.leaks++;
    
    const alert: Alert = {
      id: `leak-${service}-${Date.now()}`,
      timestamp: Date.now(),
      service,
      severity: 'critical',
      message: result.message,
      metric: result,
      resolved: false
    };
    
    this?.alerts?.set(alert.id, alert);
    this.broadcastUpdate('alert', alert);
    
    logger.error('Memory leak detected', 'MEMORY_MONITOR', {
      service,
      growthRate: result.growthRate,
      confidence: result.confidence
    });
  }
  
  /**
   * Handle critical memory pressure
   */
  private handleCriticalPressure(service: string, metrics: MemoryMetrics): void {
    const alert: Alert = {
      id: `critical-${service}-${Date.now()}`,
      timestamp: Date.now(),
      service,
      severity: 'critical',
      message: `Critical memory pressure: ${Math.round(metrics.heapUsedPercent * 100)}% heap used`,
      metric: metrics,
      resolved: false
    };
    
    this?.alerts?.set(alert.id, alert);
    this.broadcastUpdate('alert', alert);
  }
  
  /**
   * Handle warning memory pressure
   */
  private handleWarningPressure(service: string, metrics: MemoryMetrics): void {
    const alert: Alert = {
      id: `warning-${service}-${Date.now()}`,
      timestamp: Date.now(),
      service,
      severity: 'warning',
      message: `High memory usage: ${Math.round(metrics.heapUsedPercent * 100)}% heap used`,
      metric: metrics,
      resolved: false
    };
    
    this?.alerts?.set(alert.id, alert);
    this.broadcastUpdate('alert', alert);
  }
  
  /**
   * Handle service restart
   */
  private handleServiceRestart(service: string, data: any): void {
    const profile = this?.services?.get(service);
    if (!profile) return;
    
    profile.restarts++;
    
    const alert: Alert = {
      id: `restart-${service}-${Date.now()}`,
      timestamp: Date.now(),
      service,
      severity: 'warning',
      message: `Service restarted due to memory pressure (restart #${profile.restarts})`,
      metric: data,
      resolved: false
    };
    
    this?.alerts?.set(alert.id, alert);
    this.broadcastUpdate('alert', alert);
  }
  
  /**
   * Check alert rules
   */
  private checkAlertRules(): void {
    const now = Date.now();
    
    for (const rule of this.alertRules) {
      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown) {
        continue;
      }
      
      // Check each service or all services
      const servicesToCheck = rule.service === '*' 
        ? Array.from(this?.services?.keys())
        : [rule.service];
      
      for (const service of servicesToCheck) {
        const profile = this?.services?.get(service);
        if (!profile) continue;
        
        let triggered = false;
        
        switch (rule.metric) {
          case 'memory':
            if (profile.memoryPercent && profile.memoryPercent >= rule.threshold) {
              triggered = true;
            }
            break;
            
          case 'restart':
            if (profile.restarts >= rule.threshold) {
              triggered = true;
            }
            break;
            
          case 'leak':
            if (profile.leaks >= rule.threshold) {
              triggered = true;
            }
            break;
        }
        
        if (triggered) {
          this.triggerAlertAction(rule, service, profile);
          rule.lastTriggered = now;
        }
      }
    }
  }
  
  /**
   * Trigger alert action
   */
  private async triggerAlertAction(
    rule: AlertRule,
    service: string,
    profile: ServiceMemoryProfile
  ): Promise<void> {
    logger.info('Alert rule triggered', 'MEMORY_MONITOR', {
      rule: rule.id,
      service,
      action: rule.action
    });
    
    switch (rule.action) {
      case 'log':
        logger.warn('Alert rule triggered', 'MEMORY_MONITOR', { rule, service, profile });
        break;
        
      case 'notify':
        this.emit('alert-notification', { rule, service, profile });
        break;
        
      case 'restart':
        await this.restartService(service);
        break;
        
      case 'scale':
        this.emit('scale-request', { service, profile });
        break;
    }
  }
  
  /**
   * Restart a service
   */
  private async restartService(service: string): Promise<void> {
    try {
      logger.info(`Restarting service ${service}`, 'MEMORY_MONITOR');
      await execAsync(`systemctl restart walmart-${service}`);
      
      const profile = this?.services?.get(service);
      if (profile) {
        profile.restarts++;
      }
      
    } catch (error) {
      logger.error(`Failed to restart service ${service}`, 'MEMORY_MONITOR', { error });
      throw error;
    }
  }
  
  /**
   * Store metrics in Redis
   */
  private async storeMetrics(service: string, profile: ServiceMemoryProfile): Promise<void> {
    const key = `metrics:${service}:${Date.now()}`;
    const ttl = Math.floor(this.METRICS_RETENTION / 1000); // Convert to seconds
    
    try {
      await this?.redis.setex(key, ttl, JSON.stringify(profile));
    } catch (error) {
      logger.error('Failed to store metrics', 'MEMORY_MONITOR', { error, service });
    }
  }
  
  /**
   * Get service metrics history
   */
  private async getServiceMetricsHistory(service: string): Promise<ServiceMemoryProfile[]> {
    try {
      const pattern = `metrics:${service}:*`;
      const keys = await this?.redis.keys(pattern);
      
      if (keys?.length || 0 === 0) return [];
      
      const values = await this?.redis.mget(...keys);
      
      return values
        .filter((v: any): v is string => v !== null)
        .map((v: string) => JSON.parse(v))
        .sort((a: ServiceMemoryProfile, b: ServiceMemoryProfile) => b.lastUpdate - a.lastUpdate)
        .slice(0, 100); // Return last 100 metrics
        
    } catch (error) {
      logger.error('Failed to get metrics history', 'MEMORY_MONITOR', { error, service });
      return [];
    }
  }
  
  /**
   * Collect all metrics
   */
  private async collectAllMetrics(): Promise<any> {
    const services = Array.from(this?.services?.values());
    const totalMemoryUsed = services.reduce((sum: any, s: any) => sum + (s.currentMemory || 0), 0);
    const totalMemoryLimit = services.reduce((sum: any, s: any) => sum + s.maxMemory, 0);
    
    return {
      timestamp: Date.now(),
      totalMemoryUsed,
      totalMemoryLimit,
      memoryPercent: totalMemoryUsed / totalMemoryLimit,
      services,
      alerts: Array.from(this?.alerts?.values()).filter(a => !a.resolved).length,
      healthy: services?.filter(s => s.status === 'healthy').length,
      warning: services?.filter(s => s.status === 'warning').length,
      critical: services?.filter(s => s.status === 'critical').length,
      offline: services?.filter(s => s.status === 'offline').length
    };
  }
  
  /**
   * Generate memory report
   */
  private async generateReport(): Promise<MemoryReport> {
    const services = Array.from(this?.services?.values());
    const alerts = Array.from(this?.alerts?.values());
    
    const totalMemoryUsed = services.reduce((sum: any, s: any) => sum + (s.currentMemory || 0), 0);
    const totalMemoryLimit = services.reduce((sum: any, s: any) => sum + s.maxMemory, 0);
    
    const recommendations: string[] = [];
    
    // Generate recommendations
    for (const service of services) {
      if (service.memoryPercent && service.memoryPercent > 0.8) {
        recommendations.push(`Consider increasing memory limit for ${service.service}`);
      }
      
      if (service.restarts > 2) {
        recommendations.push(`${service.service} has restarted ${service.restarts} times - investigate memory leaks`);
      }
      
      if (service.leaks > 0) {
        recommendations.push(`Memory leak detected in ${service.service} - take heap snapshot for analysis`);
      }
    }
    
    return {
      timestamp: Date.now(),
      totalMemoryUsed,
      totalMemoryLimit,
      services,
      alerts,
      recommendations
    };
  }
  
  /**
   * Generate and save report
   */
  private async generateAndSaveReport(): Promise<void> {
    try {
      const report = await this.generateReport();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-report-${timestamp}.json`;
      const filepath = join(this.REPORT_DIR, filename);
      
      await writeFile(filepath, JSON.stringify(report, null, 2));
      
      logger.info('Memory report saved', 'MEMORY_MONITOR', { filepath });
      
      // Emit report event
      this.emit('report-generated', report);
      
    } catch (error) {
      logger.error('Failed to generate report', 'MEMORY_MONITOR', { error });
    }
  }
  
  /**
   * Ensure report directory exists
   */
  private async ensureReportDirectory(): Promise<void> {
    if (!existsSync(this.REPORT_DIR)) {
      await mkdir(this.REPORT_DIR, { recursive: true });
    }
  }
  
  /**
   * Cleanup old metrics from Redis
   */
  private async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoff = Date.now() - this.METRICS_RETENTION;
      const pattern = 'metrics:*:*';
      const keys = await this?.redis.keys(pattern);
      
      const toDelete: string[] = [];
      
      for (const key of keys) {
        const timestamp = parseInt(key.split(':')[2] || '0');
        if (timestamp < cutoff) {
          toDelete.push(key);
        }
      }
      
      if (toDelete?.length || 0 > 0) {
        await this?.redis.del(...toDelete);
        logger.debug(`Cleaned up ${toDelete?.length || 0} old metrics`, 'MEMORY_MONITOR');
      }
      
    } catch (error) {
      logger.error('Failed to cleanup old metrics', 'MEMORY_MONITOR', { error });
    }
  }
  
  /**
   * Shutdown the monitoring service
   */
  async shutdown(): Promise<void> {
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Shutdown memory managers
    for (const manager of this?.memoryManagers?.values()) {
      await manager.shutdown();
    }
    
    // Close WebSocket server
    if (this.wss) {
      this?.wss?.close();
    }
    
    // Close Redis connection
    await this?.redis.quit();
    
    logger.info('Memory Monitoring Service shutdown', 'MEMORY_MONITOR');
  }
}

// Export singleton getter
export const getMemoryMonitor = () => MemoryMonitoringService.getInstance();