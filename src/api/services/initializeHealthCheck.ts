/**
 * Health Check Service Initialization
 * Initializes comprehensive health monitoring at server startup
 */

import { healthCheckService } from "../../monitoring/HealthCheckService.js";
import { logger } from "../../utils/logger.js";

let isInitialized = false;

/**
 * Initialize the Health Check Service
 */
export async function initializeHealthCheck(): Promise<void> {
  if (isInitialized) {
    logger.info("Health Check Service already initialized", "HEALTH");
    return;
  }

  try {
    // Get the health check service instance
    const service = healthCheckService;
    
    // Start health monitoring with custom configuration
    // Note: The service is already configured, so we just start monitoring
    service.startHealthMonitoring();

    // Set up event listeners for critical health events
    interface HealthData {
      status: string;
      services: Array<{
        name: string;
        status: string;
      }>;
    }
    
    service.on("health:critical", (health: HealthData) => {
      logger.error("CRITICAL: System health is unhealthy", "HEALTH", {
        status: health.status,
        failedServices: health.services
          .filter((s: any) => s.status === "unhealthy")
          .map((s: any) => s.name),
      });
      
      // In production, this would trigger alerts
      // sendAlert("System Critical", health);
    });

    service.on("health:warning", (health: HealthData) => {
      logger.warn("WARNING: System health is degraded", "HEALTH", {
        status: health.status,
        degradedServices: health.services
          .filter((s: any) => s.status === "degraded")
          .map((s: any) => s.name),
      });
    });

    interface CircuitBreakerEvent {
      service: string;
      breaker: {
        failures: number;
        lastFailure: Date;
        nextRetry: Date;
      };
    }
    
    service.on("circuit:open", ({ service: serviceName, breaker }: CircuitBreakerEvent) => {
      logger.error(`Circuit breaker opened for service: ${serviceName}`, "HEALTH", {
        failures: breaker.failures,
        lastFailure: breaker.lastFailure,
        nextRetry: breaker.nextRetry,
      });
      
      // In production, this would trigger specific service recovery
      // triggerServiceRecovery(serviceName);
    });

    isInitialized = true;
    logger.info("Health Check Service initialized successfully", "HEALTH");
  } catch (error) {
    logger.error(`Failed to initialize Health Check Service: ${error}`, "HEALTH");
    throw error;
  }
}

/**
 * Shutdown the Health Check Service
 */
export async function shutdownHealthCheck(): Promise<void> {
  if (healthCheckService) {
    healthCheckService.stopAllHealthChecks();
    isInitialized = false;
    logger.info("Health Check Service shutdown complete", "HEALTH");
  }
}

/**
 * Send alert to configured notification channels
 * This is a placeholder for actual alert implementation
 */
async function sendAlert(type: string, data: any): Promise<void> {
  // In production, this would integrate with:
  // - Email service
  // - Slack/Teams webhooks
  // - PagerDuty API
  // - Custom monitoring systems
  
  logger.info(`Alert triggered: ${type}`, "HEALTH_ALERT", data);
}

/**
 * Trigger service recovery procedures
 * This is a placeholder for actual recovery implementation
 */
async function triggerServiceRecovery(serviceName: string): Promise<void> {
  // In production, this would:
  // - Attempt service restart
  // - Switch to backup service
  // - Scale up healthy instances
  // - Notify operations team
  
  logger.info(`Recovery triggered for service: ${serviceName}`, "HEALTH_RECOVERY");
}

export default {
  initialize: initializeHealthCheck,
  shutdown: shutdownHealthCheck,
};