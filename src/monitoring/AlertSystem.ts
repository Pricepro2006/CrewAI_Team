import { EventEmitter } from 'node:events';
import { sentryErrorTracker } from './SentryErrorTracker.js';
import { logger } from '../utils/logger.js';
import { schedule } from 'node-cron';

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  component: string;
  timestamp: Date;
  data?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (data: any) => boolean;
  severity: Alert['severity'];
  component: string;
  enabled: boolean;
  throttleMinutes?: number;
  escalationLevels?: AlertEscalationLevel[];
  notificationChannels: NotificationChannel[];
}

export interface AlertEscalationLevel {
  level: number;
  delayMinutes: number;
  channels: NotificationChannel[];
}

export type NotificationChannel = 
  | 'email'
  | 'slack'
  | 'webhook'
  | 'sms'
  | 'pagerduty'
  | 'discord'
  | 'teams'
  | 'console';

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
    from: string;
    to: string[];
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    username?: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
    method: 'POST' | 'PUT';
  };
  sms?: {
    enabled: boolean;
    provider: 'twilio' | 'aws-sns';
    config: Record<string, any>;
    numbers: string[];
  };
  pagerduty?: {
    enabled: boolean;
    integrationKey: string;
  };
  discord?: {
    enabled: boolean;
    webhookUrl: string;
  };
  teams?: {
    enabled: boolean;
    webhookUrl: string;
  };
}

export class AlertSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private throttleCache: Map<string, number> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: NotificationConfig;
  private maxAlertsRetention = 10000;

  constructor(config: NotificationConfig = {}) {
    super();
    this.config = config;
    this.setupDefaultRules();
    this.setupPeriodicCleanup();
  }

  // === Alert Management ===

  createAlert(
    type: string,
    severity: Alert['severity'],
    message: string,
    component: string,
    data?: Record<string, any>
  ): Alert {
    const alertId = this.generateAlertId();
    
    const alert: Alert = {
      id: alertId,
      type,
      severity,
      message,
      component,
      timestamp: new Date(),
      data,
      resolved: false,
    };

    // Check throttling
    const throttleKey = `${type}_${component}`;
    const lastAlertTime = this?.throttleCache?.get(throttleKey) || 0;
    const rule = this.findMatchingRule(alert);
    
    if (rule?.throttleMinutes) {
      const throttleMs = rule.throttleMinutes * 60 * 1000;
      if (Date.now() - lastAlertTime < throttleMs) {
        logger.debug(`Alert throttled: ${type}`, 'ALERT_SYSTEM', {
          alertId,
          throttleRemaining: throttleMs - (Date.now() - lastAlertTime),
        });
        return alert; // Return but don't process
      }
    }

    // Store alert
    this?.alerts?.set(alertId, alert);
    this?.throttleCache?.set(throttleKey, Date.now());

    // Emit event
    this.emit('alert-created', alert);

    // Send notifications
    this.processAlert(alert);

    // Track in Sentry
    sentryErrorTracker.captureError(
      new Error(`Alert: ${message}`),
      {
        component,
        operation: 'alert_system',
      },
      severity === 'critical' ? 'fatal' : 
      severity === 'error' ? 'error' : 
      severity === 'warning' ? 'warning' : 'info',
      {
        alert_id: alertId,
        alert_type: type,
        alert_component: component,
      }
    );

    // Setup escalation if configured
    this.setupEscalation(alert);

    logger.info(`Alert created: ${type}`, 'ALERT_SYSTEM', {
      alertId,
      severity,
      component,
      message,
    });

    // Cleanup old alerts if needed
    this.cleanupOldAlerts();

    return alert;
  }

  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this?.alerts?.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    // Cancel escalation
    const escalationTimer = this?.escalationTimers?.get(alertId);
    if (escalationTimer) {
      clearTimeout(escalationTimer);
      this?.escalationTimers?.delete(alertId);
    }

    this.emit('alert-resolved', alert);

    // Send resolution notification
    this.sendNotification({
      ...alert,
      message: `🟢 RESOLVED: ${alert.message}`,
    }, ['email', 'slack', 'teams']);

    logger.info(`Alert resolved: ${alert.type}`, 'ALERT_SYSTEM', {
      alertId,
      resolvedBy,
      duration: alert?.resolvedAt?.getTime() - alert?.timestamp?.getTime(),
    });

    return true;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this?.alerts?.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.emit('alert-acknowledged', alert);

    logger.info(`Alert acknowledged: ${alert.type}`, 'ALERT_SYSTEM', {
      alertId,
      acknowledgedBy,
    });

    return true;
  }

  // === Alert Rules Management ===

  addRule(rule: AlertRule): void {
    this?.alertRules?.set(rule.id, rule);
    logger.info(`Alert rule added: ${rule.name}`, 'ALERT_SYSTEM', {
      ruleId: rule.id,
      component: rule.component,
      severity: rule.severity,
    });
  }

  removeRule(ruleId: string): boolean {
    const removed = this?.alertRules?.delete(ruleId);
    if (removed) {
      logger.info(`Alert rule removed: ${ruleId}`, 'ALERT_SYSTEM');
    }
    return removed;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this?.alertRules?.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    logger.info(`Alert rule updated: ${rule.name}`, 'ALERT_SYSTEM', {
      ruleId,
      updates: Object.keys(updates),
    });

    return true;
  }

  // === Notification Channels ===

  private async sendNotification(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    const promises = channels?.map(async (channel: any) => {
      try {
        switch (channel) {
          case 'console':
            this.sendConsoleNotification(alert);
            break;
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'slack':
            await this.sendSlackNotification(alert);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert);
            break;
          case 'discord':
            await this.sendDiscordNotification(alert);
            break;
          case 'teams':
            await this.sendTeamsNotification(alert);
            break;
          case 'pagerduty':
            await this.sendPagerDutyNotification(alert);
            break;
          case 'sms':
            await this.sendSMSNotification(alert);
            break;
          default:
            logger.warn(`Unsupported notification channel: ${channel}`, 'ALERT_SYSTEM');
        }
      } catch (error) {
        logger.error(`Failed to send notification via ${channel}`, 'ALERT_SYSTEM', {
          error: (error as Error).message,
          alertId: alert.id,
          channel,
        });
      }
    });

    await Promise.allSettled(promises);
  }

  private sendConsoleNotification(alert: Alert): void {
    const icon = this.getSeverityIcon(alert.severity);
    const color = this.getSeverityColor(alert.severity);
    
    console.log(`\n${color}${icon} ALERT [${alert?.severity?.toUpperCase()}] ${alert.component}${'\x1b[0m'}`);
    console.log(`  Message: ${alert.message}`);
    console.log(`  Time: ${alert?.timestamp?.toISOString()}`);
    console.log(`  ID: ${alert.id}`);
    if (alert.data) {
      console.log(`  Data: ${JSON.stringify(alert.data, null, 2)}`);
    }
    console.log('');
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    if (!this?.config?.email?.enabled) return;

    try {
      // @ts-ignore - nodemailer is optional and may not be installed
      const nodemailer: any = await import('nodemailer').catch(() => null);
      if (!nodemailer) {
        console.error('Nodemailer not available, cannot send email notification');
        return;
      }
      const transporter = nodemailer.default.createTransporter(this?.config?.email.smtp);

    const subject = `🚨 ${alert?.severity?.toUpperCase()} Alert: ${alert.component}`;
    const html = this.generateEmailHTML(alert);

      await transporter.sendMail({
        from: this?.config?.email.from,
        to: this?.config?.email.to.join(', '),
        subject,
        html,
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  private async sendSlackNotification(alert: Alert): Promise<void> {
    if (!this?.config?.slack?.enabled) return;

    const payload = {
      channel: this?.config?.slack.channel,
      username: this?.config?.slack.username || 'AlertBot',
      icon_emoji: this.getSlackIcon(alert.severity),
      attachments: [{
        color: this.getSlackColor(alert.severity),
        title: `${alert?.severity?.toUpperCase()} Alert in ${alert.component}`,
        text: alert.message,
        fields: [
          {
            title: 'Component',
            value: alert.component,
            short: true,
          },
          {
            title: 'Severity',
            value: alert?.severity?.toUpperCase(),
            short: true,
          },
          {
            title: 'Time',
            value: alert?.timestamp?.toISOString(),
            short: false,
          },
        ],
        footer: `Alert ID: ${alert.id}`,
        ts: Math.floor(alert?.timestamp?.getTime() / 1000),
      }],
    };

    const response = await fetch(this?.config?.slack.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    if (!this?.config?.webhook?.enabled) return;

    const response = await fetch(this?.config?.webhook.url, {
      method: this?.config?.webhook.method,
      headers: {
        'Content-Type': 'application/json',
        ...this?.config?.webhook.headers,
      },
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  private async sendDiscordNotification(alert: Alert): Promise<void> {
    if (!this?.config?.discord?.enabled) return;

    const embed = {
      title: `🚨 ${alert?.severity?.toUpperCase()} Alert`,
      description: alert.message,
      color: this.getDiscordColor(alert.severity),
      fields: [
        {
          name: 'Component',
          value: alert.component,
          inline: true,
        },
        {
          name: 'Severity',
          value: alert?.severity?.toUpperCase(),
          inline: true,
        },
        {
          name: 'Time',
          value: alert?.timestamp?.toISOString(),
          inline: false,
        },
      ],
      footer: {
        text: `Alert ID: ${alert.id}`,
      },
      timestamp: alert?.timestamp?.toISOString(),
    };

    const response = await fetch(this?.config?.discord.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      throw new Error(`Discord notification failed: ${response.statusText}`);
    }
  }

  private async sendTeamsNotification(alert: Alert): Promise<void> {
    if (!this?.config?.teams?.enabled) return;

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: `${alert?.severity?.toUpperCase()} Alert in ${alert.component}`,
      themeColor: this.getTeamsColor(alert.severity),
      sections: [{
        activityTitle: `🚨 ${alert?.severity?.toUpperCase()} Alert`,
        activitySubtitle: alert.component,
        text: alert.message,
        facts: [
          {
            name: 'Severity',
            value: alert?.severity?.toUpperCase(),
          },
          {
            name: 'Component',
            value: alert.component,
          },
          {
            name: 'Time',
            value: alert?.timestamp?.toISOString(),
          },
          {
            name: 'Alert ID',
            value: alert.id,
          },
        ],
      }],
    };

    const response = await fetch(this?.config?.teams.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Teams notification failed: ${response.statusText}`);
    }
  }

  private async sendPagerDutyNotification(alert: Alert): Promise<void> {
    if (!this?.config?.pagerduty?.enabled) return;

    const payload = {
      routing_key: this?.config?.pagerduty.integrationKey,
      event_action: 'trigger',
      dedup_key: `${alert.component}_${alert.type}`,
      payload: {
        summary: alert.message,
        source: alert.component,
        severity: alert.severity,
        component: alert.component,
        group: 'grocery_agent',
        class: alert.type,
        custom_details: alert.data,
      },
    };

    const response = await fetch('https://events?.pagerduty?.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`PagerDuty notification failed: ${response.statusText}`);
    }
  }

  private async sendSMSNotification(alert: Alert): Promise<void> {
    if (!this?.config?.sms?.enabled) return;

    const message = `ALERT [${alert?.severity?.toUpperCase()}] ${alert.component}: ${alert.message}`;

    if (this?.config?.sms.provider === 'twilio') {
      // Implementation would depend on Twilio client
      logger.warn('Twilio SMS not implemented yet', 'ALERT_SYSTEM');
    } else if (this?.config?.sms.provider === 'aws-sns') {
      // Implementation would depend on AWS SDK
      logger.warn('AWS SNS SMS not implemented yet', 'ALERT_SYSTEM');
    }
  }

  // === Helper Methods ===

  private processAlert(alert: Alert): void {
    const rule = this.findMatchingRule(alert);
    const channels = rule?.notificationChannels || ['console'];
    
    this.sendNotification(alert, channels);
  }

  private findMatchingRule(alert: Alert): AlertRule | undefined {
    return Array.from(this?.alertRules?.values()).find(rule => 
      rule.enabled && 
      rule.component === alert.component &&
      rule.condition(alert)
    );
  }

  private setupEscalation(alert: Alert): void {
    const rule = this.findMatchingRule(alert);
    if (!rule?.escalationLevels?.length) return;

    rule?.escalationLevels?.forEach(level => {
      const timer = setTimeout(() => {
        if (!alert.resolved && !alert.acknowledgedBy) {
          logger.warn(`Escalating alert level ${level.level}: ${alert.type}`, 'ALERT_SYSTEM', {
            alertId: alert.id,
            level: level.level,
          });

          this.sendNotification({
            ...alert,
            message: `🔺 ESCALATED (Level ${level.level}): ${alert.message}`,
          }, level.channels);
        }
      }, level.delayMinutes * 60 * 1000);

      this?.escalationTimers?.set(`${alert.id}_${level.level}`, timer);
    });
  }

  private setupDefaultRules(): void {
    // Critical system errors
    this.addRule({
      id: 'critical_errors',
      name: 'Critical System Errors',
      description: 'Triggers on critical system errors',
      condition: (alert: Alert) => alert.severity === 'critical',
      severity: 'critical',
      component: 'system',
      enabled: true,
      throttleMinutes: 5,
      notificationChannels: ['console', 'email', 'slack', 'teams'],
      escalationLevels: [
        {
          level: 1,
          delayMinutes: 10,
          channels: ['pagerduty', 'sms'],
        },
        {
          level: 2,
          delayMinutes: 30,
          channels: ['pagerduty', 'sms', 'email'],
        },
      ],
    });

    // High error rates
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Triggers when error rate exceeds threshold',
      condition: (alert: Alert) => 
        alert?.type?.includes('error_rate') || alert?.type?.includes('failure_rate'),
      severity: 'warning',
      component: 'monitoring',
      enabled: true,
      throttleMinutes: 10,
      notificationChannels: ['console', 'slack'],
    });

    // Performance issues
    this.addRule({
      id: 'performance_issues',
      name: 'Performance Issues',
      description: 'Triggers on performance threshold violations',
      condition: (alert: Alert) => 
        alert?.type?.includes('response_time') || alert?.type?.includes('threshold'),
      severity: 'warning',
      component: 'performance',
      enabled: true,
      throttleMinutes: 15,
      notificationChannels: ['console', 'slack'],
    });
  }

  private setupPeriodicCleanup(): void {
    // Clean up old alerts every hour
    schedule('0 * * * *', () => {
      this.cleanupOldAlerts();
      this.cleanupThrottleCache();
    });
  }

  private cleanupOldAlerts(): void {
    if (this?.alerts?.size <= this.maxAlertsRetention) return;

    const sortedAlerts = Array.from(this?.alerts?.entries())
      .sort(([, a], [, b]) => b?.timestamp?.getTime() - a?.timestamp?.getTime());

    const toDelete = sortedAlerts.slice(this.maxAlertsRetention);
    
    toDelete.forEach(([id]) => {
      this?.alerts?.delete(id);
      
      // Clean up escalation timers
      this?.escalationTimers?.forEach((timer, key) => {
        if (key.startsWith(id)) {
          clearTimeout(timer);
          this?.escalationTimers?.delete(key);
        }
      });
    });

    logger.info(`Cleaned up ${toDelete?.length || 0} old alerts`, 'ALERT_SYSTEM');
  }

  private cleanupThrottleCache(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    this?.throttleCache?.forEach((timestamp, key) => {
      if (timestamp < oneHourAgo) {
        this?.throttleCache?.delete(key);
      }
    });
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Color and icon helpers
  private getSeverityIcon(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'error': return '🟠';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  }

  private getSeverityColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return '\x1b[41m\x1b[37m'; // Red background, white text
      case 'error': return '\x1b[31m'; // Red text
      case 'warning': return '\x1b[33m'; // Yellow text
      case 'info': return '\x1b[36m'; // Cyan text
      default: return '\x1b[0m'; // Reset
    }
  }

  private getSlackIcon(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return ':red_circle:';
      case 'error': return ':orange_circle:';
      case 'warning': return ':yellow_circle:';
      case 'info': return ':blue_circle:';
      default: return ':white_circle:';
    }
  }

  private getSlackColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'error': return '#ff9900';
      case 'warning': return 'warning';
      case 'info': return 'good';
      default: return '#cccccc';
    }
  }

  private getDiscordColor(severity: Alert['severity']): number {
    switch (severity) {
      case 'critical': return 0xFF0000; // Red
      case 'error': return 0xFF9900; // Orange
      case 'warning': return 0xFFFF00; // Yellow
      case 'info': return 0x00BFFF; // Blue
      default: return 0xCCCCCC; // Gray
    }
  }

  private getTeamsColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return 'FF0000';
      case 'error': return 'FF9900';
      case 'warning': return 'FFFF00';
      case 'info': return '00BFFF';
      default: return 'CCCCCC';
    }
  }

  private generateEmailHTML(alert: Alert): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${this.getEmailColor(alert.severity)};">
              ${this.getSeverityIcon(alert.severity)} ${alert?.severity?.toUpperCase()} Alert
            </h2>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Component:</strong> ${alert.component}</p>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>Time:</strong> ${alert?.timestamp?.toISOString()}</p>
              <p><strong>Alert ID:</strong> ${alert.id}</p>
            </div>
            ${alert.data ? `
              <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h4>Additional Data:</h4>
                <pre style="background: #fff; padding: 10px; border-radius: 3px; overflow: auto;">
${JSON.stringify(alert.data, null, 2)}
                </pre>
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `;
  }

  private getEmailColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'error': return '#f57c00';
      case 'warning': return '#fbc02d';
      case 'info': return '#1976d2';
      default: return '#757575';
    }
  }

  // === Public API ===

  getAlerts(filter?: {
    severity?: Alert['severity'];
    component?: string;
    resolved?: boolean;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this?.alerts?.values());

    if (filter) {
      if (filter.severity) {
        alerts = alerts?.filter(a => a.severity === filter.severity);
      }
      if (filter.component) {
        alerts = alerts?.filter(a => a.component === filter.component);
      }
      if (filter.resolved !== undefined) {
        alerts = alerts?.filter(a => a.resolved === filter.resolved);
      }
    }

    alerts.sort((a, b) => b?.timestamp?.getTime() - a?.timestamp?.getTime());

    if (filter?.limit) {
      alerts = alerts.slice(0, filter.limit);
    }

    return alerts;
  }

  getAlertStats(): Record<string, any> {
    const alerts = Array.from(this?.alerts?.values());
    const last24h = alerts?.filter(a => 
      Date.now() - a?.timestamp?.getTime() < 24 * 60 * 60 * 1000
    );

    return {
      total: alerts?.length || 0,
      last24h: last24h?.length || 0,
      unresolved: alerts?.filter(a => !a.resolved).length,
      bySeverity: {
        critical: alerts?.filter(a => a.severity === 'critical').length,
        error: alerts?.filter(a => a.severity === 'error').length,
        warning: alerts?.filter(a => a.severity === 'warning').length,
        info: alerts?.filter(a => a.severity === 'info').length,
      },
      byComponent: alerts.reduce((acc: any, alert: any) => {
        acc[alert.component] = (acc[alert.component] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Alert system configuration updated', 'ALERT_SYSTEM', {
      channels: Object.keys(newConfig),
    });
  }

  testNotification(channel: NotificationChannel): void {
    const testAlert: Alert = {
      id: 'test_alert',
      type: 'test',
      severity: 'info',
      message: 'This is a test notification from the alert system',
      component: 'alert_system',
      timestamp: new Date(),
      resolved: false,
    };

    this.sendNotification(testAlert, [channel]);
  }
}

// Singleton instance
export const alertSystem = new AlertSystem();