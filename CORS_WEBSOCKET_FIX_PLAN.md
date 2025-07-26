# CORS and WebSocket Fix Plan - CrewAI Team

**Date:** January 21, 2025  
**Priority:** 🔴 CRITICAL - Blocking all functionality

## Overview
This plan addresses the critical CORS and WebSocket issues preventing the CrewAI Team system from functioning. All solutions align with our established architecture patterns from ARCHITECTURE_PATTERNS_STANDARDS.md.

---

## Issue Summary
1. **CORS Configuration Mismatch** - Frontend on port 5175 not in allowed origins
2. **WebSocket Connection Failure** - Cannot establish real-time connections
3. **API Communication Blocked** - No data can be loaded or sent
4. **4-Step MO RAG System Untestable** - Chat interface non-functional

---

## Step-by-Step Resolution Plan

### Step 1: Fix CORS Configuration (Immediate)
**Time Estimate:** 5 minutes  
**Files to Modify:** 
- `/src/config/app.config.ts`

**Actions:**
1. Add port 5175 to allowed origins
2. Update CORS configuration for development environment
3. Ensure WebSocket CORS support

```typescript
// src/config/app.config.ts
cors: {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174', // Add for Vite alternate port
      'http://localhost:5175'  // Add current dev port
    ];
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}
```

### Step 2: Fix WebSocket Server Configuration
**Time Estimate:** 10 minutes  
**Files to Modify:**
- `/src/api/server.ts`
- `/src/ui/App.tsx`

**Actions:**
1. Update WebSocket server to handle CORS properly
2. Ensure WebSocket connection parameters are set correctly
3. Fix client-side WebSocket configuration

**Server-side (server.ts):**
```typescript
// Add origin validation for WebSocket
const wss = new WebSocketServer({
  port: PORT + 1,
  path: "/trpc-ws",
  // Add origin validation
  verifyClient: (info) => {
    const origin = info.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175'
    ];
    return allowedOrigins.includes(origin);
  }
});

// Apply tRPC WebSocket handler with proper context
const wsHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: ({ req, connectionParams }) => createContext({
    req: req,
    res: {
      json: () => {},
      status: () => ({ json: () => {} }),
      send: () => {},
    },
    connectionParams, // Pass connection params for auth
  }),
  // Enable keep-alive for stable connections
  keepAlive: {
    enabled: true,
    pingMs: 30000,
    pongWaitMs: 5000,
  },
});
```

**Client-side (App.tsx):**
```typescript
// Update WebSocket client configuration
const wsClient = createWSClient({
  url: `ws://localhost:${PORT + 1}/trpc-ws`,
  connectionParams: async () => {
    const token = localStorage.getItem("token");
    return token ? { token } : {};
  },
  // Add reconnection settings
  retryDelayMs: () => {
    // Exponential backoff
    return Math.min(1000 * 2 ** retryCount, 30000);
  },
  // WebSocket implementation for browser
  WebSocket: window.WebSocket,
});
```

### Step 3: Implement Proper Environment Configuration
**Time Estimate:** 5 minutes  
**Files to Create/Modify:**
- `.env.development`
- `.env.production`
- `/src/config/app.config.ts`

**Actions:**
1. Create environment-specific configuration files
2. Update app config to use environment variables
3. Ensure proper port configuration

**.env.development:**
```env
NODE_ENV=development
API_PORT=3001
WS_PORT=3002
CLIENT_PORT=5175
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175
```

**Update app.config.ts to use env vars:**
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
];
```

### Step 4: Fix tRPC Client Configuration
**Time Estimate:** 10 minutes  
**Files to Modify:**
- `/src/ui/App.tsx`
- `/src/client/lib/trpc.ts` (if exists)

**Actions:**
1. Update tRPC client to use correct endpoints
2. Implement proper error handling
3. Add retry logic for failed requests

```typescript
// Create robust tRPC client
const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    // Log errors
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
    }),
    // Split between WebSocket and HTTP
    splitLink({
      condition(op) {
        return op.type === 'subscription';
      },
      true: wsLink({
        client: wsClient,
        transformer: superjson,
      }),
      false: httpBatchLink({
        url: `http://localhost:${API_PORT}/trpc`,
        headers() {
          const token = localStorage.getItem("token");
          return token
            ? {
                authorization: `Bearer ${token}`,
              }
            : {};
        },
        // Add CORS credentials
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: 'include',
          });
        },
      }),
    }),
  ],
});
```

### Step 5: Test and Verify Fixes
**Time Estimate:** 15 minutes  
**Tools:** Playwright, Chrome DevTools

**Test Checklist:**
1. [ ] Restart all services with new configuration
2. [ ] Verify CORS headers in Chrome DevTools Network tab
3. [ ] Check WebSocket connection establishment
4. [ ] Test API calls from Email Dashboard
5. [ ] Verify chat interface message sending
6. [ ] Test 4-step MO RAG system flow

**Verification Commands:**
```bash
# Kill existing processes
kill $(lsof -ti:3001) 2>/dev/null || true
kill $(lsof -ti:3002) 2>/dev/null || true

# Start with new configuration
npm run dev

# Test health endpoint
curl -v http://localhost:3001/health

# Check CORS headers
curl -v -X OPTIONS http://localhost:3001/trpc \
  -H "Origin: http://localhost:5175" \
  -H "Access-Control-Request-Method: POST"
```

### Step 6: Update ChromaDB Configuration (Optional)
**Time Estimate:** 10 minutes  
**Files to Modify:**
- `/src/config/chroma.config.ts`
- ChromaDB client initialization

**Actions:**
1. Update to use v2 API endpoints
2. Fix deprecated API calls

```typescript
// Update ChromaDB client
const chromaClient = new ChromaClient({
  path: process.env.CHROMA_URL || "http://localhost:8000",
  // Use v2 API
  apiVersion: 'v2',
});
```

### Step 7: Document Changes and Create Tests
**Time Estimate:** 20 minutes  
**Files to Create:**
- `/src/tests/cors.test.ts`
- `/src/tests/websocket.test.ts`

**Actions:**
1. Create integration tests for CORS
2. Create WebSocket connection tests
3. Update documentation

**Example CORS test:**
```typescript
describe('CORS Configuration', () => {
  it('should allow requests from development port', async () => {
    const response = await fetch('http://localhost:3001/trpc', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5175',
        'Access-Control-Request-Method': 'POST',
      },
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin'))
      .toBe('http://localhost:5175');
  });
});
```

---

## Rollback Plan
If issues persist after implementing fixes:

1. **Temporary Workaround:** Disable CORS for development
```typescript
// TEMPORARY - Remove after fixing
cors: {
  origin: true, // Allow all origins
  credentials: true,
}
```

2. **Alternative Approach:** Use proxy configuration in Vite
```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      '/trpc': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3002',
        ws: true,
      },
    },
  },
};
```

---

## Success Criteria
- [ ] All API calls from frontend succeed without CORS errors
- [ ] WebSocket connections establish and maintain connection
- [ ] Email Dashboard loads data successfully
- [ ] Chat interface can send and receive messages
- [ ] 4-step MO RAG system processes queries correctly
- [ ] All tests pass

---

## Monitoring
After implementation, monitor for:
- CORS errors in browser console
- WebSocket disconnection events
- API response times
- Failed requests in Network tab

---

## References
- [tRPC WebSocket Documentation](https://trpc.io/docs/server/websockets)
- [Express CORS Best Practices 2025](https://singh-sandeep.medium.com/best-practices-for-using-cors-in-node-js-a-complete-guide-3fc7974b39be)
- [WebSocket Security Guide](https://infinitejs.com/posts/secure-websockets-sop-cors/)
- Architecture Standards: `/home/pricepro2006/CrewAI_Team/ARCHITECTURE_PATTERNS_STANDARDS.md`