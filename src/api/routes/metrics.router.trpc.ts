/**
 * tRPC Metrics Router - Converted from Express router
 * Provides metrics endpoints for Prometheus scraping via tRPC
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc/enhanced-router.js";
import { metricsCollectionService } from "../../monitoring/MetricsCollectionService.js";
import { groceryAgentMetrics } from "../../monitoring/GroceryAgentMetrics.js";
import { monitoringSystem } from "../../monitoring/MonitoringSystem.js";
import { logger } from "../../utils/logger.js";

export const metricsRouter = router({
  /**
   * Get Prometheus formatted metrics
   */
  prometheus: publicProcedure.query(async () => {
    try {
      // Get Prometheus formatted metrics
      const prometheusMetrics = metricsCollectionService.exportPrometheusMetrics();
      
      return {
        contentType: "text/plain; version=0.0.4",
        metrics: prometheusMetrics
      };
      
    } catch (error) {
      logger.error('Failed to export metrics', 'METRICS_ROUTER', {}, error as Error);
      throw new Error('Failed to export metrics');
    }
  }),

  /**
   * Get metrics in JSON format for debugging
   */
  json: publicProcedure.query(async () => {
    try {
      // Get comprehensive metrics summary
      const metricsSummary = metricsCollectionService.getMetricsSummary();
      
      // Add grocery agent specific metrics
      const groceryMetrics = groceryAgentMetrics.exportAllMetrics();
      
      // Add monitoring system health
      const systemHealth = monitoringSystem.getSystemHealth();
      
      return {
        timestamp: new Date().toISOString(),
        collection: metricsSummary,
        grocery: groceryMetrics,
        health: systemHealth
      };
      
    } catch (error) {
      logger.error('Failed to export JSON metrics', 'METRICS_ROUTER', {}, error as Error);
      throw new Error('Failed to export metrics');
    }
  }),

  /**
   * Get Grafana dashboard configuration
   */
  grafana: publicProcedure.query(async () => {
    try {
      const dashboardConfig = metricsCollectionService.getGrafanaDashboardConfig();
      return dashboardConfig;
    } catch (error) {
      logger.error('Failed to generate Grafana config', 'METRICS_ROUTER', {}, error as Error);
      throw new Error('Failed to generate Grafana configuration');
    }
  }),

  /**
   * Get Prometheus alert rules configuration
   */
  alerts: publicProcedure.query(async () => {
    try {
      const alertRules = metricsCollectionService.getPrometheusAlertRules();
      return alertRules;
    } catch (error) {
      logger.error('Failed to generate alert rules', 'METRICS_ROUTER', {}, error as Error);
      throw new Error('Failed to generate alert rules');
    }
  }),

  /**
   * Record a distributed trace
   */
  recordTrace: publicProcedure
    .input(z.object({
      correlationId: z.string(),
      serviceName: z.string(),
      endpoint: z.string(),
      latency: z.number()
    }))
    .mutation(async ({ input }) => {
      try {
        const { correlationId, serviceName, endpoint, latency } = input;
        
        metricsCollectionService.recordTrace(correlationId, serviceName, endpoint, latency);
        
        return { success: true, correlationId };
        
      } catch (error) {
        logger.error('Failed to record trace', 'METRICS_ROUTER', {}, error as Error);
        throw new Error('Failed to record trace');
      }
    }),

  /**
   * Record API metrics
   */
  recordAPI: publicProcedure
    .input(z.object({
      method: z.string(),
      endpoint: z.string(),
      status: z.number(),
      duration: z.number()
    }))
    .mutation(async ({ input }) => {
      try {
        const { method, endpoint, status, duration } = input;
        
        metricsCollectionService.recordAPIMetric(method, endpoint, status, duration);
        
        return { success: true };
        
      } catch (error) {
        logger.error('Failed to record API metric', 'METRICS_ROUTER', {}, error as Error);
        throw new Error('Failed to record API metric');
      }
    }),

  /**
   * Record database metrics
   */
  recordDatabase: publicProcedure
    .input(z.object({
      queryType: z.string(),
      table: z.string(),
      duration: z.number(),
      success: z.boolean()
    }))
    .mutation(async ({ input }) => {
      try {
        const { queryType, table, duration, success } = input;
        
        metricsCollectionService.recordDatabaseMetric(queryType, table, duration, success);
        
        return { success: true };
        
      } catch (error) {
        logger.error('Failed to record database metric', 'METRICS_ROUTER', {}, error as Error);
        throw new Error('Failed to record database metric');
      }
    }),

  /**
   * Record WebSocket metrics
   */
  recordWebSocket: publicProcedure
    .input(z.object({
      type: z.enum(['connect', 'disconnect', 'message', 'error']),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const { type, metadata } = input;
        
        metricsCollectionService.recordWebSocketMetric(type, metadata);
        
        return { success: true };
        
      } catch (error) {
        logger.error('Failed to record WebSocket metric', 'METRICS_ROUTER', {}, error as Error);
        throw new Error('Failed to record WebSocket metric');
      }
    })
});