import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { MasterOrchestrator } from '../../core/master-orchestrator/MasterOrchestrator';
import { AgentRegistry } from '../../core/agents/registry/AgentRegistry';
import { RAGSystem } from '../../core/rag/RAGSystem';
import { MaestroFramework } from '../../core/maestro/MaestroFramework';
import { ConversationService } from '../services/ConversationService';
import { TaskService } from '../services/TaskService';
import appConfig from '../../config/app.config';
import ollamaConfig from '../../config/ollama.config';
import ragConfig from '../../config/rag.config';

// Initialize services (singleton pattern)
let masterOrchestrator: MasterOrchestrator;
let agentRegistry: AgentRegistry;
let ragSystem: RAGSystem;
let maestroFramework: MaestroFramework;
let conversationService: ConversationService;
let taskService: TaskService;

async function initializeServices() {
  if (!masterOrchestrator) {
    masterOrchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.main.baseUrl!,
      rag: ragConfig
    });
    await masterOrchestrator.initialize();
  }

  if (!agentRegistry) {
    agentRegistry = new AgentRegistry(appConfig.agents);
    await agentRegistry.initialize();
  }

  if (!ragSystem) {
    ragSystem = new RAGSystem(ragConfig);
    await ragSystem.initialize();
  }

  if (!maestroFramework) {
    maestroFramework = new MaestroFramework(appConfig.maestro);
  }

  if (!conversationService) {
    conversationService = new ConversationService();
  }

  if (!taskService) {
    taskService = new TaskService(maestroFramework);
  }

  return {
    masterOrchestrator,
    agentRegistry,
    ragSystem,
    maestroFramework,
    conversationService,
    taskService
  };
}

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions) {
  // Get services
  const services = await initializeServices();

  // Extract user from JWT if present
  const token = req.headers.authorization?.replace('Bearer ', '');
  let user = null;
  
  if (token) {
    // Verify JWT and extract user
    // user = await verifyJWT(token);
  }

  return {
    req,
    res,
    user,
    ...services
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
