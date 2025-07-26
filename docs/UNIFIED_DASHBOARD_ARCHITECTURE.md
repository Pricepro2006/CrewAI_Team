# Unified Dashboard Architecture Design

_Version 1.0 - July 22, 2025_

## Overview

This document outlines the architecture for consolidating the email management dashboards into a unified, intelligent system that incorporates comprehensive email analysis insights and real-time processing capabilities.

## Current State Analysis

### Existing Dashboards

1. **EmailDashboard** (`src/ui/components/Email/EmailDashboard.tsx`)
   - Basic email list with filtering
   - Email composition
   - Status tracking
   - Real-time updates via WebSocket

2. **IEMSDashboard** (`src/ui/components/IEMS/IEMSDashboard.tsx`)
   - Categorized email sections
   - Team member assignment
   - Email actions and mutations
   - Quick stats bar
   - Status legend

3. **AdvancedEmailDashboard** (`src/client/components/dashboard/AdvancedEmailDashboard.tsx`)
   - Advanced filtering with rules
   - Status update management
   - Export capabilities
   - Analytics charts
   - SLA tracking

### Key Insights from Email Analysis

- **Total Emails Analyzed**: 105,081
- **Clean Dataset**: 97,900 emails
- **Critical Finding**: Only 3.5% of workflows have complete chains
- **Average Response Time**: 4.3 hours
- **First Contact Resolution**: 38%

## Unified Architecture Design

### Component Hierarchy

```
UnifiedEmailDashboard
├── Header
│   ├── Title & Branding
│   ├── Global Actions (Refresh, Settings)
│   └── User Profile
├── MetricsBar
│   ├── Total/Today's Emails
│   ├── Workflow Completion Rate (3.5%)
│   ├── Agent Performance
│   ├── Average Response Time
│   └── Critical Alerts
├── MainContent
│   ├── EmailListView
│   │   ├── UnifiedEmailTable
│   │   ├── AdvancedFilterPanel
│   │   └── BulkActions
│   ├── AnalyticsView
│   │   ├── WorkflowAnalytics
│   │   ├── EntityInsights
│   │   ├── CommunicationPatterns
│   │   └── PerformanceMetrics
│   └── AgentView
│       ├── AgentAssignments
│       ├── AgentPerformance
│       └── AutomationRules
└── Footer
    └── StatusLegend
```

### Data Flow Architecture

```
                    ┌─────────────────────────┐
                    │   Graph API Webhooks    │
                    │  (Real-time emails)     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Email Processing       │
                    │     Pipeline            │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
    ┌───────────────────────┐      ┌──────────────────────┐
    │  UnifiedEmailService  │      │  WebSocket Updates   │
    │  (Data Layer)         │      │  (Real-time)         │
    └───────────┬───────────┘      └──────────┬───────────┘
                │                              │
                └──────────────┬───────────────┘
                               ▼
                    ┌─────────────────────────┐
                    │  UnifiedEmailDashboard  │
                    │    (Presentation)       │
                    └─────────────────────────┘
```

## Implementation Details

### 1. UnifiedEmailDashboard Component

**File:** `src/ui/components/UnifiedEmail/UnifiedEmailDashboard.tsx`

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/utils/trpc';
import { MetricsBar } from './MetricsBar';
import { EmailListView } from './EmailListView';
import { AnalyticsView } from './AnalyticsView';
import { AgentView } from './AgentView';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { UnifiedEmailData, ViewMode } from '@/types/unified-email.types';

interface UnifiedEmailDashboardProps {
  className?: string;
  initialView?: ViewMode;
}

export const UnifiedEmailDashboard: React.FC<UnifiedEmailDashboardProps> = ({
  className,
  initialView = 'list'
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterConfig>(defaultFilters);

  // Fetch unified email data
  const { data: emailData, refetch } = trpc.unifiedEmail.getEmails.useQuery({
    ...filters,
    includeAnalysis: true,
    includeWorkflowState: true,
    includeAgentInfo: true
  });

  // Real-time updates
  const { lastMessage } = useWebSocket('/ws/emails', {
    onMessage: (event) => {
      if (event.type === 'email.processed' || event.type === 'email.updated') {
        refetch();
      }
    }
  });

  // Analytics data
  const { data: analytics } = trpc.unifiedEmail.getAnalytics.useQuery({
    includeWorkflowMetrics: true,
    includeAgentMetrics: true,
    includeTrends: true
  });

  return (
    <div className={`unified-dashboard ${className || ''}`}>
      <Header 
        onViewChange={setViewMode}
        currentView={viewMode}
      />
      
      <MetricsBar 
        metrics={{
          totalEmails: emailData?.total || 0,
          workflowCompletion: analytics?.workflowCompletion || 3.5,
          avgResponseTime: analytics?.avgResponseTime || 4.3,
          criticalAlerts: analytics?.criticalAlerts || [],
          agentUtilization: analytics?.agentUtilization || 0
        }}
      />

      <div className="unified-dashboard__content">
        {viewMode === 'list' && (
          <EmailListView
            emails={emailData?.emails || []}
            onSelectionChange={setSelectedEmails}
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}
        
        {viewMode === 'analytics' && (
          <AnalyticsView
            analytics={analytics}
            emails={emailData?.emails || []}
          />
        )}
        
        {viewMode === 'agents' && (
          <AgentView
            agents={analytics?.agents || []}
            assignments={emailData?.agentAssignments || {}}
          />
        )}
      </div>
      
      <StatusLegend />
    </div>
  );
};
```

### 2. MetricsBar Component

**File:** `src/ui/components/UnifiedEmail/MetricsBar.tsx`

```typescript
interface MetricsBarProps {
  metrics: {
    totalEmails: number;
    workflowCompletion: number;
    avgResponseTime: number;
    criticalAlerts: Alert[];
    agentUtilization: number;
  };
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  return (
    <div className="metrics-bar">
      <MetricCard
        label="Total Emails"
        value={metrics.totalEmails.toLocaleString()}
        trend={calculateTrend(metrics.totalEmails)}
      />
      
      <MetricCard
        label="Workflow Completion"
        value={`${metrics.workflowCompletion}%`}
        status={metrics.workflowCompletion < 10 ? 'critical' : 'normal'}
        tooltip="Percentage of emails with complete workflow chains"
      />
      
      <MetricCard
        label="Avg Response Time"
        value={`${metrics.avgResponseTime}h`}
        target="2h"
        status={metrics.avgResponseTime > 4 ? 'warning' : 'good'}
      />
      
      <MetricCard
        label="Agent Utilization"
        value={`${metrics.agentUtilization}%`}
        chart={<MiniChart data={agentUtilizationHistory} />}
      />
      
      {metrics.criticalAlerts.length > 0 && (
        <AlertBanner alerts={metrics.criticalAlerts} />
      )}
    </div>
  );
};
```

### 3. Workflow Analytics Component

**File:** `src/ui/components/UnifiedEmail/WorkflowAnalytics.tsx`

```typescript
export const WorkflowAnalytics: React.FC = () => {
  const { data } = trpc.unifiedEmail.getWorkflowAnalytics.useQuery();
  
  return (
    <div className="workflow-analytics">
      <div className="workflow-header">
        <h2>Workflow Chain Analysis</h2>
        <p className="workflow-insight">
          Critical: Only {data?.completeChains || '3.5%'} of workflows have complete chains
        </p>
      </div>
      
      <div className="workflow-grid">
        <Card title="Chain Completeness">
          <PieChart
            data={[
              { label: 'Complete', value: 3.5, color: '#10b981' },
              { label: 'Partial', value: 26.2, color: '#f59e0b' },
              { label: 'Broken', value: 70.3, color: '#ef4444' }
            ]}
          />
        </Card>
        
        <Card title="Workflow Types">
          <BarChart
            data={data?.workflowTypes || []}
            xAxis="type"
            yAxis="count"
          />
        </Card>
        
        <Card title="Bottleneck Analysis">
          <FlowChart
            nodes={data?.bottlenecks || []}
            highlight="critical"
          />
        </Card>
        
        <Card title="Recommendations">
          <RecommendationsList
            recommendations={data?.recommendations || []}
            priority="critical"
          />
        </Card>
      </div>
    </div>
  );
};
```

### 4. Agent Integration Component

**File:** `src/ui/components/UnifiedEmail/AgentIntegration.tsx`

```typescript
interface AgentIntegrationProps {
  email: UnifiedEmailData;
  onAgentAction: (action: AgentAction) => void;
}

export const AgentIntegration: React.FC<AgentIntegrationProps> = ({
  email,
  onAgentAction
}) => {
  const { data: agentStatus } = trpc.agents.getStatus.useQuery({
    emailId: email.id
  });

  return (
    <div className="agent-integration">
      {email.agentAssignment ? (
        <div className="agent-assigned">
          <AgentAvatar agent={email.agentAssignment.agent} />
          <div className="agent-info">
            <h4>{email.agentAssignment.agent.name}</h4>
            <p>Processing: {email.agentAssignment.status}</p>
            <ProgressBar value={email.agentAssignment.progress} />
          </div>
          
          {email.agentAssignment.actions && (
            <div className="agent-actions">
              <h5>Automated Actions:</h5>
              <ul>
                {email.agentAssignment.actions.map((action, idx) => (
                  <li key={idx}>
                    <ActionIcon type={action.type} />
                    {action.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="agent-unassigned">
          <p>No agent assigned</p>
          <Button onClick={() => onAgentAction({ type: 'assign' })}>
            Assign Agent
          </Button>
        </div>
      )}
    </div>
  );
};
```

## Database Schema Updates

```sql
-- Unified email table structure
CREATE TABLE unified_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core email fields
  message_id VARCHAR(500) UNIQUE,
  graph_resource_id VARCHAR(500),
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  from_address VARCHAR(255),
  to_addresses TEXT[],
  cc_addresses TEXT[],
  received_at TIMESTAMP,
  
  -- Analysis fields
  workflow_state VARCHAR(50) DEFAULT 'START_POINT',
  workflow_type VARCHAR(100),
  workflow_chain_id UUID,
  is_workflow_complete BOOLEAN DEFAULT FALSE,
  
  -- Entity extraction
  entities JSONB DEFAULT '{}',
  
  -- Priority and categorization
  priority VARCHAR(20) DEFAULT 'medium',
  category VARCHAR(100),
  tags TEXT[],
  
  -- Agent assignment
  assigned_agent_id UUID,
  agent_assignment_time TIMESTAMP,
  agent_actions JSONB DEFAULT '[]',
  
  -- Performance metrics
  processing_duration_ms INTEGER,
  response_time_hours DECIMAL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_unified_emails_workflow ON unified_emails(workflow_state, workflow_type);
CREATE INDEX idx_unified_emails_agent ON unified_emails(assigned_agent_id);
CREATE INDEX idx_unified_emails_received ON unified_emails(received_at DESC);
CREATE INDEX idx_unified_emails_priority ON unified_emails(priority, created_at DESC);
```

## API Endpoints

### Unified Email Service API

```typescript
// src/api/routes/unified-email.router.ts
export const unifiedEmailRouter = router({
  // Get emails with all enrichments
  getEmails: publicProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      filters: filterSchema.optional(),
      includeAnalysis: z.boolean().default(true),
      includeWorkflowState: z.boolean().default(true),
      includeAgentInfo: z.boolean().default(true)
    }))
    .query(async ({ input, ctx }) => {
      return ctx.unifiedEmailService.getEmails(input);
    }),

  // Get analytics
  getAnalytics: publicProcedure
    .input(z.object({
      dateRange: dateRangeSchema.optional(),
      includeWorkflowMetrics: z.boolean().default(true),
      includeAgentMetrics: z.boolean().default(true),
      includeTrends: z.boolean().default(true)
    }))
    .query(async ({ input, ctx }) => {
      return ctx.unifiedEmailService.getAnalytics(input);
    }),

  // Get workflow analytics
  getWorkflowAnalytics: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.unifiedEmailService.getWorkflowAnalytics();
    }),

  // Update email
  updateEmail: protectedProcedure
    .input(z.object({
      emailId: z.string().uuid(),
      updates: z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
        assignedAgentId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.unifiedEmailService.updateEmail(input);
    }),

  // Real-time subscription
  subscribe: publicProcedure
    .subscription(({ ctx }) => {
      return observable<EmailUpdate>((emit) => {
        const unsubscribe = ctx.wsService.subscribe('email.*', (data) => {
          emit.next(data);
        });
        
        return () => {
          unsubscribe();
        };
      });
    })
});
```

## Migration Strategy

### Phase 1: Parallel Running (Week 1)
1. Deploy unified dashboard alongside existing dashboards
2. Route 10% of users to new dashboard
3. Monitor performance and feedback

### Phase 2: Gradual Migration (Week 2-3)
1. Increase traffic to 50%
2. Migrate historical data
3. Train users on new features

### Phase 3: Full Cutover (Week 4)
1. Route 100% traffic to unified dashboard
2. Deprecate old dashboards
3. Archive legacy code

## Performance Considerations

### Optimization Strategies

1. **Data Loading**
   - Implement virtual scrolling for large email lists
   - Use cursor-based pagination
   - Cache frequently accessed data

2. **Real-time Updates**
   - Debounce WebSocket messages
   - Batch UI updates
   - Use React.memo for expensive components

3. **Analytics Computation**
   - Pre-compute metrics in background jobs
   - Use materialized views for complex queries
   - Implement data sampling for large datasets

### Performance Targets

- Initial page load: < 2 seconds
- Email list rendering: < 100ms for 1000 items
- Real-time update latency: < 500ms
- Analytics dashboard load: < 3 seconds

## Security Considerations

1. **Data Access Control**
   - Role-based access to emails
   - Field-level security for sensitive data
   - Audit logging for all actions

2. **API Security**
   - Rate limiting per user
   - Input validation
   - SQL injection prevention

3. **Real-time Security**
   - WebSocket authentication
   - Message validation
   - Connection limits

## Monitoring and Analytics

### Key Metrics

1. **User Engagement**
   - Dashboard usage patterns
   - Feature adoption rates
   - User session duration

2. **System Performance**
   - API response times
   - WebSocket connection stability
   - Database query performance

3. **Business Metrics**
   - Workflow completion improvement
   - Response time reduction
   - Agent efficiency gains

### Monitoring Implementation

```typescript
// src/api/monitoring/DashboardMetrics.ts
export class DashboardMetrics {
  static trackUserAction(action: string, metadata: any) {
    metrics.increment('dashboard.user_action', {
      action,
      ...metadata
    });
  }

  static trackPerformance(operation: string, duration: number) {
    metrics.histogram('dashboard.performance', duration, {
      operation
    });
  }

  static trackWorkflowImprovement(before: number, after: number) {
    metrics.gauge('dashboard.workflow_completion', after);
    metrics.increment('dashboard.workflow_improvement', after - before);
  }
}
```

## Next Steps

1. Review and approve architecture
2. Set up development environment
3. Create feature branch
4. Begin component development
5. Implement data migration scripts
6. Deploy to staging environment
7. Conduct user acceptance testing
8. Production deployment