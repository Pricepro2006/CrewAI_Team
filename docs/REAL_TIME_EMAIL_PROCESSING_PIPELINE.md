# Real-Time Email Processing Pipeline Design

_Version 1.0 - July 22, 2025_

## Overview

This document details the design for a real-time email processing pipeline that integrates Microsoft Graph API webhooks with our intelligent email analysis system, following the established patterns from our CrewAI framework.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Microsoft 365 / Exchange                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            │ Webhook Notifications
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Graph API Webhook Handler                                  │
│                     /api/webhooks/microsoft-graph (existing)                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            │ Queue
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Redis Queue (BullMQ)                                    │
│                           'email-notifications' queue                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            │ Process
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          Email Processing Worker                                     │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────────────────┐    │
│  │ Fetch Full     │  │ Email Analysis   │  │ Workflow State Detection        │    │
│  │ Email Content  │→ │ Pipeline         │→ │ (Addresses 3.5% completion)     │    │
│  └────────────────┘  └──────────────────┘  └─────────────────────────────────┘    │
│                                                           │                          │
│                                                           ▼                          │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────────────────┐    │
│  │ Entity         │  │ Priority         │  │ Agent Assignment                │    │
│  │ Extraction     │← │ Classification   │← │ (Based on content & load)       │    │
│  └────────────────┘  └──────────────────┘  └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                ┌───────────┴───────────┐
                                ▼                       ▼
┌─────────────────────────────────────┐   ┌────────────────────────────────────────┐
│         PostgreSQL Database         │   │      WebSocket Broadcasting            │
│  • emails table                     │   │  • Real-time UI updates               │
│  • email_analysis table             │   │  • Agent notifications                │
│  • workflow_states table            │   │  • Analytics updates                  │
│  • entity_extractions table         │   └────────────────────────────────────────┘
└─────────────────────────────────────┘

```

## Component Details

### 1. Graph API Webhook Handler (Existing)

Located at: `src/api/webhooks/microsoft-graph.ts`

**Enhancements Required:**
- Add retry logic for failed Graph API calls
- Implement signature validation for security
- Add metrics collection

```typescript
// Enhanced webhook handler
export const enhancedGraphWebhookHandler = async (req: Request, res: Response) => {
  // Existing validation logic...
  
  // Add signature validation
  if (!validateWebhookSignature(req)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process notifications with metrics
  const startTime = Date.now();
  
  for (const notification of notifications.value) {
    await emailQueue.add('process-email-notification', {
      type: 'email-notification',
      notification,
      timestamp: new Date().toISOString(),
      retryCount: 0
    });
    
    // Record metrics
    metrics.increment('graph.webhook.notifications.received', {
      changeType: notification.changeType
    });
  }
  
  metrics.timing('graph.webhook.processing', Date.now() - startTime);
  return res.status(202).send();
};
```

### 2. Email Processing Worker

**New File:** `src/core/workers/EmailProcessingWorker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { GraphEmailFetcher } from '../services/GraphEmailFetcher';
import { EmailAnalysisPipeline } from '../processors/EmailAnalysisPipeline';
import { UnifiedEmailService } from '@/api/services/UnifiedEmailService';
import { WebSocketService } from '@/api/services/WebSocketService';
import { logger } from '@/utils/logger';
import { withTimeout } from '@/utils/timeout';
import { DEFAULT_TIMEOUTS } from '@/config/app.config';

export class EmailProcessingWorker {
  private worker: Worker;
  private graphFetcher: GraphEmailFetcher;
  private analysisPipeline: EmailAnalysisPipeline;
  private emailService: UnifiedEmailService;
  private wsService: WebSocketService;

  constructor() {
    this.graphFetcher = new GraphEmailFetcher();
    this.analysisPipeline = new EmailAnalysisPipeline();
    this.emailService = new UnifiedEmailService();
    this.wsService = WebSocketService.getInstance();
    
    this.initializeWorker();
  }

  private initializeWorker() {
    this.worker = new Worker(
      'email-notifications',
      async (job: Job) => {
        try {
          return await this.processEmailNotification(job);
        } catch (error) {
          logger.error('Email processing failed', 'WORKER', { jobId: job.id }, error);
          throw error;
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: 5, // Process 5 emails concurrently
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      logger.info('Email processed successfully', 'WORKER', { jobId: job.id });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Email processing failed', 'WORKER', { jobId: job?.id }, err);
    });
  }

  private async processEmailNotification(job: Job): Promise<ProcessedEmailResult> {
    const { notification } = job.data;
    const startTime = Date.now();

    try {
      // Step 1: Fetch full email from Graph API
      const email = await withTimeout(
        this.graphFetcher.fetchEmail(notification.resource),
        DEFAULT_TIMEOUTS.EXTERNAL_API,
        'Graph API fetch timeout'
      );

      // Step 2: Store raw email
      const storedEmail = await this.emailService.storeRawEmail(email);

      // Step 3: Run through analysis pipeline
      const analyzedEmail = await withTimeout(
        this.analysisPipeline.process({
          id: storedEmail.id,
          from: email.from.emailAddress.address,
          to: email.toRecipients.map(r => r.emailAddress.address),
          subject: email.subject,
          body: email.body.content,
          receivedDateTime: email.receivedDateTime,
          hasAttachments: email.hasAttachments,
          importance: email.importance
        }),
        DEFAULT_TIMEOUTS.LLM_GENERATION,
        'Analysis pipeline timeout'
      );

      // Step 4: Extract workflow state (Critical for 3.5% issue)
      const workflowState = this.detectWorkflowState(analyzedEmail);

      // Step 5: Store analyzed email
      const processedEmail = await this.emailService.storeProcessedEmail({
        ...storedEmail,
        analysis: analyzedEmail.analysis,
        workflowState,
        entities: analyzedEmail.entities,
        priority: analyzedEmail.priority,
        agentAssignment: analyzedEmail.agentAssignment
      });

      // Step 6: Broadcast updates
      await this.broadcastUpdates(processedEmail);

      // Record metrics
      const processingTime = Date.now() - startTime;
      metrics.timing('email.processing.duration', processingTime);
      metrics.increment('email.processing.success');

      return {
        emailId: processedEmail.id,
        processingTime,
        workflowState,
        agentAssigned: processedEmail.agentAssignment?.agentId
      };

    } catch (error) {
      metrics.increment('email.processing.error');
      throw error;
    }
  }

  private detectWorkflowState(email: AnalyzedEmail): WorkflowState {
    // Implementation based on the 97,900 email analysis
    const indicators = {
      startPoints: [
        'quote request', 'new order', 'inquiry', 'rfq',
        'please provide', 'can you send', 'need pricing'
      ],
      inProgress: [
        'processing', 'working on', 'in progress', 'pending',
        'waiting for', 'following up', 'checking on'
      ],
      completion: [
        'completed', 'delivered', 'shipped', 'resolved',
        'order confirmed', 'quote attached', 'thank you for'
      ]
    };

    const content = (email.subject + ' ' + email.analysis.summary).toLowerCase();
    
    // Check for completion markers first (most specific)
    if (indicators.completion.some(marker => content.includes(marker))) {
      return 'COMPLETION';
    }
    
    // Check for in-progress indicators
    if (indicators.inProgress.some(marker => content.includes(marker))) {
      return 'IN_PROGRESS';
    }
    
    // Default to start point for new emails
    return 'START_POINT';
  }

  private async broadcastUpdates(email: ProcessedEmail) {
    // Broadcast to WebSocket clients
    this.wsService.broadcast('email.processed', {
      emailId: email.id,
      workflowState: email.workflowState,
      priority: email.priority,
      agentAssignment: email.agentAssignment
    });

    // Notify assigned agent if applicable
    if (email.agentAssignment) {
      this.wsService.sendToUser(email.agentAssignment.agentId, 'email.assigned', {
        emailId: email.id,
        priority: email.priority
      });
    }
  }
}
```

### 3. Email Analysis Pipeline

**File:** `src/core/processors/EmailAnalysisPipeline.ts`

```typescript
import { EmailAnalysisAgent } from '../agents/specialized/EmailAnalysisAgent';
import { logger } from '@/utils/logger';

interface AnalysisStage {
  name: string;
  process(email: EmailData): Promise<EmailData>;
}

export class EmailAnalysisPipeline {
  private stages: AnalysisStage[] = [];
  private analysisAgent: EmailAnalysisAgent;

  constructor() {
    this.analysisAgent = new EmailAnalysisAgent();
    this.initializeStages();
  }

  private initializeStages() {
    this.stages = [
      new ContentAnalysisStage(this.analysisAgent),
      new WorkflowDetectionStage(),
      new EntityExtractionStage(),
      new PriorityClassificationStage(),
      new CommunicationPatternStage(),
      new AgentAssignmentStage()
    ];
  }

  async process(email: EmailData): Promise<EnrichedEmail> {
    let enrichedEmail = { ...email } as any;
    const startTime = Date.now();

    for (const stage of this.stages) {
      try {
        logger.info(`Processing stage: ${stage.name}`, 'PIPELINE', { 
          emailId: email.id 
        });
        
        enrichedEmail = await stage.process(enrichedEmail);
        
      } catch (error) {
        logger.error(`Stage ${stage.name} failed`, 'PIPELINE', {
          emailId: email.id,
          stage: stage.name
        }, error);
        
        // Continue with other stages even if one fails
        enrichedEmail[`${stage.name}_error`] = true;
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('Pipeline processing complete', 'PIPELINE', {
      emailId: email.id,
      duration: processingTime
    });

    return enrichedEmail as EnrichedEmail;
  }
}

// Individual stage implementations
class WorkflowDetectionStage implements AnalysisStage {
  name = 'WorkflowDetection';

  async process(email: EmailData): Promise<EmailData> {
    // Detect workflow patterns based on 97,900 email analysis
    const patterns = {
      quoteToOrder: /quote.*order|rfq.*po|pricing.*purchase/i,
      orderSupport: /order.*status|tracking.*shipment|delivery.*update/i,
      technicalSupport: /issue.*resolved|problem.*fixed|ticket.*closed/i
    };

    const workflowType = this.detectWorkflowType(email, patterns);
    const chainPosition = this.detectChainPosition(email);

    return {
      ...email,
      workflow: {
        type: workflowType,
        chainPosition,
        isComplete: chainPosition === 'end'
      }
    };
  }

  private detectWorkflowType(email: EmailData, patterns: any): string {
    const content = email.subject + ' ' + email.body;
    
    for (const [type, pattern] of Object.entries(patterns)) {
      if ((pattern as RegExp).test(content)) {
        return type;
      }
    }
    
    return 'general';
  }

  private detectChainPosition(email: EmailData): 'start' | 'middle' | 'end' {
    // Logic based on email analysis findings
    if (this.isStartIndicator(email)) return 'start';
    if (this.isEndIndicator(email)) return 'end';
    return 'middle';
  }
}
```

### 4. Graph Email Fetcher Service

**File:** `src/core/services/GraphEmailFetcher.ts`

```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import { logger } from '@/utils/logger';

export class GraphEmailFetcher {
  private graphClient: Client;

  constructor() {
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    this.graphClient = Client.initWithMiddleware({
      authProvider
    });
  }

  async fetchEmail(resource: string): Promise<GraphEmail> {
    try {
      // Extract message ID from resource path
      const messageId = this.extractMessageId(resource);
      
      // Fetch full email with all properties
      const email = await this.graphClient
        .api(resource)
        .select([
          'id', 'subject', 'from', 'toRecipients', 'ccRecipients',
          'body', 'bodyPreview', 'hasAttachments', 'importance',
          'receivedDateTime', 'sentDateTime', 'conversationId',
          'isRead', 'isDraft', 'categories', 'flag'
        ])
        .expand('attachments')
        .get();

      logger.info('Email fetched from Graph API', 'GRAPH', {
        messageId: email.id,
        subject: email.subject
      });

      return email;

    } catch (error) {
      logger.error('Failed to fetch email from Graph API', 'GRAPH', {
        resource
      }, error);
      throw error;
    }
  }

  private extractMessageId(resource: string): string {
    const match = resource.match(/messages\/([^\/]+)/);
    return match ? match[1] : '';
  }
}
```

## Database Schema Updates

**File:** `src/database/migrations/real_time_email_processing.sql`

```sql
-- Add workflow state tracking
ALTER TABLE emails ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'START_POINT';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(100);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS workflow_chain_id UUID;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_workflow_complete BOOLEAN DEFAULT FALSE;

-- Add real-time processing metadata
ALTER TABLE emails ADD COLUMN IF NOT EXISTS graph_resource_id VARCHAR(500);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER;

-- Create workflow chains table
CREATE TABLE IF NOT EXISTS workflow_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_type VARCHAR(100) NOT NULL,
  start_email_id UUID REFERENCES emails(id),
  end_email_id UUID REFERENCES emails(id),
  email_count INTEGER DEFAULT 1,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_emails_workflow_state ON emails(workflow_state);
CREATE INDEX idx_emails_workflow_chain_id ON emails(workflow_chain_id);
CREATE INDEX idx_emails_graph_resource_id ON emails(graph_resource_id);
```

## Configuration Updates

**File:** `src/config/email-processing.config.ts`

```typescript
export const EMAIL_PROCESSING_CONFIG = {
  // Worker configuration
  worker: {
    concurrency: 5,
    maxJobsPerWorker: 100,
    stalledInterval: 30000,
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 1000
    },
    removeOnFail: {
      age: 86400 // 24 hours
    }
  },

  // Graph API configuration
  graph: {
    subscriptionRenewalBuffer: 300, // 5 minutes before expiry
    maxSubscriptionDuration: 4230, // 70.5 minutes
    retryAttempts: 3,
    retryDelay: 1000
  },

  // Analysis pipeline configuration
  pipeline: {
    stages: {
      contentAnalysis: { timeout: 30000 },
      workflowDetection: { timeout: 5000 },
      entityExtraction: { timeout: 10000 },
      priorityClassification: { timeout: 5000 },
      agentAssignment: { timeout: 5000 }
    }
  },

  // Monitoring thresholds
  monitoring: {
    slowProcessingThreshold: 10000, // 10 seconds
    errorRateThreshold: 0.05, // 5%
    queueSizeWarning: 1000,
    queueSizeCritical: 5000
  }
};
```

## Monitoring and Metrics

### Key Metrics to Track

1. **Pipeline Performance**
   - Email processing duration (p50, p95, p99)
   - Stage-wise processing times
   - Queue depth and processing rate

2. **Workflow Detection Accuracy**
   - Workflow state distribution
   - Complete chain percentage (target: increase from 3.5%)
   - Workflow type classification accuracy

3. **System Health**
   - Graph API success rate
   - Worker error rate
   - WebSocket connection count

### Monitoring Implementation

```typescript
// src/api/monitoring/EmailProcessingMetrics.ts
export class EmailProcessingMetrics {
  private static instance: EmailProcessingMetrics;
  
  static track(metric: string, value: number, tags?: Record<string, string>) {
    // Send to monitoring service (Prometheus, DataDog, etc.)
    metrics.histogram(metric, value, tags);
  }

  static trackWorkflowCompletion(chainId: string, isComplete: boolean) {
    this.track('workflow.chain.completion', isComplete ? 1 : 0, {
      chainId,
      timestamp: new Date().toISOString()
    });
  }

  static trackProcessingDuration(emailId: string, duration: number, stage: string) {
    this.track('email.processing.duration', duration, {
      emailId,
      stage
    });
  }
}
```

## Error Handling and Recovery

### Retry Strategy

1. **Graph API Failures**: Exponential backoff with max 3 retries
2. **Analysis Pipeline Failures**: Continue with partial analysis
3. **Database Failures**: Dead letter queue for later processing

### Graceful Degradation

```typescript
class EmailProcessingWorker {
  private async handleProcessingError(job: Job, error: Error) {
    const { retryCount = 0 } = job.data;
    
    if (retryCount < 3) {
      // Retry with exponential backoff
      await emailQueue.add(
        'process-email-notification',
        { ...job.data, retryCount: retryCount + 1 },
        { delay: Math.pow(2, retryCount) * 1000 }
      );
    } else {
      // Move to dead letter queue
      await deadLetterQueue.add('failed-email', {
        jobData: job.data,
        error: error.message,
        failedAt: new Date().toISOString()
      });
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Test each pipeline stage independently
- Mock Graph API responses
- Test workflow detection accuracy

### Integration Tests
- End-to-end webhook → processing → storage flow
- WebSocket broadcast verification
- Database transaction integrity

### Load Tests
- Simulate 1000 emails/minute
- Measure processing latency
- Verify queue handling under load

## Security Considerations

1. **Webhook Validation**: Verify Microsoft signature on all webhooks
2. **Token Security**: Rotate Graph API credentials regularly
3. **Data Encryption**: Encrypt sensitive email content at rest
4. **Access Control**: Role-based access to processed emails

## Next Steps

1. Implement GraphEmailFetcher service
2. Set up EmailProcessingWorker
3. Configure Graph API subscriptions
4. Deploy monitoring infrastructure
5. Run load tests before production