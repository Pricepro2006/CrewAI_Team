# 🔌 WebSocket Connection Error Analysis & Fix

**Date**: August 7, 2025  
**Issue**: WebSocket connection failures at `ws://localhost:3001/trpc-ws` causing infinite reconnection loops  
**Status**: ❌ CRITICAL - Root cause identified

---

## 🔍 Root Cause Analysis

### **The Problem**
The WebSocket client is trying to connect to `ws://localhost:3001/trpc-ws` but the actual WebSocket server is configured differently in the backend.

### **Configuration Mismatch Identified**

**Frontend (useGroceryWebSocket.ts:55-57):**
```typescript
const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window.location.hostname}:3001/trpc-ws`
  : `ws://localhost:3001/trpc-ws`;
```

**Backend (server.ts:338-340):**
```typescript
const wss = new WebSocketServer({
  port: PORT + 1,  // PORT is 3001, so WebSocket runs on 3002!
  path: "/trpc-ws",
```

### 🚨 **THE CRITICAL ISSUE**
- Frontend expects WebSocket on port **3001** at path `/trpc-ws`
- Backend serves WebSocket on port **3002** at path `/trpc-ws`
- **Port mismatch: 3001 vs 3002**

---

## 🔄 Why the Infinite Loop Occurs

1. **Connection Attempt**: Frontend tries `ws://localhost:3001/trpc-ws`
2. **Immediate Failure**: Port 3001 doesn't have WebSocket handler at `/trpc-ws`
3. **onClose Triggered**: Connection closes immediately (line 164 in useGroceryWebSocket.ts)
4. **Reconnection Logic**: Attempts reconnection with exponential backoff
5. **Max Attempts**: After 10 attempts, still keeps trying due to component re-renders
6. **React Error**: "Maximum update depth exceeded" from state updates during reconnection

---

## ✅ The Fix

### **Option 1: Fix Frontend URL (Recommended - Quickest)**

**File**: `/home/pricepro2006/CrewAI_Team/src/ui/hooks/useGroceryWebSocket.ts`

**Change Line 55-57 from:**
```typescript
const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window.location.hostname}:3001/trpc-ws`
  : `ws://localhost:3001/trpc-ws`;
```

**To:**
```typescript
const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window.location.hostname}:3002/trpc-ws`
  : `ws://localhost:3002/trpc-ws`;  // Changed from 3001 to 3002
```

### **Option 2: Fix Backend Port (Alternative)**

**File**: `/home/pricepro2006/CrewAI_Team/src/api/server.ts`

**Change Line 339 from:**
```typescript
port: PORT + 1,  // This makes it 3002
```

**To:**
```typescript
port: PORT,  // Keep it on same port 3001
server: server,  // Attach to existing HTTP server
```

### **Option 3: Use HTTP Server Upgrade (Best Architecture)**

Instead of separate port, use HTTP server upgrade for WebSocket on same port:

```typescript
// In server.ts
const wss = new WebSocketServer({
  noServer: true,  // Don't create separate server
  path: "/trpc-ws",
});

// Handle upgrade on existing server
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/trpc-ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});
```

---

## 🛠️ Additional Fixes for Infinite Loop Prevention

### **1. Fix Reconnection Logic**

**File**: `/home/pricepro2006/CrewAI_Team/src/ui/hooks/useGroceryWebSocket.ts`

Add these improvements:

```typescript
// Line 89 - Add mounted check ref
const isMountedRef = useRef(true);
const hasConnectedOnceRef = useRef(false);

// Line 179 - Fix reconnection condition
if (
  state.reconnectAttempts < maxReconnectAttempts && 
  isMountedRef.current &&
  !isReconnectingRef.current  // Prevent duplicate reconnections
) {
  // ...existing reconnection logic
}

// Line 311 - Fix auto-connect to prevent loops
useEffect(() => {
  if (!hasConnectedOnceRef.current) {
    hasConnectedOnceRef.current = true;
    connect();
  }
  
  return () => {
    isMountedRef.current = false;
    disconnect();
  };
}, []); // Remove dependencies to prevent re-runs
```

### **2. Add Connection State Management**

Create a connection manager to prevent multiple WebSocket instances:

```typescript
// New file: src/ui/hooks/WebSocketConnectionManager.ts
class WebSocketConnectionManager {
  private static instance: WebSocket | null = null;
  private static connecting = false;
  
  static async getConnection(url: string): Promise<WebSocket> {
    if (this.instance?.readyState === WebSocket.OPEN) {
      return this.instance;
    }
    
    if (this.connecting) {
      // Wait for ongoing connection
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.instance?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            resolve(this.instance);
          }
        }, 100);
      });
    }
    
    this.connecting = true;
    // ... create new connection
  }
}
```

---

## 📊 Testing the Fix

### **1. Quick Test Command**
```bash
# Test if WebSocket is accessible on correct port
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3002/trpc-ws
```

### **2. Verify in Browser Console**
```javascript
// Test WebSocket connection directly
const ws = new WebSocket('ws://localhost:3002/trpc-ws');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = (e) => console.log('🔌 Closed:', e.code, e.reason);
```

---

## 🎯 Implementation Steps

1. **Stop the frontend dev server**
   ```bash
   # Find and kill the Vite process
   pkill -f "vite"
   ```

2. **Apply the fix** (Option 1 - simplest)
   - Edit `/src/ui/hooks/useGroceryWebSocket.ts`
   - Change port from 3001 to 3002 on line 57

3. **Restart the frontend**
   ```bash
   npm run dev:client
   ```

4. **Test in browser**
   - Open http://localhost:5173/walmart
   - Check console - WebSocket errors should stop
   - Verify no infinite reconnection loops

---

## 🔒 Prevention Measures

### **1. Environment Variables**
Add WebSocket URL to environment config:
```env
# .env
VITE_WS_URL=ws://localhost:3002/trpc-ws
VITE_WS_URL_PROD=wss://yourdomain.com/trpc-ws
```

### **2. Centralized Configuration**
```typescript
// src/config/websocket.config.ts
export const getWebSocketUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.VITE_WS_URL_PROD || `wss://${window.location.host}/trpc-ws`;
  }
  return process.env.VITE_WS_URL || 'ws://localhost:3002/trpc-ws';
};
```

### **3. Health Check Endpoint**
Add WebSocket health check:
```typescript
// In server.ts
app.get('/api/ws/health', (req, res) => {
  res.json({
    websocket: {
      port: PORT + 1,
      path: '/trpc-ws',
      url: `ws://localhost:${PORT + 1}/trpc-ws`,
      connections: wss.clients.size,
      ready: true
    }
  });
});
```

---

## ✅ Expected Outcome After Fix

- ✅ WebSocket connects successfully on first attempt
- ✅ No more "WebSocket is closed before connection" errors
- ✅ No infinite reconnection loops
- ✅ No "Maximum update depth exceeded" React errors
- ✅ Real-time updates work for Walmart Grocery features
- ✅ Console shows: "WebSocket connected successfully"

---

## 📝 Summary

**Root Cause**: Port mismatch - Frontend expects WebSocket on port 3001, backend serves it on port 3002  
**Quick Fix**: Change frontend WebSocket URL from port 3001 to 3002  
**Long-term Fix**: Use HTTP server upgrade to serve WebSocket on same port as HTTP  
**Testing**: Verify connection with curl and browser console  

The fix is simple but critical - just a one-character change (1→2) in the port number will resolve the entire issue!