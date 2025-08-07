/**
 * Metrics Router - Exposes Prometheus metrics endpoint
 * Provides /metrics endpoint for Prometheus scraping
 */

import express from 'express';
import type { Request, Response, Router as RouterType } from 'express';

const { Router } = express;

import { metricsCollectionService } from '../../monitoring/MetricsCollectionService.js';
import { groceryAgentMetrics } from '../../monitoring/GroceryAgentMetrics.js';
import { monitoringSystem } from '../../monitoring/MonitoringSystem.js';
import { logger } from '../../utils/logger.js';

const router: RouterType = Router();

/**
 * GET /metrics
 * Returns metrics in Prometheus format
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Get Prometheus formatted metrics
    const prometheusMetrics = metricsCollectionService.exportPrometheusMetrics();
    
    // Set appropriate content type for Prometheus
    res.set('Content-Type', 'text/plain; version=0.0.4');
    
    // Send metrics
    res.send(prometheusMetrics);
    
  } catch (error) {
    logger.error('Failed to export metrics', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).send('# Failed to export metrics\n');
  }
});

/**
 * GET /metrics/json
 * Returns metrics in JSON format for debugging
 */
router.get('/metrics/json', async (req: Request, res: Response) => {
  try {
    // Get comprehensive metrics summary
    const metricsSummary = metricsCollectionService.getMetricsSummary();
    
    // Add grocery agent specific metrics
    const groceryMetrics = groceryAgentMetrics.exportAllMetrics();
    
    // Add monitoring system health
    const systemHealth = monitoringSystem.getSystemHealth();
    
    const fullMetrics = {
      timestamp: new Date().toISOString(),
      collection: metricsSummary,
      grocery: groceryMetrics,
      health: systemHealth
    };
    
    res.json(fullMetrics);
    
  } catch (error) {
    logger.error('Failed to export JSON metrics', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

/**
 * GET /metrics/grafana
 * Returns Grafana dashboard configuration
 */
router.get('/metrics/grafana', async (req: Request, res: Response) => {
  try {
    const dashboardConfig = metricsCollectionService.getGrafanaDashboardConfig();
    res.json(dashboardConfig);
  } catch (error) {
    logger.error('Failed to generate Grafana config', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to generate Grafana configuration' });
  }
});

/**
 * GET /metrics/alerts
 * Returns Prometheus alert rules configuration
 */
router.get('/metrics/alerts', async (req: Request, res: Response) => {
  try {
    const alertRules = metricsCollectionService.getPrometheusAlertRules();
    res.json(alertRules);
  } catch (error) {
    logger.error('Failed to generate alert rules', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to generate alert rules' });
  }
});

/**
 * POST /metrics/trace
 * Record a distributed trace
 */
router.post('/metrics/trace', async (req: Request, res: Response) => {
  try {
    const { correlationId, serviceName, endpoint, latency } = req.body;
    
    if (!correlationId || !serviceName || !endpoint || latency === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: correlationId, serviceName, endpoint, latency' 
      });
    }
    
    metricsCollectionService.recordTrace(correlationId, serviceName, endpoint, latency);
    
    res.json({ success: true, correlationId });
    
  } catch (error) {
    logger.error('Failed to record trace', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to record trace' });
  }
});

/**
 * POST /metrics/api
 * Record API metrics
 */
router.post('/metrics/api', async (req: Request, res: Response) => {
  try {
    const { method, endpoint, status, duration } = req.body;
    
    if (!method || !endpoint || status === undefined || duration === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: method, endpoint, status, duration' 
      });
    }
    
    metricsCollectionService.recordAPIMetric(method, endpoint, status, duration);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Failed to record API metric', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to record API metric' });
  }
});

/**
 * POST /metrics/database
 * Record database metrics
 */
router.post('/metrics/database', async (req: Request, res: Response) => {
  try {
    const { queryType, table, duration, success } = req.body;
    
    if (!queryType || !table || duration === undefined || success === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: queryType, table, duration, success' 
      });
    }
    
    metricsCollectionService.recordDatabaseMetric(queryType, table, duration, success);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Failed to record database metric', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to record database metric' });
  }
});

/**
 * POST /metrics/websocket
 * Record WebSocket metrics
 */
router.post('/metrics/websocket', async (req: Request, res: Response) => {
  try {
    const { type, metadata } = req.body;
    
    if (!type || !['connect', 'disconnect', 'message', 'error'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be: connect, disconnect, message, or error' 
      });
    }
    
    metricsCollectionService.recordWebSocketMetric(type, metadata);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Failed to record WebSocket metric', 'METRICS_ROUTER', {}, error as Error);
    res.status(500).json({ error: 'Failed to record WebSocket metric' });
  }
});

export default router;