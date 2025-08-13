# Email Pipeline Backend Architecture

## Core Principle: Backend Processing → UI Presentation

The email pipeline runs independently of the UI, continuously processing emails through the three-phase analysis system and storing actionable data that the UI simply presents.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND EMAIL PIPELINE                           │
│                     (Runs 24/7 Independent of UI)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. EMAIL INGESTION SERVICE                                            │
│     ├─ Microsoft Graph API Polling (every 5 minutes)                   │
│     ├─ 24 Mailboxes Monitoring                                         │
│     ├─ Delta Queries for Efficiency                                    │
│     └─ Email Queue Management                                          │
│                                                                         │
│  2. THREE-PHASE ANALYSIS ENGINE                                        │
│     ├─ Phase 1: Rule-Based Triage (<1s)                               │
│     │   └─ Runs on ALL emails                                         │
│     ├─ Phase 2: Llama Enhancement (10s)                               │
│     │   └─ Runs on 90% of emails                                      │
│     └─ Phase 3: Phi-4 Strategic (80s)                                 │
│         └─ Runs on 10% critical emails                                │
│                                                                         │
│  3. WORKFLOW TASK GENERATOR                                            │
│     ├─ Creates structured tasks from analysis                          │
│     ├─ Assigns ownership based on rules                               │
│     ├─ Sets SLA deadlines                                             │
│     └─ Determines Red/Yellow/Green status                             │
│                                                                         │
│  4. DATABASE PERSISTENCE LAYER                                         │
│     ├─ Stores workflow tasks                                           │
│     ├─ Updates status history                                          │
│     ├─ Maintains entity relationships                                  │
│     └─ Calculates aggregated metrics                                   │
│                                                                         │
│  5. NOTIFICATION & ALERTING SERVICE                                    │
│     ├─ SLA violation alerts                                            │
│     ├─ Critical task notifications                                     │
│     ├─ Status change events                                            │
│     └─ WebSocket event broadcasting                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Data Flow
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                               UI LAYER                                   │
│                        (Presents Actionable Data)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  • Displays pre-processed workflow tasks                               │
│  • Shows real-time status updates via WebSocket                        │
│  • Provides action buttons that trigger backend operations             │
│  • Visualizes aggregated metrics calculated by backend                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Backend Services Detail

### 1. Email Ingestion Service

```typescript
class EmailIngestionService {
  private graphClient: GraphAPIClient;
  private lastSyncTokens: Map<string, string>;

  async run() {
    // Runs every 5 minutes via cron/scheduler
    while (true) {
      for (const mailbox of MAILBOXES) {
        const newEmails = await this.fetchNewEmails(mailbox);
        await this.queueForAnalysis(newEmails);
      }
      await sleep(5 * 60 * 1000); // 5 minutes
    }
  }

  private async fetchNewEmails(mailbox: string): Promise<Email[]> {
    // Use delta queries for efficiency
    const deltaToken = this.lastSyncTokens.get(mailbox);
    const response = await this.graphClient.getMessages(mailbox, deltaToken);
    this.lastSyncTokens.set(mailbox, response.deltaToken);
    return response.emails;
  }
}
```

### 2. Analysis Pipeline Processor

```typescript
class AnalysisPipelineProcessor {
  private phase1Analyzer: Phase1Analyzer;
  private phase2Analyzer: Phase2Analyzer;
  private phase3Analyzer: Phase3Analyzer;

  async processEmailBatch(emails: Email[]) {
    const tasks = [];

    for (const email of emails) {
      // Phase 1 - Always run
      const phase1Results = await this.phase1Analyzer.analyze(email);

      // Determine which phases to run
      const phases = this.determinePhases(email, phase1Results);

      let finalResults = phase1Results;

      // Phase 2 - If needed
      if (phases.includes(2)) {
        finalResults = await this.phase2Analyzer.enhance(email, phase1Results);
      }

      // Phase 3 - For critical emails
      if (phases.includes(3)) {
        finalResults = await this.phase3Analyzer.strategize(
          email,
          finalResults,
        );
      }

      // Generate task
      const task = this.createWorkflowTask(email, finalResults);
      tasks.push(task);
    }

    // Bulk save to database
    await this.saveTasksBatch(tasks);

    // Emit events for UI updates
    this.emitTaskCreatedEvents(tasks);
  }
}
```

### 3. Background Job Scheduler

```typescript
class BackgroundJobScheduler {
  jobs = [
    {
      name: "Email Ingestion",
      schedule: "*/5 * * * *", // Every 5 minutes
      handler: EmailIngestionService.run,
    },
    {
      name: "Metric Aggregation",
      schedule: "*/15 * * * *", // Every 15 minutes
      handler: MetricAggregationService.run,
    },
    {
      name: "SLA Monitor",
      schedule: "*/10 * * * *", // Every 10 minutes
      handler: SLAMonitoringService.checkDeadlines,
    },
    {
      name: "Status Transition Detector",
      schedule: "*/5 * * * *", // Every 5 minutes
      handler: StatusTransitionService.detectChanges,
    },
    {
      name: "Daily Summary Generator",
      schedule: "0 6 * * *", // 6 AM daily
      handler: DailySummaryService.generate,
    },
  ];
}
```

### 4. Metric Aggregation Service

```typescript
class MetricAggregationService {
  async run() {
    // Calculate executive metrics
    const executiveMetrics = await this.calculateExecutiveMetrics();

    // Calculate category breakdowns
    const categoryMetrics = await this.calculateCategoryMetrics();

    // Calculate owner workloads
    const ownerMetrics = await this.calculateOwnerMetrics();

    // Calculate trend data
    const trendData = await this.calculateTrends();

    // Store in cache for fast UI access
    await this.cacheMetrics({
      executive: executiveMetrics,
      categories: categoryMetrics,
      owners: ownerMetrics,
      trends: trendData,
      lastUpdated: new Date(),
    });

    // Emit metric update event
    this.emitMetricUpdate();
  }

  private async calculateExecutiveMetrics() {
    return db.query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as revenue_at_risk,
        COUNT(CASE WHEN task_status = 'RED' THEN 1 END) as critical_count,
        COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
             AND task_status != 'COMPLETED' THEN 1 END) as sla_violations
      FROM workflow_tasks
      WHERE created_at > datetime('now', '-7 days')
    `);
  }
}
```

### 5. Real-time Event System

```typescript
class WorkflowEventEmitter {
  private wsServer: WebSocketServer;

  // Task Events
  emitTaskCreated(task: WorkflowTask) {
    this.broadcast("workflow:task:created", {
      task,
      timestamp: new Date(),
      impact: this.calculateImpact(task),
    });
  }

  emitStatusChanged(taskId: string, oldStatus: string, newStatus: string) {
    this.broadcast("workflow:status:changed", {
      taskId,
      oldStatus,
      newStatus,
      timestamp: new Date(),
    });

    // Special handling for critical status changes
    if (newStatus === "RED") {
      this.emitCriticalAlert(taskId);
    }
  }

  emitSLAWarning(taskId: string, hoursRemaining: number) {
    this.broadcast("workflow:sla:warning", {
      taskId,
      hoursRemaining,
      severity: hoursRemaining < 4 ? "CRITICAL" : "WARNING",
    });
  }

  emitMetricsUpdated(metrics: DashboardMetrics) {
    this.broadcast("workflow:metrics:updated", metrics);
  }
}
```

## Data Flow Examples

### Example 1: New Email Arrives

```
1. Email arrives in InsightOrderSupport@tdsynnex.com
2. Graph API delta query picks it up (within 5 minutes)
3. Email queued for analysis
4. Phase 1: Detects "Quote Processing", "RED" status, $50k value
5. Phase 2: Identifies owner "Sales Team", SLA 24 hours
6. Phase 3: Flags competitor mention, expansion opportunity
7. Task created in database
8. WebSocket event sent: "workflow:task:created"
9. UI receives event and updates dashboard in real-time
```

### Example 2: SLA Monitoring

```
1. SLA Monitor runs every 10 minutes
2. Queries tasks with upcoming deadlines
3. Finds task approaching SLA (4 hours remaining)
4. Emits "workflow:sla:warning" event
5. UI shows warning icon and countdown timer
6. If SLA violated, status changes to "RED"
7. Critical alert sent to manager
```

### Example 3: Metric Aggregation

```
1. Every 15 minutes, aggregation job runs
2. Calculates revenue at risk: $1.2M
3. Counts critical tasks: 47
4. Identifies bottleneck: "Vendor Pricing Delays"
5. Stores metrics in cache
6. Emits "workflow:metrics:updated"
7. UI updates executive dashboard
```

## UI's Role: Pure Presentation Layer

The UI's responsibilities are limited to:

1. **Display Pre-Calculated Data**

   ```typescript
   // UI simply fetches and displays
   const metrics = await api.getExecutiveMetrics();
   setDashboardData(metrics);
   ```

2. **Listen for Real-time Updates**

   ```typescript
   websocket.on("workflow:task:created", (event) => {
     addTaskToList(event.task);
     showNotification(`New ${event.task.priority} task created`);
   });
   ```

3. **Trigger Backend Actions**

   ```typescript
   // UI sends command, backend does the work
   async function reassignTask(taskId: string, newOwner: string) {
     await api.updateTask(taskId, { owner: newOwner });
     // Backend handles status history, notifications, etc.
   }
   ```

4. **Visualize Aggregated Metrics**
   ```typescript
   // Charts display pre-calculated data
   <RevenueAtRiskChart data={metrics.revenueByCategory} />
   <SLAComplianceGauge value={metrics.slaCompliance} />
   ```

## Benefits of This Architecture

1. **Scalability**: Backend can process thousands of emails without UI impact
2. **Reliability**: Email processing continues even if UI is down
3. **Performance**: UI loads instantly with pre-calculated data
4. **Real-time**: WebSocket events keep UI current without polling
5. **Maintainability**: Clear separation of concerns
6. **Flexibility**: Can add new analysis phases without UI changes

## Implementation Timeline

### Week 1: Core Pipeline

- Email ingestion service
- Three-phase analysis engine
- Task generation logic

### Week 2: Data Layer

- Database schema
- Aggregation queries
- Caching layer

### Week 3: Event System

- WebSocket infrastructure
- Event emitters
- Real-time notifications

### Week 4: Job Scheduling

- Background job framework
- Scheduled tasks
- Monitoring setup

### Week 5-6: Integration

- API endpoints
- UI integration
- End-to-end testing

This architecture ensures the email pipeline operates independently, continuously analyzing emails and generating actionable insights that the UI simply presents to users in real-time.
