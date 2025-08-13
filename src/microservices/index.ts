/**
 * Microservices Discovery and Load Balancing System
 * 
 * This module provides a complete service discovery and load balancing solution
 * for the Walmart Grocery Agent microservices architecture.
 * 
 * Main Components:
 * - ServiceRegistry: Redis-based service registration and discovery
 * - LoadBalancer: Multi-strategy load balancing with health awareness
 * - HealthChecker: Continuous health monitoring with circuit breaker integration
 * - ServiceProxy: Transparent service communication with caching and retry logic
 * - ServiceDiscovery: Main orchestrator for all discovery components
 * - WalmartServiceMesh: High-level interface for managing the complete service mesh
 * 
 * Features:
 * - Auto-registration with graceful shutdown
 * - Multiple load balancing strategies (round-robin, least connections, weighted, etc.)
 * - Circuit breaker integration for fault tolerance
 * - Health monitoring with automatic failover
 * - Service scaling and auto-scaling support
 * - WebSocket proxy support
 * - Comprehensive metrics and monitoring
 * - Service mesh communication patterns
 */

// Core Discovery Components
export {
  ServiceRegistry,
  ServiceMetadata,
  serviceRegistry,
} from './discovery/ServiceRegistry.js';

export {
  LoadBalancer,
  LoadBalancerFactory,
  LoadBalancingStrategy,
  LoadBalancerConfig,
  ServiceInstance,
  LoadBalancingResult,
} from './discovery/LoadBalancer.js';

export {
  HealthChecker,
  HealthCheckConfig,
  HealthCheckResult,
  HealthMetrics,
  healthChecker,
} from './discovery/HealthChecker.js';

export {
  ServiceProxy,
  ServiceProxyFactory,
  ServiceProxyConfig,
  ProxyRequest,
  ProxyResponse,
  ProxyMetrics,
} from './discovery/ServiceProxy.js';

export {
  ServiceDiscovery,
  ServiceConfig,
  ServiceDiscoveryStats,
  serviceDiscovery,
} from './discovery/ServiceDiscovery.js';

// Walmart-Specific Configuration and Integration
export {
  WalmartServiceDefinition,
  WALMART_SERVICES,
  SERVICE_DEPENDENCIES,
  LOAD_BALANCING_STRATEGIES,
  SCALING_POLICIES,
  CIRCUIT_BREAKER_CONFIGS,
  HEALTH_CHECK_CONFIGS,
  getServiceConfig,
  getServicesInDeploymentOrder,
  getScalableServices,
  getServicesByTag,
  validateServiceConfig,
  generateDeploymentManifest,
} from './config/WalmartServiceConfig.js';

export {
  WalmartServiceMesh,
  ServiceMeshOptions,
  ServiceMeshStatus,
  walmartServiceMesh,
} from './WalmartServiceMesh.js';

// Utility Types
export type {
  ServiceConfig,
  ServiceMetadata,
  LoadBalancingStrategy,
  HealthCheckConfig,
  ServiceProxyConfig,
} from './discovery/ServiceDiscovery.js';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { walmartServiceMesh } from './microservices';
 * 
 * // Deploy all services
 * await walmartServiceMesh.deployAllServices();
 * 
 * // Get a proxy for making requests
 * const pricingProxy = walmartServiceMesh.getServiceProxy('walmart-pricing');
 * const response = await pricingProxy.proxyRequest({
 *   method: 'GET',
 *   path: '/api/price/12345',
 *   headers: {},
 * });
 * 
 * // Scale a service
 * await walmartServiceMesh.scaleService('walmart-pricing', 3);
 * 
 * // Setup Express with service proxies
 * const app = express();
 * walmartServiceMesh.setupExpressProxies(app);
 * 
 * // Graceful shutdown
 * await walmartServiceMesh.shutdown();
 * ```
 */

/**
 * Architecture Overview:
 * 
 * 1. Service Registry (Redis-based):
 *    - Auto-registration with TTL-based expiration
 *    - Service metadata storage and retrieval
 *    - Event-driven service updates
 * 
 * 2. Load Balancer:
 *    - Multiple strategies: round-robin, weighted, least connections, etc.
 *    - Health-aware routing with circuit breaker integration
 *    - Connection tracking and metrics
 * 
 * 3. Health Checker:
 *    - HTTP/HTTPS/WebSocket health checks
 *    - Configurable intervals and timeouts
 *    - Circuit breaker integration for failing services
 * 
 * 4. Service Proxy:
 *    - Transparent request routing with retry logic
 *    - Caching layer integration
 *    - Request/response transformation
 *    - WebSocket proxy support
 * 
 * 5. Service Discovery:
 *    - Main orchestrator coordinating all components
 *    - Auto-scaling support
 *    - Comprehensive metrics collection
 * 
 * 6. Walmart Service Mesh:
 *    - High-level interface for managing the complete architecture
 *    - Express and WebSocket integration
 *    - Service scaling and monitoring
 */

/**
 * Service Communication Patterns:
 * 
 * 1. Direct Service-to-Service:
 *    ```typescript
 *    const proxy = serviceDiscovery.getServiceProxy('service-name');
 *    const response = await proxy.proxyRequest(request);
 *    ```
 * 
 * 2. Through Express Middleware:
 *    ```typescript
 *    app.use('/api/service', proxy.createHttpMiddleware());
 *    ```
 * 
 * 3. WebSocket Proxy:
 *    ```typescript
 *    const wsProxy = proxy.createWebSocketProxy();
 *    wsProxy(ws, req);
 *    ```
 */

/**
 * Monitoring and Metrics:
 * 
 * All components emit comprehensive metrics including:
 * - Service registration/deregistration events
 * - Health check success/failure rates
 * - Load balancing decisions and response times
 * - Circuit breaker state changes
 * - Service scaling events
 * - Request success/failure rates
 * - Average response times by service
 */