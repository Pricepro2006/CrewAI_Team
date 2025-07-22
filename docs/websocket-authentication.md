# WebSocket Authentication Documentation

## Overview

The CrewAI Team application implements comprehensive WebSocket authentication to secure real-time communications. This ensures that only authorized users can receive sensitive updates and perform actions through WebSocket connections.

## Features

- **JWT-based Authentication**: Uses the same JWT tokens as the REST API
- **Permission-based Broadcasting**: Messages are filtered based on user permissions
- **Role-based Access Control**: Different roles have different WebSocket capabilities
- **Activity Tracking**: Monitors client connections and activity
- **Automatic Cleanup**: Expired sessions are automatically removed
- **Rate Limiting**: Prevents abuse through connection limits
- **Graceful Degradation**: Unauthenticated users get limited read-only access

## Authentication Flow

### 1. Initial Connection

When a client connects to the WebSocket server, they can authenticate in two ways:

#### Query Parameter Authentication
```javascript
const ws = new WebSocket('ws://localhost:3001/ws?token=YOUR_JWT_TOKEN');
```

#### Post-Connection Authentication
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));
});
```

### 2. Authentication Response

The server responds with an authentication result:

```json
{
  "type": "auth_response",
  "success": true,
  "userId": "user-123",
  "permissions": ["read", "write"],
  "error": null
}
```

### 3. Welcome Message

After connection, clients receive a welcome message:

```json
{
  "type": "welcome",
  "clientId": "user-123-1234567890-abc123",
  "isAuthenticated": true,
  "permissions": ["read", "write"],
  "subscriptions": ["system.health", "email.analyzed"]
}
```

## Permission Model

### Permission Levels

1. **Guest** (Unauthenticated)
   - `read`: Limited read access to public data
   - No write capabilities
   - No sensitive data access

2. **User** (Authenticated)
   - `read`: Full read access to authorized data
   - `write`: Can perform write operations
   - Receives email updates and notifications

3. **Moderator**
   - All User permissions plus:
   - `moderate`: Can moderate content
   - `broadcast`: Can send broadcast messages

4. **Admin**
   - All permissions including:
   - `admin`: Full administrative access
   - `delete`: Can delete resources
   - Can subscribe to all channels

### Permission-Based Message Filtering

Messages are filtered based on permissions:

```typescript
// Email analysis updates - requires 'read' permission
broadcastEmailAnalyzed(emailId, workflow, priority, summary, confidence, slaStatus, state)

// Batch operations - requires 'write' permission
broadcastEmailBatchStateChanged(emailIds, successCount, errorCount, changedBy)

// Delete operations - requires 'delete' permission
broadcastEmailBatchDeleted(emailIds, successCount, errorCount, softDelete)
```

## Channel Subscriptions

### Default Subscriptions

Based on permissions, users are automatically subscribed to relevant channels:

- **Authenticated Users**: `system.health`
- **Read Permission**: `email.*` updates
- **Write Permission**: `agent.*`, `task.*` updates
- **Admin Permission**: `*` (all channels)

### Manual Subscription

Clients can subscribe to specific channels:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['email.analyzed', 'email.state_changed']
}));
```

### Subscription Response

```json
{
  "type": "subscribed",
  "channels": ["email.analyzed", "email.state_changed"]
}
```

## Security Features

### 1. Token Validation
- JWT tokens are validated on connection
- Expired tokens are rejected
- Invalid signatures result in connection closure

### 2. Permission Enforcement
- Each broadcast method checks required permissions
- Unauthorized clients don't receive sensitive messages
- Permission checks are performed server-side

### 3. Activity Monitoring
- Last activity timestamp is tracked
- Inactive sessions can be terminated
- Connection health is monitored

### 4. Rate Limiting
- Connection attempts are rate-limited per IP
- Message frequency is throttled
- Prevents DoS attacks

### 5. Origin Validation
- In production, only allowed origins can connect
- CORS headers are properly configured
- Prevents unauthorized embedding

## Client Implementation

### JavaScript/TypeScript Example

```typescript
class AuthenticatedWebSocketClient {
  private ws: WebSocket;
  private token: string;
  private reconnectAttempts = 0;

  constructor(url: string, token: string) {
    this.token = token;
    this.connect(url);
  }

  private connect(url: string) {
    this.ws = new WebSocket(`${url}?token=${this.token}`);

    this.ws.on('open', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`WebSocket closed: ${code} - ${reason}`);
      if (code !== 1000) {
        this.attemptReconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'welcome':
        console.log('Authenticated:', message.isAuthenticated);
        console.log('Permissions:', message.permissions);
        break;
      
      case 'auth_error':
        console.error('Authentication failed:', message.error);
        // Handle re-authentication
        break;
      
      case 'email.analyzed':
        // Handle email analysis update
        this.onEmailAnalyzed(message);
        break;
      
      default:
        console.log('Received message:', message);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.connect(this.ws.url), delay);
    }
  }

  subscribe(channels: string[]) {
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channels
    }));
  }

  private onEmailAnalyzed(message: any) {
    // Handle email analysis update
    console.log('Email analyzed:', message.emailId);
  }
}
```

## Server Configuration

### Environment Variables

```env
# WebSocket Configuration
WS_PORT=3001
WS_PATH=/ws

# Security
ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
JWT_SECRET=your-jwt-secret

# Rate Limiting
WS_RATE_LIMIT_WINDOW=60000
WS_RATE_LIMIT_MAX=100
```

### Server Setup

```typescript
import { createAuthenticatedWebSocketServer } from './api/websocket/setup';
import { UserService } from './api/services/UserService';

const userService = new UserService();
const { wss, authManager } = createAuthenticatedWebSocketServer(
  process.env.WS_PORT || 3001,
  userService
);

// Monitor authentication stats
setInterval(() => {
  const stats = authManager.getStats();
  console.log('WebSocket Auth Stats:', stats);
}, 60000);
```

## Monitoring and Debugging

### Authentication Statistics

The system provides real-time statistics:

```typescript
const stats = authManager.getStats();
// {
//   totalAuthenticated: 45,
//   byRole: { admin: 2, user: 40, moderator: 3 },
//   byUser: { 'user-123': 2, 'user-456': 1, ... }
// }
```

### Connection Statistics

```typescript
const connectionStats = wsService.getConnectionStats();
// {
//   totalClients: 50,
//   totalConnections: 52,
//   authenticatedClients: 45,
//   subscriptionStats: { 'email.analyzed': 40, ... },
//   authStats: { byRole: {...}, byPermission: {...} }
// }
```

### Debug Logging

Enable debug logging for troubleshooting:

```env
LOG_LEVEL=debug
LOG_WS_AUTH=true
```

## Best Practices

1. **Token Refresh**: Implement token refresh before expiry
2. **Reconnection Logic**: Use exponential backoff for reconnections
3. **Message Queuing**: Queue messages during disconnections
4. **Error Handling**: Gracefully handle authentication failures
5. **Permission Caching**: Cache permissions to reduce lookups
6. **Connection Pooling**: Limit connections per user
7. **Monitoring**: Track authentication metrics and failures

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check token expiry
   - Verify JWT secret matches
   - Ensure user is active

2. **Missing Messages**
   - Verify permissions are correct
   - Check subscription status
   - Ensure authentication succeeded

3. **Connection Drops**
   - Check rate limiting
   - Verify origin is allowed
   - Monitor server resources

4. **Performance Issues**
   - Enable message throttling
   - Implement connection pooling
   - Use compression

## Migration Guide

For existing WebSocket implementations:

1. Update client to send authentication token
2. Handle auth_response messages
3. Update message handlers for permission-based filtering
4. Implement reconnection with authentication
5. Test with different permission levels

## Security Considerations

1. **Never log tokens**: Avoid logging JWT tokens
2. **Use HTTPS/WSS**: Always use secure connections in production
3. **Rotate secrets**: Regularly rotate JWT secrets
4. **Monitor failures**: Track authentication failures for security
5. **Limit permissions**: Follow principle of least privilege
6. **Audit access**: Log authentication events for compliance