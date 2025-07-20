import express from "express";
import cors from "cors";
import { config } from "dotenv";
config();
const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
// Mock conversation storage
const conversations = new Map();
const messages = new Map();
// Mock TRPC endpoints
app.post("/trpc/chat.create", async (req, res) => {
    const conversationId = Date.now().toString();
    const { message } = req.body["0"]; // TRPC batch format
    conversations.set(conversationId, {
        id: conversationId,
        createdAt: new Date().toISOString(),
    });
    // Store user message
    const userMessageId = `${conversationId}-1`;
    messages.set(userMessageId, {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
    });
    // Simulate agent processing
    setTimeout(() => {
        const assistantMessageId = `${conversationId}-2`;
        messages.set(assistantMessageId, {
            role: "assistant",
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
[Confidence: High]`,
            timestamp: new Date().toISOString(),
        });
    }, 2000);
    // TRPC batch response format
    res.json([
        {
            result: {
                data: {
                    json: {
                        conversationId,
                        response: "I'll research the latest trends in AI agent architectures for you. Please wait while I gather information...",
                        metadata: {
                            agentType: "ResearchAgent",
                            toolsUsed: ["web_search", "document_analysis"],
                        },
                    },
                },
            },
        },
    ]);
});
app.post("/trpc/chat.message", async (req, res) => {
    console.log(`Body: ${JSON.stringify(req.body, null, 2)}`);
    const { conversationId, message } = req.body[0]?.json || req.body[0] || {};
    console.log(`Continuing conversation ${conversationId}: ${message}`);
    res.json({
        result: {
            data: {
                response: "I'm processing your request. The research agent is currently analyzing multiple sources...",
                metadata: {
                    status: "processing",
                    agent: "ResearchAgent",
                },
            },
        },
    });
});
// List conversations endpoint
app.post("/trpc/chat.list", async (_req, res) => {
    const conversationList = Array.from(conversations.values()).map((conv) => ({
        id: conv.id,
        title: "AI Agent Research",
        createdAt: conv.createdAt,
        updatedAt: conv.createdAt,
    }));
    res.json({
        result: {
            data: conversationList,
        },
    });
});
// Get conversation history
app.post("/trpc/chat.history", async (req, res) => {
    const conversationId = req.body[0]?.json?.conversationId;
    const convMessages = [];
    // Get all messages for this conversation
    messages.forEach((msg, key) => {
        if (key.startsWith(conversationId)) {
            convMessages.push(msg);
        }
    });
    res.json({
        result: {
            data: convMessages,
        },
    });
});
// Agent status endpoint
app.post("/trpc/agent.status", async (_req, res) => {
    res.json({
        result: {
            data: {
                agents: [
                    {
                        id: "research-agent",
                        name: "ResearchAgent",
                        status: "active",
                        currentTask: "Researching AI agent architectures",
                        progress: 75,
                    },
                ],
            },
        },
    });
});
app.get("/health", (_req, res) => {
    res.json({ status: "ok", mode: "mock" });
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Mock server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=mock-server.js.map