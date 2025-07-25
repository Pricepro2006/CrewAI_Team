# Chat Integration Troubleshooting Guide 2025

## tRPC WebSocket Chat Integration Issues

### Common Problems

1. **WebSocket Server Not Running**: Most common cause of chat messages not being received
   - Symptoms: "ERR_CONNECTION_REFUSED" in browser console
   - Solution: Ensure WebSocket server running on separate port (3002 in our case)

2. **Client-Side WebSocket Initialization**
   - Issue: "WebSocket is not defined" during SSR
   - Solution: Initialize WebSocket client only on client side

3. **Connection Mode Issues**
   - Lazy mode auto-closes after inactivity
   - Use "immediate" mode for persistent connections
   - Implement heartbeat/ping for keep-alive

### Implementation Requirements

- applyWSSHandler to combine WebSocket with tRPC routes
- createWSClient + wsLink for client configuration
- Custom server wrapper for Next.js integration

## ChromaDB Connection Issues 2025

### Recent Issues (v3.0.9)

- Status 422: Unprocessable Entity with TypeScript SDK
- Docker integration problems
- Version compatibility issues

### Troubleshooting Steps

1. **Server Status**: Verify ChromaDB running before client connection
2. **Version**: Use latest npm package (3.0.9+)
3. **Connection Config**: Try localhost:8000, chroma, or container name
4. **Next.js Issues**: Known integration difficulties

### Installation & Setup

```bash
npm install chromadb @chroma-core/default-embed
```

```typescript
// Start server
chroma run --path ./data/chroma
# OR
docker run -p 8000:8000 chromadb/chroma

// Client
import { ChromaClient } from "chromadb";
const client = new ChromaClient();
```

## React Query + tRPC Mutations 2025

### New TanStack Integration (Feb 2025)

- Native QueryOptions/MutationOptions support
- Improved type inference
- Enhanced query key management
- Better cache control

### Common Chat App Issues

#### 1. Error Handling

- tRPC mutations don't re-throw errors like raw React Query
- Error boundaries may not catch properly
- **Solution**: Use proper error handling in mutation options

#### 2. Cache Invalidation

```typescript
const mutation = useMutation(
  trpc.messages.send.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.messages.list.queryKey(),
      });
    },
  }),
);
```

#### 3. Optimistic Updates

```typescript
const sendMessage = trpc.messages.send.useMutation({
  onMutate: async (newMessage) => {
    await queryClient.cancelQueries(["messages"]);
    const previousMessages = queryClient.getQueryData(["messages"]);
    queryClient.setQueryData(["messages"], (old) => [...old, newMessage]);
    return { previousMessages };
  },
  onError: (err, newMessage, context) => {
    queryClient.setQueryData(["messages"], context.previousMessages);
  },
  onSettled: () => {
    queryClient.invalidateQueries(["messages"]);
  },
});
```

#### 4. Date Serialization

- JSON stringify converts Date to string
- Use superjson transformer for proper Date handling

### Debugging Checklist

- ✅ WebSocket server running on correct port
- ✅ Client-side only WebSocket initialization
- ✅ Proper query key configuration
- ✅ Cache invalidation after mutations
- ✅ Error boundaries configured
- ✅ SSR settings correct for queries

## Our Specific Configuration Issues

### Current Status

- ✅ Backend server running (port 3001)
- ✅ WebSocket server running (port 3002)
- ✅ Ollama connected with granite3.3:2b
- ✅ granite3.3:2b responding to direct API calls
- ❌ ChromaDB connection error
- ❌ Chat messages not reaching LLM pipeline

### Next Steps

1. Fix ChromaDB connection
2. Debug tRPC message routing
3. Test WebSocket client connection
4. Verify React Query cache invalidation
5. Check mutation error handling
