# WebSocket Memory Leak Fixes

## Overview

This document describes the comprehensive fixes implemented to prevent memory leaks in the WebSocket service (ERR-003).

## Issues Identified

### 1. Event Listeners Not Being Removed

- WebSocket event listeners were added but not properly cleaned up on disconnect
- Multiple listeners could accumulate over time with reconnections

### 2. Unbounded Data Structure Growth

- No limits on the number of clients
- No limits on subscriptions per client
- Message queues could grow indefinitely
- Maps storing client data had no size constraints

### 3. Timers and Intervals Not Cleared

- Health check intervals continued running after client disconnect
- Throttle timers not cleaned up
- Performance monitoring intervals not stopped on shutdown

### 4. Circular References

- WebSocket objects stored in multiple maps creating circular references
- Authentication data not cleaned up when clients disconnected

### 5. No Proper Shutdown Process

- Service lacked a comprehensive shutdown method
- Resources not properly released on server termination

## Fixes Implemented

### 1. Connection Lifecycle Management

#### Added Connection Limits

```typescript
private readonly MAX_CLIENTS = 10000; // Prevent unbounded growth
private readonly MAX_SUBSCRIPTIONS_PER_CLIENT = 100; // Limit subscriptions
```

#### Proper Client Registration

- Check client limit before accepting new connections
- Store cleanup handlers for proper removal later
- Use `once()` instead of `on()` for one-time events

#### Enhanced Cleanup on Disconnect

```typescript
unregisterClient(clientId: string, ws: AuthenticatedWebSocket): void {
  // Complete cleanup to prevent memory leaks
  this.cleanupClient(clientId);

  // Remove all event listeners to prevent memory leaks
  ws.removeAllListeners();

  // Remove cleanup handler reference
  this.clientCleanupHandlers.delete(clientId);
}
```

### 2. Memory Cleanup Routines

#### Periodic Memory Cleanup

- Runs every 30 seconds
- Trims message queues to maximum size
- Removes disconnected clients
- Cleans up orphaned data structures
- Monitors memory usage and logs warnings

#### Orphaned Data Cleanup

```typescript
private cleanupOrphanedData(): void {
  // Clean up authenticated clients that don't have active connections
  const clientIds = new Set(this.clients.keys());

  // Remove orphaned entries from all maps
  this.authenticatedClients.forEach((_, clientId) => {
    if (!clientIds.has(clientId)) {
      this.authenticatedClients.delete(clientId);
    }
  });
  // ... similar cleanup for other maps
}
```

### 3. Comprehensive Shutdown Process

#### Graceful Shutdown Method

```typescript
shutdown(): void {
  // Stop all intervals
  if (this.healthInterval) clearInterval(this.healthInterval);
  if (this.memoryCleanupInterval) clearInterval(this.memoryCleanupInterval);
  if (this.performanceMonitorInterval) clearInterval(this.performanceMonitorInterval);

  // Clear all timers
  this.throttleTimers.forEach(timer => clearTimeout(timer));
  this.connectionHealthChecks.forEach(timer => clearTimeout(timer));

  // Close all active connections
  this.clients.forEach((sockets) => {
    sockets.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.close(1001, "Server shutting down");
      }
    });
  });

  // Clear all data structures
  this.clients.clear();
  this.subscriptions.clear();
  // ... clear all other maps

  // Remove all event listeners
  this.removeAllListeners();
}
```

#### Process Exit Handlers

```typescript
process.once("SIGINT", () => wsService.shutdown());
process.once("SIGTERM", () => wsService.shutdown());
```

### 4. Client-Side Memory Leak Prevention

#### Enhanced useWebSocket Hook

- Added mount state tracking to prevent operations after unmount
- Proper cleanup of reconnection timers
- Prevention of multiple simultaneous connections
- Cleanup of all subscriptions on unmount

#### Subscription Management

```typescript
// Clean up previous subscription
if (unsubscribeRef.current) {
  unsubscribeRef.current.unsubscribe?.();
  unsubscribeRef.current = null;
}

// Clean up on unmount
useEffect(() => {
  return () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current.unsubscribe?.();
      unsubscribeRef.current = null;
    }
  };
}, []);
```

### 5. Monitoring and Diagnostics

#### WebSocket Monitoring Endpoints

- `/api/websocket/stats` - Connection statistics
- `/api/websocket/clients` - Detailed client information (admin only)
- `/api/websocket/health` - Service health check
- `/api/websocket/broadcast` - Send broadcast messages (admin only)
- `/api/websocket/client/:clientId` - Force disconnect client (admin only)

#### Performance Metrics

```typescript
private performanceMetrics = {
  messagesSent: 0,
  messagesDropped: 0,
  averageResponseTime: 0,
  connectionErrors: 0,
  lastCleanup: Date.now(),
};
```

## Testing

### Memory Leak Tests

- Connection cleanup verification
- Client limit enforcement
- Subscription limit enforcement
- Event listener cleanup
- Timer cleanup
- Orphaned data cleanup
- Shutdown process verification

### Integration Test

- Memory usage over time with connection churn
- Verify stable memory usage with continuous connect/disconnect cycles

## Best Practices Going Forward

1. **Always use `once()` for one-time event handlers**
2. **Clear all timers and intervals on cleanup**
3. **Remove event listeners when no longer needed**
4. **Implement size limits for data structures**
5. **Use weak references where appropriate**
6. **Monitor memory usage in production**
7. **Implement proper shutdown handlers**
8. **Test for memory leaks with connection churn**

## Monitoring in Production

1. Monitor `/api/websocket/health` endpoint
2. Set up alerts for:
   - High connection count (>1000)
   - High error rate (>10 errors)
   - Memory usage above 90%
3. Regular review of connection statistics
4. Periodic forced garbage collection during low traffic

## Results

The implemented fixes ensure:

- ✅ No memory growth with connection churn
- ✅ Proper cleanup of all resources
- ✅ Graceful handling of errors
- ✅ Monitoring capabilities for production
- ✅ Protection against unbounded growth
- ✅ Clean shutdown process
