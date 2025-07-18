/**
 * WebSocket handlers for confidence scoring real-time updates
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../utils/logger';
import { ConfidenceMasterOrchestrator } from '../../core/master-orchestrator/ConfidenceMasterOrchestrator';

export interface ConfidenceUpdateData {
  stage: 'query-analysis' | 'retrieval' | 'generation' | 'evaluation' | 'delivery';
  confidence: number;
  details?: any;
  timestamp: string;
}

export interface EvaluationCompleteData {
  factuality: number;
  relevance: number;
  coherence: number;
  overall: number;
  action: string;
  timestamp: string;
}

export interface ConfidenceWebSocketEvents {
  'confidence:join': (conversationId: string) => void;
  'confidence:leave': (conversationId: string) => void;
  'confidence:update': (data: ConfidenceUpdateData) => void;
  'evaluation:complete': (data: EvaluationCompleteData) => void;
  'feedback:submit': (feedbackData: any) => void;
}

export function setupConfidenceWebSocket(
  io: SocketIOServer,
  orchestrator: ConfidenceMasterOrchestrator
) {
  const confidenceNamespace = io.of('/confidence');
  
  logger.info('Setting up confidence WebSocket namespace', 'WEBSOCKET');

  confidenceNamespace.on('connection', (socket) => {
    logger.info('New confidence WebSocket connection', 'WEBSOCKET', {
      socketId: socket.id,
    });

    // Join conversation room for updates
    socket.on('confidence:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug('Socket joined conversation room', 'WEBSOCKET', {
        socketId: socket.id,
        conversationId,
      });
    });

    // Leave conversation room
    socket.on('confidence:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug('Socket left conversation room', 'WEBSOCKET', {
        socketId: socket.id,
        conversationId,
      });
    });

    // Handle feedback submission via WebSocket
    socket.on('feedback:submit', async (data) => {
      const { feedbackId, feedback } = data;
      
      try {
        orchestrator.captureFeedback(feedbackId, feedback);
        
        // Acknowledge receipt
        socket.emit('feedback:acknowledged', {
          feedbackId,
          timestamp: new Date().toISOString(),
        });
        
        logger.info('Feedback submitted via WebSocket', 'WEBSOCKET', {
          feedbackId,
          helpful: feedback.helpful,
          accurate: feedback.accurate,
        });
      } catch (error) {
        socket.emit('feedback:error', {
          feedbackId,
          error: (error as Error).message,
        });
      }
    });

    // Request confidence stats
    socket.on('stats:request', async () => {
      const stats = orchestrator.getPerformanceStats();
      socket.emit('stats:response', {
        ...stats,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      logger.debug('Confidence WebSocket disconnected', 'WEBSOCKET', {
        socketId: socket.id,
      });
    });
  });

  // Set up orchestrator event forwarding
  orchestrator.on('confidence:update', (data) => {
    const updateData: ConfidenceUpdateData = {
      stage: data.stage,
      confidence: data.confidence,
      details: data.details,
      timestamp: new Date().toISOString(),
    };
    
    // Emit to all clients in the conversation room
    if (data.conversationId) {
      confidenceNamespace
        .to(`conversation:${data.conversationId}`)
        .emit('confidence:update', updateData);
    }
    
    // Also emit to global listeners
    confidenceNamespace.emit('confidence:global:update', {
      ...updateData,
      conversationId: data.conversationId,
    });
  });

  orchestrator.on('evaluation:complete', (data) => {
    const evaluationData: EvaluationCompleteData = {
      factuality: data.factuality,
      relevance: data.relevance,
      coherence: data.coherence,
      overall: data.overall,
      action: data.action,
      timestamp: new Date().toISOString(),
    };
    
    // Emit to conversation room
    if (data.conversationId) {
      confidenceNamespace
        .to(`conversation:${data.conversationId}`)
        .emit('evaluation:complete', evaluationData);
    }
    
    // Global emit
    confidenceNamespace.emit('evaluation:global:complete', {
      ...evaluationData,
      conversationId: data.conversationId,
    });
  });

  orchestrator.on('processing:complete', (data) => {
    // Emit processing completion
    if (data.conversationId) {
      confidenceNamespace
        .to(`conversation:${data.conversationId}`)
        .emit('processing:complete', {
          confidence: data.confidence,
          processingPath: data.processingPath,
          duration: data.duration,
          timestamp: new Date().toISOString(),
        });
    }
  });

  // Periodic stats broadcast
  const statsInterval = setInterval(() => {
    const stats = orchestrator.getPerformanceStats();
    confidenceNamespace.emit('stats:broadcast', {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }, 30000); // Every 30 seconds

  // Cleanup on shutdown
  process.on('SIGTERM', () => {
    clearInterval(statsInterval);
  });

  return confidenceNamespace;
}

/**
 * Create confidence visualization data for frontend
 */
export function createConfidenceVisualization(
  confidence: number,
  qualityMetrics?: {
    factuality: number;
    relevance: number;
    coherence: number;
  }
): any {
  const getColor = (score: number) => {
    if (score >= 0.8) return '#10b981'; // green
    if (score >= 0.6) return '#f59e0b'; // amber
    if (score >= 0.4) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getLabel = (score: number) => {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    if (score >= 0.4) return 'Low';
    return 'Very Low';
  };

  const visualization = {
    overall: {
      score: confidence,
      percentage: Math.round(confidence * 100),
      color: getColor(confidence),
      label: getLabel(confidence),
    },
    metrics: qualityMetrics ? {
      factuality: {
        score: qualityMetrics.factuality,
        percentage: Math.round(qualityMetrics.factuality * 100),
        color: getColor(qualityMetrics.factuality),
        label: getLabel(qualityMetrics.factuality),
      },
      relevance: {
        score: qualityMetrics.relevance,
        percentage: Math.round(qualityMetrics.relevance * 100),
        color: getColor(qualityMetrics.relevance),
        label: getLabel(qualityMetrics.relevance),
      },
      coherence: {
        score: qualityMetrics.coherence,
        percentage: Math.round(qualityMetrics.coherence * 100),
        color: getColor(qualityMetrics.coherence),
        label: getLabel(qualityMetrics.coherence),
      },
    } : null,
  };

  return visualization;
}