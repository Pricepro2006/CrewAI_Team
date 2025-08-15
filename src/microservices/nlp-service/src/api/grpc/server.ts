/**
 * gRPC Server for NLP Microservice
 * Provides high-performance gRPC endpoints for NLP operations
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { NLPService } from '../../services/NLPService.js';
import { logger } from '../../utils/logger.js';
import type {
  NLPServiceConfig,
  NLPServiceAPI
} from '../../types/index.js';

export class GrpcAPIServer {
  private server: grpc.Server;
  private nlpService: NLPService;
  private config: NLPServiceConfig;
  private proto: any;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    // Load protocol buffer definitions
    this.loadProtoDefinition();
    
    this.server = new grpc.Server();
    this.setupServices();
  }

  /**
   * Start the gRPC server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const address = `${this?.config?.host}:${this?.config?.grpcPort}`;
      
      this?.server?.bindAsync(address, grpc?.ServerCredentials?.createInsecure(), (error, port) => {
        if (error) {
          logger.error('Failed to bind gRPC server', 'GRPC_SERVER', { error });
          reject(error);
          return;
        }
        
        this?.server?.start();
        logger.info('gRPC server started', 'GRPC_SERVER', {
          host: this?.config?.host,
          port: this?.config?.grpcPort,
          address
        });
        
        resolve();
      });
    });
  }

  /**
   * Stop the gRPC server
   */
  async stop(): Promise<void> {
    return new Promise((resolve: any) => {
      this?.server?.tryShutdown((error: any) => {
        if (error) {
          logger.error('Error stopping gRPC server', 'GRPC_SERVER', { error });
        } else {
          logger.info('gRPC server stopped', 'GRPC_SERVER');
        }
        resolve();
      });
    });
  }

  /**
   * Force stop the gRPC server
   */
  forceShutdown(): void {
    this?.server?.forceShutdown();
    logger.info('gRPC server force shutdown', 'GRPC_SERVER');
  }

  /**
   * Load protocol buffer definition
   */
  private loadProtoDefinition(): void {
    // For now, we'll create the proto definition inline
    // In production, this would be loaded from a .proto file
    const protoDefinition = protoLoader.loadSync('nlp_service.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [__dirname]
    });
    
    this.proto = grpc.loadPackageDefinition(protoDefinition);
    
    // Create the proto file content if it doesn't exist
    this.createProtoFile();
  }

  /**
   * Set up gRPC services
   */
  private setupServices(): void {
    // Add the NLP service
    this?.server?.addService(this?.proto?.nlp.NLPService.service, {
      ProcessQuery: this?.processQuery?.bind(this),
      ProcessBatch: this?.processBatch?.bind(this),
      GetStatus: this?.getStatus?.bind(this),
      GetMetrics: this?.getMetrics?.bind(this),
      GetQueueStatus: this?.getQueueStatus?.bind(this),
      HealthCheck: this?.healthCheck?.bind(this)
    });
  }

  /**
   * Process a single query (gRPC method)
   */
  private async processQuery(
    call: grpc.ServerUnaryCall<NLPServiceAPI.GRPC.NLPRequest, NLPServiceAPI.GRPC.NLPResponse>,
    callback: grpc.sendUnaryData<NLPServiceAPI.GRPC.NLPResponse>
  ): Promise<void> {
    const { query, priority, timeout, metadata, requestId } = call.request;
    
    try {
      logger.debug('gRPC process query', 'GRPC_SERVER', {
        requestId,
        query: query.substring(0, 100),
        priority
      });
      
      const priorityLevel = this.mapGrpcPriority(priority);
      const result = await this?.nlpService?.processQuery(query, priorityLevel, timeout, metadata);
      
      const response: NLPServiceAPI.GRPC.NLPResponse = {
        success: true,
        requestId,
        entities: result?.entities?.map(e => ({
          type: e.type,
          value: e.value,
          confidence: e.confidence,
          startIndex: e.startIndex,
          endIndex: e.endIndex
        })),
        intent: {
          action: result?.intent?.action,
          confidence: result?.intent?.confidence
        },
        normalizedProducts: result?.normalizedItems?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || ''
        })),
        error: '',
        processingTime: result?.processingMetadata?.processingTime,
        queueTime: 0
      };
      
      callback(null, response);
      
    } catch (error: any) {
      logger.error('gRPC process query failed', 'GRPC_SERVER', {
        requestId,
        error: error.message
      });
      
      const response: NLPServiceAPI.GRPC.NLPResponse = {
        success: false,
        requestId,
        entities: [],
        intent: { action: '', confidence: 0 },
        normalizedProducts: [],
        error: error.message,
        processingTime: 0,
        queueTime: 0
      };
      
      callback(null, response);
    }
  }

  /**
   * Process batch queries (gRPC method)
   */
  private async processBatch(
    call: grpc.ServerUnaryCall<NLPServiceAPI.GRPC.BatchNLPRequest, NLPServiceAPI.GRPC.BatchNLPResponse>,
    callback: grpc.sendUnaryData<NLPServiceAPI.GRPC.BatchNLPResponse>
  ): Promise<void> {
    const { queries, batchId } = call.request;
    
    try {
      logger.debug('gRPC process batch', 'GRPC_SERVER', {
        batchId,
        queryCount: queries?.length || 0
      });
      
      const queryData = queries?.map(q => ({
        query: q.query,
        metadata: q.metadata
      }));
      
      const result = await this?.nlpService?.processBatch(
        queryData,
        'normal',
        undefined,
        { batchId }
      );
      
      const response: NLPServiceAPI.GRPC.BatchNLPResponse = {
        success: true,
        batchId: result.batchId,
        results: result?.results?.map((r, index) => {
          if (!r) {
            return {
              success: false,
              requestId: `${batchId}-${index}`,
              entities: [],
              intent: { action: '', confidence: 0 },
              normalizedProducts: [],
              error: 'Processing failed',
              processingTime: 0,
              queueTime: 0
            };
          }
          
          return {
            success: true,
            requestId: `${batchId}-${index}`,
            entities: r?.entities?.map(e => ({
              type: e.type,
              value: e.value,
              confidence: e.confidence,
              startIndex: e.startIndex,
              endIndex: e.endIndex
            })),
            intent: {
              action: r?.intent?.action,
              confidence: r?.intent?.confidence
            },
            normalizedProducts: r?.normalizedItems?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unit: item.unit || ''
            })),
            error: '',
            processingTime: r?.processingMetadata?.processingTime,
            queueTime: 0
          };
        }),
        totalProcessingTime: result.totalProcessingTime,
        completedCount: result.completedCount,
        failedCount: result.failedCount
      };
      
      callback(null, response);
      
    } catch (error: any) {
      logger.error('gRPC process batch failed', 'GRPC_SERVER', {
        batchId,
        error: error.message
      });
      
      const response: NLPServiceAPI.GRPC.BatchNLPResponse = {
        success: false,
        batchId,
        results: [],
        totalProcessingTime: 0,
        completedCount: 0,
        failedCount: queries?.length || 0
      };
      
      callback(null, response);
    }
  }

  /**
   * Get service status (gRPC method)
   */
  private getStatus(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    const status = this?.nlpService?.getStatus();
    callback(null, {
      service: status.service,
      version: status.version,
      status: status.status,
      uptime: status.uptime,
      startedAt: status.startedAt,
      dependencies: {
        ollama: status?.dependencies?.ollama,
        redis: status?.dependencies?.redis,
        queue: status?.dependencies?.queue
      },
      queue: {
        size: status?.queue?.size,
        activeRequests: status?.queue?.activeRequests,
        health: status?.queue?.health
      }
    });
  }

  /**
   * Get service metrics (gRPC method)
   */
  private getMetrics(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    const metrics = this?.nlpService?.getMetrics();
    callback(null, metrics);
  }

  /**
   * Get queue status (gRPC method)
   */
  private getQueueStatus(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    const queueStatus = this?.nlpService?.getQueueStatus();
    callback(null, queueStatus);
  }

  /**
   * Health check (gRPC method)
   */
  private healthCheck(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): void {
    const status = this?.nlpService?.getStatus();
    callback(null, {
      status: status.status === 'healthy' ? 'SERVING' : 'NOT_SERVING',
      service: 'nlp-service',
      timestamp: Date.now()
    });
  }

  /**
   * Map gRPC priority to service priority
   */
  private mapGrpcPriority(priority: number): 'high' | 'normal' | 'low' {
    switch (priority) {
      case 2:
        return 'high';
      case 1:
        return 'normal';
      case 0:
      default:
        return 'low';
    }
  }

  /**
   * Create proto file definition
   */
  private createProtoFile(): void {
    // This would typically be a separate .proto file
    // Here's the definition for reference:
    const protoContent = `
syntax = "proto3";

package nlp;

service NLPService {
  rpc ProcessQuery (NLPRequest) returns (NLPResponse);
  rpc ProcessBatch (BatchNLPRequest) returns (BatchNLPResponse);
  rpc GetStatus (StatusRequest) returns (StatusResponse);
  rpc GetMetrics (MetricsRequest) returns (MetricsResponse);
  rpc GetQueueStatus (QueueStatusRequest) returns (QueueStatusResponse);
  rpc HealthCheck (HealthRequest) returns (HealthResponse);
}

message NLPRequest {
  string query = 1;
  int32 priority = 2;
  int32 timeout = 3;
  map<string, string> metadata = 4;
  string request_id = 5;
}

message NLPResponse {
  bool success = 1;
  string request_id = 2;
  repeated Entity entities = 3;
  Intent intent = 4;
  repeated NormalizedProduct normalized_products = 5;
  string error = 6;
  int64 processing_time = 7;
  int64 queue_time = 8;
}

message Entity {
  string type = 1;
  string value = 2;
  double confidence = 3;
  int32 start_index = 4;
  int32 end_index = 5;
}

message Intent {
  string action = 1;
  double confidence = 2;
}

message NormalizedProduct {
  string name = 1;
  int32 quantity = 2;
  string unit = 3;
}

message BatchNLPRequest {
  repeated NLPRequest queries = 1;
  string batch_id = 2;
}

message BatchNLPResponse {
  bool success = 1;
  string batch_id = 2;
  repeated NLPResponse results = 3;
  int64 total_processing_time = 4;
  int32 completed_count = 5;
  int32 failed_count = 6;
}

message StatusRequest {}

message StatusResponse {
  string service = 1;
  string version = 2;
  string status = 3;
  int64 uptime = 4;
  int64 started_at = 5;
  Dependencies dependencies = 6;
  QueueInfo queue = 7;
}

message Dependencies {
  string ollama = 1;
  string redis = 2;
  string queue = 3;
}

message QueueInfo {
  int32 size = 1;
  int32 active_requests = 2;
  string health = 3;
}

message MetricsRequest {}

message MetricsResponse {
  int64 uptime = 1;
  RequestMetrics requests = 2;
  QueueMetrics queue = 3;
  ResourceMetrics resources = 4;
  DependencyMetrics dependencies = 5;
}

message RequestMetrics {
  int64 total = 1;
  int64 successful = 2;
  int64 failed = 3;
  double rate = 4;
}

message QueueMetrics {
  int32 size = 1;
  int32 processing = 2;
  double average_wait_time = 3;
  double average_processing_time = 4;
  double throughput = 5;
}

message ResourceMetrics {
  CPUMetrics cpu = 1;
  MemoryMetrics memory = 2;
}

message CPUMetrics {
  double usage = 1;
  repeated double load = 2;
}

message MemoryMetrics {
  int64 used = 1;
  int64 total = 2;
  int64 heap_used = 3;
  int64 heap_total = 4;
}

message DependencyMetrics {
  DependencyStatus ollama = 1;
  DependencyStatus redis = 2;
}

message DependencyStatus {
  string status = 1;
  double response_time = 2;
  int64 last_check = 3;
}

message QueueStatusRequest {}

message QueueStatusResponse {
  bool healthy = 1;
  int32 queue_size = 2;
  int32 active_requests = 3;
  int32 max_concurrent = 4;
  int64 estimated_wait_time = 5;
}

message HealthRequest {}

message HealthResponse {
  string status = 1;
  string service = 2;
  int64 timestamp = 3;
}
    `;
    
    // In a real implementation, you would write this to a file
    logger.debug('gRPC proto definition loaded', 'GRPC_SERVER');
  }
}