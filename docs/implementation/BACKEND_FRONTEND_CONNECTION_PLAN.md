# Backend-Frontend Connection Plan

## Current Status
- ✅ Backend services implemented (MasterOrchestrator, RAG, Tools)
- ✅ tRPC routers defined
- ❌ Mock servers still being used
- ❌ Frontend making calls to mock endpoints

## Step 1: Remove Mock Servers and Connect Real Backend

### 1.1 Update Server Configuration
```typescript
// src/api/server.ts
// Remove mock server imports and use real services
```

### 1.2 Fix Health Check Endpoints
```typescript
// Implement real health checks for:
- Ollama connection status
- ChromaDB connection status
- Database connection status
```

### 1.3 Update tRPC Context
```typescript
// Ensure all services are properly initialized in context
- MasterOrchestrator with Ollama
- ConversationService with SQLite
- AgentRegistry with all agents
- RAGSystem with ChromaDB
```

## Step 2: Frontend API Integration

### 2.1 Update API Endpoints
```typescript
// Update App.tsx to use correct backend URL
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc', // Ensure this matches backend
    }),
  ],
});
```

### 2.2 Test Chat Interface
- Verify chat.create mutation works
- Test conversation history
- Ensure real LLM responses

## Step 3: WebSocket Implementation

### 3.1 Server-Side WebSocket
```typescript
// Implement WebSocket server for real-time updates
- Agent status updates
- Streaming responses
- Progress notifications
```

### 3.2 Client-Side WebSocket
```typescript
// Connect WebSocket client
- Handle connection/disconnection
- Subscribe to updates
- Display real-time feedback
```

## Testing Checklist
- [ ] Start backend server without errors
- [ ] Frontend connects to backend
- [ ] Chat interface sends queries to real orchestrator
- [ ] Responses come from Ollama models
- [ ] Agent status updates in real-time
- [ ] Error handling works properly