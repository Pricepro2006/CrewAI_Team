const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Simple chat endpoint that works with the frontend
app.post('/trpc/chat.create', async (req, res) => {
  console.log('Received chat.create request:', JSON.stringify(req.body, null, 2));
  
  const conversationId = Date.now().toString();
  let message = '';
  
  // Handle different request formats
  if (req.body && req.body[0]) {
    if (req.body[0].json && req.body[0].json.message) {
      message = req.body[0].json.message;
    } else if (req.body[0].message) {
      message = req.body[0].message;
    }
  }
  
  console.log('Extracted message:', message);
  
  // Send immediate response with the expected structure
  const response = {
    result: {
      data: {
        json: {
          conversationId,
          response: `I'll research the latest trends in AI agent architectures for you.

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

[Research conducted using web search and analysis tools]
[Sources: Recent papers and implementations from 2024]
[Agent: ResearchAgent | Status: Complete]`,
          metadata: {
            agentType: "ResearchAgent",
            toolsUsed: ["web_search", "document_analysis"],
            status: "complete"
          }
        }
      }
    }
  };
  
  res.json(response);
  
  // Log success
  console.log('Sent response for conversation:', conversationId);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'simple-test-server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Simple test server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /trpc/chat.create - Create chat conversation');
  console.log('  GET  /health - Health check');
});