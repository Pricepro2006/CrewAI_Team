/**
 * Agent System Types
 * Comprehensive agent and task orchestration types
 */

import type { BaseEntity, TimestampedEntity, Timestamp, Document, TokenUsage } from './core.js';
import type { TaskLog } from './api.js';

// =====================================================
// Agent Types
// =====================================================

export type AgentType = 
  | 'ResearchAgent' 
  | 'CodeAgent' 
  | 'DataAnalysisAgent' 
  | 'WriterAgent' 
  | 'ToolExecutorAgent'
  | 'EmailAnalysisAgent'
  | 'ConversationAgent'
  | 'PlanningAgent'
  | 'ReviewAgent'
  | 'CoordinatorAgent'
  | 'SpecialistAgent';

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline' | 'initializing';

export interface Agent extends BaseEntity {
  name: string;
  type: AgentType;
  description: string;
  version: string;
  
  // Status and availability
  status: AgentStatus;
  lastActivity: Timestamp;
  currentTask?: string;
  
  // Capabilities and configuration
  capabilities: AgentCapability[];
  tools: string[];
  models: string[];
  languages: string[];
  
  // Performance metrics
  tasksCompleted: number;
  tasksSuccessful: number;
  tasksFailed: number;
  averageExecutionTime: number;
  lastSuccessfulTask?: Timestamp;
  lastFailedTask?: Timestamp;
  
  // Resource usage
  memoryUsage: number;
  cpuUsage: number;
  maxConcurrentTasks: number;
  currentConcurrentTasks: number;
  
  // Configuration
  configuration: AgentConfiguration;
  
  // Health and monitoring
  healthScore: number; // 0-100
  errorRate: number; // 0-1
  isHealthy: boolean;
  lastHealthCheck: Timestamp;
  
  // Metadata
  createdBy: string;
  tags: string[];
  environment: string;
}

export interface AgentCapability {
  name: string;
  type: 'tool' | 'analysis' | 'generation' | 'retrieval' | 'communication' | 'planning' | 'review';
  description: string;
  version: string;
  enabled: boolean;
  confidence: number; // 0-1
  prerequisites?: string[];
  limitations?: string[];
  parameters?: AgentCapabilityParameter[];
}

export interface AgentCapabilityParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
  };
}

export interface AgentConfiguration {
  // Model settings
  model: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  
  // Execution settings
  timeout: number;
  retries: number;
  parallelExecution: boolean;
  maxConcurrency: number;
  
  // Memory and context
  contextWindow: number;
  memoryRetention: number; // in days
  useShortTermMemory: boolean;
  useLongTermMemory: boolean;
  
  // Tool usage
  toolSelectionStrategy: 'automatic' | 'manual' | 'guided';
  maxToolCalls: number;
  toolTimeout: number;
  
  // Learning and adaptation
  learningEnabled: boolean;
  adaptToFeedback: boolean;
  personalizeResponses: boolean;
  
  // Safety and filtering
  contentFiltering: boolean;
  safetyLevel: 'strict' | 'moderate' | 'permissive';
  outputValidation: boolean;
  
  // Custom parameters
  customParameters: Record<string, unknown>;
}

// =====================================================
// Task Types
// =====================================================

export interface AgentTask extends BaseEntity {
  // Task identification
  title: string;
  description: string;
  type: AgentTaskType;
  category: string;
  
  // Assignment and execution
  agentId: string;
  agentType: AgentType;
  status: AgentTaskStatus;
  priority: TaskPriority;
  
  // Input and output
  input: AgentTaskInput;
  output?: AgentTaskOutput;
  
  // Execution details
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  executionTime?: number; // in milliseconds
  
  // Dependencies and relationships
  parentTaskId?: string;
  dependencies: string[];
  blockedBy: string[];
  blocks: string[];
  
  // Progress tracking
  progress: AgentTaskProgress;
  steps: TaskStep[];
  currentStep?: number;
  
  // Error handling
  error?: AgentTaskError;
  retryCount: number;
  maxRetries: number;
  
  // Context and resources
  context: AgentTaskContext;
  resources: TaskResource[];
  
  // Results and metrics
  metrics: TaskMetrics;
  feedback?: TaskFeedback;
  
  // Metadata
  createdBy: string;
  tags: string[];
  estimatedDuration?: number;
  actualDuration?: number;
}

export type AgentTaskType = 
  | 'analysis' 
  | 'generation' 
  | 'research' 
  | 'coding' 
  | 'review' 
  | 'planning' 
  | 'execution' 
  | 'coordination' 
  | 'communication'
  | 'data_processing'
  | 'tool_execution'
  | 'custom';

export type AgentTaskStatus = 
  | 'pending' 
  | 'queued'
  | 'running' 
  | 'paused'
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'timeout'
  | 'blocked';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AgentTaskInput {
  query?: string;
  data?: unknown;
  parameters: Record<string, unknown>;
  files?: TaskFile[];
  context?: Record<string, unknown>;
  constraints?: TaskConstraints;
  expectations?: TaskExpectations;
}

export interface AgentTaskOutput {
  result: unknown;
  data?: unknown;
  files?: TaskFile[];
  artifacts?: TaskArtifact[];
  summary: string;
  confidence: number; // 0-1
  reasoning?: string;
  alternatives?: unknown[];
  recommendations?: string[];
  nextSteps?: string[];
}

export interface TaskFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  content?: string | Buffer;
  metadata?: Record<string, unknown>;
}

export interface TaskArtifact {
  id: string;
  type: 'document' | 'code' | 'data' | 'image' | 'chart' | 'model' | 'report';
  name: string;
  description: string;
  content: unknown;
  format: string;
  metadata?: Record<string, unknown>;
}

export interface TaskConstraints {
  timeLimit?: number; // in minutes
  memoryLimit?: number; // in MB
  cpuLimit?: number; // percentage
  costLimit?: number; // in dollars
  qualityThreshold?: number; // 0-1
  allowedTools?: string[];
  forbiddenActions?: string[];
  complianceRequirements?: string[];
}

export interface TaskExpectations {
  outputFormat: string;
  outputLength?: 'brief' | 'moderate' | 'detailed' | 'comprehensive';
  detailLevel: 'high' | 'medium' | 'low';
  accuracy: 'highest' | 'high' | 'moderate' | 'acceptable';
  creativity: 'high' | 'moderate' | 'low' | 'none';
  tone?: 'formal' | 'casual' | 'technical' | 'friendly' | 'professional';
  audience?: string;
  language?: string;
  includeReferences?: boolean;
  includeSources?: boolean;
  includeReasoning?: boolean;
}

export interface AgentTaskProgress {
  percentage: number; // 0-100
  currentStage: string;
  stagesCompleted: number;
  totalStages: number;
  estimatedTimeRemaining?: number; // in minutes
  lastUpdate: Timestamp;
  milestones: TaskMilestone[];
}

export interface TaskMilestone {
  name: string;
  description: string;
  targetDate?: Timestamp;
  completedDate?: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface TaskStep {
  id: string;
  name: string;
  description: string;
  type: 'thinking' | 'tool_call' | 'analysis' | 'generation' | 'validation' | 'review';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  
  // Execution details
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  duration?: number;
  
  // Input and output
  input?: unknown;
  output?: unknown;
  
  // Tool usage
  tool?: string;
  toolParameters?: Record<string, unknown>;
  
  // Results
  success: boolean;
  error?: string;
  confidence?: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
  logs?: TaskLog[];
}

export interface AgentTaskLog {
  timestamp: Timestamp;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  stepId?: string;
}

export interface AgentTaskError {
  code: string;
  message: string;
  type: 'system' | 'validation' | 'timeout' | 'resource' | 'business' | 'unknown';
  recoverable: boolean;
  retryAfter?: number; // in seconds
  details?: Record<string, unknown>;
  stack?: string;
  suggestions?: string[];
}

export interface AgentTaskContext {
  // Conversation context
  conversationId?: string;
  previousTasks: string[];
  relatedTasks: string[];
  
  // User context
  userId?: string;
  userPreferences?: Record<string, unknown>;
  userHistory?: TaskHistoryItem[];
  
  // Business context
  domain?: string;
  businessUnit?: string;
  project?: string;
  customer?: string;
  
  // Technical context
  environment: string;
  version: string;
  features: string[];
  
  // Data context
  documents: Document[];
  datasets?: string[];
  databases?: string[];
  
  // Temporal context
  deadline?: Timestamp;
  timezone?: string;
  businessHours?: BusinessHours;
  
  // Custom context
  customData?: Record<string, unknown>;
}

export interface TaskHistoryItem {
  taskId: string;
  taskType: AgentTaskType;
  completedAt: Timestamp;
  outcome: 'success' | 'failure' | 'partial';
  feedback?: TaskFeedback;
}

export interface BusinessHours {
  timezone: string;
  schedule: DaySchedule[];
  holidays?: Timestamp[];
}

export interface DaySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // HH:MM format
  endTime: string;
  breaks?: TimeSlot[];
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  description?: string;
}

export interface TaskResource {
  id: string;
  type: 'cpu' | 'memory' | 'storage' | 'network' | 'gpu' | 'license' | 'api_quota' | 'custom';
  name: string;
  amount: number;
  unit: string;
  allocated: number;
  used: number;
  available: number;
  cost?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskMetrics {
  // Performance
  executionTime: number; // milliseconds
  cpuTime: number;
  memoryUsed: number;
  networkTraffic: number;
  
  // Quality
  qualityScore: number; // 0-1
  accuracyScore: number; // 0-1
  completenessScore: number; // 0-1
  
  // LLM usage
  tokenUsage: TokenUsage;
  modelCalls: number;
  cost: number;
  
  // Tool usage
  toolsCalled: string[];
  toolCallsCount: number;
  toolExecutionTime: number;
  
  // Data metrics
  dataProcessed: number;
  recordsProcessed: number;
  filesProcessed: number;
  
  // Error metrics
  errorsCount: number;
  warningsCount: number;
  retryCount: number;
  
  // Business metrics
  businessValue?: number;
  customerSatisfaction?: number;
  slaCompliance?: boolean;
}

export interface TaskFeedback {
  // User feedback
  userRating?: number; // 1-5
  userComments?: string;
  userSatisfaction?: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  
  // Automatic feedback
  systemRating?: number; // 0-1
  qualityMetrics?: Record<string, number>;
  performanceMetrics?: Record<string, number>;
  
  // Improvement suggestions
  suggestions?: string[];
  improvementAreas?: string[];
  
  // Metadata
  providedBy?: string;
  providedAt: Timestamp;
  feedbackType: 'user' | 'system' | 'peer' | 'supervisor';
}

// =====================================================
// Agent Orchestration Types
// =====================================================

export interface AgentPlan extends BaseEntity {
  // Plan identification
  name: string;
  description: string;
  objective: string;
  
  // Planning details
  steps: PlanStep[];
  dependencies: PlanDependency[];
  resources: PlanResource[];
  
  // Execution
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
  progress: PlanProgress;
  
  // Timing
  estimatedDuration: number; // minutes
  actualDuration?: number;
  startTime?: Timestamp;
  endTime?: Timestamp;
  deadline?: Timestamp;
  
  // Quality and validation
  validated: boolean;
  validationResults?: PlanValidationResult[];
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  
  // Context
  context: Record<string, unknown>;
  constraints: PlanConstraints;
  
  // Metadata
  createdBy: string;
  version: string;
  previousVersions?: string[];
}

export interface PlanStep {
  id: string;
  name: string;
  description: string;
  type: AgentTaskType;
  agentType: AgentType;
  
  // Requirements
  requiredCapabilities: string[];
  requiredTools: string[];
  requiredResources: PlanResource[];
  
  // Execution details
  input: Record<string, unknown>;
  expectedOutput: string;
  successCriteria: string[];
  
  // Dependencies
  dependencies: string[]; // step IDs
  parallelExecution: boolean;
  
  // Timing
  estimatedDuration: number;
  priority: TaskPriority;
  
  // Status
  status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'skipped';
  assignedAgent?: string;
  taskId?: string;
  
  // Metadata
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface PlanDependency {
  fromStepId: string;
  toStepId: string;
  type: 'blocks' | 'requires' | 'enhances' | 'optional';
  description: string;
  conditions?: string[];
}

export interface PlanResource {
  type: 'agent' | 'tool' | 'data' | 'api' | 'compute' | 'memory' | 'storage';
  name: string;
  quantity: number;
  duration: number; // minutes
  cost?: number;
  availability?: string;
}

export interface PlanProgress {
  stepsCompleted: number;
  totalSteps: number;
  percentage: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  blockedSteps: string[];
  failedSteps: string[];
}

export interface PlanValidationResult {
  validator: string;
  validatedAt: Timestamp;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  category: 'feasibility' | 'resources' | 'logic' | 'constraints' | 'quality';
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestions?: string[];
}

export interface PlanConstraints {
  timeConstraints: {
    maxDuration?: number; // minutes
    deadline?: Timestamp;
    businessHours?: boolean;
  };
  
  resourceConstraints: {
    maxAgents?: number;
    maxCost?: number;
    allowedAgentTypes?: AgentType[];
    forbiddenTools?: string[];
  };
  
  qualityConstraints: {
    minAccuracy?: number;
    minCompleteness?: number;
    requiresReview?: boolean;
    requiresApproval?: boolean;
  };
  
  businessConstraints: {
    compliance?: string[];
    approvals?: string[];
    notifications?: string[];
  };
}

// =====================================================
// Agent Communication Types
// =====================================================

export interface AgentMessage extends BaseEntity {
  // Message identification
  conversationId: string;
  threadId?: string;
  replyToMessageId?: string;
  
  // Participants
  fromAgentId: string;
  toAgentIds: string[];
  ccAgentIds?: string[];
  
  // Content
  content: string;
  contentType: 'text' | 'json' | 'markdown' | 'html' | 'structured';
  attachments?: AgentMessageAttachment[];
  
  // Classification
  messageType: 'request' | 'response' | 'notification' | 'question' | 'answer' | 'status' | 'error';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  
  // Status and tracking
  status: 'draft' | 'sent' | 'delivered' | 'read' | 'processed' | 'archived';
  readBy: Record<string, Timestamp>; // agentId -> timestamp
  deliveredAt?: Timestamp;
  
  // Context
  context: AgentMessageContext;
  tags: string[];
  
  // Metadata
  encrypted?: boolean;
  signed?: boolean;
  expiresAt?: Timestamp;
  retentionPeriod?: number; // days
}

export interface AgentMessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: unknown;
  url?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMessageContext {
  taskId?: string;
  planId?: string;
  requestId?: string;
  sessionId?: string;
  businessContext?: Record<string, unknown>;
  technicalContext?: Record<string, unknown>;
  previousMessages?: string[];
}

export interface AgentConversation extends BaseEntity {
  // Participants
  participantIds: string[];
  participantRoles: Record<string, string>; // agentId -> role
  
  // Content
  messages: AgentMessage[];
  messageCount: number;
  
  // Status
  status: 'active' | 'paused' | 'completed' | 'archived' | 'deleted';
  lastActivity: Timestamp;
  
  // Classification
  topic?: string;
  category?: string;
  purpose?: string;
  
  // Configuration
  settings: ConversationSettings;
  
  // Results
  outcome?: ConversationOutcome;
  summary?: string;
  decisions?: ConversationDecision[];
  actionItems?: ConversationActionItem[];
  
  // Metadata
  startedBy: string;
  tags: string[];
  privacy: 'public' | 'private' | 'confidential';
}

export interface ConversationSettings {
  autoArchiveAfter?: number; // days
  maxParticipants?: number;
  allowGuests?: boolean;
  moderationEnabled?: boolean;
  encryptionEnabled?: boolean;
  loggingEnabled?: boolean;
  retentionPeriod?: number; // days
  notifications: {
    newMessage?: boolean;
    mentions?: boolean;
    statusUpdates?: boolean;
  };
}

export interface ConversationOutcome {
  status: 'success' | 'partial' | 'failure' | 'cancelled';
  description: string;
  achievements?: string[];
  failures?: string[];
  lessons?: string[];
  metrics?: Record<string, number>;
  artifacts?: TaskArtifact[];
}

export interface ConversationDecision {
  id: string;
  description: string;
  madeBy: string;
  madeAt: Timestamp;
  rationale?: string;
  impact: 'high' | 'medium' | 'low';
  implementationRequired: boolean;
  status: 'pending' | 'approved' | 'implemented' | 'rejected';
}

export interface ConversationActionItem {
  id: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Timestamp;
  dueDate?: Timestamp;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: TaskPriority;
  tags?: string[];
}