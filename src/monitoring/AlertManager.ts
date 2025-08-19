/**
 * Enhanced Alert Manager
 * Comprehensive alerting system with intelligent thresholds and escalation
 */

import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
// Import nodemailer and discord.js only if available
let nodemailer: any;
let WebhookClient: any;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  // nodemailer not available
}
try {
  const discord = require('discord.js');
  WebhookClient = discord.WebhookClient;
} catch (error) {
  // discord.js not available
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;
  timestamp: number;
  resolvedAt?: number;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  metadata?: Record<string, any>;
  escalated?: boolean;
  escalatedAt?: number;
  escalationLevel?: number;
  suppressUntil?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  component: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  escalationMinutes?: number;
  description: string;
  tags: string[];
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'webhook' | 'discord' | 'slack' | 'console';
  name: string;
  config: Record<string, any>;
  severityFilter: ('info' | 'warning' | 'error' | 'critical')[];
  componentFilter?: string[];
  enabled: boolean;
}

export interface SLODefinition {
  name: string;
  description: string;
  target: number; // percentage (e.g., 99.9)
  window: number; // time window in milliseconds
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  alertOnBreach: boolean;
  escalateAfterMinutes?: number;
}

class AlertManager extends EventEmitter {
  private static instance: AlertManager;
  private alerts = new Map<string, Alert>();
  private alertRules = new Map<string, AlertRule>();
  private notificationChannels = new Map<string, NotificationChannel>();
  private sloDefinitions = new Map<string, SLODefinition>();
  private lastAlertTimes = new Map<string, number>(); // For cooldown tracking
  private alertCounts = new Map<string, number>(); // For frequency tracking
  private checkInterval?: NodeJS.Timeout;
  private initialized = false;
  private emailTransporter?: any;

  private constructor() {
    super();
    this.setupDefaultRules();
    this.setupDefaultChannels();
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Alert manager already initialized', 'ALERT_MGR');
      return;
    }

    // Setup email transporter if configured
    await this.setupEmailTransporter();

    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.checkEscalations();
      this.cleanupOldAlerts();
    }, 60 * 1000); // Every minute

    this.initialized = true;
    logger.info('Alert manager initialized', 'ALERT_MGR', {
      rules: this.alertRules.size,
      channels: this.notificationChannels.size,
      slos: this.sloDefinitions.size,
    });
    this.emit('initialized');
  }

  private setupDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        component: 'api',
        condition: 'error_rate > threshold',
        threshold: 5, // 5%
        severity: 'error',
        enabled: true,
        cooldownMinutes: 10,
        escalationMinutes: 30,
        description: 'API error rate is above acceptable threshold',
        tags: ['api', 'errors', 'reliability'],
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        component: 'api',
        condition: 'p95_response_time > threshold',
        threshold: 2000, // 2 seconds
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 15,
        description: 'API response time is slower than expected',
        tags: ['api', 'performance', 'latency'],
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        component: 'system',
        condition: 'memory_usage_percent > threshold',
        threshold: 85, // 85%
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 5,
        escalationMinutes: 15,
        description: 'System memory usage is high',
        tags: ['system', 'memory', 'resources'],
      },
      {
        id: 'critical_memory_usage',
        name: 'Critical Memory Usage',
        component: 'system',
        condition: 'memory_usage_percent > threshold',
        threshold: 95, // 95%
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 2,
        escalationMinutes: 5,
        description: 'System memory usage is critically high',
        tags: ['system', 'memory', 'critical'],
      },
      {
        id: 'websocket_connection_spike',
        name: 'WebSocket Connection Spike',
        component: 'websocket',
        condition: 'new_connections_per_minute > threshold',
        threshold: 100,
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 5,
        description: 'Unusual spike in WebSocket connections',
        tags: ['websocket', 'connections', 'spike'],
      },
      {
        id: 'database_slow_queries',
        name: 'Database Slow Queries',
        component: 'database',
        condition: 'slow_query_rate > threshold',
        threshold: 10, // 10%
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 10,
        description: 'High rate of slow database queries',
        tags: ['database', 'performance', 'queries'],
      },
      {
        id: 'rum_high_bounce_rate',
        name: 'High User Bounce Rate',
        component: 'frontend',
        condition: 'bounce_rate > threshold',
        threshold: 70, // 70%
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30,
        description: 'User bounce rate is higher than expected',
        tags: ['frontend', 'user-experience', 'bounce-rate'],
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private setupDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'console',
        type: 'console',
        name: 'Console Logging',
        config: {},
        severityFilter: ['info', 'warning', 'error', 'critical'],
        enabled: true,
      },
      {
        id: 'error_log',
        type: 'console',
        name: 'Error Log File',
        config: { logLevel: 'error' },
        severityFilter: ['error', 'critical'],
        enabled: true,
      },
    ];

    // Add email channel if configured
    if (process.env.ALERT_EMAIL_HOST) {
      defaultChannels.push({
        id: 'email_alerts',
        type: 'email',
        name: 'Email Alerts',
        config: {
          host: process.env.ALERT_EMAIL_HOST,
          port: parseInt(process.env.ALERT_EMAIL_PORT || '587'),
          secure: process.env.ALERT_EMAIL_SECURE === 'true',
          auth: {
            user: process.env.ALERT_EMAIL_USER,
            pass: process.env.ALERT_EMAIL_PASS,
          },
          from: process.env.ALERT_EMAIL_FROM || 'alerts@localhost',
          to: (process.env.ALERT_EMAIL_TO || '').split(','),
        },
        severityFilter: ['error', 'critical'],
        enabled: true,
      });
    }

    // Add Discord webhook if configured
    if (process.env.DISCORD_WEBHOOK_URL) {
      defaultChannels.push({
        id: 'discord_alerts',
        type: 'discord',
        name: 'Discord Alerts',
        config: {
          webhookUrl: process.env.DISCORD_WEBHOOK_URL,
        },
        severityFilter: ['warning', 'error', 'critical'],
        enabled: true,
      });
    }

    defaultChannels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });
  }

  private setupDefaultSLOs(): void {
    const defaultSLOs: SLODefinition[] = [
      {
        name: 'API Availability',
        description: 'API should be available 99.9% of the time',
        target: 99.9,
        window: 24 * 60 * 60 * 1000, // 24 hours
        metric: 'availability_percent',
        threshold: 99.9,
        operator: 'gte',
        alertOnBreach: true,
        escalateAfterMinutes: 15,
      },
      {
        name: 'Response Time SLO',
        description: 'P95 response time should be under 100ms',
        target: 100,
        window: 60 * 60 * 1000, // 1 hour
        metric: 'p95_response_time',
        threshold: 100,
        operator: 'lte',
        alertOnBreach: true,
        escalateAfterMinutes: 30,
      },
      {
        name: 'Error Rate SLO',
        description: 'Error rate should be below 1%',
        target: 1,
        window: 60 * 60 * 1000, // 1 hour
        metric: 'error_rate_percent',
        threshold: 1,
        operator: 'lte',
        alertOnBreach: true,
        escalateAfterMinutes: 10,
      },
    ];

    defaultSLOs.forEach(slo => {
      this.sloDefinitions.set(slo.name, slo);
    });
  }

  private async setupEmailTransporter(): Promise<void> {
    const emailChannel = this.notificationChannels.get('email_alerts');
    if (emailChannel && emailChannel.enabled && nodemailer) {
      try {
        this.emailTransporter = nodemailer.createTransporter(emailChannel.config);
        await this.emailTransporter?.verify();
        logger.info('Email transporter configured successfully', 'ALERT_MGR');
      } catch (error) {
        logger.warn('Failed to setup email transporter', 'ALERT_MGR', error as Error);
        emailChannel.enabled = false;
      }
    } else if (!nodemailer && emailChannel?.enabled) {
      logger.warn('Nodemailer not available, disabling email channel', 'ALERT_MGR');
      emailChannel.enabled = false;
    }
  }

  // Create a new alert
  async createAlert(
    type: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    component: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const alertId = this.generateAlertId();
    const now = Date.now();

    // Check cooldown
    const cooldownKey = `${type}_${component}`;
    const lastAlertTime = this.lastAlertTimes.get(cooldownKey) || 0;
    const rule = this.alertRules.get(type);
    const cooldownMs = (rule?.cooldownMinutes || 5) * 60 * 1000;

    if (now - lastAlertTime < cooldownMs) {
      logger.debug('Alert suppressed due to cooldown', 'ALERT_MGR', {
        type,
        component,
        cooldownRemaining: cooldownMs - (now - lastAlertTime),
      });
      return alertId; // Return ID but don't actually create alert
    }

    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      message,
      component,
      timestamp: now,
      metadata,
    };

    this.alerts.set(alertId, alert);
    this.lastAlertTimes.set(cooldownKey, now);
    
    // Update alert frequency tracking
    const currentCount = this.alertCounts.get(cooldownKey) || 0;
    this.alertCounts.set(cooldownKey, currentCount + 1);

    // Send notifications
    await this.sendNotifications(alert);

    // Emit event
    this.emit('alert-created', alert);

    logger.info('Alert created', 'ALERT_MGR', {
      id: alertId,
      type,
      severity,
      component,
      title,
    });

    return alertId;
  }

  // Resolve an alert
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolvedAt) {
      return false;
    }

    alert.resolvedAt = Date.now();
    this.alerts.set(alertId, alert);

    // Send resolution notification
    await this.sendResolutionNotification(alert, resolvedBy);

    this.emit('alert-resolved', alert);

    logger.info('Alert resolved', 'ALERT_MGR', {
      id: alertId,
      type: alert.type,
      component: alert.component,
      duration: alert.resolvedAt - alert.timestamp,
      resolvedBy,
    });

    return true;
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.acknowledged) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();
    this.alerts.set(alertId, alert);

    this.emit('alert-acknowledged', alert);

    logger.info('Alert acknowledged', 'ALERT_MGR', {
      id: alertId,
      acknowledgedBy,
    });

    return true;
  }

  // Send notifications through configured channels
  private async sendNotifications(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const channel of this.notificationChannels.values() || []) {
      if (!channel.enabled) continue;
      if (!channel.severityFilter?.includes(alert.severity)) continue;
      if (channel.componentFilter && !channel.componentFilter.includes(alert.component)) continue;

      promises.push(this.sendNotification(channel, alert));
    }

    await Promise.allSettled(promises);
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case 'console':
          this.sendConsoleNotification(alert);
          break;
        case 'email':
          await this.sendEmailNotification(channel, alert);
          break;
        case 'discord':
          await this.sendDiscordNotification(channel, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, alert);
          break;
        default:
          logger.warn('Unknown notification channel type', 'ALERT_MGR', { type: channel.type });
      }
    } catch (error) {
      logger.error('Failed to send notification', 'ALERT_MGR', {
        channel: channel.name,
        alertId: alert.id,
      }, error as Error);
    }
  }

  private sendConsoleNotification(alert: Alert): void {
    const logLevel = alert.severity === 'critical' ? 'error' : 
                    alert.severity === 'error' ? 'error' :
                    alert.severity === 'warning' ? 'warn' : 'info';
    
    if (logLevel === 'error') {
      logger.error(`ALERT: ${alert.title}`, 'ALERT', {
        id: alert.id,
        type: alert.type,
        component: alert.component,
        message: alert.message,
        metadata: alert.metadata,
      }, undefined);
    } else if (logLevel === 'warn') {
      logger.warn(`ALERT: ${alert.title}`, 'ALERT', {
        id: alert.id,
        type: alert.type,
        component: alert.component,
        message: alert.message,
        metadata: alert.metadata,
      });
    } else {
      logger.info(`ALERT: ${alert.title}`, 'ALERT', {
        id: alert.id,
        type: alert.type,
        component: alert.component,
        message: alert.message,
        metadata: alert.metadata,
      });
    }
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!this.emailTransporter || !nodemailer) return;

    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    };

    const html = `
      <h2>${severityEmoji[alert.severity]} ${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert?.severity?.toUpperCase()}</p>
      <p><strong>Component:</strong> ${alert.component}</p>
      <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      ${alert.metadata ? `<pre>${JSON.stringify(alert.metadata, null, 2)}</pre>` : ''}
      <hr>
      <p><small>Alert ID: ${alert.id}</small></p>
    `;

    await this.emailTransporter?.sendMail({
      from: channel.config?.from,
      to: channel.config?.to,
      subject: `[${alert.severity?.toUpperCase()}] ${alert.title}`,
      html,
    });
  }

  private async sendDiscordNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!WebhookClient) {
      logger.warn('Discord.js not available, cannot send Discord notification', 'ALERT_MGR');
      return;
    }
    const webhook = new WebhookClient({ url: channel.config?.webhookUrl });
    
    const colorMap = {
      info: 0x3498db,     // Blue
      warning: 0xf39c12,  // Orange
      error: 0xe74c3c,    // Red
      critical: 0x8e44ad, // Purple
    };

    await webhook.send({
      embeds: [{
        title: alert.title,
        description: alert.message,
        color: colorMap[alert.severity],
        fields: [
          { name: 'Component', value: alert.component, inline: true },
          { name: 'Severity', value: alert.severity?.toUpperCase() || '', inline: true },
          { name: 'Time', value: new Date(alert.timestamp).toISOString(), inline: true },
        ],
        footer: { text: `Alert ID: ${alert.id}` },
        timestamp: new Date(alert.timestamp).toISOString(),
      }],
    });
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const payload = {
      alert,
      timestamp: Date.now(),
      source: 'walmart-grocery-agent',
    };

    const response = await fetch(channel.config?.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config?.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendResolutionNotification(alert: Alert, resolvedBy?: string): Promise<void> {
    // Send resolution notifications through appropriate channels
    const resolutionAlert: Alert = {
      ...alert,
      title: `RESOLVED: ${alert.title}`,
      message: `Alert has been resolved. Original message: ${alert.message}`,
      severity: 'info',
      metadata: {
        ...alert.metadata,
        originalAlertId: alert.id,
        resolvedBy,
        resolutionTime: alert.resolvedAt,
        duration: alert.resolvedAt ? alert.resolvedAt - alert.timestamp : 0,
      },
    };

    await this.sendNotifications(resolutionAlert);
  }

  // Check for alerts that need escalation
  private checkEscalations(): void {
    const now = Date.now();
    
    for (const alert of this.alerts.values()) {
      if (alert.resolvedAt || alert.escalated) continue;
      
      const rule = this.alertRules.get(alert.type);
      if (!rule?.escalationMinutes) continue;
      
      const escalationTime = alert.timestamp + (rule.escalationMinutes * 60 * 1000);
      
      if (now >= escalationTime) {
        this.escalateAlert(alert);
      }
    }
  }

  private async escalateAlert(alert: Alert): Promise<void> {
    alert.escalated = true;
    alert.escalatedAt = Date.now();
    alert.escalationLevel = (alert.escalationLevel || 0) + 1;
    
    // Create escalation alert
    await this.createAlert(
      'alert_escalation',
      'critical',
      `ESCALATED: ${alert.title}`,
      `Alert has been escalated due to lack of resolution. Original: ${alert.message}`,
      'alert_system',
      {
        originalAlertId: alert.id,
        escalationLevel: alert.escalationLevel,
        timeUnresolved: alert.escalatedAt - alert.timestamp,
      }
    );

    this.emit('alert-escalated', alert);
    
    logger.warn('Alert escalated', 'ALERT_MGR', {
      id: alert.id,
      type: alert.type,
      escalationLevel: alert.escalationLevel,
      timeUnresolved: alert.escalatedAt - alert.timestamp,
    });
  }

  // Clean up old resolved alerts
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(alertId);
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getAlerts(filters?: {
    severity?: ('info' | 'warning' | 'error' | 'critical')[];
    component?: string[];
    resolved?: boolean;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (filters) {
      if (filters.severity) {
        alerts = alerts?.filter(a => filters.severity!.includes(a.severity));
      }
      if (filters.component) {
        alerts = alerts?.filter(a => filters.component!.includes(a.component));
      }
      if (filters.resolved !== undefined) {
        alerts = alerts?.filter(a => Boolean(a.resolvedAt) === filters.resolved);
      }
    }
    
    alerts.sort((a, b) => b.timestamp - a.timestamp);
    
    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }
    
    return alerts;
  }

  getAlertStats(): {
    total: number;
    unresolved: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    const unresolved = alerts?.filter(a => !a.resolvedAt);
    
    const byCategory = alerts.reduce((acc: any, alert: any) => {
      acc[alert.component] = (acc[alert.component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const bySeverity = alerts.reduce((acc: any, alert: any) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: alerts?.length || 0,
      unresolved: unresolved?.length || 0,
      byCategory,
      bySeverity,
    };
  }

  // Rule management
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info('Alert rule added', 'ALERT_MGR', { id: rule.id, name: rule.name });
  }

  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) return false;
    
    this.alertRules.set(id, { ...rule, ...updates });
    logger.info('Alert rule updated', 'ALERT_MGR', { id, updates });
    return true;
  }

  // Channel management
  addNotificationChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, channel);
    logger.info('Notification channel added', 'ALERT_MGR', { id: channel.id, type: channel.type });
  }

  // SLO management
  addSLO(slo: SLODefinition): void {
    this.sloDefinitions.set(slo.name, slo);
    logger.info('SLO definition added', 'ALERT_MGR', { name: slo.name });
  }

  checkSLO(sloName: string, currentValue: number): void {
    const slo = this.sloDefinitions.get(sloName);
    if (!slo || !slo.alertOnBreach) return;
    
    let breached = false;
    switch (slo.operator) {
      case 'gt': breached = currentValue <= slo.threshold; break;
      case 'lt': breached = currentValue >= slo.threshold; break;
      case 'gte': breached = currentValue < slo.threshold; break;
      case 'lte': breached = currentValue > slo.threshold; break;
      case 'eq': breached = currentValue !== slo.threshold; break;
    }
    
    if (breached) {
      this.createAlert(
        'slo_breach',
        'error',
        `SLO Breach: ${slo.name}`,
        `${slo.description}. Current: ${currentValue}, Target: ${slo.threshold}`,
        'slo_monitor',
        {
          sloName,
          currentValue,
          target: slo.threshold,
          operator: slo.operator,
        }
      );
    }
  }

  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.initialized = false;
    logger.info('Alert manager shut down', 'ALERT_MGR');
  }
}

export const alertManager = AlertManager.getInstance();
export { AlertManager };
