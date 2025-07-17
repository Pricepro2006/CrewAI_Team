import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { MasterOrchestrator } from '../../core/master-orchestrator/MasterOrchestrator';
import { ConversationService } from '../services/ConversationService';
import ollamaConfig from '../../config/ollama.config';

// Initialize services (singleton pattern)
let masterOrchestrator: MasterOrchestrator;
let conversationService: ConversationService;

async function initializeServices() {
  if (!masterOrchestrator) {
    masterOrchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.main.baseUrl!,
      rag: {
        vectorStore: {
          type: 'chromadb',
          path: './data/chroma',
          collectionName: 'crewai-knowledge',
          dimension: 384
        },
        chunking: {
          size: 500,
          overlap: 50,
          method: 'sentence'
        },
        retrieval: {
          topK: 5,
          minScore: 0.5,
          reranking: true
        }
      }
    });
    await masterOrchestrator.initialize();
  }

  if (!conversationService) {
    conversationService = new ConversationService();
  }

  return {
    masterOrchestrator,
    conversationService,
    agentRegistry: masterOrchestrator.agentRegistry,
    ragSystem: masterOrchestrator.ragSystem
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
  const user = null;
  
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
