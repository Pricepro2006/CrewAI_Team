# CrewAI Team API Documentation

## Overview

The CrewAI Team API provides a comprehensive set of endpoints for managing emails, business searches, agent operations, and real-time communications. This documentation covers all available endpoints, authentication requirements, and usage examples.

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.crewai.com/api
```

## Authentication

Most API endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:

- **General API**: 60 requests per minute
- **WebSearch API**: 100 requests per 15 minutes
- **Email Operations**: 200 requests per minute

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  },
  "timestamp": "2025-01-20T12:00:00Z"
}
```

Common error codes:
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMITED`: Rate limit exceeded
- `INTERNAL_ERROR`: Server error

## API Endpoints

### [Authentication](./authentication.md)
- User registration and login
- Token management
- Password reset

### [Email Management](./emails.md)
- Email CRUD operations
- Email analysis
- Batch operations
- SLA monitoring

### [Business Search](./business-search.md)
- Local business queries
- Enhanced search with caching
- Result validation

### [Agent Operations](./agents.md)
- Agent management
- Task assignment
- Performance metrics

### [WebSocket API](./websocket.md)
- Real-time updates
- Authentication
- Channel subscriptions

### [System](./system.md)
- Health checks
- Metrics
- Configuration

## Quick Start

### 1. Obtain Authentication Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### 2. Make Authenticated Request

```bash
curl -X GET http://localhost:3000/api/emails \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 3. Connect to WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?token=eyJhbGciOiJIUzI1NiIs...');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @crewai/client
```

```typescript
import { CrewAIClient } from '@crewai/client';

const client = new CrewAIClient({
  apiUrl: 'http://localhost:3000/api',
  wsUrl: 'ws://localhost:3001/ws',
  token: 'your-jwt-token'
});

// Fetch emails
const emails = await client.emails.list({ limit: 10 });

// Subscribe to real-time updates
client.on('email.analyzed', (data) => {
  console.log('Email analyzed:', data);
});
```

### Python

```bash
pip install crewai-client
```

```python
from crewai_client import CrewAIClient

client = CrewAIClient(
    api_url='http://localhost:3000/api',
    token='your-jwt-token'
)

# Fetch emails
emails = client.emails.list(limit=10)

# Search for businesses
results = client.business_search.search(
    query='irrigation specialists',
    location='Naples, FL'
)
```

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

```http
GET /api/emails?limit=20&offset=40
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 40,
    "hasMore": true
  }
}
```

## Filtering and Sorting

Most list endpoints support filtering and sorting:

```http
GET /api/emails?status=active&priority=high&sortBy=received_at&order=DESC
```

## Webhooks

Configure webhooks to receive HTTP callbacks for events:

```http
POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["email.analyzed", "email.state_changed"],
  "secret": "your-webhook-secret"
}
```

## API Versioning

The API uses URL versioning. Current version: v1

```
http://localhost:3000/api/v1/emails
```

## Support

- GitHub Issues: https://github.com/crewai/team/issues
- Email: support@crewai.com
- Documentation: https://docs.crewai.com