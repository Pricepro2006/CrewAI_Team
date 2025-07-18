/**
 * ConfidenceMasterOrchestrator - Enhanced orchestrator with confidence-scored RAG
 * Replaces the 6-step planning approach with a streamlined 4-step confidence workflow
 */
import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import { DeliveredResponse } from "../rag/confidence";
import type { ExecutionResult, Query, MasterOrchestratorConfig } from "./types";
import { EventEmitter } from "events";
export interface ConfidenceOrchestratorResult extends ExecutionResult {
    confidence: number;
    deliveredResponse: DeliveredResponse;
    processingPath: "simple-query" | "confidence-rag" | "agent-orchestration";
    feedbackId: string;
}
export declare class ConfidenceMasterOrchestrator extends EventEmitter {
    private llm;
    agentRegistry: AgentRegistry;
    ragSystem: RAGSystem;
    private planExecutor;
    private enhancedParser;
    private agentRouter;
    private perfMonitor;
    private confidenceRAG;
    private performanceOptimizer;
    private confidenceConfig;
    constructor(config: MasterOrchestratorConfig);
    initialize(): Promise<void>;
    processQuery(query: Query): Promise<ConfidenceOrchestratorResult>;
    /**
     * Handle simple queries with direct response
     */
    private handleSimpleQuery;
    /**
     * Handle medium complexity queries with confidence RAG
     */
    private handleConfidenceRAG;
    /**
     * Handle complex queries with full agent orchestration
     */
    private handleComplexAgentTask;
    /**
     * Create enhanced plan for complex queries
     */
    private createEnhancedPlan;
    /**
     * Parse plan from LLM response
     */
    private parsePlan;
    /**
     * Consolidate results from multiple agents
     */
    private consolidateAgentResults;
    /**
     * Calculate confidence based on agent execution
     */
    private calculateAgentConfidence;
    /**
     * Create fallback response for errors
     */
    private createFallbackResponse;
    /**
     * Get error-specific fallback message
     */
    private getErrorFallbackMessage;
    /**
     * Create orchestrator result
     */
    private createOrchestratorResult;
    /**
     * Capture user feedback
     */
    captureFeedback(feedbackId: string, feedback: any): void;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        delivery: any;
        calibration: any;
        performance: any;
        optimization: any;
    };
    /**
     * Load calibration parameters
     */
    private loadCalibrationParameters;
    /**
     * Save calibration parameters
     */
    saveCalibrationParameters(): Promise<void>;
    /**
     * Get default RAG configuration
     */
    private getDefaultRAGConfig;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=ConfidenceMasterOrchestrator.d.ts.map