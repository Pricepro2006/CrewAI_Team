# Email Analysis Agent Migration Guide

Transitioning to TD SYNNEX Enhanced Email Analysis

## Overview
This guide provides step-by-step instructions for migrating from the existing `EmailAnalysisAgent` to the new `EmailAnalysisAgentEnhanced` that incorporates TD SYNNEX-specific workflow patterns and enhanced two-stage analysis.

## Key Improvements

### 1. TD SYNNEX Workflow Alignment

- **Before**: Generic workflow categories
- **After**: 8 specific TD SYNNEX workflows with distribution patterns:
  - Order Management (87.9%)
  - Shipping/Logistics (83.2%)
  - Quote Processing (65.2%)
  - Customer Support (39.1%)
  - Deal Registration (17.6%)
  - Approval Workflows (11.9%)
  - Renewal Processing (2.2%)
  - Vendor Management (1.5%)

### 2. Enhanced Entity Extraction

- **Before**: Basic regex patterns
- **After**: Comprehensive entity extraction with:
  - PO format detection (8/10/11-digit, alphanumeric)
  - Quote type classification (CAS/TS/WQ)
  - Case type identification (INC/order/tracking)
  - Contact classification (internal/external)
  - Revenue and date context extraction

### 3. Two-Stage Analysis (Always Run)

- **Before**: Conditional deep analysis based on confidence
- **After**: Both stages always run for comprehensive analysis:
  - Stage 1: Quick categorization (qwen3:0.6b) - <500ms
  - Stage 2: Deep workflow analysis (granite3.3:2b) - <2000ms

### 4. SLA Tracking

- **Before**: No SLA management
- **After**: Built-in SLA tracking with:
  - Critical: 4 hours
  - High: 24 hours
  - Medium: 72 hours
  - Low: 168 hours (1 week)

### 5. Action Summary

- **Before**: List of suggested actions
- **After**: Concise action summary (max 100 chars) for UI display

## Migration Steps

### Step 1: Update Database Schema

Run the following migration to add new fields:

```sql
-- Add enhanced fields to email_analysis table
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_workflow VARCHAR(100);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_priority VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_intent VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_urgency VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_confidence DECIMAL(3,2);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_suggested_state VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_model VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS quick_processing_time INTEGER;

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deep_workflow_primary VARCHAR(100);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deep_workflow_secondary TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deep_workflow_related TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deep_confidence DECIMAL(3,2);

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS entities_po_numbers TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS entities_quote_numbers TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS entities_case_numbers TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS entities_part_numbers TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS entities_order_references TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS entities_contacts TEXT;

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS action_summary VARCHAR(100);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS action_details TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS action_sla_status VARCHAR(50);

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'New';
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS workflow_state_updated_at TIMESTAMP;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS workflow_suggested_next VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS workflow_estimated_completion TIMESTAMP;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS workflow_blockers TEXT;

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS business_impact_revenue DECIMAL(10,2);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS business_impact_satisfaction VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS business_impact_urgency_reason TEXT;

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS contextual_summary TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS suggested_response TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS related_emails TEXT;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS thread_position INTEGER;

ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deep_model VARCHAR(50);
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS deep_processing_time INTEGER;
ALTER TABLE email_analysis ADD COLUMN IF NOT EXISTS total_processing_time INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_primary ON email_analysis(deep_workflow_primary);
CREATE INDEX IF NOT EXISTS idx_state ON email_analysis(workflow_state);
CREATE INDEX IF NOT EXISTS idx_sla_status ON email_analysis(action_sla_status);

-- Create workflow patterns table
CREATE TABLE IF NOT EXISTS workflow_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_name VARCHAR(100) NOT NULL,
  workflow_category VARCHAR(100) NOT NULL,
  trigger_keywords TEXT,
  typical_entities TEXT,
  average_completion_time INTEGER,
  success_rate DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-populate TD SYNNEX patterns
INSERT INTO workflow_patterns (pattern_name, workflow_category, success_rate) VALUES
('Standard Order Processing', 'Order Management', 0.973),
('Express Shipping Request', 'Shipping/Logistics', 0.965),
('Quote to Order Conversion', 'Quote Processing', 0.892),
('Technical Support Case', 'Customer Support', 0.915),
('Partner Deal Registration', 'Deal Registration', 0.883),
('Manager Approval Request', 'Approval Workflows', 0.947),
('Contract Renewal', 'Renewal Processing', 0.871),
('Vendor RMA Process', 'Vendor Management', 0.824)
ON CONFLICT DO NOTHING;
```

### Step 2: Update Agent Registry

Replace the agent registration:

```typescript
// Before
import { EmailAnalysisAgent } from './agents/specialized/EmailAnalysisAgent';
agentRegistry.register(new EmailAnalysisAgent());

// After
import { EmailAnalysisAgentEnhanced } from './agents/specialized/EmailAnalysisAgentEnhanced';
agentRegistry.register(new EmailAnalysisAgentEnhanced());
```

### Step 3: Update API Response Handling

The enhanced agent returns a different structure:

```typescript
// Before
interface EmailAnalysis {
  categories: {
    workflow: string[];
    priority: string;
    intent: string;
    urgency: string;
  };
  priority: string;
  entities: EmailEntities;
  workflowState: string;
  suggestedActions: string[];
  confidence: number;
  summary: string;
}

// After
interface EmailAnalysisResult {
  quick: QuickAnalysis;
  deep: DeepWorkflowAnalysis;
  actionSummary: string; // New: concise action for UI
  processingMetadata: {
    stage1Time: number;
    stage2Time: number;
    totalTime: number;
    models: {
      stage1: string;
      stage2: string;
    };
  };
}
```

### Step 4: Update Storage Service

Modify `EmailStorageService` to handle new structure:

```typescript
export class EmailStorageService {
  async storeEmail(email: Email, analysis: EmailAnalysisResult): Promise<void> {
    await db.transaction(async (trx) => {
      // Store email (unchanged)
      await trx('emails').insert({
        id: email.id,
        graph_id: email.graphId,
        subject: email.subject,
        sender_email: email.from.emailAddress.address,
        sender_name: email.from.emailAddress.name,
        received_at: email.receivedDateTime,
        is_read: email.isRead,
        has_attachments: email.hasAttachments,
        raw_content: JSON.stringify(email)
      });
      
      // Store enhanced analysis
      await trx('email_analysis').insert({
        email_id: email.id,
        // Stage 1 results
        quick_workflow: analysis.quick.workflow.primary,
        quick_priority: analysis.quick.priority,
        quick_intent: analysis.quick.intent,
        quick_urgency: analysis.quick.urgency,
        quick_confidence: analysis.quick.confidence,
        quick_suggested_state: analysis.quick.suggestedState,
        quick_model: analysis.processingMetadata.models.stage1,
        quick_processing_time: analysis.processingMetadata.stage1Time,
        // Stage 2 results
        deep_workflow_primary: analysis.deep.detailedWorkflow.primary,
        deep_workflow_secondary: JSON.stringify(analysis.deep.detailedWorkflow.secondary),
        deep_workflow_related: JSON.stringify(analysis.deep.detailedWorkflow.relatedCategories),
        deep_confidence: analysis.deep.detailedWorkflow.confidence,
        // Entities
        entities_po_numbers: JSON.stringify(analysis.deep.entities.poNumbers),
        entities_quote_numbers: JSON.stringify(analysis.deep.entities.quoteNumbers),
        entities_case_numbers: JSON.stringify(analysis.deep.entities.caseNumbers),
        entities_part_numbers: JSON.stringify(analysis.deep.entities.partNumbers),
        entities_order_references: JSON.stringify(analysis.deep.entities.orderReferences),
        entities_contacts: JSON.stringify(analysis.deep.entities.contacts),
        // Actions
        action_summary: analysis.actionSummary,
        action_details: JSON.stringify(analysis.deep.actionItems),
        action_sla_status: analysis.deep.actionItems[0]?.slaStatus,
        // Workflow state
        workflow_state: analysis.deep.workflowState.current,
        workflow_suggested_next: analysis.deep.workflowState.suggestedNext,
        workflow_blockers: JSON.stringify(analysis.deep.workflowState.blockers),
        // Business impact
        business_impact_revenue: analysis.deep.businessImpact.revenue,
        business_impact_satisfaction: analysis.deep.businessImpact.customerSatisfaction,
        business_impact_urgency_reason: analysis.deep.businessImpact.urgencyReason,
        // Context
        contextual_summary: analysis.deep.contextualSummary,
        suggested_response: analysis.deep.suggestedResponse,
        related_emails: JSON.stringify(analysis.deep.relatedEmails),
        // Metadata
        deep_model: analysis.processingMetadata.models.stage2,
        deep_processing_time: analysis.processingMetadata.stage2Time,
        total_processing_time: analysis.processingMetadata.totalTime
      });
    });
  }
}
```

### Step 5: Update UI Components

Update components to use new fields:

```typescript
// EmailListItem component
const EmailListItem: React.FC<{ email: EmailWithAnalysis }> = ({ email }) => {
  // Use deep_workflow_primary instead of workflow_category
  const workflowColor = WORKFLOW_COLORS[email.analysis.deep_workflow_primary];
  
  // Use action_summary for display
  <span className="action-text">
    {email.analysis.action_summary}
  </span>
  
  // Use workflow_state for state indicators
  <span className={stateStyle.badge}>
    {email.analysis.workflow_state}
  </span>
  
  // Show SLA status if at-risk or overdue
  {email.analysis.action_sla_status === 'at-risk' && (
    <span className="sla-warning">SLA Risk</span>
  )}
};
```

### Step 6: Update WebSocket Events

Emit enhanced analysis data:

```typescript
// Email worker
const analysis = await emailAnalysisAgent.analyzeEmail(email);

// Emit with new structure
io.emit('email:analyzed', {
  id: email.id,
  workflow: analysis.deep.detailedWorkflow.primary,
  priority: analysis.quick.priority,
  actionSummary: analysis.actionSummary,
  confidence: analysis.deep.confidence,
  slaStatus: analysis.deep.actionItems[0]?.slaStatus,
  state: analysis.deep.workflowState.current
});
```

## Testing Migration

### 1. Unit Tests

Create tests for new functionality:

```typescript
describe('EmailAnalysisAgentEnhanced', () => {
  it('should categorize into TD SYNNEX workflows', async () => {
    const email = createTestEmail({
      subject: 'Order PO 12345678',
      body: 'Please process this purchase order'
    });
    
    const result = await agent.analyzeEmail(email);
    
    expect(result.deep.detailedWorkflow.primary).toBe('Order Management');
    expect(result.deep.entities.poNumbers).toHaveLength(1);
    expect(result.deep.entities.poNumbers[0].value).toBe('12345678');
    expect(result.deep.entities.poNumbers[0].format).toBe('8-digit');
  });
  
  it('should calculate SLA status', async () => {
    const email = createTestEmail({
      subject: 'URGENT: System down',
      receivedDateTime: new Date(Date.now() - 5 * 3600000).toISOString() // 5 hours ago
    });
    
    const result = await agent.analyzeEmail(email);
    
    expect(result.quick.priority).toBe('Critical');
    expect(result.deep.actionItems[0].slaStatus).toBe('overdue'); // 4 hour SLA
  });
});
```

### 2. Integration Tests

Test full workflow:

```typescript
it('should process email through complete workflow', async () => {
  // Create email
  const email = await createEmailInGraph();
  
  // Process through webhook
  await request(app)
    .post('/api/webhooks/microsoft-graph')
    .send(createNotification(email.id));
  
  // Verify stored analysis
  const analysis = await db('email_analysis')
    .where('email_id', email.id)
    .first();
  
  expect(analysis.deep_workflow_primary).toBeDefined();
  expect(analysis.action_summary).toBeDefined();
  expect(analysis.workflow_state).toBe('New');
});
```

### 3. Performance Tests

Ensure performance targets are met:

```typescript
it('should meet performance targets', async () => {
  const emails = generateTestEmails(100);
  const results = [];
  
  for (const email of emails) {
    const start = Date.now();
    const result = await agent.analyzeEmail(email);
    results.push(result);
  }
  
  const avgStage1 = average(results.map(r => r.processingMetadata.stage1Time));
  const avgStage2 = average(results.map(r => r.processingMetadata.stage2Time));
  
  expect(avgStage1).toBeLessThan(500); // <500ms target
  expect(avgStage2).toBeLessThan(2000); // <2000ms target
});
```

## Rollback Plan

If issues arise, rollback by:

1. **Revert Agent Registration**:
   ```typescript
   agentRegistry.register(new EmailAnalysisAgent());
   ```

2. **Keep Database Changes**: New columns won't affect old code

3. **Use Feature Flag**:

   ```typescript
   const agent = process.env.USE_ENHANCED_EMAIL_AGENT === 'true'
     ? new EmailAnalysisAgentEnhanced()
     : new EmailAnalysisAgent();
   ```

## Monitoring

### Key Metrics to Track

1. **Processing Time**: Compare old vs new agent
2. **Categorization Accuracy**: Monitor workflow distribution
3. **Entity Extraction Rate**: Track extraction success
4. **SLA Compliance**: Monitor overdue items
5. **Cache Hit Rate**: Ensure caching works

### Alerts to Set Up

```typescript
// Alert if processing time exceeds targets
if (analysis.processingMetadata.totalTime > 3000) {
  logger.warn('Email analysis exceeded 3s threshold', {
    emailId: email.id,
    totalTime: analysis.processingMetadata.totalTime
  });
}

// Alert on low confidence
if (analysis.deep.confidence < 0.6) {
  logger.warn('Low confidence email analysis', {
    emailId: email.id,
    confidence: analysis.deep.confidence
  });
}
```

## Post-Migration Checklist

- [ ] Database migration completed
- [ ] Agent registered in all environments
- [ ] API endpoints updated
- [ ] UI components using new fields
- [ ] WebSocket events emitting correctly
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Monitoring dashboards updated
- [ ] Team trained on new features
- [ ] Documentation updated

## Support

For migration support:

1. Check logs for detailed error messages
2. Review test failures for specific issues
3. Use feature flags for gradual rollout
4. Monitor metrics dashboard for anomalies

The enhanced agent provides significant improvements in accuracy, performance, and business alignment while maintaining backward compatibility through careful schema design.
