import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import type { User } from "../trpc/context.js";
import { guestUserService } from "./GuestUserService.js";

/**
 * Security event types for monitoring
 */
export enum SecurityEventType {
  GUEST_USER_CREATED = "GUEST_USER_CREATED",
  GUEST_ACCESS_DENIED = "GUEST_ACCESS_DENIED",
  GUEST_RATE_LIMITED = "GUEST_RATE_LIMITED",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  AUTH_FAILURE = "AUTH_FAILURE",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  ELEVATED_ACCESS = "ELEVATED_ACCESS",
}

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: Date;
  userId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Security Monitoring Service
 * Tracks and analyzes security events, particularly for guest users
 */
export class SecurityMonitoringService extends EventEmitter {
  private static instance: SecurityMonitoringService;
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 10000;
  private readonly ALERT_THRESHOLDS = {
    guestCreationPerHour: 50,
    failedAuthPerHour: 20,
    deniedAccessPerHour: 100,
    suspiciousActivityPerHour: 10,
  };

  private constructor() {
    super();
    this.setupPeriodicAnalysis();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, "timestamp">): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Add to event history
    this.events.push(fullEvent);
    
    // Maintain size limit
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log to system logger
    const logLevel = this.getLogLevel(event.type);
    logger[logLevel](
      `Security Event: ${event.type}`,
      "SECURITY_MONITOR",
      {
        ...event,
        timestamp: fullEvent?.timestamp?.toISOString(),
      }
    );

    // Emit event for real-time monitoring
    this.emit("security-event", fullEvent);

    // Check for alert conditions
    this.checkAlertConditions(fullEvent);
  }

  /**
   * Get security statistics
   */
  getStats(timeWindowMs: number = 3600000): {
    timeWindow: string;
    totalEvents: number;
    eventCounts: Record<string, number>;
    guestUserStats: any;
    suspiciousIps: string[];
    topDeniedResources: Array<{resource: string; count: number}>;
    alertsTriggered: string[];
  } {
    const now = Date.now();
    const windowStart = new Date(now - timeWindowMs);

    const recentEvents = this.events.filter(
      event => event.timestamp >= windowStart
    );

    const eventCounts = recentEvents.reduce((acc: Record<string, number>, event: SecurityEvent) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get guest user stats
    const guestStats = guestUserService.getStats();

    // Analyze patterns
    const suspiciousIps = this.identifySuspiciousIps(recentEvents);
    const deniedResources = this.getMostDeniedResources(recentEvents);

    return {
      timeWindow: `${timeWindowMs / 60000} minutes`,
      totalEvents: recentEvents?.length || 0,
      eventCounts,
      guestUserStats: guestStats,
      suspiciousIps,
      topDeniedResources: deniedResources.slice(0, 10),
      alertsTriggered: this.getRecentAlerts(timeWindowMs),
    };
  }

  /**
   * Check if a user has suspicious activity
   */
  isUserSuspicious(userId: string, timeWindowMs: number = 600000): boolean {
    const now = Date.now();
    const windowStart = new Date(now - timeWindowMs);

    const userEvents = this.events.filter(
      event => event.userId === userId && event.timestamp >= windowStart
    );

    // Check for suspicious patterns
    const deniedCount = userEvents?.filter(
      event => 
        event.type === SecurityEventType.GUEST_ACCESS_DENIED ||
        event.type === SecurityEventType.PERMISSION_DENIED
    ).length;

    const rateLimitCount = userEvents?.filter(
      event => event.type === SecurityEventType.GUEST_RATE_LIMITED
    ).length;

    return deniedCount > 10 || rateLimitCount > 5;
  }

  /**
   * Get recent security alerts
   */
  private getRecentAlerts(timeWindowMs: number): string[] {
    const alerts: string[] = [];
    const stats = this.getEventCountsByType(timeWindowMs);

    if ((stats.GUEST_USER_CREATED || 0) > this.ALERT_THRESHOLDS.guestCreationPerHour) {
      alerts.push(`High guest user creation rate: ${stats.GUEST_USER_CREATED || 0}/hour`);
    }

    if ((stats.AUTH_FAILURE || 0) > this.ALERT_THRESHOLDS.failedAuthPerHour) {
      alerts.push(`High authentication failure rate: ${stats.AUTH_FAILURE || 0}/hour`);
    }

    if ((stats.GUEST_ACCESS_DENIED || 0) + (stats.PERMISSION_DENIED || 0) > 
        this.ALERT_THRESHOLDS.deniedAccessPerHour) {
      alerts.push(`High access denial rate: ${(stats.GUEST_ACCESS_DENIED || 0) + (stats.PERMISSION_DENIED || 0)}/hour`);
    }

    if ((stats.SUSPICIOUS_ACTIVITY || 0) > this.ALERT_THRESHOLDS.suspiciousActivityPerHour) {
      alerts.push(`Suspicious activity detected: ${stats.SUSPICIOUS_ACTIVITY || 0} events/hour`);
    }

    return alerts;
  }

  /**
   * Get event counts by type
   */
  private getEventCountsByType(timeWindowMs: number): Record<string, number> {
    const now = Date.now();
    const windowStart = new Date(now - timeWindowMs);

    return this.events
      .filter(event => event.timestamp >= windowStart)
      .reduce((acc: Record<string, number>, event: SecurityEvent) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
  }

  /**
   * Identify suspicious IPs
   */
  private identifySuspiciousIps(events: SecurityEvent[]): string[] {
    const ipCounts = events.reduce((acc: Record<string, number>, event: SecurityEvent) => {
      if (event.ip) {
        acc[event.ip] = (acc[event.ip] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(ipCounts)
      .filter(([_, count]) => count > 20)
      .sort((a, b) => b[1] - a[1])
      .map(([ip]) => ip);
  }

  /**
   * Get most denied resources
   */
  private getMostDeniedResources(events: SecurityEvent[]): Array<{resource: string; count: number}> {
    const deniedEvents = events?.filter(
      event => 
        event.type === SecurityEventType.GUEST_ACCESS_DENIED ||
        event.type === SecurityEventType.PERMISSION_DENIED
    );

    const resourceCounts = deniedEvents.reduce((acc: Record<string, number>, event: SecurityEvent) => {
      if (event.resource) {
        acc[event.resource] = (acc[event.resource] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(event: SecurityEvent): void {
    // Check for rapid guest creation from same IP
    if (event.type === SecurityEventType.GUEST_USER_CREATED && event.ip) {
      const recentGuestCreations = this.events.filter(
        e => 
          e.type === SecurityEventType.GUEST_USER_CREATED &&
          e.ip === event.ip &&
          e.timestamp > new Date(Date.now() - 300000) // 5 minutes
      );

      if ((recentGuestCreations?.length || 0) > 5) {
        this.emit("security-alert", {
          type: "RAPID_GUEST_CREATION",
          message: `IP ${event.ip} created ${recentGuestCreations?.length || 0} guest users in 5 minutes`,
          severity: "HIGH",
        });
      }
    }

    // Check for brute force patterns
    if (event.type === SecurityEventType.AUTH_FAILURE && event.ip) {
      const recentFailures = this.events.filter(
        e => 
          e.type === SecurityEventType.AUTH_FAILURE &&
          e.ip === event.ip &&
          e.timestamp > new Date(Date.now() - 600000) // 10 minutes
      );

      if ((recentFailures?.length || 0) > 10) {
        this.emit("security-alert", {
          type: "POTENTIAL_BRUTE_FORCE",
          message: `IP ${event.ip} had ${recentFailures?.length || 0} auth failures in 10 minutes`,
          severity: "CRITICAL",
        });
      }
    }
  }

  /**
   * Get appropriate log level for event type
   */
  private getLogLevel(eventType: SecurityEventType): "info" | "warn" | "error" {
    switch (eventType) {
      case SecurityEventType.GUEST_USER_CREATED:
        return "info";
      case SecurityEventType.GUEST_ACCESS_DENIED:
      case SecurityEventType.GUEST_RATE_LIMITED:
        return "warn";
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
      case SecurityEventType.AUTH_FAILURE:
      case SecurityEventType.PERMISSION_DENIED:
        return "error";
      case SecurityEventType.ELEVATED_ACCESS:
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Setup periodic analysis
   */
  private setupPeriodicAnalysis(): void {
    // Run analysis every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      const alerts = stats?.alertsTriggered;

      if ((alerts?.length || 0) > 0) {
        logger.warn("Security alerts detected in periodic analysis", "SECURITY_MONITOR", {
          alerts,
          stats,
        });
      }

      // Clean up old events (keep last 24 hours)
      const cutoff = new Date(Date.now() - 86400000);
      this.events = this.events.filter(event => event.timestamp >= cutoff);
    }, 300000); // 5 minutes
  }

  /**
   * Generate security report
   */
  generateReport(timeWindowMs: number = 86400000): string {
    const stats = this.getStats(timeWindowMs);
    const now = new Date().toISOString();

    return `
Security Report - Generated: ${now}
===============================================

Time Window: ${stats.timeWindow}
Total Events: ${stats.totalEvents}

Event Breakdown:
${Object.entries(stats.eventCounts)
  .map(([type, count]) => `  - ${type}: ${count}`)
  .join('\n')}

Guest User Statistics:
  - Active Sessions: ${stats?.guestUserStats?.activeSessions}
  - Rate Limited IPs: ${stats?.guestUserStats?.rateLimitedIps}
  - Max Sessions Per IP: ${stats?.guestUserStats?.maxSessionsPerIp}
  - Session TTL: ${stats?.guestUserStats?.sessionTtlMinutes} minutes

Suspicious IPs: ${stats?.suspiciousIps?.length > 0 ? stats?.suspiciousIps?.join(', ') : 'None'}

Top Denied Resources:
${stats.topDeniedResources
  .map(r => `  - ${r.resource}: ${r.count} denials`)
  .join('\n') || '  None'}

Active Alerts:
${stats?.alertsTriggered?.map(alert => `  ⚠️  ${alert}`).join('\n') || '  None'}
`;
  }
}

// Export singleton instance
export const securityMonitor = SecurityMonitoringService.getInstance();