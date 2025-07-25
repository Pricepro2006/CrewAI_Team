# Agent Operations API

## Overview

The Agent Operations API provides endpoints for managing AI agents, task assignment, performance monitoring, and agent collaboration. Agents are specialized AI workers that process emails and perform automated tasks.

## Endpoints

### List Agents

Retrieve all available agents with their status and capabilities.

```http
GET /api/agents
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter by status (active, idle, busy, offline) |
| type | string | - | Filter by agent type |
| capability | string | - | Filter by capability |

#### Response

```json
{
  "agents": [
    {
      "id": "agent-email-analyzer",
      "name": "Email Analysis Agent",
      "type": "analyzer",
      "status": "active",
      "capabilities": [
        "email_classification",
        "sentiment_analysis",
        "entity_extraction",
        "priority_assessment"
      ],
      "performance": {
        "tasksCompleted": 15420,
        "averageResponseTime": 235, // milliseconds
        "successRate": 0.98,
        "uptime": 0.999
      },
      "currentLoad": {
        "activeTasks": 3,
        "queuedTasks": 12,
        "capacity": 50
      },
      "configuration": {
        "model": "gpt-4",
        "temperature": 0.7,
        "maxConcurrentTasks": 10
      },
      "lastActive": "2025-01-20T12:00:00Z"
    },
    {
      "id": "agent-router",
      "name": "Workflow Router Agent",
      "type": "router",
      "status": "busy",
      "capabilities": [
        "workflow_classification",
        "agent_selection",
        "load_balancing"
      ],
      "performance": {
        "tasksCompleted": 28540,
        "averageResponseTime": 120,
        "successRate": 0.995,
        "uptime": 0.9999
      },
      "currentLoad": {
        "activeTasks": 8,
        "queuedTasks": 45,
        "capacity": 100
      }
    }
  ],
  "summary": {
    "totalAgents": 12,
    "activeAgents": 10,
    "totalCapacity": 500,
    "currentUtilization": 0.68
  }
}
```

### Get Agent Details

Retrieve detailed information about a specific agent.

```http
GET /api/agents/:id
Authorization: Bearer <token>
```

#### Response

```json
{
  "agent": {
    "id": "agent-email-analyzer",
    "name": "Email Analysis Agent",
    "description": "Specialized in analyzing email content and extracting insights",
    "type": "analyzer",
    "version": "2.1.0",
    "status": "active",
    "capabilities": {
      "email_classification": {
        "accuracy": 0.96,
        "supportedCategories": 45
      },
      "sentiment_analysis": {
        "accuracy": 0.92,
        "languages": ["en", "es", "fr"]
      },
      "entity_extraction": {
        "types": ["person", "organization", "location", "date", "money"]
      }
    },
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2000,
      "timeout": 30000,
      "retryAttempts": 3,
      "maxConcurrentTasks": 10
    },
    "resources": {
      "cpu": {
        "usage": 45.2,
        "limit": 100
      },
      "memory": {
        "usage": 2.1, // GB
        "limit": 4.0
      },
      "apiCalls": {
        "used": 145200,
        "limit": 1000000,
        "resetDate": "2025-02-01T00:00:00Z"
      }
    },
    "performance": {
      "last24Hours": {
        "tasksCompleted": 3240,
        "tasksFaild": 12,
        "averageResponseTime": 235,
        "medianResponseTime": 210,
        "p95ResponseTime": 450
      },
      "last7Days": {
        "tasksCompleted": 21450,
        "tasksFailed": 89,
        "averageResponseTime": 242,
        "uptime": 0.998
      }
    },
    "errors": {
      "recent": [
        {
          "timestamp": "2025-01-20T11:45:00Z",
          "error": "Token limit exceeded",
          "taskId": "task-789"
        }
      ],
      "byType": {
        "timeout": 5,
        "token_limit": 3,
        "api_error": 1
      }
    }
  }
}
```

### Create Agent Task

Assign a task to an agent or let the system select the best agent.

```http
POST /api/agents/tasks
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "type": "email_analysis",
  "priority": "high",
  "data": {
    "emailId": "email-123",
    "requiredCapabilities": [
      "sentiment_analysis",
      "entity_extraction"
    ],
    "options": {
      "deepAnalysis": true,
      "extractActionItems": true
    }
  },
  "agentId": "agent-email-analyzer", // Optional - auto-select if not specified
  "timeout": 60000, // milliseconds
  "callback": {
    "url": "https://your-app.com/webhook/task-complete",
    "headers": {
      "X-API-Key": "your-key"
    }
  }
}
```

#### Response

```json
{
  "task": {
    "id": "task-456",
    "type": "email_analysis",
    "status": "queued",
    "priority": "high",
    "assignedAgent": {
      "id": "agent-email-analyzer",
      "name": "Email Analysis Agent"
    },
    "createdAt": "2025-01-20T12:00:00Z",
    "estimatedCompletion": "2025-01-20T12:01:00Z",
    "queuePosition": 3
  }
}
```

### Get Task Status

Check the status of an agent task.

```http
GET /api/agents/tasks/:id
Authorization: Bearer <token>
```

#### Response

```json
{
  "task": {
    "id": "task-456",
    "type": "email_analysis",
    "status": "completed",
    "priority": "high",
    "assignedAgent": {
      "id": "agent-email-analyzer",
      "name": "Email Analysis Agent"
    },
    "progress": {
      "percentage": 100,
      "currentStep": "complete",
      "steps": [
        {
          "name": "preprocessing",
          "status": "completed",
          "duration": 45
        },
        {
          "name": "analysis",
          "status": "completed",
          "duration": 189
        },
        {
          "name": "postprocessing",
          "status": "completed",
          "duration": 23
        }
      ]
    },
    "result": {
      "sentiment": {
        "overall": "negative",
        "confidence": 0.89,
        "aspects": {
          "product": "negative",
          "service": "neutral",
          "price": "negative"
        }
      },
      "entities": [
        {
          "text": "John Smith",
          "type": "person",
          "confidence": 0.95
        },
        {
          "text": "ABC Corporation",
          "type": "organization",
          "confidence": 0.92
        }
      ],
      "classification": {
        "primary": "complaint",
        "secondary": "product_issue",
        "confidence": 0.87
      },
      "actionItems": [
        "Contact customer within 24 hours",
        "Escalate to product team",
        "Offer replacement or refund"
      ]
    },
    "performance": {
      "startTime": "2025-01-20T12:00:00Z",
      "endTime": "2025-01-20T12:00:257Z",
      "duration": 257,
      "tokensUsed": 1245,
      "cost": 0.0089
    }
  }
}
```

### Cancel Task

Cancel a queued or running task.

```http
DELETE /api/agents/tasks/:id
Authorization: Bearer <token>
```

### List Agent Tasks

Get tasks for a specific agent or all agents.

```http
GET /api/agents/tasks
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| agentId | string | - | Filter by agent |
| status | string | - | Filter by status |
| type | string | - | Filter by task type |
| priority | string | - | Filter by priority |
| limit | integer | 50 | Number of results |
| offset | integer | 0 | Pagination offset |

### Agent Performance Metrics

Get detailed performance metrics for agents.

```http
GET /api/agents/metrics
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| agentId | string | - | Specific agent or all |
| period | string | 24h | Time period (1h, 24h, 7d, 30d) |
| metrics | array | all | Specific metrics to include |

#### Response

```json
{
  "metrics": {
    "overview": {
      "totalTasks": 45678,
      "successRate": 0.976,
      "averageResponseTime": 245,
      "totalCost": 125.67
    },
    "byAgent": [
      {
        "agentId": "agent-email-analyzer",
        "name": "Email Analysis Agent",
        "tasks": {
          "completed": 15420,
          "failed": 234,
          "timeout": 12,
          "cancelled": 45
        },
        "performance": {
          "avgResponseTime": 235,
          "medianResponseTime": 210,
          "p95ResponseTime": 450,
          "p99ResponseTime": 890
        },
        "reliability": {
          "uptime": 0.998,
          "errorRate": 0.015,
          "timeoutRate": 0.008
        },
        "cost": {
          "total": 45.23,
          "perTask": 0.0029,
          "byModel": {
            "gpt-4": 42.10,
            "embeddings": 3.13
          }
        }
      }
    ],
    "timeline": [
      {
        "timestamp": "2025-01-20T00:00:00Z",
        "tasksCompleted": 1890,
        "avgResponseTime": 240,
        "errorRate": 0.012
      }
    ]
  },
  "period": "24h",
  "generatedAt": "2025-01-20T12:00:00Z"
}
```

### Agent Collaboration

Create a multi-agent workflow for complex tasks.

```http
POST /api/agents/workflows
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Complex Email Processing",
  "steps": [
    {
      "id": "step1",
      "agent": "agent-email-analyzer",
      "task": "analyze_email",
      "input": {
        "emailId": "email-123"
      }
    },
    {
      "id": "step2", 
      "agent": "agent-router",
      "task": "determine_workflow",
      "input": {
        "analysis": "{{step1.output}}"
      },
      "dependsOn": ["step1"]
    },
    {
      "id": "step3",
      "agent": "agent-responder",
      "task": "generate_response",
      "input": {
        "emailId": "email-123",
        "workflow": "{{step2.output.workflow}}",
        "sentiment": "{{step1.output.sentiment}}"
      },
      "dependsOn": ["step2"]
    }
  ],
  "timeout": 300000,
  "onError": "continue" // or "stop"
}
```

### Update Agent Configuration

Update an agent's configuration (admin only).

```http
PUT /api/agents/:id/config
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "configuration": {
    "temperature": 0.8,
    "maxConcurrentTasks": 15,
    "timeout": 45000,
    "model": "gpt-4-turbo"
  }
}
```

### Agent Health Check

Check health status of all agents.

```http
GET /api/agents/health
Authorization: Bearer <token>
```

#### Response

```json
{
  "health": {
    "status": "healthy", // healthy, degraded, unhealthy
    "agents": [
      {
        "id": "agent-email-analyzer",
        "status": "healthy",
        "lastCheck": "2025-01-20T12:00:00Z",
        "uptime": 0.999,
        "responseTime": 45 // ms
      }
    ],
    "issues": [],
    "lastFullCheck": "2025-01-20T11:59:00Z"
  }
}
```

## WebSocket Events

Subscribe to real-time agent events:

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    'agent.status_changed',
    'agent.task_completed',
    'agent.error'
  ]
}));
```

### Event Types

```json
{
  "type": "agent.task_completed",
  "data": {
    "taskId": "task-456",
    "agentId": "agent-email-analyzer",
    "duration": 257,
    "success": true
  }
}
```

## Code Examples

### JavaScript/TypeScript

```typescript
// Create and monitor a task
async function processEmailWithAgent(emailId: string) {
  // Create task
  const response = await fetch('/api/agents/tasks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'email_analysis',
      priority: 'high',
      data: {
        emailId,
        requiredCapabilities: ['sentiment_analysis'],
        options: {
          deepAnalysis: true
        }
      }
    })
  });

  const { task } = await response.json();

  // Poll for completion
  let result;
  while (!result || result.task.status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await fetch(`/api/agents/tasks/${task.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    result = await statusResponse.json();
  }

  return result.task;
}

// Monitor agent performance
async function getAgentMetrics() {
  const response = await fetch('/api/agents/metrics?period=24h', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { metrics } = await response.json();
  
  // Find poorly performing agents
  const slowAgents = metrics.byAgent.filter(
    agent => agent.performance.avgResponseTime > 500
  );
  
  return { metrics, slowAgents };
}
```

### Python

```python
import asyncio
import aiohttp

class AgentClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}
    
    async def create_workflow(self, email_id):
        """Create multi-agent workflow for email processing"""
        workflow = {
            'name': 'Email Processing Pipeline',
            'steps': [
                {
                    'id': 'analyze',
                    'agent': 'agent-email-analyzer',
                    'task': 'analyze_email',
                    'input': {'emailId': email_id}
                },
                {
                    'id': 'classify',
                    'agent': 'agent-classifier',
                    'task': 'classify_intent',
                    'input': {'analysis': '{{analyze.output}}'},
                    'dependsOn': ['analyze']
                },
                {
                    'id': 'respond',
                    'agent': 'agent-responder',
                    'task': 'generate_response',
                    'input': {
                        'emailId': email_id,
                        'intent': '{{classify.output.intent}}'
                    },
                    'dependsOn': ['classify']
                }
            ]
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{self.base_url}/api/agents/workflows',
                json=workflow,
                headers=self.headers
            ) as response:
                return await response.json()
```

## Best Practices

1. **Let system auto-select agents**: Don't specify agentId unless necessary
2. **Use appropriate priorities**: High priority affects queue position
3. **Set reasonable timeouts**: Default is usually sufficient
4. **Monitor agent health**: Check metrics regularly
5. **Handle failures gracefully**: Implement retry logic
6. **Use webhooks for long tasks**: Avoid polling when possible
7. **Batch similar tasks**: Better resource utilization

## Agent Types Reference

| Type | Purpose | Capabilities |
|------|---------|--------------|
| analyzer | Content analysis | sentiment, entities, classification |
| router | Workflow routing | load balancing, agent selection |
| responder | Response generation | templates, personalization |
| classifier | Intent classification | categorization, prioritization |
| extractor | Data extraction | structured data, key info |
| validator | Data validation | format checking, verification |
| translator | Language translation | multi-language support |