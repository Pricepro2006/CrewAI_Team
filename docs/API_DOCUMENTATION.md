# Email Dashboard API Documentation

## Overview

This document provides detailed API documentation for the Email Dashboard system, including all tRPC endpoints, WebSocket message types, and integration patterns.

## Authentication

All API endpoints require authentication through Microsoft Graph OAuth. Include the bearer token in the request headers:

```
Authorization: Bearer <access_token>
```

## tRPC Endpoints

### Email Analytics

#### `emails.getAnalytics`

Retrieves comprehensive email analytics and broadcasts updates via WebSocket.

**Input Schema:**
```typescript
{
  refreshKey: number // Used for cache invalidation
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: {
    totalEmails: number,
    workflowDistribution: Record<string, number>,
    slaCompliance: Record<string, number>,
    averageProcessingTime: number
  },
  error?: string
}
```

**Example Request:**
```typescript
const analytics = await trpc.emails.getAnalytics.query({ refreshKey: 1 });
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalEmails": 1250,
    "workflowDistribution": {
      "Order Management": 650,
      "Customer Support": 350,
      "Shipping/Logistics": 150,
      "General": 100
    },
    "slaCompliance": {
      "on-track": 1000,
      "at-risk": 150,
      "overdue": 100
    },
    "averageProcessingTime": 1200
  }
}
```

### Email List

#### `emails.getList`

Retrieves filtered list of emails with search and pagination support.

**Input Schema:**
```typescript
{
  workflow?: string,     // Filter by workflow category
  search?: string,       // Search in subject, body, sender
  priority?: string,     // Filter by priority level
  limit?: number,        // Pagination limit (default: 50)
  offset?: number,       // Pagination offset (default: 0)
  refreshKey?: number    // Cache invalidation key
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: Array<{
    id: string,
    subject: string,
    from: {
      emailAddress: {
        address: string,
        name: string
      }
    },
    receivedDateTime: string,
    workflow?: string,
    priority?: string,
    state?: string,
    slaStatus?: string,
    analysis?: {
      quick_priority: string,
      workflow_state: string,
      action_summary: string
    }
  }>,
  error?: string
}
```

**Example Request:**
```typescript
const emails = await trpc.emails.getList.query({
  workflow: 'Order Management',
  priority: 'High',
  search: 'urgent',
  limit: 25,
  offset: 0
});
```

### Email Details

#### `emails.getById`

Retrieves complete email details including analysis data.

**Input Schema:**
```typescript
{
  id: string // Email ID
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: {
    id: string,
    subject: string,
    body: string,
    from: {
      emailAddress: {
        address: string,
        name: string
      }
    },
    to: Array<{
      emailAddress: {
        address: string,
        name: string
      }
    }>,
    receivedDateTime: string,
    analysis: {
      quick: {
        workflow: {
          primary: string,
          secondary: string[]
        },
        priority: string,
        intent: string,
        urgency: string,
        confidence: number
      },
      deep: {
        entities: {
          poNumbers: Array<{
            value: string,
            confidence: number
          }>,
          // ... other entity types
        },
        actionItems: Array<{
          type: string,
          description: string,
          priority: string,
          slaStatus: string
        }>,
        workflowState: {
          current: string,
          suggestedNext: string
        }
      }
    }
  } | null,
  error?: string
}
```

### Workflow State Updates

#### `emails.updateWorkflowState`

Updates the workflow state of an email and broadcasts the change.

**Input Schema:**
```typescript
{
  emailId: string,
  newState: string
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  message: string,
  error?: string
}
```

**Example Request:**
```typescript
const result = await trpc.emails.updateWorkflowState.mutate({
  emailId: 'email-123',
  newState: 'Completed'
});
```

### Bulk Operations

#### `emails.bulkUpdate`

Performs bulk operations on multiple emails.

**Input Schema:**
```typescript
{
  emailIds: string[],
  action: 'archive' | 'mark-read' | 'change-state',
  value?: string // Required for 'change-state' action
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: {
    processed: number,
    successful: number,
    failed: number,
    errors: Array<{
      emailId: string,
      error: string
    }>
  },
  error?: string
}
```

**Example Request:**
```typescript
const result = await trpc.emails.bulkUpdate.mutate({
  emailIds: ['email-1', 'email-2', 'email-3'],
  action: 'change-state',
  value: 'In Progress'
});
```

### Workflow Patterns

#### `emails.getWorkflowPatterns`

Retrieves workflow patterns and success metrics.

**Input Schema:**
```typescript
{} // No input parameters
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: Array<{
    id: string,
    pattern_name: string,
    workflow_category: string,
    success_rate: number,
    average_completion_time: number
  }>,
  error?: string
}
```

### Email Statistics

#### `emails.getStats`

Retrieves comprehensive email statistics including today's metrics.

**Input Schema:**
```typescript
{} // No input parameters
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: {
    totalEmails: number,
    workflowDistribution: Record<string, number>,
    slaCompliance: Record<string, number>,
    averageProcessingTime: number,
    todayStats: {
      received: number,
      processed: number,
      overdue: number,
      critical: number
    }
  },
  error?: string
}
```

### Send Email

#### `emails.sendEmail`

Sends an email (currently simulated).

**Input Schema:**
```typescript
{
  to: string[],
  cc?: string[],
  bcc?: string[],
  subject: string,
  body: string,
  priority?: 'low' | 'normal' | 'high',
  template?: string
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: {
    messageId: string,
    sentAt: string,
    recipients: number
  },
  error?: string
}
```

### Email Search

#### `emails.search`

Performs advanced email search with filtering.

**Input Schema:**
```typescript
{
  query: string,
  filters?: {
    workflow?: string,
    priority?: string,
    dateRange?: {
      start: string,
      end: string
    }
  }
}
```

**Output Schema:**
```typescript
{
  success: boolean,
  data: {
    emails: Array<EmailObject>,
    total: number,
    query: string,
    filters: object
  },
  error?: string
}
```

### WebSocket Subscriptions

#### `emails.subscribeToEmailUpdates`

Subscribes to real-time email updates via WebSocket.

**Input Schema:**
```typescript
{
  types?: string[] // Array of event types to subscribe to
}
```

**Output Schema:**
```typescript
// Async iterator that yields:
{
  type: string,
  data: object,
  timestamp: string
}
```

**Example Usage:**
```typescript
const subscription = trpc.emails.subscribeToEmailUpdates.useSubscription({
  types: ['email.analyzed', 'email.state_changed']
}, {
  onData: (update) => {
    console.log('Received update:', update);
  },
  onError: (error) => {
    console.error('Subscription error:', error);
  }
});
```

## WebSocket Events

### Email Analyzed Event

Triggered when an email completes analysis.

**Event Type:** `email.analyzed`

**Payload:**
```typescript
{
  type: 'email.analyzed',
  data: {
    emailId: string,
    workflow: string,
    priority: 'Critical' | 'High' | 'Medium' | 'Low',
    actionSummary: string,
    confidence: number,
    slaStatus: 'on-track' | 'at-risk' | 'overdue',
    state: string
  },
  timestamp: string
}
```

### Email State Changed Event

Triggered when an email's workflow state changes.

**Event Type:** `email.state_changed`

**Payload:**
```typescript
{
  type: 'email.state_changed',
  data: {
    emailId: string,
    oldState: string,
    newState: string,
    changedBy?: string
  },
  timestamp: string
}
```

### Email Bulk Update Event

Triggered when bulk operations complete.

**Event Type:** `email.bulk_update`

**Payload:**
```typescript
{
  type: 'email.bulk_update',
  data: {
    action: string,
    emailIds: string[],
    results: {
      successful: number,
      failed: number,
      total: number
    }
  },
  timestamp: string
}
```

### Email SLA Alert Event

Triggered when emails approach or exceed SLA thresholds.

**Event Type:** `email.sla_alert`

**Payload:**
```typescript
{
  type: 'email.sla_alert',
  data: {
    emailId: string,
    workflow: string,
    priority: 'Critical' | 'High' | 'Medium' | 'Low',
    slaStatus: 'at-risk' | 'overdue',
    timeRemaining?: number, // milliseconds
    overdueDuration?: number // milliseconds
  },
  timestamp: string
}
```

### Email Analytics Updated Event

Triggered when analytics data is refreshed.

**Event Type:** `email.analytics_updated`

**Payload:**
```typescript
{
  type: 'email.analytics_updated',
  data: {
    totalEmails: number,
    workflowDistribution: Record<string, number>,
    slaCompliance: Record<string, number>,
    averageProcessingTime: number
  },
  timestamp: string
}
```

## Error Handling

### Standard Error Response

All API endpoints return errors in a consistent format:

```typescript
{
  success: false,
  error: string,
  code?: string,
  details?: object
}
```

### Common Error Codes

- `EMAIL_NOT_FOUND`: Requested email doesn't exist
- `INVALID_WORKFLOW_STATE`: Invalid state transition
- `BULK_OPERATION_FAILED`: Bulk operation encountered errors
- `WEBSOCKET_CONNECTION_FAILED`: WebSocket connection issues
- `AUTHENTICATION_REQUIRED`: Missing or invalid authentication
- `RATE_LIMIT_EXCEEDED`: Too many requests

### Error Handling Best Practices

```typescript
try {
  const result = await trpc.emails.getById.query({ id: 'email-123' });
  if (!result.success) {
    throw new Error(result.error);
  }
  // Handle successful response
} catch (error) {
  // Handle error appropriately
  console.error('API Error:', error.message);
}
```

## Rate Limiting

### Limits

- **API Endpoints**: 1000 requests per minute per user
- **WebSocket Connections**: 10 concurrent connections per user
- **Bulk Operations**: 100 items per request

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Pagination

### Standard Pagination

Most list endpoints support pagination:

```typescript
{
  limit: number,    // Max items per page (default: 50, max: 100)
  offset: number    // Starting position (default: 0)
}
```

### Cursor-based Pagination

For real-time data, use cursor-based pagination:

```typescript
{
  cursor?: string,  // Cursor from previous response
  limit: number     // Max items per page
}
```

## Caching

### Cache Headers

API responses include cache control headers:

```
Cache-Control: private, max-age=300
ETag: "abc123"
```

### Cache Invalidation

Use `refreshKey` parameter to force cache refresh:

```typescript
const freshData = await trpc.emails.getAnalytics.query({ 
  refreshKey: Date.now() 
});
```

## Integration Examples

### React Hook Integration

```typescript
function EmailDashboard() {
  const { data: emails, isLoading } = trpc.emails.getList.useQuery({
    workflow: 'Order Management',
    limit: 50
  });

  const updateStateMutation = trpc.emails.updateWorkflowState.useMutation();

  const handleStateChange = async (emailId: string, newState: string) => {
    try {
      await updateStateMutation.mutateAsync({ emailId, newState });
    } catch (error) {
      console.error('State update failed:', error);
    }
  };

  return (
    <div>
      {isLoading ? <Loading /> : <EmailList emails={emails} />}
    </div>
  );
}
```

### WebSocket Integration

```typescript
function useEmailUpdates() {
  const [updates, setUpdates] = useState([]);

  const subscription = trpc.emails.subscribeToEmailUpdates.useSubscription({
    types: ['email.analyzed', 'email.state_changed']
  }, {
    onData: (update) => {
      setUpdates(prev => [...prev, update]);
    }
  });

  return { updates, subscription };
}
```

## Testing

### API Testing

```typescript
describe('Email API', () => {
  it('should retrieve email analytics', async () => {
    const caller = emailRouter.createCaller(mockContext);
    const result = await caller.getAnalytics({ refreshKey: 1 });
    
    expect(result.success).toBe(true);
    expect(result.data.totalEmails).toBeGreaterThan(0);
  });
});
```

### WebSocket Testing

```typescript
describe('WebSocket Events', () => {
  it('should broadcast email analyzed event', async () => {
    const mockBroadcast = vi.fn();
    wsService.broadcastEmailAnalyzed = mockBroadcast;
    
    await emailStorage.storeEmail(mockEmail, mockAnalysis);
    
    expect(mockBroadcast).toHaveBeenCalledWith(
      'email-123',
      'Order Management',
      'High',
      'Action summary',
      0.85,
      'on-track',
      'In Progress'
    );
  });
});
```

## Security Considerations

### Input Validation

All inputs are validated using Zod schemas:

```typescript
const EmailIdSchema = z.object({
  id: z.string().min(1, 'Email ID is required')
});
```

### SQL Injection Prevention

All database queries use parameterized statements:

```typescript
const stmt = db.prepare('SELECT * FROM emails WHERE id = ?');
const email = stmt.get(emailId);
```

### XSS Prevention

All user inputs are sanitized before display:

```typescript
const sanitizedSubject = escapeHtml(email.subject);
```

## Performance Optimization

### Database Optimization

- Proper indexing on frequently queried columns
- Connection pooling for concurrent requests
- Query optimization for large datasets

### Caching Strategy

- API response caching with TTL
- WebSocket message deduplication
- Client-side result caching

### Resource Management

- Connection limit enforcement
- Memory usage monitoring
- Cleanup of inactive subscriptions

## Support and Contact

For API support and questions:
- Documentation: [Internal Wiki]
- Email: dev-team@tdsynnex.com
- Slack: #email-dashboard-support