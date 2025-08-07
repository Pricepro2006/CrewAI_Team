/**
 * Service Proxy for Transparent Microservice Communication
 * 
 * Features:
 * - Transparent request routing to healthy services
 * - Automatic failover and retry logic
 * - Circuit breaker integration
 * - Request/response transformation
 * - Caching layer integration
 * - Metrics collection and monitoring
 * - WebSocket proxy support
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
import { LoadBalancer, LoadBalancerFactory, LoadBalancingStrategy } from './LoadBalancer.js';
import { serviceRegistry } from './ServiceRegistry.js';
import { CircuitBreakerFactory } from '../../core/resilience/CircuitBreaker.js';
import { cacheManager } from '../../core/cache/RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import WebSocket from 'ws';

export interface ServiceProxyConfig {
  serviceName: string;
  loadBalancingStrategy: LoadBalancingStrategy;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  circuitBreakerEnabled: boolean;
  cachingEnabled: boolean;
  cacheTTL: number;
  requestTransform?: (req: any) => any;
  responseTransform?: (res: any) => any;
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
}

export interface ProxyRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
  clientIp?: string;
  clientId?: string;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  cached: boolean;
  serviceId: string;
  responseTime: number;
}

export interface ProxyMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  cacheHitRate: number;
  circuitBreakerTrips: number;
  retryCount: number;
}

export class ServiceProxy {
  private loadBalancer: LoadBalancer;
  private metrics: ProxyMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    cacheHitRate: 0,
    circuitBreakerTrips: 0,
    retryCount: 0,
  };

  constructor(private config: ServiceProxyConfig) {
    this.loadBalancer = LoadBalancerFactory.getInstance(
      config.serviceName,
      {
        strategy: config.loadBalancingStrategy,
        healthCheckEnabled: true,
        circuitBreakerEnabled: config.circuitBreakerEnabled,
        stickySession: false,
        maxConnections: 100,
        connectionTimeout: config.timeout,
      }
    );
  }

  /**
   * Proxy HTTP request to a service
   */
  async proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Check cache first if enabled
      if (this.config.cachingEnabled && this.isCacheableRequest(request)) {
        const cachedResponse = await this.getCachedResponse(request);
        if (cachedResponse) {
          this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
          return {
            ...cachedResponse,
            cached: true,
            responseTime: Date.now() - startTime,
          };
        }
      }

      // Select service instance
      const selection = await this.loadBalancer.selectService(
        this.config.serviceName,
        request.clientId,
        { clientIp: request.clientIp }
      );

      if (!selection.service) {
        throw new Error(selection.error || 'No available service instances');
      }

      const service = selection.service;
      
      // Execute request with retry logic
      const response = await this.executeWithRetry(service, request, startTime);

      // Cache response if applicable
      if (this.config.cachingEnabled && this.isCacheableResponse(response)) {
        await this.cacheResponse(request, response);
      }

      // Update metrics
      this.updateSuccessMetrics(response.responseTime);
      
      // Report to load balancer
      await this.loadBalancer.reportRequestCompletion(
        service.id,
        response.responseTime,
        true
      );

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateFailureMetrics();
      
      logger.error('Proxy request failed', 'SERVICE_PROXY', {
        serviceName: this.config.serviceName,
        path: request.path,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });

      throw error;
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    service: any,
    request: ProxyRequest,
    startTime: number
  ): Promise<ProxyResponse> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.retryAttempts) {
      attempt++;
      
      try {
        return await this.executeRequest(service, request, startTime);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry
        if (attempt >= this.config.retryAttempts || !this.isRetryableError(error)) {
          break;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        this.metrics.retryCount++;
        
        logger.warn('Retrying request', 'SERVICE_PROXY', {
          serviceName: this.config.serviceName,
          serviceId: service.id,
          attempt,
          error: lastError.message,
        });
      }
    }

    // Report failure to load balancer
    await this.loadBalancer.reportRequestCompletion(
      service.id,
      Date.now() - startTime,
      false
    );

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest(
    service: any,
    request: ProxyRequest,
    startTime: number
  ): Promise<ProxyResponse> {
    const url = `${service.protocol}://${service.host}:${service.port}${request.path}`;
    
    // Apply request transformation
    const transformedRequest = this.config.requestTransform 
      ? this.config.requestTransform(request)
      : request;

    // Prepare axios config
    const axiosConfig: AxiosRequestConfig = {
      method: request.method as any,
      url,
      headers: {
        ...request.headers,
        ...this.config.headers,
      },
      timeout: this.config.timeout,
      params: transformedRequest.query,
      data: transformedRequest.body,
    };

    // Add authentication
    if (this.config.authentication) {
      this.addAuthentication(axiosConfig, this.config.authentication);
    }

    // Execute with circuit breaker if enabled
    if (this.config.circuitBreakerEnabled) {
      const circuitBreaker = CircuitBreakerFactory.getInstance(service.id);
      
      const axiosResponse = await circuitBreaker.execute(async () => {
        return await axios(axiosConfig);
      });

      return await this.createProxyResponse(axiosResponse, service.id, startTime);
    } else {
      const axiosResponse = await axios(axiosConfig);
      return await this.createProxyResponse(axiosResponse, service.id, startTime);
    }
  }

  /**
   * Create proxy response from axios response
   */
  private async createProxyResponse(
    axiosResponse: AxiosResponse,
    serviceId: string,
    startTime: number
  ): Promise<ProxyResponse> {
    const responseTime = Date.now() - startTime;
    
    let body = axiosResponse.data;
    
    // Apply response transformation
    if (this.config.responseTransform) {
      body = this.config.responseTransform(body);
    }

    return {
      status: axiosResponse.status,
      headers: axiosResponse.headers as Record<string, string>,
      body,
      cached: false,
      serviceId,
      responseTime,
    };
  }

  /**
   * Add authentication to request config
   */
  private addAuthentication(config: AxiosRequestConfig, auth: ServiceProxyConfig['authentication']): void {
    if (!auth) return;

    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${auth.token}`,
          };
        }
        break;
        
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          config.headers = {
            ...config.headers,
            Authorization: `Basic ${credentials}`,
          };
        }
        break;
        
      case 'api-key':
        if (auth.apiKey && auth.headerName) {
          config.headers = {
            ...config.headers,
            [auth.headerName]: auth.apiKey,
          };
        }
        break;
    }
  }

  /**
   * Check if request is cacheable
   */
  private isCacheableRequest(request: ProxyRequest): boolean {
    return request.method.toLowerCase() === 'get';
  }

  /**
   * Check if response is cacheable
   */
  private isCacheableResponse(response: ProxyResponse): boolean {
    return response.status >= 200 && response.status < 300;
  }

  /**
   * Get cached response
   */
  private async getCachedResponse(request: ProxyRequest): Promise<ProxyResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const cached = await cacheManager.get<ProxyResponse>(cacheKey, 'proxy');
      return cached;
    } catch (error) {
      logger.warn('Cache get failed', 'SERVICE_PROXY', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache response
   */
  private async cacheResponse(request: ProxyRequest, response: ProxyResponse): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request);
      await cacheManager.set(cacheKey, response, {
        ttl: this.config.cacheTTL,
        namespace: 'proxy',
        tags: [this.config.serviceName],
      });
    } catch (error) {
      logger.warn('Cache set failed', 'SERVICE_PROXY', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: ProxyRequest): string {
    const keyData = {
      service: this.config.serviceName,
      method: request.method,
      path: request.path,
      query: request.query,
    };
    return `proxy:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      // Retry on network errors and 5xx status codes
      return !error.response || (error.response.status >= 500 && error.response.status < 600);
    }
    return true; // Retry on non-axios errors
  }

  /**
   * Update success metrics
   */
  private updateSuccessMetrics(responseTime: number): void {
    this.metrics.successfulRequests++;
    
    // Update average response time
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.avgResponseTime = (
      (this.metrics.avgResponseTime * (totalRequests - 1)) + responseTime
    ) / totalRequests;

    // Record Prometheus metrics
    metrics.increment('service_proxy.request.success', {
      service: this.config.serviceName,
    });
    metrics.histogram('service_proxy.response_time', responseTime, {
      service: this.config.serviceName,
    });
  }

  /**
   * Update failure metrics
   */
  private updateFailureMetrics(): void {
    this.metrics.failedRequests++;
    
    // Record Prometheus metrics
    metrics.increment('service_proxy.request.failed', {
      service: this.config.serviceName,
    });
  }

  /**
   * Create Express middleware for HTTP proxy
   */
  createHttpMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const proxyRequest: ProxyRequest = {
          method: req.method,
          path: req.path,
          headers: req.headers as Record<string, string>,
          body: req.body,
          query: req.query as Record<string, any>,
          clientIp: req.ip,
          clientId: req.get('X-Client-ID') || req.sessionID,
        };

        const response = await this.proxyRequest(proxyRequest);
        
        // Set response headers
        Object.entries(response.headers).forEach(([key, value]) => {
          res.set(key, value);
        });

        res.status(response.status).json(response.body);
        
      } catch (error) {
        logger.error('HTTP proxy middleware error', 'SERVICE_PROXY', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path,
        });
        next(error);
      }
    };
  }

  /**
   * Create WebSocket proxy
   */
  createWebSocketProxy(): (ws: WebSocket, req: IncomingMessage) => Promise<void> {
    return async (ws: WebSocket, req: IncomingMessage) => {
      try {
        // Select service instance
        const selection = await this.loadBalancer.selectService(
          this.config.serviceName,
          req.headers['x-client-id'] as string,
          { clientIp: req.socket.remoteAddress }
        );

        if (!selection.service) {
          ws.close(1011, selection.error || 'No available service instances');
          return;
        }

        const service = selection.service;
        const targetUrl = `${service.protocol === 'wss' ? 'wss' : 'ws'}://${service.host}:${service.port}${req.url}`;

        // Create connection to target service
        const targetWs = new WebSocket(targetUrl);

        // Set up bidirectional forwarding
        ws.on('message', (data) => {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(data);
          }
        });

        targetWs.on('message', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        // Handle connection events
        targetWs.on('open', () => {
          logger.debug('WebSocket proxy connection established', 'SERVICE_PROXY', {
            serviceId: service.id,
            targetUrl,
          });
        });

        targetWs.on('close', (code, reason) => {
          ws.close(code, reason);
        });

        targetWs.on('error', (error) => {
          logger.error('WebSocket proxy target error', 'SERVICE_PROXY', {
            serviceId: service.id,
            error: error.message,
          });
          ws.close(1011, 'Target service error');
        });

        ws.on('close', () => {
          targetWs.close();
        });

        ws.on('error', (error) => {
          logger.error('WebSocket proxy client error', 'SERVICE_PROXY', {
            error: error.message,
          });
          targetWs.close();
        });

      } catch (error) {
        logger.error('WebSocket proxy setup error', 'SERVICE_PROXY', {
          error: error instanceof Error ? error.message : String(error),
        });
        ws.close(1011, 'Proxy setup failed');
      }
    };
  }

  /**
   * Get proxy metrics
   */
  getMetrics(): ProxyMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      cacheHitRate: 0,
      circuitBreakerTrips: 0,
      retryCount: 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ServiceProxyConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (newConfig.loadBalancingStrategy) {
      this.loadBalancer.updateConfig({
        strategy: newConfig.loadBalancingStrategy,
      });
    }

    logger.info('Service proxy config updated', 'SERVICE_PROXY', {
      serviceName: this.config.serviceName,
      config: this.config,
    });
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    this.loadBalancer.shutdown();
    logger.info('Service proxy shutdown complete', 'SERVICE_PROXY', {
      serviceName: this.config.serviceName,
    });
  }
}

/**
 * Service proxy factory for creating and managing proxy instances
 */
export class ServiceProxyFactory {
  private static instances = new Map<string, ServiceProxy>();

  static createProxy(serviceName: string, config: Partial<ServiceProxyConfig>): ServiceProxy {
    const fullConfig: ServiceProxyConfig = {
      serviceName,
      loadBalancingStrategy: 'round_robin',
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      circuitBreakerEnabled: true,
      cachingEnabled: false,
      cacheTTL: 300,
      ...config,
    };

    const proxy = new ServiceProxy(fullConfig);
    this.instances.set(serviceName, proxy);
    return proxy;
  }

  static getProxy(serviceName: string): ServiceProxy | undefined {
    return this.instances.get(serviceName);
  }

  static getAllProxies(): Map<string, ServiceProxy> {
    return new Map(this.instances);
  }

  static shutdown(): void {
    this.instances.forEach(proxy => proxy.shutdown());
    this.instances.clear();
  }
}