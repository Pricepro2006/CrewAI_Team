/**
 * Core services index - Centralized exports for service layer
 * Phase 4 TypeScript remediation - Enhanced type exports
 */

// Existing exports
export { SearchKnowledgeService } from "./SearchKnowledgeService.js";
export type { SearchResult, SearchQuery } from "./SearchKnowledgeService.js";

// Advanced service orchestration types
export * from './types.js';

// Core service implementations  
export { EmailIngestionServiceImpl } from './EmailIngestionServiceImpl.js';
export { EmailProcessingQueueService } from './EmailProcessingQueueService.js';
export { OptimizedEmailProcessor } from './OptimizedEmailProcessor.js';
export { EmailChainAnalyzer } from './EmailChainAnalyzer.js';
export { EmailThreePhaseAnalysisService } from './EmailThreePhaseAnalysisService.js';

// Service interfaces and types
export * from './EmailIngestionService.js';

// Performance optimization services
export { OllamaOptimizer } from './OllamaOptimizer.js';
