import { Tool } from '../../tools/base/BaseTool.js';
import { Document } from '../../shared/types.js';

export interface AgentCapability {
  name: string;
  description: string;
  type: 'tool' | 'analysis' | 'generation' | 'retrieval';
}

export interface AgentContext {
  task: string;
  ragDocuments?: Document[];
  previousResults?: any[];
  userPreferences?: Record<string, any>;
  tool?: string;
  metadata?: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  output?: string;
  error?: string;
  metadata?: AgentMetadata;
}

export interface AgentMetadata {
  agent: string;
  tool?: string;
  timestamp: string;
  duration?: number;
  tokensUsed?: number;
  toolMetadata?: any;
  errorType?: string;
  [key: string]: any;
}

export interface ToolExecutionParams {
  tool: Tool;
  context: AgentContext;
  parameters: any;
  guidance?: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  capabilities?: string[];
}

export interface AgentRegistration {
  type: string;
  agent: BaseAgent;
  config: AgentConfig;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  
  abstract execute(task: string, context: AgentContext): Promise<AgentResult>;
  abstract executeWithTool(params: ToolExecutionParams): Promise<AgentResult>;
  abstract registerTool(tool: Tool): void;
  abstract getTools(): Tool[];
  abstract getTool(name: string): Tool | undefined;
  abstract hasCapability(capability: string): boolean;
  abstract initialize(): Promise<void>;
}

export type AgentFactory = () => BaseAgent;

export interface AgentPoolConfig {
  maxAgents: number;
  idleTimeout: number;
  preloadAgents?: string[];
}

export interface AgentStatus {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  lastActivity: Date;
  tasksCompleted: number;
  errors: number;
}
