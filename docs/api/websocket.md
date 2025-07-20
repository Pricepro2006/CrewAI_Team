# WebSocket API

## Overview

The WebSocket API provides real-time bidirectional communication for live updates, notifications, and streaming data. It uses JWT authentication and supports channel-based subscriptions with permission-based filtering.

## Connection

### WebSocket URL

```
Development: ws://localhost:3001/ws
Production: wss://api.crewai.com/ws
```

### Authentication

Authentication can be done in two ways:

#### 1. Query Parameter (Recommended)

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?token=your-jwt-token');
```

#### 2. Post-Connection Authentication

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
});
```

## Message Format

All messages use JSON format with a `type` field to identify the message type.

### Client to Server Messages

```json
{
  "type": "message_type",
  "data": {
    // Message-specific data
  }
}
```

### Server to Client Messages

```json
{
  "type": "message_type",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    // Message-specific data
  }
}
```

## Connection Lifecycle

### 1. Welcome Message

Upon connection, you'll receive a welcome message:

```json
{
  "type": "welcome",
  "clientId": "user-123-1737385200000-abc123",
  "isAuthenticated": true,
  "permissions": ["read", "write"],
  "subscriptions": ["system.health", "email.analyzed"]
}
```

### 2. Authentication Response

If authenticating post-connection:

```json
{
  "type": "auth_response",
  "success": true,
  "userId": "user-123",
  "userRole": "user",
  "permissions": ["read", "write"],
  "error": null
}
```

### 3. Heartbeat (Ping/Pong)

Keep connection alive with periodic pings:

```javascript
// Client sends
{ "type": "ping" }

// Server responds
{ "type": "pong" }
```

## Channel Subscriptions

### Available Channels

Channels are permission-based. Here are the available channels by permission level:

#### Read Permission
- `system.health` - System health updates
- `system.announcements` - System-wide announcements
- `email.analyzed` - Email analysis completed
- `email.state_changed` - Email state changes
- `email.sla_violated` - SLA violations

#### Write Permission
- All read channels plus:
- `email.created` - New emails created
- `email.updated` - Email updates
- `task.assigned` - Task assignments
- `task.completed` - Task completions
- `agent.status` - Agent status changes

#### Admin Permission
- All channels plus:
- `system.logs` - System log events
- `system.metrics` - Real-time metrics
- `audit.events` - Audit trail events
- `*.admin` - Admin-only events

### Subscribe to Channels

```json
{
  "type": "subscribe",
  "channels": ["email.analyzed", "email.state_changed"]
}
```

Response:

```json
{
  "type": "subscribed",
  "channels": ["email.analyzed", "email.state_changed"]
}
```

### Unsubscribe from Channels

```json
{
  "type": "unsubscribe", 
  "channels": ["email.state_changed"]
}
```

Response:

```json
{
  "type": "unsubscribed",
  "channels": ["email.state_changed"]
}
```

## Event Messages

### Email Events

#### Email Analyzed

```json
{
  "type": "email.analyzed",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "emailId": "email-123",
    "workflow": "technical_support",
    "priority": "high",
    "summary": "Server outage reported by customer",
    "confidence": 0.95,
    "slaStatus": "on_track",
    "state": "analyzed"
  }
}
```

#### Email State Changed

```json
{
  "type": "email.state_changed",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "emailId": "email-123",
    "previousState": "pending",
    "newState": "in_progress",
    "changedBy": "agent-456"
  }
}
```

#### Email SLA Violated

```json
{
  "type": "email.sla_violated",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "emailId": "email-123",
    "workflow": "technical_support",
    "priority": "high",
    "violationType": "response_time",
    "deadline": "2025-01-20T14:00:00Z",
    "breachedAt": "2025-01-20T14:15:00Z"
  }
}
```

### Batch Email Events

#### Batch State Changed

```json
{
  "type": "email.batch_state_changed",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "emailIds": ["email-123", "email-124", "email-125"],
    "state": "archived",
    "successCount": 3,
    "errorCount": 0,
    "changedBy": "user-456"
  }
}
```

#### Batch Deleted

```json
{
  "type": "email.batch_deleted",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "emailIds": ["email-123", "email-124"],
    "successCount": 2,
    "errorCount": 0,
    "softDelete": true
  }
}
```

### Task Events

#### Task Assigned

```json
{
  "type": "task.assigned",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "taskId": "task-789",
    "emailId": "email-123",
    "assignedTo": "agent-email-analyzer",
    "priority": "high",
    "estimatedCompletion": "2025-01-20T12:05:00Z"
  }
}
```

#### Task Completed

```json
{
  "type": "task.completed",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "taskId": "task-789",
    "emailId": "email-123",
    "completedBy": "agent-email-analyzer",
    "duration": 4500,
    "success": true,
    "result": {
      "workflow": "technical_support",
      "priority": "high"
    }
  }
}
```

### Agent Events

#### Agent Status Changed

```json
{
  "type": "agent.status",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "agentId": "agent-email-analyzer",
    "previousStatus": "idle",
    "newStatus": "busy",
    "currentLoad": 8,
    "maxCapacity": 10
  }
}
```

### System Events

#### System Health

```json
{
  "type": "system.health",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "status": "healthy",
    "services": {
      "api": "healthy",
      "database": "healthy",
      "redis": "healthy",
      "agents": "degraded"
    },
    "metrics": {
      "cpu": 45.2,
      "memory": 62.1,
      "activeConnections": 234
    }
  }
}
```

#### System Announcement

```json
{
  "type": "system.announcement",
  "timestamp": "2025-01-20T12:00:00Z",
  "data": {
    "id": "announce-123",
    "title": "Scheduled Maintenance",
    "message": "System will be under maintenance from 2:00 AM to 3:00 AM EST",
    "severity": "warning",
    "expiresAt": "2025-01-21T08:00:00Z"
  }
}
```

## Error Handling

### Error Message Format

```json
{
  "type": "error",
  "error": {
    "code": "INVALID_CHANNEL",
    "message": "You don't have permission to subscribe to channel: system.logs",
    "details": {
      "channel": "system.logs",
      "requiredPermission": "admin"
    }
  }
}
```

### Common Error Codes

- `AUTH_REQUIRED` - Authentication required
- `AUTH_FAILED` - Authentication failed
- `INVALID_TOKEN` - Invalid or expired token
- `PERMISSION_DENIED` - Insufficient permissions
- `INVALID_CHANNEL` - Channel doesn't exist or no permission
- `INVALID_MESSAGE` - Malformed message
- `RATE_LIMITED` - Too many messages

## Client Implementation

### JavaScript/TypeScript Example

```typescript
class CrewAIWebSocket {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval?: NodeJS.Timer;
  private eventHandlers: Map<string, Set<Function>> = new Map();

  constructor(private url: string, private token: string) {
    this.connect();
  }

  private connect(): void {
    const wsUrl = new URL(this.url);
    wsUrl.searchParams.set('token', this.token);
    
    this.ws = new WebSocket(wsUrl.toString());
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected');
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code}`);
      this.stopHeartbeat();
      this.emit('disconnected', event);
      
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  private handleMessage(message: any): void {
    // Emit to specific event handlers
    this.emit(message.type, message.data || message);
    
    // Handle system messages
    switch (message.type) {
      case 'welcome':
        console.log('Authenticated:', message.isAuthenticated);
        console.log('Permissions:', message.permissions);
        break;
        
      case 'ping':
        this.send({ type: 'pong' });
        break;
        
      case 'error':
        console.error('Server error:', message.error);
        break;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  public send(message: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public subscribe(channels: string[]): void {
    this.send({
      type: 'subscribe',
      channels
    });
  }

  public unsubscribe(channels: string[]): void {
    this.send({
      type: 'unsubscribe',
      channels
    });
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  public off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data?: any): void {
    this.eventHandlers.get(event)?.forEach(handler => handler(data));
  }

  public close(): void {
    this.stopHeartbeat();
    this.ws.close(1000, 'Client closing connection');
  }
}

// Usage
const ws = new CrewAIWebSocket('ws://localhost:3001/ws', 'your-jwt-token');

ws.on('connected', () => {
  // Subscribe to channels
  ws.subscribe(['email.analyzed', 'task.completed']);
});

ws.on('email.analyzed', (data) => {
  console.log('Email analyzed:', data);
  updateUI(data);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### React Hook Example

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

export function useCrewAIWebSocket(token: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<CrewAIWebSocket | null>(null);

  useEffect(() => {
    ws.current = new CrewAIWebSocket('ws://localhost:3001/ws', token);
    
    ws.current.on('connected', () => setIsConnected(true));
    ws.current.on('disconnected', () => setIsConnected(false));
    
    // Set up default message handler
    ws.current.on('email.analyzed', setLastMessage);
    ws.current.on('task.completed', setLastMessage);
    
    return () => {
      ws.current?.close();
    };
  }, [token]);

  const subscribe = useCallback((channels: string[]) => {
    ws.current?.subscribe(channels);
  }, []);

  const unsubscribe = useCallback((channels: string[]) => {
    ws.current?.unsubscribe(channels);
  }, []);

  const on = useCallback((event: string, handler: Function) => {
    ws.current?.on(event, handler);
  }, []);

  return {
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    on
  };
}

// Usage in component
function EmailDashboard() {
  const { isConnected, subscribe, on } = useCrewAIWebSocket(authToken);
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    if (isConnected) {
      subscribe(['email.analyzed', 'email.state_changed']);
      
      on('email.analyzed', (data) => {
        // Update email in list
        setEmails(prev => 
          prev.map(email => 
            email.id === data.emailId 
              ? { ...email, analysis: data }
              : email
          )
        );
      });
    }
  }, [isConnected]);

  return (
    <div>
      <ConnectionStatus connected={isConnected} />
      <EmailList emails={emails} />
    </div>
  );
}
```

### Python Example

```python
import asyncio
import json
import websockets
from typing import Dict, List, Callable

class CrewAIWebSocket:
    def __init__(self, url: str, token: str):
        self.url = f"{url}?token={token}"
        self.handlers: Dict[str, List[Callable]] = {}
        self.running = False
        
    async def connect(self):
        self.running = True
        async with websockets.connect(self.url) as websocket:
            self.websocket = websocket
            
            # Start heartbeat
            asyncio.create_task(self._heartbeat())
            
            # Listen for messages
            async for message in websocket:
                data = json.loads(message)
                await self._handle_message(data)
                
    async def _handle_message(self, message: dict):
        msg_type = message.get('type')
        
        # Call registered handlers
        if msg_type in self.handlers:
            for handler in self.handlers[msg_type]:
                await handler(message.get('data', message))
                
        # Handle system messages
        if msg_type == 'ping':
            await self.send({'type': 'pong'})
        elif msg_type == 'welcome':
            print(f"Connected: {message}")
            
    async def _heartbeat(self):
        while self.running:
            await asyncio.sleep(30)
            await self.send({'type': 'ping'})
            
    async def send(self, message: dict):
        await self.websocket.send(json.dumps(message))
        
    async def subscribe(self, channels: List[str]):
        await self.send({
            'type': 'subscribe',
            'channels': channels
        })
        
    def on(self, event: str, handler: Callable):
        if event not in self.handlers:
            self.handlers[event] = []
        self.handlers[event].append(handler)
        
    async def close(self):
        self.running = False
        await self.websocket.close()

# Usage
async def main():
    ws = CrewAIWebSocket('ws://localhost:3001/ws', 'your-token')
    
    async def on_email_analyzed(data):
        print(f"Email analyzed: {data}")
        
    ws.on('email.analyzed', on_email_analyzed)
    
    await ws.connect()

asyncio.run(main())
```

## Best Practices

1. **Implement reconnection logic**: Network issues are common
2. **Handle authentication failures**: Refresh tokens when needed
3. **Use heartbeat**: Detect stale connections early
4. **Buffer messages during reconnection**: Don't lose data
5. **Implement backpressure**: Don't overwhelm the server
6. **Log important events**: Aid in debugging
7. **Clean up on unmount**: Prevent memory leaks in SPAs
8. **Use compression**: For high-volume data streams

## Rate Limiting

WebSocket connections are rate-limited:

- **Connection attempts**: 10 per minute per IP
- **Messages sent**: 100 per minute per connection
- **Subscriptions**: 50 channels per connection

## Security Considerations

1. **Always use WSS in production**: Encrypted connections only
2. **Validate tokens server-side**: Don't trust client claims
3. **Implement origin checking**: Prevent CSRF attacks
4. **Monitor for abuse**: Log suspicious patterns
5. **Rotate tokens regularly**: Limit exposure window
6. **Sanitize user input**: Even in WebSocket messages

## Troubleshooting

### Connection Issues

1. **Check token validity**: Expired tokens cause immediate disconnection
2. **Verify WebSocket URL**: Ensure correct protocol (ws/wss)
3. **Check firewall/proxy**: Some networks block WebSocket
4. **Monitor browser console**: Look for CORS or security errors

### Message Issues

1. **Verify permissions**: Check channel subscription permissions
2. **Check message format**: Must be valid JSON
3. **Monitor rate limits**: Too many messages cause throttling
4. **Validate event names**: Typos in event names are common

### Debug Mode

Enable debug logging:

```javascript
ws.on('*', (event, data) => {
  console.log(`[WS Debug] ${event}:`, data);
});
```