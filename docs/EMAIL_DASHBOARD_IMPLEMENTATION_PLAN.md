# Email Dashboard Implementation Plan

## Executive Summary
This plan outlines the implementation of a comprehensive Email Dashboard for the CrewAI Team system. The dashboard will display analyzed emails with workflow categorization, color coding, and action summaries, building upon the existing Email Analysis Agent infrastructure.

## Key Requirements
1. **Two-Stage Analysis**: Simple categorization (small model) → Full workflow analysis (complex model)
2. **Color-Coded UI**: Emails categorized by workflow type with visual indicators
3. **Action Column**: Summary of required actions for each email
4. **Real-Time Updates**: WebSocket integration for live email updates
5. **Backend Integration**: Leverage existing Email Analysis Agent with enhancements

## Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Microsoft Graph    │────▶│  Webhook Handler     │────▶│  Email Queue    │
│  Email Subscription │     │  /api/webhooks/...   │     │  (BullMQ)       │
└─────────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                                    │
                                                                    ▼
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Email Dashboard    │◀────│  WebSocket Updates   │◀────│  Email Worker   │
│  React Frontend     │     │  Real-time Events    │     │  Processing     │
└─────────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                                    │
        ▲                                                          ▼
        │                   ┌──────────────────────┐     ┌─────────────────┐
        └───────────────────│  Email API Routes    │◀────│  Email Analysis │
                           │  /api/emails/...     │     │  Agent (2-stage)│
                           └──────────────────────┘     └─────────────────┘
```

## Implementation Phases

### Phase 1: Backend Enhancement (Week 1)

#### 1.1 Two-Stage Analysis Implementation
- **Modify EmailAnalysisAgent** for explicit two-stage processing:
  - Stage 1: Quick categorization with qwen3:0.6b
  - Stage 2: Full workflow analysis with granite3.3:2b for all emails
- **Add analysis metadata** to track which model was used
- **Implement action extraction** as a dedicated analysis step

#### 1.2 Database Schema
- Create email storage tables:
  ```sql
  CREATE TABLE emails (
    id VARCHAR(255) PRIMARY KEY,
    graph_id VARCHAR(255) UNIQUE,
    subject TEXT,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    received_at TIMESTAMP,
    is_read BOOLEAN,
    raw_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE email_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id VARCHAR(255) REFERENCES emails(id),
    workflow_category VARCHAR(100),
    priority VARCHAR(50),
    intent VARCHAR(50),
    urgency VARCHAR(50),
    confidence_score DECIMAL(3,2),
    action_summary TEXT,
    workflow_state VARCHAR(50),
    analysis_stage VARCHAR(50),
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE email_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id VARCHAR(255) REFERENCES emails(id),
    entity_type VARCHAR(50),
    entity_value TEXT,
    context TEXT
  );
  ```

#### 1.3 Enhanced Email Processing Worker
- Store emails in database after analysis
- Emit detailed WebSocket events with analysis results
- Track processing metrics

### Phase 2: API Development (Week 1-2)

#### 2.1 Email Management API
```typescript
// GET /api/emails - List emails with pagination and filters
// GET /api/emails/:id - Get single email with full analysis
// PUT /api/emails/:id/read - Mark as read
// POST /api/emails/:id/analyze - Re-analyze email
// GET /api/emails/stats - Dashboard statistics
```

#### 2.2 Real-time Subscription API
```typescript
// WebSocket events
{
  "email:new": { id, subject, sender, preview },
  "email:analyzed": { id, analysis, action },
  "email:updated": { id, changes },
  "stats:updated": { total, unread, byCategory }
}
```

### Phase 3: Frontend Implementation (Week 2-3)

#### 3.1 Email Dashboard Component Structure
```
src/ui/
├── pages/
│   └── EmailDashboard/
│       ├── EmailDashboard.tsx
│       ├── EmailDashboard.css
│       └── index.ts
├── components/
│   └── Email/
│       ├── EmailList/
│       │   ├── EmailList.tsx
│       │   ├── EmailListItem.tsx
│       │   └── EmailList.css
│       ├── EmailFilters/
│       │   ├── EmailFilters.tsx
│       │   └── WorkflowFilter.tsx
│       ├── EmailDetail/
│       │   ├── EmailDetail.tsx
│       │   ├── EmailAnalysis.tsx
│       │   └── ActionSummary.tsx
│       └── EmailStats/
│           ├── EmailStats.tsx
│           └── CategoryChart.tsx
```

#### 3.2 Color Coding System
```typescript
const WORKFLOW_COLORS = {
  'Order Management': { bg: '#FEE2E2', border: '#DC2626', dot: '#EF4444' },
  'Shipping/Logistics': { bg: '#DBEAFE', border: '#2563EB', dot: '#3B82F6' },
  'Quote Processing': { bg: '#F3E8FF', border: '#7C3AED', dot: '#8B5CF6' },
  'Customer Support': { bg: '#D1FAE5', border: '#059669', dot: '#10B981' },
  'Deal Registration': { bg: '#FEF3C7', border: '#D97706', dot: '#F59E0B' },
  'Approval Workflows': { bg: '#E0E7FF', border: '#4F46E5', dot: '#6366F1' },
  'Renewal Processing': { bg: '#FCE7F3', border: '#BE185D', dot: '#EC4899' },
  'Vendor Management': { bg: '#F3F4F6', border: '#4B5563', dot: '#6B7280' }
};
```

#### 3.3 UI Components

**EmailListItem Component**:
- Display sender, subject, timestamp
- Color-coded workflow indicator
- Priority badge
- Action summary in dedicated column
- Unread indicator

**EmailFilters Component**:
- Workflow category filter
- Priority filter
- Date range picker
- Search by sender/subject
- Read/Unread toggle

**EmailDetail Component**:
- Full email content
- Complete analysis breakdown
- Entity extraction results
- Suggested actions list
- Workflow state visualization

### Phase 4: Integration & Testing (Week 3-4)

#### 4.1 Integration Tasks
- Connect frontend to backend APIs
- Implement real-time WebSocket updates
- Add loading states and error handling
- Implement pagination and infinite scroll
- Add email search functionality

#### 4.2 Testing Strategy
- Unit tests for all components
- Integration tests for API endpoints
- E2E tests for critical workflows
- Performance testing with large email volumes
- Accessibility testing

### Phase 5: Advanced Features (Week 4+)

#### 5.1 Bulk Actions
- Select multiple emails
- Bulk mark as read/unread
- Bulk categorization
- Export selected emails

#### 5.2 Analytics Dashboard
- Email volume trends
- Category distribution
- Response time metrics
- Workflow completion rates

#### 5.3 Smart Notifications
- Priority email alerts
- SLA breach warnings
- Workflow deadline reminders

## Technical Implementation Details

### Backend Enhancements

#### Enhanced EmailAnalysisAgent
```typescript
export class EmailAnalysisAgent extends BaseAgent {
  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    // Stage 1: Always run quick categorization
    const quickAnalysis = await this.quickCategorize(email);
    
    // Stage 2: Always run deep analysis for workflow
    const deepAnalysis = await this.deepWorkflowAnalysis(email);
    
    // Stage 3: Extract specific actions needed
    const actionSummary = await this.extractRequiredActions(email, deepAnalysis);
    
    // Combine results
    return {
      ...deepAnalysis,
      actionSummary,
      analysisMetadata: {
        stage1Model: 'qwen3:0.6b',
        stage2Model: 'granite3.3:2b',
        processingTime: Date.now() - startTime
      }
    };
  }
  
  private async extractRequiredActions(
    email: Email, 
    analysis: EmailAnalysis
  ): Promise<string> {
    // Use LLM to extract specific action items
    const prompt = `Based on this email analysis, what specific action needs to be taken?
    
    Email: ${email.subject}
    Category: ${analysis.categories.workflow}
    Intent: ${analysis.categories.intent}
    Priority: ${analysis.priority}
    
    Provide a concise action summary (max 100 characters):`;
    
    const action = await this.ollamaProvider.generate(prompt, {
      maxTokens: 50,
      temperature: 0.3
    });
    
    return action.trim();
  }
}
```

#### Email Storage Service
```typescript
export class EmailStorageService {
  async storeEmail(email: Email, analysis: EmailAnalysis): Promise<void> {
    await db.transaction(async (trx) => {
      // Store email
      await trx('emails').insert({
        id: email.id,
        graph_id: email.graphId,
        subject: email.subject,
        sender_email: email.from.emailAddress.address,
        sender_name: email.from.emailAddress.name,
        received_at: email.receivedDateTime,
        is_read: email.isRead,
        raw_content: JSON.stringify(email)
      });
      
      // Store analysis
      await trx('email_analysis').insert({
        email_id: email.id,
        workflow_category: analysis.categories.workflow.join(','),
        priority: analysis.priority,
        intent: analysis.categories.intent,
        urgency: analysis.categories.urgency,
        confidence_score: analysis.confidence,
        action_summary: analysis.actionSummary,
        workflow_state: analysis.workflowState,
        analysis_stage: 'complete',
        model_used: analysis.analysisMetadata.stage2Model
      });
      
      // Store entities
      for (const [type, values] of Object.entries(analysis.entities)) {
        for (const value of values) {
          await trx('email_entities').insert({
            email_id: email.id,
            entity_type: type,
            entity_value: JSON.stringify(value),
            context: ''
          });
        }
      }
    });
  }
}
```

### Frontend Implementation

#### EmailDashboard Page
```typescript
export const EmailDashboard: React.FC = () => {
  const [emails, setEmails] = useState<EmailWithAnalysis[]>([]);
  const [filters, setFilters] = useState<EmailFilters>({});
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  
  // Subscribe to WebSocket updates
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('email:new', (data) => {
      // Add new email to list
    });
    
    ws.on('email:analyzed', (data) => {
      // Update email with analysis
    });
    
    return () => ws.close();
  }, []);
  
  return (
    <div className="email-dashboard">
      <div className="email-sidebar">
        <EmailStats emails={emails} />
        <EmailFilters 
          filters={filters} 
          onChange={setFilters} 
        />
      </div>
      
      <div className="email-list-container">
        <EmailList 
          emails={emails}
          filters={filters}
          onSelectEmail={setSelectedEmail}
        />
      </div>
      
      {selectedEmail && (
        <div className="email-detail-container">
          <EmailDetail emailId={selectedEmail} />
        </div>
      )}
    </div>
  );
};
```

#### EmailListItem Component
```typescript
export const EmailListItem: React.FC<{ email: EmailWithAnalysis }> = ({ email }) => {
  const workflowColor = WORKFLOW_COLORS[email.analysis.workflow_category];
  
  return (
    <div 
      className={cn(
        "email-list-item",
        !email.is_read && "email-unread"
      )}
      style={{
        borderLeftColor: workflowColor.border,
        backgroundColor: email.is_read ? 'white' : workflowColor.bg
      }}
    >
      <div className="email-workflow-indicator">
        <div 
          className="workflow-dot"
          style={{ backgroundColor: workflowColor.dot }}
        />
      </div>
      
      <div className="email-sender">
        <div className="sender-name">{email.sender_name}</div>
        <div className="sender-email">{email.sender_email}</div>
      </div>
      
      <div className="email-subject">
        {email.subject}
        {email.analysis.priority === 'Critical' && (
          <span className="priority-badge critical">!</span>
        )}
      </div>
      
      <div className="email-action">
        <span className="action-text">
          {email.analysis.action_summary}
        </span>
      </div>
      
      <div className="email-timestamp">
        {formatRelativeTime(email.received_at)}
      </div>
    </div>
  );
};
```

## Performance Considerations

1. **Pagination**: Load emails in batches of 50
2. **Virtual Scrolling**: Use react-window for large lists
3. **Debounced Search**: 300ms delay on search input
4. **Optimistic Updates**: Update UI before server confirmation
5. **Caching**: Cache email details for 30 minutes

## Security Considerations

1. **Authentication**: Require user authentication for dashboard access
2. **Authorization**: Implement role-based access control
3. **Data Sanitization**: Sanitize email content before display
4. **XSS Prevention**: Use React's built-in protections
5. **Rate Limiting**: Limit API calls per user

## Monitoring & Analytics

1. **Performance Metrics**:
   - Email processing time
   - Dashboard load time
   - API response times

2. **Business Metrics**:
   - Email volume by category
   - Average response time
   - Workflow completion rates

3. **Error Tracking**:
   - Failed email processing
   - API errors
   - WebSocket disconnections

## Rollout Strategy

1. **Phase 1**: Deploy backend enhancements
2. **Phase 2**: Beta test with limited users
3. **Phase 3**: Gradual rollout to all users
4. **Phase 4**: Monitor and optimize based on usage

## Success Criteria

1. **Performance**: 
   - Email analysis < 1 second
   - Dashboard load < 2 seconds
   - Real-time updates < 500ms

2. **Accuracy**:
   - 95%+ correct categorization
   - 90%+ relevant action summaries

3. **User Adoption**:
   - 80%+ daily active users
   - <5% error rate
   - Positive user feedback

## Risk Mitigation

1. **Performance Issues**: Implement caching and pagination
2. **Model Accuracy**: Continuous training and feedback loop
3. **Data Loss**: Regular backups and transaction logging
4. **Scalability**: Horizontal scaling for workers
5. **User Experience**: A/B testing and iterative improvements

## Timeline

- **Week 1**: Backend enhancements and database setup
- **Week 2**: API development and WebSocket integration
- **Week 3**: Frontend implementation
- **Week 4**: Integration, testing, and deployment
- **Week 5+**: Advanced features and optimization

## Resources Required

1. **Development Team**:
   - 1 Backend Developer
   - 1 Frontend Developer
   - 1 DevOps Engineer
   - 1 QA Engineer

2. **Infrastructure**:
   - Redis for queuing
   - PostgreSQL for data storage
   - WebSocket server
   - Additional Ollama capacity

3. **Tools**:
   - React with TypeScript
   - TailwindCSS for styling
   - Vitest for testing
   - Playwright for E2E tests

## Conclusion

This implementation plan provides a comprehensive approach to building an Email Dashboard that leverages the existing Email Analysis Agent while adding the requested two-stage analysis, color-coded UI, and action summaries. The phased approach ensures steady progress while maintaining system stability.