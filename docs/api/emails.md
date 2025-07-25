# Email Management API

## Overview

The Email Management API provides comprehensive endpoints for managing emails, including CRUD operations, analysis, batch operations, and SLA monitoring. All email operations require authentication.

## Endpoints

### List Emails

Retrieve a paginated list of emails with optional filtering and sorting.

```http
GET /api/emails
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 50 | Number of emails to return (max: 100) |
| offset | integer | 0 | Number of emails to skip |
| sortBy | string | received_at | Field to sort by |
| order | string | DESC | Sort order (ASC or DESC) |
| status | string | - | Filter by status (active, archived, deleted) |
| priority | string | - | Filter by priority (high, medium, low) |
| workflow | string | - | Filter by workflow |
| customerId | string | - | Filter by customer ID |
| fromDate | string | - | Filter by received date (ISO 8601) |
| toDate | string | - | Filter by received date (ISO 8601) |
| search | string | - | Search in subject and body |

#### Response

```json
{
  "emails": [
    {
      "id": "email-123",
      "subject": "Urgent: System Alert",
      "from_address": "alerts@system.com",
      "to_address": "admin@company.com",
      "received_at": "2025-01-20T12:00:00Z",
      "status": "active",
      "priority": "high",
      "customer_id": "cust-456",
      "body_preview": "System memory usage exceeded 90%...",
      "has_attachments": true,
      "attachment_count": 2,
      "analysis": {
        "id": "analysis-789",
        "workflow": "technical_support",
        "priority": "high",
        "confidence": 0.95,
        "summary": "Memory usage alert requiring immediate attention",
        "sla_status": "at_risk",
        "analyzed_at": "2025-01-20T12:01:00Z"
      }
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Email by ID

Retrieve a single email with full details.

```http
GET /api/emails/:id
Authorization: Bearer <token>
```

#### Response

```json
{
  "email": {
    "id": "email-123",
    "subject": "Urgent: System Alert",
    "from_address": "alerts@system.com",
    "to_address": "admin@company.com",
    "cc_addresses": ["team@company.com"],
    "bcc_addresses": [],
    "received_at": "2025-01-20T12:00:00Z",
    "sent_at": "2025-01-20T11:59:30Z",
    "status": "active",
    "priority": "high",
    "customer_id": "cust-456",
    "thread_id": "thread-111",
    "message_id": "<alert-123@system.com>",
    "in_reply_to": null,
    "body_text": "System memory usage exceeded 90%...",
    "body_html": "<html><body>System memory usage...</body></html>",
    "headers": {
      "Return-Path": "<alerts@system.com>",
      "X-Priority": "1"
    },
    "attachments": [
      {
        "id": "attach-1",
        "filename": "memory-report.pdf",
        "content_type": "application/pdf",
        "size": 102400,
        "url": "/api/emails/email-123/attachments/attach-1"
      }
    ],
    "analysis": {
      "id": "analysis-789",
      "workflow": "technical_support",
      "priority": "high",
      "confidence": 0.95,
      "summary": "Memory usage alert requiring immediate attention",
      "sla_status": "at_risk",
      "sentiment": "negative",
      "entities": ["system", "memory", "alert"],
      "intents": ["report_issue", "request_help"],
      "analyzed_at": "2025-01-20T12:01:00Z"
    },
    "metadata": {
      "source": "smtp",
      "spam_score": 0.1,
      "virus_scan": "clean"
    },
    "created_at": "2025-01-20T12:00:30Z",
    "updated_at": "2025-01-20T12:01:00Z"
  }
}
```

### Create Email

Create a new email (typically used for testing or imports).

```http
POST /api/emails
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "subject": "Test Email",
  "from_address": "sender@example.com",
  "to_address": "recipient@example.com",
  "cc_addresses": ["cc@example.com"],
  "body_text": "This is a test email",
  "body_html": "<html><body>This is a test email</body></html>",
  "customer_id": "cust-456",
  "priority": "medium",
  "received_at": "2025-01-20T12:00:00Z"
}
```

### Update Email

Update email properties.

```http
PUT /api/emails/:id
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "status": "archived",
  "priority": "low",
  "customer_id": "cust-789",
  "metadata": {
    "processed": true,
    "tags": ["resolved", "automated"]
  }
}
```

### Delete Email

Soft delete an email (moves to deleted status).

```http
DELETE /api/emails/:id
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| permanent | boolean | false | Permanently delete (requires admin) |

### Get Email Analysis

Retrieve detailed analysis for an email.

```http
GET /api/emails/:id/analysis
Authorization: Bearer <token>
```

#### Response

```json
{
  "analysis": {
    "id": "analysis-789",
    "email_id": "email-123",
    "workflow": "technical_support",
    "sub_workflow": "infrastructure",
    "priority": "high",
    "confidence": 0.95,
    "summary": "Memory usage alert requiring immediate attention",
    "sla_status": "at_risk",
    "sla_deadline": "2025-01-20T14:00:00Z",
    "sentiment": {
      "overall": "negative",
      "scores": {
        "positive": 0.1,
        "negative": 0.8,
        "neutral": 0.1
      }
    },
    "entities": [
      {
        "text": "system memory",
        "type": "technical_component",
        "confidence": 0.98
      }
    ],
    "intents": [
      {
        "name": "report_issue",
        "confidence": 0.96
      },
      {
        "name": "request_help",
        "confidence": 0.89
      }
    ],
    "suggested_actions": [
      "Check system memory usage",
      "Review memory-intensive processes",
      "Consider memory upgrade"
    ],
    "analyzed_at": "2025-01-20T12:01:00Z",
    "analyzer_version": "2.1.0"
  }
}
```

### Analyze Email

Trigger analysis or re-analysis of an email.

```http
POST /api/emails/:id/analyze
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body (Optional)

```json
{
  "force": true, // Force re-analysis even if already analyzed
  "analyzer": "advanced", // Specify analyzer version
  "options": {
    "deep_learning": true,
    "extract_entities": true
  }
}
```

### Batch Operations

Perform operations on multiple emails at once.

```http
POST /api/emails/batch
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "operation": "update", // update, delete, analyze, move
  "email_ids": ["email-123", "email-124", "email-125"],
  "data": {
    "status": "archived",
    "metadata": {
      "batch_processed": true
    }
  }
}
```

#### Response

```json
{
  "results": {
    "successful": 3,
    "failed": 0,
    "errors": []
  },
  "operation": "update",
  "processed_ids": ["email-123", "email-124", "email-125"]
}
```

### Search Emails

Advanced email search with full-text and field-specific queries.

```http
POST /api/emails/search
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "query": "memory usage alert",
  "filters": {
    "workflow": ["technical_support", "infrastructure"],
    "priority": ["high", "medium"],
    "date_range": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-01-31T23:59:59Z"
    },
    "has_attachments": true
  },
  "fields": ["subject", "body_text", "analysis.summary"],
  "highlight": true,
  "limit": 20,
  "offset": 0
}
```

### Get Email Thread

Retrieve all emails in a conversation thread.

```http
GET /api/emails/:id/thread
Authorization: Bearer <token>
```

#### Response

```json
{
  "thread": {
    "id": "thread-111",
    "subject": "Re: System Alert",
    "participants": [
      "alerts@system.com",
      "admin@company.com",
      "support@company.com"
    ],
    "email_count": 5,
    "emails": [
      {
        "id": "email-120",
        "subject": "System Alert",
        "from_address": "alerts@system.com",
        "received_at": "2025-01-20T10:00:00Z",
        "position": 1
      },
      // ... more emails
    ],
    "started_at": "2025-01-20T10:00:00Z",
    "last_activity": "2025-01-20T14:30:00Z"
  }
}
```

### Email Statistics

Get aggregated statistics for emails.

```http
GET /api/emails/stats
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 7d | Time period (1d, 7d, 30d, 90d) |
| groupBy | string | day | Grouping (hour, day, week, month) |
| workflow | string | - | Filter by workflow |
| customerId | string | - | Filter by customer |

#### Response

```json
{
  "stats": {
    "total_emails": 5420,
    "new_emails": 234,
    "by_status": {
      "active": 1200,
      "archived": 4000,
      "deleted": 220
    },
    "by_priority": {
      "high": 420,
      "medium": 2800,
      "low": 2200
    },
    "by_workflow": {
      "technical_support": 1500,
      "sales": 2000,
      "general": 1920
    },
    "sla_stats": {
      "met": 4800,
      "at_risk": 400,
      "breached": 220
    },
    "response_times": {
      "average": 3600, // seconds
      "median": 2400,
      "p95": 7200
    },
    "timeline": [
      {
        "date": "2025-01-20",
        "received": 234,
        "processed": 220,
        "resolved": 200
      }
    ]
  },
  "period": "7d",
  "generated_at": "2025-01-20T15:00:00Z"
}
```

### SLA Monitoring

Get emails at risk of SLA breach.

```http
GET /api/emails/sla/at-risk
Authorization: Bearer <token>
```

#### Response

```json
{
  "emails": [
    {
      "id": "email-123",
      "subject": "Urgent: System Alert",
      "received_at": "2025-01-20T12:00:00Z",
      "sla_deadline": "2025-01-20T14:00:00Z",
      "time_remaining": 3600, // seconds
      "workflow": "technical_support",
      "priority": "high",
      "assigned_to": "agent-456"
    }
  ],
  "summary": {
    "total_at_risk": 15,
    "by_workflow": {
      "technical_support": 8,
      "sales": 7
    },
    "critical": 3 // Less than 1 hour remaining
  }
}
```

### Export Emails

Export emails in various formats.

```http
POST /api/emails/export
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "format": "csv", // csv, json, pdf
  "filters": {
    "date_range": {
      "from": "2025-01-01T00:00:00Z",
      "to": "2025-01-31T23:59:59Z"
    },
    "workflow": ["technical_support"]
  },
  "fields": ["id", "subject", "from_address", "received_at", "analysis.workflow"],
  "async": true // For large exports
}
```

#### Response

```json
{
  "export_id": "export-123",
  "status": "processing",
  "format": "csv",
  "estimated_size": 1048576,
  "download_url": "/api/exports/export-123/download"
}
```

### Email Attachments

#### List Attachments

```http
GET /api/emails/:id/attachments
Authorization: Bearer <token>
```

#### Download Attachment

```http
GET /api/emails/:emailId/attachments/:attachmentId
Authorization: Bearer <token>
```

#### Upload Attachment

```http
POST /api/emails/:id/attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

## Webhooks

Configure webhooks for email events:

```http
POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": [
    "email.received",
    "email.analyzed",
    "email.sla_breach",
    "email.status_changed"
  ]
}
```

## Code Examples

### JavaScript/TypeScript

```typescript
// List emails with filtering
const response = await fetch('http://localhost:3000/api/emails?' + 
  new URLSearchParams({
    limit: '20',
    workflow: 'technical_support',
    priority: 'high',
    sortBy: 'received_at',
    order: 'DESC'
  }), {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { emails, pagination } = await response.json();

// Batch update emails
const batchResponse = await fetch('http://localhost:3000/api/emails/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'update',
    email_ids: emails.map(e => e.id),
    data: {
      status: 'archived'
    }
  })
});
```

### Python

```python
import requests

# Search emails
response = requests.post(
    'http://localhost:3000/api/emails/search',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'query': 'urgent system alert',
        'filters': {
            'priority': ['high'],
            'date_range': {
                'from': '2025-01-01T00:00:00Z',
                'to': '2025-01-31T23:59:59Z'
            }
        }
    }
)

results = response.json()
```

## Best Practices

1. **Use pagination**: Always paginate large result sets
2. **Filter efficiently**: Use specific filters to reduce data transfer
3. **Batch operations**: Use batch endpoints for multiple updates
4. **Monitor SLAs**: Set up webhooks for SLA breach notifications
5. **Cache analysis**: Analysis results are immutable, cache them
6. **Handle attachments carefully**: Stream large attachments
7. **Use appropriate formats**: Choose export format based on use case