/**
 * gRPC API Server for NLP Microservice
 * Provides gRPC endpoints for high-performance NLP operations
 */

// Optional gRPC dependencies - fallback gracefully if not available
let grpc: any;
let protoLoader: any;

// Type definitions for gRPC
interface GrpcServer {
  addService(service: any, implementation: any): void;
  bindAsync(address: string, credentials: any, callback: (error: Error | null, port?: number) => void): void;
  start(): void;
  forceShutdown(): void;
  tryShutdown(callback: () => void): void;
}

interface GrpcCall {
  request: any;
  callback?: (error: Error | null, response?: any) => void;
  write?: (data: any) => void;
  end?: () => void;
  on?: (event: string, handler: (...args: any[]) => void) => void;
}

try {
  grpc = require('@grpc/grpc-js');
  protoLoader = require('@grpc/proto-loader');
} catch (error) {
  // gRPC dependencies not available - server will be disabled
  grpc = null;
  protoLoader = null;
}

import { NLPService } from '../../services/NLPService';
import { logger } from '../../utils/logger';
import type {
  NLPServiceConfig,
  NLPServiceAPI,
  ServiceStatus,
  ServiceMetrics
} from '../../types/index';

export class GrpcAPIServer {
  private server: GrpcServer | null = null;
  private nlpService: NLPService;
  private config: NLPServiceConfig;
  private isStarted = false;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    if (grpc && protoLoader) {
      this.server = new grpc.Server() as GrpcServer;
      this.setupServices();
    } else {
      logger.warn('gRPC dependencies not available, gRPC API disabled', 'GRPC_SERVER');
    }
  }

  /**
   * Setup gRPC services
   */
  private setupServices(): void {
    if (!this.server || !grpc) return;

    // Define proto-like service definition inline (avoiding external .proto files)
    const serviceDefinition = {
      NLPService: {
        ProcessQuery: {
          path: '/nlp.NLPService/ProcessQuery',
          requestStream: false,
          responseStream: false,
          requestSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString())
        },
        ProcessBatch: {
          path: '/nlp.NLPService/ProcessBatch',
          requestStream: false,
          responseStream: false,
          requestSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString())
        },
        ProcessStream: {
          path: '/nlp.NLPService/ProcessStream',
          requestStream: true,
          responseStream: true,
          requestSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString())
        },
        GetStatus: {
          path: '/nlp.NLPService/GetStatus',
          requestStream: false,
          responseStream: false,
          requestSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
          responseSerialize: (obj: any) => Buffer.from(JSON.stringify(obj)),
          responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString())
        }
      }
    };

    // Service implementation
    const serviceImplementation = {
      ProcessQuery: this.handleProcessQuery.bind(this),
      ProcessBatch: this.handleProcessBatch.bind(this),
      ProcessStream: this.handleProcessStream.bind(this),
      GetStatus: this.handleGetStatus.bind(this)
    };

    this.server.addService(serviceDefinition.NLPService, serviceImplementation);
    
    logger.info('gRPC services configured', 'GRPC_SERVER', {
      services: Object.keys(serviceImplementation)
    });
  }

  /**
   * Handle ProcessQuery RPC
   */
  private async handleProcessQuery(call: GrpcCall): Promise<void> {
    try {
      const { query, priority = 1, timeout, metadata = {} }: NLPServiceAPI.GRPC.NLPRequest = call.request;
      
      if (!query || typeof query !== 'string') {
        const error = new Error('Query is required and must be a string');
        (error as any).code = grpc.status.INVALID_ARGUMENT;
        throw error;
      }

      const priorityMap: Record<number, 'high' | 'normal' | 'low'> = {
        2: 'high',
        1: 'normal',
        0: 'low'
      };

      const result = await this.nlpService.processQuery(
        query,
        priorityMap[priority] || 'normal',
        timeout,
        metadata
      );

      const response: NLPServiceAPI.GRPC.NLPResponse = {
        success: true,
        requestId: this.generateRequestId(),
        entities: result.entities.map(entity => ({
          type: entity.type,
          value: entity.value,
          confidence: entity.confidence,
          startIndex: entity.startIndex,
          endIndex: entity.endIndex
        })),
        intent: {
          action: result.intent.action,
          confidence: result.intent.confidence
        },
        normalizedProducts: result.normalizedItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || ''
        })),
        error: '',
        processingTime: result.processingMetadata.processingTime,
        queueTime: 0
      };

      if (call.callback) {
        call.callback(null, response);
      }
    } catch (error: any) {
      logger.error('gRPC ProcessQuery error', 'GRPC_SERVER', { error });
      if (call.callback) {
        call.callback(error);
      }
    }
  }

  /**
   * Handle ProcessBatch RPC
   */
  private async handleProcessBatch(call: GrpcCall): Promise<void> {
    try {
      const { queries, batchId }: NLPServiceAPI.GRPC.BatchNLPRequest = call.request;
      
      if (!Array.isArray(queries) || queries.length === 0) {
        const error = new Error('Queries array is required and cannot be empty');
        (error as any).code = grpc.status.INVALID_ARGUMENT;
        throw error;
      }

      const queryData = queries.map(q => ({
        query: q.query,
        metadata: q.metadata
      }));

      const batchResult = await this.nlpService.processBatch(
        queryData,
        'normal',
        undefined,
        { batchId }
      );

      const response: NLPServiceAPI.GRPC.BatchNLPResponse = {
        success: true,
        batchId: batchResult.batchId,
        results: batchResult.results.map((result, index) => {
          if (result) {
            return {
              success: true,
              requestId: `${batchResult.batchId}-${index}`,
              entities: result.entities.map(entity => ({
                type: entity.type,
                value: entity.value,
                confidence: entity.confidence,
                startIndex: entity.startIndex,
                endIndex: entity.endIndex
              })),
              intent: {
                action: result.intent.action,
                confidence: result.intent.confidence
              },
              normalizedProducts: result.normalizedItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit || ''
              })),
              error: '',
              processingTime: result.processingMetadata.processingTime,
              queueTime: 0
            };
          } else {
            return {
              success: false,
              requestId: `${batchResult.batchId}-${index}`,
              entities: [],
              intent: { action: '', confidence: 0 },
              normalizedProducts: [],
              error: 'Processing failed',
              processingTime: 0,
              queueTime: 0
            };
          }
        }),
        totalProcessingTime: batchResult.totalProcessingTime,
        completedCount: batchResult.completedCount,
        failedCount: batchResult.failedCount
      };

      if (call.callback) {
        call.callback(null, response);
      }
    } catch (error: any) {
      logger.error('gRPC ProcessBatch error', 'GRPC_SERVER', { error });
      if (call.callback) {
        call.callback(error);
      }
    }
  }

  /**
   * Handle ProcessStream RPC (bidirectional streaming)
   */
  private handleProcessStream(call: GrpcCall): void {
    try {
      logger.info('gRPC stream initiated', 'GRPC_SERVER');

      if (call.on) {
        call.on('data', async (request: NLPServiceAPI.GRPC.NLPRequest) => {
          try {
            const result = await this.nlpService.processQuery(
              request.query,
              'normal',
              request.timeout,
              request.metadata
            );

            const response: NLPServiceAPI.GRPC.NLPResponse = {
              success: true,
              requestId: request.requestId || this.generateRequestId(),
              entities: result.entities.map(entity => ({
                type: entity.type,
                value: entity.value,
                confidence: entity.confidence,
                startIndex: entity.startIndex,
                endIndex: entity.endIndex
              })),
              intent: {
                action: result.intent.action,
                confidence: result.intent.confidence
              },
              normalizedProducts: result.normalizedItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit || ''
              })),
              error: '',
              processingTime: result.processingMetadata.processingTime,
              queueTime: 0
            };

            if (call.write) {
              call.write(response);
            }
          } catch (error: any) {
            logger.error('gRPC stream processing error', 'GRPC_SERVER', { error });
            const errorResponse: NLPServiceAPI.GRPC.NLPResponse = {
              success: false,
              requestId: request.requestId || this.generateRequestId(),
              entities: [],
              intent: { action: '', confidence: 0 },
              normalizedProducts: [],
              error: error.message,
              processingTime: 0,
              queueTime: 0
            };

            if (call.write) {
              call.write(errorResponse);
            }
          }
        });

        call.on('end', () => {
          logger.info('gRPC stream ended', 'GRPC_SERVER');
          if (call.end) {
            call.end();
          }
        });

        call.on('error', (error: any) => {
          logger.error('gRPC stream error', 'GRPC_SERVER', { error });
        });
      }
    } catch (error: any) {
      logger.error('gRPC ProcessStream setup error', 'GRPC_SERVER', { error });
    }
  }

  /**
   * Handle GetStatus RPC
   */
  private async handleGetStatus(call: GrpcCall): Promise<void> {
    try {
      const status = this.nlpService.getStatus();
      
      if (call.callback) {
        call.callback(null, status);
      }
    } catch (error: any) {
      logger.error('gRPC GetStatus error', 'GRPC_SERVER', { error });
      if (call.callback) {
        call.callback(error);
      }
    }
  }

  /**
   * Start the gRPC server
   */
  async start(): Promise<void> {
    if (!this.server || !grpc) {
      logger.warn('gRPC not available, skipping gRPC server start', 'GRPC_SERVER');
      return;
    }

    if (this.isStarted) {
      logger.warn('gRPC server already started', 'GRPC_SERVER');
      return;
    }

    try {
      const address = `${this.config.host}:${this.config.grpcPort}`;
      
      await new Promise<void>((resolve, reject) => {
        this.server!.bindAsync(
          address,
          grpc.ServerCredentials.createInsecure(),
          (error: Error | null, port?: number) => {
            if (error) {
              reject(error);
            } else {
              this.server!.start();
              this.isStarted = true;
              logger.info('gRPC server started', 'GRPC_SERVER', {
                address,
                port: port || this.config.grpcPort
              });
              resolve();
            }
          }
        );
      });
    } catch (error) {
      logger.error('Failed to start gRPC server', 'GRPC_SERVER', { error });
      throw error;
    }
  }

  /**
   * Stop the gRPC server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.isStarted) {
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        this.server!.tryShutdown(() => {
          this.isStarted = false;
          logger.info('gRPC server stopped gracefully', 'GRPC_SERVER');
          resolve();
        });
      });
    } catch (error) {
      logger.error('Error stopping gRPC server', 'GRPC_SERVER', { error });
      throw error;
    }
  }

  /**
   * Force shutdown (emergency)
   */
  forceShutdown(): void {
    if (this.server) {
      this.server.forceShutdown();
      this.isStarted = false;
      logger.warn('gRPC server force shutdown completed', 'GRPC_SERVER');
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      port: this.config.grpcPort,
      host: this.config.host,
      grpcAvailable: grpc !== null
    };
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `grpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Fallback gRPC server for when gRPC is not available
export class GrpcAPIServerFallback {
  private nlpService: NLPService;
  private config: NLPServiceConfig;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    logger.warn('Using gRPC API fallback server (no-op)', 'GRPC_SERVER_FALLBACK');
  }

  async start(): Promise<void> {
    logger.info('gRPC API fallback server started (no-op)', 'GRPC_SERVER_FALLBACK');
  }

  async stop(): Promise<void> {
    logger.info('gRPC API fallback server stopped (no-op)', 'GRPC_SERVER_FALLBACK');
  }

  forceShutdown(): void {
    logger.info('gRPC API fallback server force shutdown (no-op)', 'GRPC_SERVER_FALLBACK');
  }

  getStatus() {
    return {
      isStarted: false,
      port: this.config.grpcPort,
      host: this.config.host,
      grpcAvailable: false,
      fallbackMode: true
    };
  }
}

// Export the appropriate server class
export { GrpcAPIServer as RealGrpcServer };