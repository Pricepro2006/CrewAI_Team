# Email Dashboard Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the Email Dashboard system into your applications, including setup, configuration, and usage examples.

## Prerequisites

### System Requirements
- Node.js 18+ 
- npm 9+ or yarn 1.22+
- SQLite 3.x
- TypeScript 5.x

### Dependencies
```json
{
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "@trpc/client": "^10.45.0",
    "@trpc/react-query": "^10.45.0",
    "better-sqlite3": "^9.2.2",
    "ws": "^8.16.0",
    "zod": "^3.22.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/CrewAI_Team.git
cd CrewAI_Team

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### 2. Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
DATABASE_PATH=./data/app.db

# Microsoft Graph API
GRAPH_CLIENT_ID=your-graph-client-id
GRAPH_CLIENT_SECRET=your-graph-client-secret
GRAPH_TENANT_ID=your-tenant-id

# WebSocket
WEBSOCKET_PORT=3001
WEBSOCKET_ORIGIN=http://localhost:3000

# Email Analysis
OLLAMA_BASE_URL=http://localhost:11434
STAGE1_MODEL=qwen3:0.6b
STAGE2_MODEL=granite3.3:2b

# Webhook Security
WEBHOOK_CLIENT_STATE=your-secret-client-state

# Logging
LOG_LEVEL=info
```

### 3. Database Setup

```bash
# Initialize database
npm run db:init

# Run migrations (if any)
npm run db:migrate
```

### 4. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Integration Patterns

### 1. tRPC Client Setup

#### Basic Client Configuration

```typescript
import { createTRPCReact } from '@trpc/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './path/to/router';

// React client
export const trpc = createTRPCReact<AppRouter>();

// Vanilla client
export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers() {
        return {
          authorization: `Bearer ${getAuthToken()}`,
        };
      },
    }),
  ],
});
```

#### Provider Setup

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './trpc';

const queryClient = new QueryClient();

function App() {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <YourApp />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### 2. Email Dashboard Component Integration

#### Basic Dashboard Integration

```typescript
import { EmailDashboard } from './components/Email/EmailDashboard';

function MyApp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header>
        <h1>Email Management System</h1>
      </header>
      <main>
        <EmailDashboard />
      </main>
    </div>
  );
}
```

#### Custom Dashboard Configuration

```typescript
import { EmailDashboard } from './components/Email/EmailDashboard';

function CustomEmailDashboard() {
  const customConfig = {
    defaultWorkflow: 'Order Management',
    pageSize: 25,
    enableBulkOperations: true,
    showAnalytics: true,
    refreshInterval: 30000, // 30 seconds
  };

  return (
    <EmailDashboard 
      config={customConfig}
      onEmailSelected={(email) => {
        console.log('Email selected:', email.id);
      }}
      onStateChanged={(emailId, newState) => {
        console.log('State changed:', emailId, newState);
      }}
    />
  );
}
```

### 3. WebSocket Integration

#### React Hook for WebSocket Updates

```typescript
import { useEffect, useState } from 'react';
import { trpc } from '../trpc';

interface EmailUpdate {
  type: string;
  data: any;
  timestamp: string;
}

export function useEmailUpdates(eventTypes: string[] = []) {
  const [updates, setUpdates] = useState<EmailUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const subscription = trpc.emails.subscribeToEmailUpdates.useSubscription({
    types: eventTypes.length > 0 ? eventTypes : undefined
  }, {
    onData: (update) => {
      setUpdates(prev => [...prev.slice(-99), update]); // Keep last 100 updates
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    },
    onStarted: () => {
      setIsConnected(true);
    },
    onStopped: () => {
      setIsConnected(false);
    }
  });

  return { updates, isConnected, subscription };
}
```

#### Usage in Components

```typescript
function EmailNotifications() {
  const { updates, isConnected } = useEmailUpdates([
    'email.analyzed',
    'email.sla_alert'
  ]);

  return (
    <div className="notifications">
      <div className="status">
        Status: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      
      {updates.map((update, index) => (
        <div key={index} className="notification">
          <span className="type">{update.type}</span>
          <span className="time">{new Date(update.timestamp).toLocaleTimeString()}</span>
          <pre>{JSON.stringify(update.data, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
```

### 4. Custom Email Analysis Integration

#### Creating Custom Analysis Pipeline

```typescript
import { EmailAnalysisAgent } from './agents/EmailAnalysisAgent';
import { EmailStorageService } from './services/EmailStorageService';

class CustomEmailProcessor {
  private analysisAgent: EmailAnalysisAgent;
  private storageService: EmailStorageService;

  constructor() {
    this.analysisAgent = new EmailAnalysisAgent();
    this.storageService = new EmailStorageService();
  }

  async processEmail(email: EmailData) {
    try {
      // Custom pre-processing
      const preprocessedEmail = await this.preprocessEmail(email);
      
      // Analysis
      const analysis = await this.analysisAgent.analyzeEmail(preprocessedEmail);
      
      // Custom post-processing
      const enhancedAnalysis = await this.enhanceAnalysis(analysis);
      
      // Storage
      await this.storageService.storeEmail(email, enhancedAnalysis);
      
      return enhancedAnalysis;
    } catch (error) {
      console.error('Email processing failed:', error);
      throw error;
    }
  }

  private async preprocessEmail(email: EmailData) {
    // Add custom preprocessing logic
    return {
      ...email,
      customField: 'processed'
    };
  }

  private async enhanceAnalysis(analysis: any) {
    // Add custom analysis enhancements
    return {
      ...analysis,
      customInsights: {
        // Your custom insights
      }
    };
  }
}
```

### 5. Custom Workflow States

#### Defining Custom Workflow States

```typescript
// config/workflow-states.ts
export const CustomWorkflowStates = {
  'Order Management': {
    states: ['New', 'Processing', 'Shipped', 'Delivered', 'Completed'],
    transitions: {
      'New': ['Processing'],
      'Processing': ['Shipped'],
      'Shipped': ['Delivered'],
      'Delivered': ['Completed']
    }
  },
  'Customer Support': {
    states: ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed'],
    transitions: {
      'Open': ['In Progress'],
      'In Progress': ['Waiting', 'Resolved'],
      'Waiting': ['In Progress'],
      'Resolved': ['Closed']
    }
  }
};
```

#### Workflow State Validation

```typescript
export function validateStateTransition(
  workflow: string,
  currentState: string,
  newState: string
): boolean {
  const workflowConfig = CustomWorkflowStates[workflow];
  if (!workflowConfig) return false;

  const allowedTransitions = workflowConfig.transitions[currentState];
  return allowedTransitions?.includes(newState) ?? false;
}
```

## Microsoft Graph Integration

### 1. Setting up Microsoft Graph Webhook

#### Register Application

1. Go to Azure Portal > App Registrations
2. Create new application registration
3. Configure API permissions:
   - Mail.ReadWrite
   - Mail.ReadWrite.Shared
   - User.Read

#### Webhook Configuration

```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@azure/msal-node';

class GraphWebhookManager {
  private graphClient: Client;

  constructor(authProvider: AuthenticationProvider) {
    this.graphClient = Client.initWithMiddleware({ authProvider });
  }

  async createSubscription(userEmail: string) {
    const subscription = {
      changeType: 'created,updated',
      notificationUrl: 'https://your-domain.com/api/webhooks/graph',
      resource: `/users/${userEmail}/mailFolders/inbox/messages`,
      expirationDateTime: new Date(Date.now() + 4200000).toISOString(), // 70 minutes
      clientState: process.env.WEBHOOK_CLIENT_STATE
    };

    return await this.graphClient.api('/subscriptions').post(subscription);
  }

  async renewSubscription(subscriptionId: string) {
    const update = {
      expirationDateTime: new Date(Date.now() + 4200000).toISOString()
    };

    return await this.graphClient
      .api(`/subscriptions/${subscriptionId}`)
      .patch(update);
  }
}
```

### 2. Email Retrieval

```typescript
async function retrieveEmail(userId: string, messageId: string) {
  const graphClient = getGraphClient();
  
  const message = await graphClient
    .api(`/users/${userId}/messages/${messageId}`)
    .select('id,subject,body,from,to,receivedDateTime,isRead,hasAttachments')
    .get();

  return {
    id: message.id,
    subject: message.subject,
    body: message.body.content,
    from: message.from,
    to: message.to,
    receivedDateTime: message.receivedDateTime,
    isRead: message.isRead,
    hasAttachments: message.hasAttachments
  };
}
```

## Database Integration

### 1. Custom Database Schema Extensions

#### Adding Custom Tables

```sql
-- Custom user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, preference_key)
);

-- Custom email tags table
CREATE TABLE IF NOT EXISTS email_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    tag_color TEXT DEFAULT '#blue',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    UNIQUE(email_id, tag_name)
);
```

#### Database Migration Script

```typescript
import { Database } from 'better-sqlite3';

export class DatabaseMigrator {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async runMigrations() {
    const migrations = [
      this.migration001_addUserPreferences,
      this.migration002_addEmailTags,
      // Add more migrations as needed
    ];

    for (const migration of migrations) {
      await migration.call(this);
    }
  }

  private migration001_addUserPreferences() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        preference_key TEXT NOT NULL,
        preference_value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, preference_key)
      );
    `);
  }

  private migration002_addEmailTags() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        tag_color TEXT DEFAULT '#blue',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
        UNIQUE(email_id, tag_name)
      );
    `);
  }
}
```

### 2. Custom Storage Service Extensions

```typescript
import { EmailStorageService } from './EmailStorageService';

export class ExtendedEmailStorageService extends EmailStorageService {
  async addEmailTag(emailId: string, tagName: string, tagColor: string = '#blue') {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO email_tags (email_id, tag_name, tag_color)
      VALUES (?, ?, ?)
    `);
    
    return stmt.run(emailId, tagName, tagColor);
  }

  async getEmailTags(emailId: string) {
    const stmt = this.db.prepare(`
      SELECT tag_name, tag_color
      FROM email_tags
      WHERE email_id = ?
    `);
    
    return stmt.all(emailId);
  }

  async getUserPreference(userId: string, key: string) {
    const stmt = this.db.prepare(`
      SELECT preference_value
      FROM user_preferences
      WHERE user_id = ? AND preference_key = ?
    `);
    
    const result = stmt.get(userId, key);
    return result?.preference_value;
  }

  async setUserPreference(userId: string, key: string, value: string) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (user_id, preference_key, preference_value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    return stmt.run(userId, key, value);
  }
}
```

## Custom UI Components

### 1. Email List Component

```typescript
import React from 'react';
import { trpc } from '../trpc';

interface EmailListProps {
  workflow?: string;
  onEmailSelected?: (email: any) => void;
  className?: string;
}

export function EmailList({ workflow, onEmailSelected, className }: EmailListProps) {
  const { data: emails, isLoading, error } = trpc.emails.getList.useQuery({
    workflow,
    limit: 50
  });

  if (isLoading) return <div>Loading emails...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className={`email-list ${className}`}>
      {emails?.data.map((email) => (
        <div
          key={email.id}
          className="email-item"
          onClick={() => onEmailSelected?.(email)}
        >
          <div className="email-header">
            <span className="subject">{email.subject}</span>
            <span className="timestamp">
              {new Date(email.receivedDateTime).toLocaleString()}
            </span>
          </div>
          <div className="email-meta">
            <span className="sender">From: {email.from.emailAddress.name}</span>
            {email.analysis?.quick_priority && (
              <span className={`priority priority-${email.analysis.quick_priority.toLowerCase()}`}>
                {email.analysis.quick_priority}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 2. Analytics Widget

```typescript
import React from 'react';
import { trpc } from '../trpc';

export function AnalyticsWidget() {
  const { data: analytics } = trpc.emails.getAnalytics.useQuery({
    refreshKey: 1
  });

  if (!analytics?.data) return null;

  const { totalEmails, workflowDistribution, slaCompliance } = analytics.data;

  return (
    <div className="analytics-widget">
      <h3>Email Analytics</h3>
      
      <div className="metric">
        <span className="label">Total Emails:</span>
        <span className="value">{totalEmails}</span>
      </div>

      <div className="workflow-distribution">
        <h4>Workflow Distribution</h4>
        {Object.entries(workflowDistribution).map(([workflow, count]) => (
          <div key={workflow} className="workflow-item">
            <span className="workflow-name">{workflow}</span>
            <span className="workflow-count">{count}</span>
          </div>
        ))}
      </div>

      <div className="sla-compliance">
        <h4>SLA Compliance</h4>
        {Object.entries(slaCompliance).map(([status, count]) => (
          <div key={status} className={`sla-item sla-${status}`}>
            <span className="sla-status">{status}</span>
            <span className="sla-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing Integration

### 1. Unit Test Setup

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTRPCMsw } from 'msw-trpc';
import { setupServer } from 'msw/node';
import { AppRouter } from '../router';

const trpcMsw = createTRPCMsw<AppRouter>();

const server = setupServer(
  trpcMsw.emails.getList.query(() => {
    return {
      success: true,
      data: [
        {
          id: 'test-email-1',
          subject: 'Test Email',
          from: {
            emailAddress: {
              address: 'test@example.com',
              name: 'Test User'
            }
          },
          receivedDateTime: '2025-01-18T10:00:00Z'
        }
      ]
    };
  })
);

describe('Email Integration Tests', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should fetch email list', async () => {
    const { result } = renderHook(() => 
      trpc.emails.getList.useQuery({ workflow: 'Test' })
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toHaveLength(1);
  });
});
```

### 2. Integration Test Examples

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { EmailDashboard } from '../components/EmailDashboard';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  const trpcClient = trpc.createClient({
    links: [
      // Mock link for testing
    ]
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

describe('EmailDashboard Integration', () => {
  it('should render email dashboard with data', async () => {
    render(
      <TestWrapper>
        <EmailDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Email Management')).toBeInTheDocument();
    });
  });
});
```

## Deployment

### 1. Docker Integration

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. Environment-specific Configuration

```typescript
// config/environments.ts
export const environments = {
  development: {
    apiUrl: 'http://localhost:3000',
    websocketUrl: 'ws://localhost:3001',
    logLevel: 'debug'
  },
  staging: {
    apiUrl: 'https://staging-api.example.com',
    websocketUrl: 'wss://staging-ws.example.com',
    logLevel: 'info'
  },
  production: {
    apiUrl: 'https://api.example.com',
    websocketUrl: 'wss://ws.example.com',
    logLevel: 'warn'
  }
};
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database file permissions
   ls -la data/app.db
   
   # Verify database schema
   sqlite3 data/app.db ".schema"
   ```

2. **WebSocket Connection Problems**
   ```typescript
   // Enable WebSocket debugging
   localStorage.setItem('debug', 'ws:*');
   ```

3. **Authentication Errors**
   ```typescript
   // Check token expiration
   const token = getAuthToken();
   if (isTokenExpired(token)) {
     await refreshToken();
   }
   ```

### Performance Optimization

1. **Database Optimization**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_emails_workflow ON email_analysis(deep_workflow_primary);
   CREATE INDEX idx_emails_priority ON email_analysis(quick_priority);
   ```

2. **Query Optimization**
   ```typescript
   // Use React Query's stale-while-revalidate
   const { data } = trpc.emails.getList.useQuery(
     { workflow: 'Order Management' },
     { staleTime: 5 * 60 * 1000 } // 5 minutes
   );
   ```

## Support and Resources

### Documentation Links
- [tRPC Documentation](https://trpc.io/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)

### Getting Help
- GitHub Issues: [Repository Issues](https://github.com/your-org/CrewAI_Team/issues)
- Internal Slack: #email-dashboard-support
- Email: dev-team@tdsynnex.com

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

This integration guide provides comprehensive examples for integrating the Email Dashboard system into your applications. Follow the patterns and examples provided to ensure successful integration with your existing systems.