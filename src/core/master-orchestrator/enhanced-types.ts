/**
 * Enhanced types for Master Orchestrator improvements
 * Based on agent template patterns for better query analysis and routing
 */

import type { AgentType } from '../shared/types';

export interface QueryAnalysis {
  intent: string;
  entities: Record<string, any>;
  complexity: number; // 1-10 scale
  domains: string[]; // Required expertise domains
  priority: "low" | "medium" | "high" | "urgent";
  estimatedDuration: number; // in seconds
  resourceRequirements: ResourceRequirements;
}

export interface ResourceRequirements {
  requiresInternet: boolean;
  requiresDatabase: boolean;
  requiresLLM: boolean;
  requiresVector: boolean;
  computeIntensive: boolean;
  memoryIntensive: boolean;
}

export interface AgentRoutingPlan {
  selectedAgents: AgentSelection[];
  executionStrategy: "sequential" | "parallel" | "hybrid";
  confidence: number; // 0-1
  fallbackAgents: AgentType[];
  estimatedCost: number;
  riskAssessment: RiskAssessment;
}

export interface AgentSelection {
  agentType: AgentType;
  priority: number;
  confidence: number;
  rationale: string;
  expectedDuration: number;
  requiredCapabilities: string[];
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  factors: string[];
  mitigations: string[];
}

export interface AgentCapabilityMatrix {
  [agentType: string]: {
    capabilities: string[];
    tools: string[];
    domains: string[];
    performance: PerformanceMetrics;
    availability: AvailabilityStatus;
  };
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface AvailabilityStatus {
  isAvailable: boolean;
  currentLoad: number; // 0-1
  estimatedWaitTime: number; // in seconds
}

export interface CrossAgentMessage {
  id: string;
  from: string;
  to: string[];
  messageType: "query" | "response" | "context_update" | "coordination";
  content: any;
  priority: "low" | "medium" | "high";
  timestamp: Date;
  requiresResponse: boolean;
  correlationId?: string;
}

export interface AgentCoordination {
  sessionId: string;
  participants: string[];
  coordinator: string;
  sharedContext: Record<string, any>;
  messageHistory: CrossAgentMessage[];
  status: "initializing" | "active" | "waiting" | "completed" | "failed";
}

export interface EnhancedExecutionContext {
  queryAnalysis: QueryAnalysis;
  routingPlan: AgentRoutingPlan;
  coordination: AgentCoordination;
  metrics: ExecutionMetrics;
}

export interface ExecutionMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  agentMetrics: Record<string, PerformanceMetrics>;
  resourceUsage: ResourceUsage;
  qualityScore: number;
}

export interface ResourceUsage {
  cpuTime: number;
  memoryPeak: number;
  networkRequests: number;
  databaseQueries: number;
  llmTokens: number;
}
