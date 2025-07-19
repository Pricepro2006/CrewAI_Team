# Email Dashboard API Documentation

## Overview

The Email Dashboard API provides programmatic access to email management functionality. Built with tRPC, it offers type-safe, efficient communication between client and server.

**Base URL**: `https://api.email-dashboard.tdsynnex.com`
**Version**: 1.0.0
**Protocol**: HTTPS with WebSocket support

## Authentication

All API requests require authentication using JWT tokens.

### Obtaining a Token

```typescript
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@tdsynnex.com",
  "password": "your-password"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh-token-here",
  "expiresIn": 3600
}
```

### Using the Token

Include the token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## tRPC Endpoints

### Email Operations

#### getEmails
Retrieve emails with filtering and pagination.

```typescript
// Input
interface GetEmailsInput {
  page?: number;
  limit?: number;
  filters?: {
    status?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    search?: string;
  };
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

// Usage
const emails = await trpc.email.getEmails.query({
  page: 1,
  limit: 50,
  filters: {
    status: ['pending', 'in-progress'],
    search: 'urgent'
  },
  sort: {
    field: 'createdAt',
    direction: 'desc'
  }
});

// Response
{
  "emails": [
    {
      "id": "123",
      "emailAlias": "support@tdsynnex.com",
      "requestedBy": "John Doe",
      "subject": "Urgent: Order Issue",
      "summary": "Customer reporting order delay",
      "status": "pending",
      "priority": "high",
      "createdAt": "2025-01-19T10:00:00Z",
      "updatedAt": "2025-01-19T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 3
}
```

#### getEmailById
Retrieve a single email by ID.

```typescript
const email = await trpc.email.getEmailById.query({ id: '123' });
```

#### updateEmailStatus
Update the status of an email.

```typescript
const result = await trpc.email.updateEmailStatus.mutate({
  id: '123',
  status: 'resolved',
  comment: 'Issue resolved with customer'
});
```

#### bulkUpdateEmails
Update multiple emails at once.

```typescript
const result = await trpc.email.bulkUpdateEmails.mutate({
  ids: ['123', '456', '789'],
  updates: {
    status: 'in-progress',
    assignedTo: 'jane.doe@tdsynnex.com'
  }
});
```

### Analytics Endpoints

#### getAnalyticsSummary
Get dashboard analytics summary.

```typescript
const analytics = await trpc.analytics.getSummary.query({
  dateRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
});

// Response
{
  "totalEmails": 1523,
  "statusDistribution": {
    "new": 234,
    "in-progress": 456,
    "pending": 321,
    "resolved": 512
  },
  "avgResponseTime": 2.5, // hours
  "slaCompliance": 98.5 // percentage
}
```

#### getResponseTimeTrends
Get response time trends over a period.

```typescript
const trends = await trpc.analytics.getResponseTimeTrends.query({
  period: 'daily', // 'daily' | 'weekly' | 'monthly'
  dateRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31')
  }
});
```

### Filter Management

#### saveFilterPreset
Save a custom filter preset.

```typescript
const preset = await trpc.filters.savePreset.mutate({
  name: 'My Urgent Emails',
  filters: {
    status: ['pending'],
    priority: ['high', 'critical'],
    assignedTo: 'me'
  }
});
```

#### getFilterPresets
Get all saved filter presets.

```typescript
const presets = await trpc.filters.getPresets.query();
```

### Export Operations

#### exportEmails
Export emails to CSV or Excel.

```typescript
const exportUrl = await trpc.export.exportEmails.mutate({
  format: 'xlsx', // 'csv' | 'xlsx'
  filters: {
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date('2025-01-31')
    }
  },
  columns: ['emailAlias', 'subject', 'status', 'createdAt']
});

// Response
{
  "downloadUrl": "https://api.email-dashboard.tdsynnex.com/downloads/export-123.xlsx",
  "expiresAt": "2025-01-19T12:00:00Z"
}
```

## WebSocket Events

Connect to WebSocket for real-time updates:

```typescript
const ws = new WebSocket('wss://api.email-dashboard.tdsynnex.com/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  switch(event.type) {
    case 'email:new':
      // New email received
      console.log('New email:', event.data);
      break;
      
    case 'email:updated':
      // Email status updated
      console.log('Email updated:', event.data);
      break;
      
    case 'stats:update':
      // Dashboard stats updated
      console.log('Stats:', event.data);
      break;
  }
});
```

### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `email:new` | New email received | Email object |
| `email:updated` | Email status/data updated | Updated email object |
| `email:deleted` | Email deleted | `{ id: string }` |
| `stats:update` | Dashboard statistics updated | Statistics object |
| `user:notification` | User-specific notification | Notification object |

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | Missing or invalid token | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Invalid input data | 400 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

## Rate Limiting

- **Default limit**: 100 requests per minute
- **Bulk operations**: 10 requests per minute
- **Export operations**: 5 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642550400
```

## Pagination

All list endpoints support pagination:

```typescript
{
  page: 1,        // Current page (1-indexed)
  limit: 50,      // Items per page (max 100)
  sort: {
    field: 'createdAt',
    direction: 'desc'
  }
}
```

Response includes:
```typescript
{
  data: [...],
  total: 500,
  page: 1,
  totalPages: 10,
  hasNext: true,
  hasPrev: false
}
```

## Webhooks

Configure webhooks to receive HTTP callbacks for events:

### Webhook Configuration

```typescript
POST /api/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["email:new", "email:updated"],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```typescript
POST https://your-server.com/webhook
X-Webhook-Signature: sha256=...

{
  "event": "email:new",
  "timestamp": "2025-01-19T10:00:00Z",
  "data": {
    "id": "123",
    "emailAlias": "support@tdsynnex.com",
    // ... email data
  }
}
```

## SDKs and Libraries

### TypeScript/JavaScript

```bash
npm install @tdsynnex/email-dashboard-sdk
```

```typescript
import { EmailDashboardClient } from '@tdsynnex/email-dashboard-sdk';

const client = new EmailDashboardClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.email-dashboard.tdsynnex.com'
});

const emails = await client.emails.list({
  filters: { status: ['pending'] }
});
```

### Python

```bash
pip install tdsynnex-email-dashboard
```

```python
from tdsynnex_email_dashboard import EmailDashboardClient

client = EmailDashboardClient(
    api_key='your-api-key',
    base_url='https://api.email-dashboard.tdsynnex.com'
)

emails = client.emails.list(filters={'status': ['pending']})
```

## Best Practices

1. **Authentication**
   - Store tokens securely
   - Implement token refresh logic
   - Use environment variables for API keys

2. **Error Handling**
   - Implement retry logic with exponential backoff
   - Handle rate limits gracefully
   - Log errors for debugging

3. **Performance**
   - Use pagination for large datasets
   - Implement caching where appropriate
   - Use WebSocket for real-time updates instead of polling

4. **Security**
   - Always use HTTPS
   - Validate webhook signatures
   - Implement request timeouts

## Changelog

### v1.0.0 (January 2025)
- Initial release
- Core email management endpoints
- WebSocket support
- Analytics and export features

---

*For additional support, contact: api-support@tdsynnex.com*