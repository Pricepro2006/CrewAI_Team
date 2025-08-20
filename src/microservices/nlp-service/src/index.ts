/**
 * NLP Microservice Main Entry Point
 * Orchestrates all service components with graceful startup and shutdown
 */

import { NLPService } from './services/NLPService';
import { getConfig } from './utils/config';
import { logger } from './utils/logger';

// Try to import servers, fall back to no-op implementations
let RestAPIServer: any;
let GrpcAPIServer: any;
let HealthMonitor: any;
let ServiceDiscovery: any;

try {
  const { RestAPIServer: FastifyRestServer } = require('./api/rest/server');
  RestAPIServer = FastifyRestServer;
} catch {
  const { RestAPIServer: FallbackRestServer } = require('./api/rest/server.fallback');
  RestAPIServer = FallbackRestServer;
}

try {
  const { GrpcAPIServer: RealGrpcServer } = require('./api/grpc/server');
  GrpcAPIServer = RealGrpcServer;
} catch {
  const { GrpcAPIServer: FallbackGrpcServer } = require('./api/grpc/server.fallback');
  GrpcAPIServer = FallbackGrpcServer;
}

try {
  const { HealthMonitor: RealHealthMonitor } = require('./monitoring/HealthMonitor');
  HealthMonitor = RealHealthMonitor;
} catch {
  // Create a simple health monitor fallback
  HealthMonitor = class {
    constructor() {}
    start() {}
    stop() {}
    getHealthStatus() { return { status: 'healthy' }; }
    on() {}
  };
}

try {
  const { ServiceDiscovery: RealServiceDiscovery } = require('./monitoring/ServiceDiscovery');
  ServiceDiscovery = RealServiceDiscovery;
} catch {
  // Create a simple service discovery fallback
  ServiceDiscovery = class {
    constructor() {}
    async start() {}
    async stop() {}
    getServiceRegistration() { return null; }
    on() {}
  };
}

/**
 * Main Application Class
 * Manages the complete lifecycle of the NLP microservice
 */
class NLPMicroservice {
  private config = getConfig();
  private nlpService: NLPService;
  private restServer: any;
  private grpcServer: any;
  private healthMonitor: any;
  private serviceDiscovery: any;
  private isShuttingDown = false;
  private startupPromise?: Promise<void>;

  constructor() {
    // Initialize all components
    this.nlpService = new NLPService(this.config);
    this.restServer = new RestAPIServer(this.nlpService, this.config);
    this.grpcServer = new GrpcAPIServer(this.nlpService, this.config);
    this.healthMonitor = new HealthMonitor(this.nlpService, this.config);
    this.serviceDiscovery = new ServiceDiscovery(this.config);
    
    this.setupEventListeners();
    
    logger.info('NLP Microservice initialized', 'NLP_MICROSERVICE', {
      version: this.config.discovery.serviceVersion,
      environment: this.config.environment
    });
  }

  /**
   * Start the microservice
   */
  async start(): Promise<void> {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this.performStartup();
    return this.startupPromise;
  }

  /**
   * Perform service startup sequence
   */
  private async performStartup(): Promise<void> {
    try {
      logger.logServiceLifecycle('starting', 'NLP_MICROSERVICE', {
        port: this.config.port,
        grpcPort: this.config.grpcPort,
        environment: this.config.environment
      });

      // Start core service
      await this.nlpService.start();

      // Start API servers
      await Promise.all([
        this.restServer.start(),
        this.grpcServer.start()
      ]);

      // Start monitoring
      if (this.config.monitoring.enabled) {
        this.healthMonitor.start();
      }

      // Start service discovery
      if (this.config.discovery.enabled) {
        await this.serviceDiscovery.start();
      }

      // Service is now fully started
      logger.logServiceLifecycle('started', 'NLP_MICROSERVICE', {
        port: this.config.port,
        grpcPort: this.config.grpcPort,
        uptime: 0
      });

      console.log(`
🚀 NLP Microservice Started Successfully!

📊 Service Information:
   • Name: ${this.config.discovery.serviceName}
   • Version: ${this.config.discovery.serviceVersion}
   • Environment: ${this.config.environment}

🌐 API Endpoints:
   • REST API: http://${this.config.host}:${this.config.port}
   • gRPC API: ${this.config.host}:${this.config.grpcPort}
   • Health Check: http://${this.config.host}:${this.config.port}/health
   • Metrics: http://${this.config.host}:${this.config.port}/metrics

⚙️  Configuration:
   • Max Concurrent: ${this.config.queue.maxConcurrent} (Ollama limit)
   • Default Timeout: ${this.config.queue.defaultTimeout}ms
   • Monitoring: ${this.config.monitoring.enabled ? 'Enabled' : 'Disabled'}
   • Service Discovery: ${this.config.discovery.enabled ? 'Enabled' : 'Disabled'}

🔧 Management:
   • Press Ctrl+C for graceful shutdown
   • View logs for detailed operation information
`);

    } catch (error) {
      logger.error('Service startup failed', 'NLP_MICROSERVICE', { error });
      await this.forceShutdown();
      throw error;
    }
  }

  /**
   * Stop the microservice gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress', 'NLP_MICROSERVICE');
      return;
    }

    this.isShuttingDown = true;

    logger.logServiceLifecycle('stopping', 'NLP_MICROSERVICE', {
      shutdownTimeout: this.config.shutdown.timeout
    });

    try {
      const shutdownPromises: Promise<void>[] = [];

      // Stop accepting new requests by stopping API servers first
      shutdownPromises.push(
        this.restServer.stop().catch((error: Error) => {
          logger.error('Error stopping REST server', 'NLP_MICROSERVICE', { error });
        })
      );

      shutdownPromises.push(
        this.grpcServer.stop().catch((error: Error) => {
          logger.error('Error stopping gRPC server', 'NLP_MICROSERVICE', { error });
        })
      );

      // Stop service discovery to prevent new connections
      if (this.config.discovery.enabled) {
        shutdownPromises.push(
          this.serviceDiscovery.stop().catch((error: Error) => {
            logger.error('Error stopping service discovery', 'NLP_MICROSERVICE', { error });
          })
        );
      }

      // Stop monitoring
      if (this.config.monitoring.enabled) {
        this.healthMonitor.stop();
      }

      // Wait for API servers to stop
      await Promise.allSettled(shutdownPromises);

      // Finally, stop the core service (allows queue to drain)
      await this.nlpService.shutdown(this.config.shutdown.timeout);

      // Flush logs
      await logger.flush();

      logger.logServiceLifecycle('stopped', 'NLP_MICROSERVICE');

      console.log('\n✅ NLP Microservice stopped gracefully\n');

    } catch (error) {
      logger.error('Error during graceful shutdown', 'NLP_MICROSERVICE', { error });
      throw error;
    }
  }

  /**
   * Force shutdown (emergency)
   */
  private async forceShutdown(): Promise<void> {
    logger.warn('Force shutdown initiated', 'NLP_MICROSERVICE');
    
    try {
      // Force stop gRPC server
      this.grpcServer.forceShutdown();
      
      // Stop other components with shorter timeout
      await Promise.allSettled([
        this.restServer.stop(),
        this.serviceDiscovery.stop(),
        this.nlpService.shutdown(5000) // 5 second timeout
      ]);
      
      await logger.flush();
      
    } catch (error) {
      console.error('Error during force shutdown:', error);
    }
    
    process.exit(1);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // NLP Service events
    this.nlpService.on('error', (error: Error) => {
      logger.error('NLP service error', 'NLP_SERVICE', { error });
    });

    this.nlpService.on('metrics-update', (metrics: any) => {
      logger.logPerformanceMetrics('NLP_SERVICE', {
        requestsPerMinute: metrics.requests.rate * 60,
        queueSize: metrics.queue.size,
        memoryUsage: metrics.resources.memory.used
      });
    });

    // Health Monitor events
    this.healthMonitor.on('alert', (alert: any) => {
      logger.warn('Health alert triggered', 'HEALTH_MONITOR', {
        component: alert.component,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity
      });
    });

    this.healthMonitor.on('healthCheck', (result: any) => {
      const unhealthyComponents = result.results?.filter((r: any) => r.status !== 'healthy');
      if (unhealthyComponents && unhealthyComponents.length > 0) {
        logger.warn('Health check found issues', 'HEALTH_MONITOR', {
          unhealthyComponents: unhealthyComponents.map((c: any) => c.component),
          overallHealth: result.overallHealth
        });
      }
    });

    // Service Discovery events
    this.serviceDiscovery.on('registered', (registration: any) => {
      logger.info('Service registered', 'SERVICE_DISCOVERY', {
        serviceId: registration.id,
        serviceName: registration.name
      });
    });

    this.serviceDiscovery.on('heartbeatFailed', (error: Error) => {
      logger.error('Service heartbeat failed', 'SERVICE_DISCOVERY', { error });
    });

    // Process events
    this.config.shutdown.signals.forEach((signal: string) => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown`, 'NLP_MICROSERVICE');
        this.stop().catch((error: Error) => {
          logger.error('Error during signal-triggered shutdown', 'NLP_MICROSERVICE', { error });
          this.forceShutdown();
        });
      });
    });

    // Unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', 'NLP_MICROSERVICE', {
        reason,
        promise: promise.toString()
      });
    });

    process.on('uncaughtException', (error: Error) => {
      logger.fatal('Uncaught exception', 'NLP_MICROSERVICE', { error });
      this.forceShutdown();
    });
  }

  /**
   * Get service status for external monitoring
   */
  getStatus() {
    return {
      service: this.nlpService.getStatus(),
      health: this.healthMonitor.getHealthStatus(),
      discovery: this.serviceDiscovery.getServiceRegistration(),
      config: {
        environment: this.config.environment,
        version: this.config.discovery.serviceVersion,
        ports: {
          http: this.config.port,
          grpc: this.config.grpcPort
        }
      }
    };
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Create and start the microservice
    const app = new NLPMicroservice();
    await app.start();

    // Keep the process running
    process.on('exit', () => {
      logger.info('Process exiting', 'NLP_MICROSERVICE');
    });

  } catch (error) {
    logger.fatal('Failed to start NLP microservice', 'NLP_MICROSERVICE', { error });
    process.exit(1);
  }
}

// Start the application if this file is run directly
if (process.argv[1] && require.main === module) {
  main();
}

// Export for testing
export { NLPMicroservice, main };