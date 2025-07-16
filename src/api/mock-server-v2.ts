import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Mock conversation storage
const conversations = new Map();
const messages = new Map();

// Helper to log requests
const log = (msg: string) => console.log(`[MockServer] ${msg}`);

// Helper to parse tRPC input from query or body
const parseTrpcInput = (req: any) => {
  if (req.method === 'GET') {
    // Parse query parameters for GET requests
    const input = req.query.input ? JSON.parse(req.query.input) : {};
    return input['0'] || {};
  } else {
    // Parse body for POST requests
    return req.body['0'] || {};
  }
};

// Mock TRPC endpoints - handle both GET (queries) and POST (mutations)
const handleTrpcRequest = async (req: any, res: any) => {
  const endpoint = req.path.replace('/trpc/', '');
  log(`${req.method} ${endpoint}`);
  
  const input = parseTrpcInput(req);
  log(`Input: ${JSON.stringify(input, null, 2)}`);

  switch (endpoint) {
    case 'chat.create': {
      const conversationId = Date.now().toString();
      const { message } = input;
      
      conversations.set(conversationId, {
        id: conversationId,
        title: 'AI Agent Research',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Store user message
      const userMsg = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      messages.set(`${conversationId}-user`, userMsg);

      // Create full assistant response immediately
      const assistantContent = `## Research Summary: Latest AI Agent Architecture Trends

### 1. Multi-Agent Orchestration
Recent developments show a shift towards sophisticated multi-agent systems:
- **Master Orchestrator Pattern**: Central coordinator for planning and delegation
- **Tool-Augmented Agents**: Specialized agents with web search, code generation capabilities

### 2. RAG-Enhanced Agents
Retrieval-Augmented Generation is becoming standard:
- Vector databases for domain knowledge
- Dynamic context retrieval during execution
- Hybrid search combining semantic and keyword matching

### 3. Plan-Execute-Review Loops
Modern architectures implement iterative refinement:
- Initial planning phase breaks down complex tasks
- Execution with real-time monitoring
- Review and replan based on results

### 4. Local-First Deployments
Growing trend towards privacy-preserving architectures:
- Using models like Llama, Mistral, and Qwen locally
- Ollama for easy local LLM deployment
- No external API dependencies

### 5. Specialized Agent Types
- **Research Agents**: Web search and synthesis
- **Code Agents**: Generation and analysis
- **Data Agents**: Processing and visualization
- **Writer Agents**: Content creation

[Research completed using web search tool]`;

      const assistantMsg = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString()
      };
      messages.set(`${conversationId}-assistant`, assistantMsg);
      
      log(`Stored assistant response for conversation ${conversationId}`);

      // TRPC batch response format - return full content immediately
      res.json([{
        result: {
          data: {
            json: {
              conversationId,
              response: assistantContent,
              metadata: {
                agentType: "ResearchAgent",
                toolsUsed: ["web_search", "document_analysis"]
              }
            }
          }
        }
      }]);
      break;
    }

    case 'chat.message': {
      const { conversationId, message } = input;
      
      // Store new user message
      const msgCount = Array.from(messages.keys()).filter(k => k.startsWith(conversationId)).length;
      messages.set(`${conversationId}-user-${msgCount}`, {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      res.json([{
        result: {
          data: {
            json: {
              response: "Processing your follow-up request...",
              metadata: {
                status: "processing",
                agent: "ResearchAgent"
              }
            }
          }
        }
      }]);
      break;
    }

    case 'chat.list': {
      const conversationList = Array.from(conversations.values());
      
      res.json([{
        result: {
          data: {
            json: conversationList
          }
        }
      }]);
      break;
    }

    case 'chat.history': {
      const { conversationId } = input;
      const convMessages = [];
      
      // Get all messages for this conversation
      messages.forEach((msg, key) => {
        if (key.startsWith(conversationId)) {
          convMessages.push(msg);
        }
      });
      
      log(`Returning ${convMessages.length} messages for conversation ${conversationId}`);
      
      res.json([{
        result: {
          data: {
            json: convMessages
          }
        }
      }]);
      break;
    }

    case 'agent.status': {
      res.json([{
        result: {
          data: {
            json: {
              agents: [
                {
                  id: 'research-agent',
                  name: 'ResearchAgent',
                  status: 'active',
                  currentTask: 'Researching AI agent architectures',
                  progress: 75
                }
              ]
            }
          }
        }
      }]);
      break;
    }

    default:
      res.status(404).json({ error: 'Endpoint not found' });
  }
};

// Handle both GET and POST requests
app.get('/trpc/*', handleTrpcRequest);
app.post('/trpc/*', handleTrpcRequest);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: 'mock-v2',
    conversations: conversations.size,
    messages: messages.size
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  log(`Mock TRPC server v2 running on http://localhost:${PORT}`);
});