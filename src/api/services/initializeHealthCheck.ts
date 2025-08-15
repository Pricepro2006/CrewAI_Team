/**
 * Health Check Service Initialization
 * Initializes comprehensive health monitoring at server startup
 */

import { initializeHealthCheckService, getHealthCheckService } from "../../monitoring/HealthCheckService.js";
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
    // Initialize with custom configuration
    const service = initializeHealthCheckService({
      intervalMs: 30000,    // Check every 30 seconds
      timeoutMs: 5000,      // 5 second timeout for each check
      retries: 3,           // Retry failed checks 3 times
      circuitBreakerThreshold: 5, // Open circuit after 5 failures
    });

    // Set up event listeners for critical health events
    service.on("health:critical", (health: any) => {
      logger.error("CRITICAL: System health is unhealthy", "HEALTH", {
        status: health.status,
        failedServices: health.services
          .filter(s => s.status === "unhealthy")
          .map(s => s.name),
      });
      
      // In production, this would trigger alerts
      // sendAlert("System Critical", health);
    });

    service.on("health:warning", (health: any) => {
      logger.warn("WARNING: System health is degraded", "HEALTH", {
        status: health.status,
        degradedServices: health.services
          .filter(s => s.status === "degraded")
          .map(s => s.name),
      });
    });

    service.on("circuit:open", ({ service: serviceName, breaker }) => {
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
  const service = getHealthCheckService();
  
  if (service) {
    service.shutdown();
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