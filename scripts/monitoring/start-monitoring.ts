#!/usr/bin/env node

/**
 * Monitoring System Startup Script
 * Initializes and starts all monitoring components
 */

import { config } from 'dotenv';
config(); // Load environment variables

import express from 'express';
import cors from 'cors';
import { monitoringService } from '../../src/services/MonitoringService';
import { databaseMonitor } from '../../src/database/monitoring/DatabaseMonitor';
import { monitoringWebSocketServer } from '../../src/api/websocket/MonitoringWebSocket';
import { 
  performanceMonitoringMiddleware,
  errorMonitoringMiddleware,
  healthCheckMiddleware,
  requestSizeMonitoringMiddleware
} from '../../src/api/middleware/monitoring/monitoring';
import { logger } from '../../src/utils/logger.js';
import path from 'path';

// Configuration
const CONFIG = {
  apiPort: parseInt(process.env.MONITORING_API_PORT || '3002'),
  websocketPort: parseInt(process.env.MONITORING_WS_PORT || '3003'),
  databases: [
    {
      name: 'app',
      path: path.join(process.cwd(), 'app.db'),
      slowQueryThreshold: 100
    },
    {
      name: 'walmart_grocery',
      path: path.join(process.cwd(), 'walmart_grocery.db'),
      slowQueryThreshold: 50
    },
    {
      name: 'crewai_enhanced',
      path: path.join(process.cwd(), 'crewai_enhanced.db'),
      slowQueryThreshold: 200
    }
  ]
};

class MonitoringServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));

    // Monitoring middleware
    this.app.use(healthCheckMiddleware);
    this.app.use(requestSizeMonitoringMiddleware());
    this.app.use(performanceMonitoringMiddleware);
    
    // Error monitoring (should be last)
    this.app.use(errorMonitoringMiddleware);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      });
    });

    // Monitoring API routes
    this.setupMonitoringAPI();

    // Serve static files for dashboard
    this.setupStaticFiles();
  }

  private setupMonitoringAPI(): void {
    const router = express.Router();

    // Dashboard data
    router.get('/dashboard', (req, res) => {
      try {
        const data = monitoringService.getDashboardData();
        res.json(data);
      } catch (error) {
        logger.error('Failed to get dashboard data', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get dashboard data' });
      }
    });

    // System health
    router.get('/health-status', async (req, res) => {
      try {
        const health = await monitoringService.runHealthChecks();
        res.json(health);
      } catch (error) {
        logger.error('Failed to get health status', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get health status' });
      }
    });

    // Metrics
    router.get('/metrics', (req, res) => {
      try {
        const { name, limit = 100 } = req.query;
        const metrics = monitoringService.getMetrics(
          name as string, 
          parseInt(limit as string)
        );
        res.json(metrics);
      } catch (error) {
        logger.error('Failed to get metrics', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    // Performance data
    router.get('/performance', (req, res) => {
      try {
        const { limit = 100 } = req.query;
        const performance = monitoringService.getPerformanceMetrics(
          parseInt(limit as string)
        );
        res.json(performance);
      } catch (error) {
        logger.error('Failed to get performance data', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get performance data' });
      }
    });

    // Database queries
    router.get('/database/queries', (req, res) => {
      try {
        const { limit = 100 } = req.query;
        const queries = monitoringService.getDatabaseQueries(
          parseInt(limit as string)
        );
        res.json(queries);
      } catch (error) {
        logger.error('Failed to get database queries', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get database queries' });
      }
    });

    // Database statistics
    router.get('/database/stats/:database?', (req, res) => {
      try {
        const { database } = req.params;
        const stats = databaseMonitor.getStatistics(database);
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get database stats', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get database stats' });
      }
    });

    // Alerts
    router.get('/alerts', (req, res) => {
      try {
        const { active } = req.query;
        const alerts = active === 'true' ? 
          monitoringService.getActiveAlerts() : 
          monitoringService.getDashboardData().alerts;
        res.json(alerts);
      } catch (error) {
        logger.error('Failed to get alerts', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get alerts' });
      }
    });

    // Acknowledge alert
    router.post('/alerts/:alertId/acknowledge', (req, res) => {
      try {
        const { alertId } = req.params;
        const success = monitoringService.acknowledgeAlert(alertId);
        
        if (success) {
          res.json({ success: true, message: 'Alert acknowledged' });
        } else {
          res.status(404).json({ error: 'Alert not found or already acknowledged' });
        }
      } catch (error) {
        logger.error('Failed to acknowledge alert', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to acknowledge alert' });
      }
    });

    // Connections
    router.get('/connections', (req, res) => {
      try {
        const connections = monitoringService.getActiveConnections();
        res.json(connections);
      } catch (error) {
        logger.error('Failed to get connections', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get connections' });
      }
    });

    // WebSocket server info
    router.get('/websocket/info', (req, res) => {
      try {
        const info = {
          clients: monitoringWebSocketServer.getClientsInfo(),
          stats: monitoringWebSocketServer.getServerStats()
        };
        res.json(info);
      } catch (error) {
        logger.error('Failed to get WebSocket info', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get WebSocket info' });
      }
    });

    // System information
    router.get('/system', (req, res) => {
      try {
        const info = {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          env: process.env.NODE_ENV || 'development'
        };
        res.json(info);
      } catch (error) {
        logger.error('Failed to get system info', 'MONITORING_API', { error });
        res.status(500).json({ error: 'Failed to get system info' });
      }
    });

    this.app.use('/api/monitoring', router);
  }

  private setupStaticFiles(): void {
    // Serve monitoring dashboard (if built)
    const dashboardPath = path.join(process.cwd(), 'dist/monitoring-dashboard');
    
    try {
      this.app.use('/monitoring', express.static(dashboardPath));
      
      // Fallback to index.html for SPA routing
      this.app.get('/monitoring/*', (req, res) => {
        res.sendFile(path.join(dashboardPath, 'index.html'));
      });
      
      logger.info('Monitoring dashboard served at /monitoring', 'MONITORING_SERVER');
    } catch (error) {
      logger.warn('Monitoring dashboard not found, serving API only', 'MONITORING_SERVER');
      
      // Provide simple HTML page with links to API endpoints
      this.app.get('/monitoring', (req, res) => {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Monitoring API</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .endpoint { margin: 10px 0; }
              .endpoint a { text-decoration: none; color: #0066cc; }
              .endpoint a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <h1>🔍 Monitoring API Endpoints</h1>
            <div class="endpoint"><a href="/api/monitoring/dashboard">Dashboard Data</a></div>
            <div class="endpoint"><a href="/api/monitoring/health-status">Health Status</a></div>
            <div class="endpoint"><a href="/api/monitoring/metrics">Metrics</a></div>
            <div class="endpoint"><a href="/api/monitoring/performance">Performance</a></div>
            <div class="endpoint"><a href="/api/monitoring/database/queries">Database Queries</a></div>
            <div class="endpoint"><a href="/api/monitoring/database/stats">Database Stats</a></div>
            <div class="endpoint"><a href="/api/monitoring/alerts">Alerts</a></div>
            <div class="endpoint"><a href="/api/monitoring/connections">Connections</a></div>
            <div class="endpoint"><a href="/api/monitoring/websocket/info">WebSocket Info</a></div>
            <div class="endpoint"><a href="/api/monitoring/system">System Info</a></div>
            <hr>
            <p><strong>WebSocket URL:</strong> ws://localhost:${CONFIG.websocketPort}/monitoring</p>
          </body>
          </html>
        `);
      });
    }
  }

  public async start(): Promise<void> {
    // Initialize databases
    this.initializeDatabases();

    // Start HTTP server
    this.server = this.app.listen(CONFIG.apiPort, () => {
      logger.info(`Monitoring API server started on port ${CONFIG.apiPort}`, 'MONITORING_SERVER', {
        apiUrl: `http://localhost:${CONFIG.apiPort}`,
        dashboardUrl: `http://localhost:${CONFIG.apiPort}/monitoring`,
        websocketUrl: `ws://localhost:${CONFIG.websocketPort}/monitoring`
      });
    });

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  private initializeDatabases(): void {
    logger.info('Initializing database monitoring...', 'MONITORING_SERVER');
    
    for (const dbConfig of CONFIG.databases) {
      try {
        const db = databaseMonitor.registerDatabase(dbConfig);
        logger.info(`Database monitoring enabled: ${dbConfig.name}`, 'MONITORING_SERVER');
      } catch (error) {
        logger.warn(`Failed to initialize database monitoring for ${dbConfig.name}`, 'MONITORING_SERVER', { 
          error,
          path: dbConfig.path 
        });
      }
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`, 'MONITORING_SERVER');
      
      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed', 'MONITORING_SERVER');
        });
      }

      // Close WebSocket server
      monitoringWebSocketServer.close();

      // Close database connections
      databaseMonitor.closeAll();

      // Exit process
      setTimeout(() => {
        logger.info('Monitoring server shutdown complete', 'MONITORING_SERVER');
        process.exit(0);
      }, 1000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Main execution
async function main() {
  try {
    logger.info('🔍 Starting Walmart Grocery Agent Monitoring System...', 'MONITORING_STARTUP');
    
    const server = new MonitoringServer();
    await server.start();
    
    logger.info('✅ Monitoring system started successfully!', 'MONITORING_STARTUP', {
      apiPort: CONFIG.apiPort,
      websocketPort: CONFIG.websocketPort,
      databases: CONFIG.databases.map(db => db.name)
    });

    // Log helpful information
    console.log('\n🔍 Monitoring System Ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Dashboard: http://localhost:${CONFIG.apiPort}/monitoring`);
    console.log(`🌐 API Base:  http://localhost:${CONFIG.apiPort}/api/monitoring`);
    console.log(`🔌 WebSocket: ws://localhost:${CONFIG.websocketPort}/monitoring`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nMonitored Services:');
    console.log('• WebSocket Connections (real-time)');
    console.log('• API Performance (response times, errors)');
    console.log('• Database Queries (execution time, slow queries)');
    console.log('• System Health (memory, CPU, connections)');
    console.log('• Alerts & Notifications');
    console.log('\nPress Ctrl+C to stop the monitoring server\n');
    
  } catch (error) {
    logger.error('Failed to start monitoring system', 'MONITORING_STARTUP', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error starting monitoring system:', error);
    process.exit(1);
  });
}

export { MonitoringServer, CONFIG };
export default MonitoringServer;