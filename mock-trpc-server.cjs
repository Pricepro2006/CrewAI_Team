const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Store conversations and messages
const conversations = new Map();
const messages = new Map();

// TRPC batch endpoint - TRPC sends all requests as POST to the main endpoint
app.post('/trpc/*', async (req, res) => {
  const path = req.path.replace('/trpc/', '');
  console.log(`TRPC Request to: ${path}`);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  // Handle different TRPC procedures
  if (path === 'chat.create') {
    handleChatCreate(req, res);
  } else if (path === 'chat.message') {
    handleChatMessage(req, res);
  } else if (path === 'chat.history') {
    handleChatHistory(req, res);
  } else {
    // Default response for unknown endpoints
    res.json({ result: { data: { json: null } } });
  }
});

function handleChatCreate(req, res) {
  const conversationId = Date.now().toString();
  
  // Extract message from TRPC request format
  let message = '';
  if (req.body && req.body[0]) {
    message = req.body[0].message || req.body[0].json?.message || '';
  }
  
  console.log('Creating conversation:', conversationId);
  console.log('Initial message:', message);
  
  // Store conversation
  conversations.set(conversationId, {
    id: conversationId,
    createdAt: new Date().toISOString(),
    messages: []
  });
  
  // Store initial messages
  const userMsg = {
    id: `${conversationId}-user-1`,
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  const assistantMsg = {
    id: `${conversationId}-assistant-1`,
    role: 'assistant',
    content: `I'll help you research the latest trends in AI agent architectures.

## Research Summary: Latest AI Agent Architecture Trends

### 1. Multi-Agent Orchestration
Recent developments show a shift towards sophisticated multi-agent systems where specialized agents collaborate:
- **Master Orchestrator Pattern**: A central coordinator that plans, delegates, and reviews agent work
- **Tool-Augmented Agents**: Agents equipped with specific tools for web search, code generation, and data analysis

### 2. RAG-Enhanced Agents
Retrieval-Augmented Generation is becoming standard:
- Agents maintain vector databases of domain knowledge
- Dynamic context retrieval during task execution
- Hybrid search combining semantic and keyword matching

### 3. Plan-Execute-Review Loops
Modern architectures implement iterative refinement:
- Initial planning phase breaks down complex tasks
- Execution with real-time monitoring
- Review and replan based on intermediate results

### 4. Local-First Deployments
Growing trend towards privacy-preserving architectures:
- Using models like Llama, Mistral, and Qwen locally
- Ollama and similar tools for easy local LLM deployment
- No external API dependencies for sensitive data

### 5. Specialized Agent Types
Common agent specializations include:
- **Research Agents**: Web search and information synthesis
- **Code Agents**: Generation and analysis of code
- **Data Agents**: Processing and visualization
- **Writer Agents**: Content creation and formatting

[Research conducted using web search tool]
[Sources analyzed: 15 recent papers and implementations]
[Agent: ResearchAgent | Confidence: High]`,
    timestamp: new Date().toISOString()
  };
  
  const conv = conversations.get(conversationId);
  conv.messages.push(userMsg);
  conv.messages.push(assistantMsg);
  
  // Send TRPC-formatted response
  res.json({
    result: {
      data: {
        json: {
          conversationId: conversationId,
          response: assistantMsg.content,
          metadata: {
            agentType: "ResearchAgent",
            toolsUsed: ["web_search", "document_analysis"],
            status: "complete"
          }
        }
      }
    }
  });
}

function handleChatMessage(req, res) {
  const { conversationId, message } = req.body[0] || {};
  
  console.log('Continuing conversation:', conversationId);
  console.log('New message:', message);
  
  const conv = conversations.get(conversationId);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  // Add messages
  const userMsg = {
    id: `${conversationId}-user-${conv.messages.length + 1}`,
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  const assistantMsg = {
    id: `${conversationId}-assistant-${conv.messages.length + 2}`,
    role: 'assistant',
    content: `I understand you want to continue our discussion. Based on your previous interest in AI agent architectures, here's additional information:

## Advanced Implementation Patterns

### Hierarchical Agent Networks
- Parent agents that spawn specialized child agents for subtasks
- Dynamic agent creation based on task requirements
- Resource pooling and load balancing across agents

### Memory and Context Management
- Long-term memory stores for persistent knowledge
- Short-term working memory for active tasks
- Context compression techniques for efficient token usage

### Inter-Agent Communication Protocols
- Standardized message formats between agents
- Event-driven architectures for real-time coordination
- Consensus mechanisms for multi-agent decision making

[Continuing analysis based on your query]
[Agent: ResearchAgent | Status: Active]`,
    timestamp: new Date().toISOString()
  };
  
  conv.messages.push(userMsg);
  conv.messages.push(assistantMsg);
  
  res.json({
    result: {
      data: {
        json: {
          response: assistantMsg.content,
          metadata: {
            agentType: "ResearchAgent",
            continuingFrom: conversationId
          }
        }
      }
    }
  });
}

function handleChatHistory(req, res) {
  const { conversationId } = req.body[0] || {};
  
  console.log('Fetching history for:', conversationId);
  
  const conv = conversations.get(conversationId);
  if (!conv) {
    return res.json({
      result: {
        data: {
          json: []
        }
      }
    });
  }
  
  res.json({
    result: {
      data: {
        json: conv.messages
      }
    }
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'mock-trpc-server',
    conversations: conversations.size
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mock TRPC server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /trpc/* - TRPC endpoints');
  console.log('  GET  /health - Health check');
});