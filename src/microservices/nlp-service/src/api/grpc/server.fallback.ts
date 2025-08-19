/**
 * Fallback gRPC API Server for NLP Microservice
 * Provides a no-op implementation when gRPC dependencies are not available
 */

import { NLPService } from '../../services/NLPService';
import { logger } from '../../utils/logger';
import type { NLPServiceConfig } from '../../types/index';

export class GrpcAPIServer {
  private nlpService: NLPService;
  private config: NLPServiceConfig;
  private isAvailable: boolean = false;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    logger.warn('gRPC dependencies not available - gRPC API server disabled', 'GRPC_SERVER');
  }

  async start(): Promise<void> {
    logger.info('gRPC server start requested, but dependencies not available', 'GRPC_SERVER');
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    logger.info('gRPC server stop requested', 'GRPC_SERVER');
    return Promise.resolve();
  }

  forceShutdown(): void {
    logger.info('gRPC server force shutdown requested', 'GRPC_SERVER');
  }

  getServerInfo() {
    return {
      isAvailable: this.isAvailable,
      host: this.config.host,
      port: this.config.grpcPort,
      serverType: 'grpc-disabled'
    };
  }
}