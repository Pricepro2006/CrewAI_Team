# Email Management System - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Services](#backend-services)
5. [API Layer](#api-layer)
6. [Frontend Components](#frontend-components)
7. [LLM Integration](#llm-integration)
8. [Processing Pipeline](#processing-pipeline)
9. [Performance Metrics](#performance-metrics)
10. [Deployment Guide](#deployment-guide)
11. [Troubleshooting](#troubleshooting)

---

## System Overview

The Email Management System is an enterprise-grade AI-powered email analysis platform designed to extract actionable business intelligence from corporate email communications. Built specifically for TD SYNNEX, it processes emails through a sophisticated three-phase analysis pipeline.

### Key Features
- **Real Business Intelligence Extraction**: Extracts PO numbers, amounts, companies, and action items
- **Three-Phase Processing Pipeline**: Rule-based → LLM Analysis → Strategic Intelligence
- **High-Quality BI**: Achieves 7-8/10 quality scores for actionable insights
- **Scalable Architecture**: Processes 100,000+ emails with various optimization modes
- **Real-Time Updates**: WebSocket support for live processing status

### Current Status (August 8, 2025)
- **Total Emails**: 143,221 in database
- **Processed with BI**: 5,000+ emails
- **Quality Achievement**: 7-8/10 for adaptive mode (LATEST)
- **Processing Rates**: 
  - Adaptive Quality Mode: 1.2 emails/minute (30-90s per email) ⭐ **ACTIVE**
  - High-Quality Mode: 0.34 emails/minute (100-120s per email)
  - Production Mode: 432 emails/minute (hybrid approach)
  - Standard Mode: 7-8 emails/minute

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  EmailDashboard | BusinessIntelligenceDashboard     │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                 API Layer (tRPC)                    │
│  Type-safe endpoints | Real-time subscriptions      │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              Backend Services (Node.js)             │
│  EmailProcessingService | BusinessIntelligenceService│
│  OptimizedBusinessAnalysisService                   │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│            Processing Pipeline (Python)             │
│  Phase 1: Rule-based | Phase 2: LLM | Phase 3: Strategic│
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              LLM Infrastructure                     │
│  llama.cpp (Mistral 7B Q4) | Ollama (deprecated)   │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│            Database (SQLite)                        │
│  emails_enhanced table | 143,221 emails            │
└─────────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend**: React 18.2.0, TypeScript 5.0, Tailwind CSS
- **Backend**: Node.js 20.11, Express, TypeScript
- **Database**: SQLite with better-sqlite3
- **API**: tRPC for type-safe APIs
- **Queue**: Redis with Bull for job management
- **LLM**: llama.cpp with Mistral 7B Q4_K_M model
- **WebSocket**: Port 8080 for real-time updates

---

## Database Schema

### Primary Table: `emails_enhanced`

```sql
CREATE TABLE emails_enhanced (
    id TEXT PRIMARY KEY,
    
    -- Email Metadata
    internet_message_id TEXT,
    subject TEXT,
    sender_email TEXT,
    sender_name TEXT,
    recipient_emails TEXT,
    sent_date DATETIME,
    received_date DATETIME,
    
    -- Content
    body_content TEXT,
    body_preview TEXT,
    attachments TEXT,
    
    -- Processing Results
    phase_1_results TEXT,  -- JSON: Rule-based extraction
    phase_2_results TEXT,  -- JSON: LLM business intelligence (NEW: phase2_result)
    phase_3_results TEXT,  -- JSON: Strategic analysis
    
    -- Chain Analysis
    chain_id TEXT,
    chain_position INTEGER,
    chain_length INTEGER,
    is_chain_start BOOLEAN,
    is_complete_chain BOOLEAN,
    completeness_score REAL,
    
    -- Workflow
    workflow_state TEXT,  -- START|IN_PROGRESS|COMPLETION
    priority TEXT,        -- CRITICAL|HIGH|NORMAL|LOW
    
    -- Analysis Metadata
    analyzed_at DATETIME,
    processing_time REAL,
    quality_score INTEGER,
    processor_version TEXT,
    
    -- Indexing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_sender_email ON emails_enhanced(sender_email);
CREATE INDEX idx_chain_id ON emails_enhanced(chain_id);
CREATE INDEX idx_workflow_state ON emails_enhanced(workflow_state);
CREATE INDEX idx_analyzed_at ON emails_enhanced(analyzed_at);
CREATE INDEX idx_phase2_null ON emails_enhanced(phase_2_results) WHERE phase_2_results IS NULL;
```

### Phase 2 Results JSON Structure

```json
{
  "email_type": "Quote Request|Order Processing|Support Ticket|Escalation",
  "workflow_state": "START|IN_PROGRESS|COMPLETION",
  "priority": "CRITICAL|HIGH|NORMAL|LOW",
  "quality_score": 8,
  
  "deal_intelligence": {
    "products_requested": ["SKU1", "SKU2"],
    "estimated_value": "$250,000",
    "margin_opportunity": "15%",
    "win_probability": "75%"
  },
  
  "customer_intelligence": {
    "company": "ACME Corporation",
    "decision_makers": ["John Smith - VP", "Jane Doe - Director"],
    "budget_indicator": "$500K-$1M",
    "purchase_history": "Previous customer, $2M lifetime"
  },
  
  "action_items": [
    {
      "action": "Follow up on pricing approval",
      "owner": "Sales Manager",
      "deadline": "2025-08-10",
      "priority": "HIGH"
    }
  ],
  
  "entities": {
    "companies": ["TD SYNNEX", "ACME Corp"],
    "people": ["John Smith", "Jane Doe"],
    "po_numbers": ["505687982", "11831540"],
    "amounts": ["$250,000", "$3,379,560.65"],
    "products": ["HPE-Aruba-Switch", "7ED25UT#ABA"]
  },
  
  "recommendations": [
    "Expedite quote approval due to customer urgency",
    "Consider bundle discount for volume purchase"
  ],
  
  "risks": [
    "Competitor offering 10% lower price",
    "Customer requesting shorter delivery timeline"
  ],
  
  "processing_metadata": {
    "processor": "high_quality_bi",
    "model": "mistral-7b-q4",
    "processed_at": "2025-08-08T10:30:00Z",
    "processing_time": 104.5
  }
}
```

---

## Backend Services

### 1. EmailProcessingService (`/src/api/services/EmailProcessingService.ts`)

Manages the core email processing pipeline.

```typescript
class EmailProcessingService {
  // Core methods
  async processEmail(emailId: string): Promise<ProcessingResult>
  async batchProcess(emailIds: string[]): Promise<BatchResult>
  async getProcessingStatus(emailId: string): Promise<Status>
  
  // Chain analysis
  async analyzeEmailChain(chainId: string): Promise<ChainAnalysis>
  async calculateCompletenessScore(chainId: string): Promise<number>
  
  // Workflow management
  async updateWorkflowState(emailId: string, state: WorkflowState): Promise<void>
  async prioritizeEmails(criteria: PriorityCriteria): Promise<string[]>
}
```

### 2. BusinessIntelligenceService (`/src/api/services/BusinessIntelligenceService.ts`)

Handles BI extraction and aggregation.

```typescript
class BusinessIntelligenceService {
  // BI extraction
  async extractBusinessIntelligence(email: Email): Promise<BIResult>
  async aggregateMetrics(timeRange: DateRange): Promise<Metrics>
  
  // Action item management
  async extractActionItems(emailId: string): Promise<ActionItem[]>
  async trackActionCompletion(actionId: string): Promise<void>
  
  // Financial analysis
  async calculateDealValue(emailId: string): Promise<FinancialMetrics>
  async identifyRevenueOpportunities(): Promise<Opportunity[]>
  
  // Caching
  private cache: NodeCache
  async getCachedBI(emailId: string): Promise<BIResult | null>
}
```

### 3. OptimizedBusinessAnalysisService (`/src/api/services/OptimizedBusinessAnalysisService.ts`)

Optimized service for high-performance analysis.

```typescript
class OptimizedBusinessAnalysisService {
  // Batch processing
  async processBatch(emails: Email[], mode: ProcessingMode): Promise<BatchResult>
  
  // Performance optimization
  async optimizeProcessingPipeline(): Promise<void>
  async adjustTimeoutSettings(emailComplexity: number): Promise<number>
  
  // Quality control
  async validateBIQuality(result: BIResult): Promise<QualityScore>
  async reprocessLowQuality(threshold: number): Promise<void>
}
```

---

## API Layer

### tRPC Router Configuration (`/src/api/trpc/trpc.router.ts`)

```typescript
export const appRouter = createRouter()
  .merge('email.', emailRouter)
  .merge('bi.', businessIntelligenceRouter)
  .merge('workflow.', workflowRouter)
  
// Email endpoints
export const emailRouter = createRouter()
  .query('getUnprocessed', {
    input: z.object({
      limit: z.number().default(100),
      priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']).optional()
    }),
    resolve: async ({ input }) => { /* ... */ }
  })
  .mutation('processEmail', {
    input: z.object({
      emailId: z.string(),
      mode: z.enum(['high_quality', 'production', 'fast'])
    }),
    resolve: async ({ input }) => { /* ... */ }
  })
  
// Business Intelligence endpoints  
export const businessIntelligenceRouter = createRouter()
  .query('getDashboardMetrics', {
    resolve: async () => { /* ... */ }
  })
  .query('getActionItems', {
    input: z.object({
      status: z.enum(['pending', 'in_progress', 'completed']).optional()
    }),
    resolve: async ({ input }) => { /* ... */ }
  })
  .subscription('processingStatus', {
    resolve: async function* () { /* WebSocket updates */ }
  })
```

### REST API Endpoints

```javascript
// Health check
GET /api/health

// Email processing
POST /api/emails/process
GET /api/emails/:id/status
GET /api/emails/unprocessed?limit=100&priority=HIGH

// Business Intelligence
GET /api/bi/metrics
GET /api/bi/action-items
GET /api/bi/opportunities
POST /api/bi/extract/:emailId

// Workflow
PUT /api/workflow/:emailId/state
GET /api/workflow/chains/:chainId
```

---

## Frontend Components

### 1. EmailDashboard Component (`/src/ui/components/EmailDashboard.tsx`)

Main dashboard for email management.

```tsx
const EmailDashboard: React.FC = () => {
  const { data: metrics } = trpc.email.getMetrics.useQuery()
  const { data: unprocessed } = trpc.email.getUnprocessed.useQuery({ limit: 50 })
  
  return (
    <div className="dashboard-container">
      <MetricsOverview metrics={metrics} />
      <ProcessingQueue emails={unprocessed} />
      <EmailList />
      <ProcessingStatus />
    </div>
  )
}
```

### 2. BusinessIntelligenceDashboard (`/src/ui/components/BusinessIntelligenceDashboard.tsx`)

BI visualization and insights dashboard.

```tsx
const BusinessIntelligenceDashboard: React.FC = () => {
  const { data: biMetrics } = trpc.bi.getDashboardMetrics.useQuery()
  const { data: actionItems } = trpc.bi.getActionItems.useQuery()
  
  return (
    <div className="bi-dashboard">
      <FinancialMetrics data={biMetrics.financial} />
      <ActionItemsTracker items={actionItems} />
      <OpportunityPipeline opportunities={biMetrics.opportunities} />
      <WorkflowVisualization />
    </div>
  )
}
```

### 3. Real-time Processing Monitor

```tsx
const ProcessingMonitor: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>()
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080')
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      setStatus(update)
    }
    
    return () => ws.close()
  }, [])
  
  return <ProcessingStatusDisplay status={status} />
}
```

---

## LLM Integration

### Migration from Ollama to llama.cpp

The system migrated from Ollama to llama.cpp due to timeout issues and fake data generation.

#### Current Configuration

```python
# high_quality_bi_processor.py
class HighQualityBIProcessor:
    def __init__(self):
        self.binary_path = "./llama.cpp/build/bin/llama-cli"
        self.model_path = "./models/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
        
        # Quality-optimized settings
        self.n_threads = 6      # Balanced thread count
        self.n_ctx = 4096       # Full context for comprehensive analysis
        self.max_tokens = 800   # Full token budget
        self.timeout = 120      # 2 minute timeout for quality
```

#### Model Information
- **Model**: Mistral 7B Instruct v0.2
- **Quantization**: Q4_K_M (4-bit quantization, medium quality)
- **Size**: 4.4GB
- **Performance**: 0.34 emails/minute in high-quality mode

### Processing Modes

1. **High-Quality Mode** (`high_quality_bi_processor.py`)
   - 100-120 seconds per email
   - 7-8/10 quality score
   - Full business intelligence extraction
   - Comprehensive prompts with action items

2. **Production Mode** (`production_td_processor.py`)
   - 432 emails/minute
   - 6/10 quality score
   - Hybrid regex + minimal LLM
   - Focus on entity extraction

3. **Standard Mode** (`binary_processor.py`)
   - 7-8 emails/minute
   - 5/10 quality score
   - Basic LLM analysis

---

## Processing Pipeline

### Phase 1: Rule-Based Extraction
- Regex patterns for PO numbers, amounts, ticket numbers
- Email type classification
- Workflow state detection
- Chain analysis and completeness scoring

### Phase 2: LLM Business Intelligence
- Sophisticated prompt engineering based on email type
- Extraction of:
  - Deal intelligence (value, products, margins)
  - Customer intelligence (decision makers, budget)
  - Competitive analysis
  - Action items with owners and deadlines
  - Strategic recommendations
  - Risk identification

### Phase 3: Strategic Analysis (Planned)
- Cross-email pattern recognition
- Account-level insights aggregation
- Predictive analytics
- Trend identification

### Email Type-Specific Processing

#### Quote Requests
- Deal value estimation
- Product identification
- Competitive intelligence
- Cross-sell/upsell opportunities
- Win probability assessment

#### Order Processing
- Fulfillment status tracking
- Delivery timeline analysis
- Customer satisfaction indicators
- Inventory bottleneck detection

#### Support Tickets
- Issue severity assessment
- Business impact calculation
- SLA risk evaluation
- Knowledge capture for improvements

#### Escalations
- Stakeholder mapping
- Financial exposure analysis
- Executive attention requirements
- De-escalation strategies

---

## Performance Metrics

### Current Performance (August 8, 2025)

| Metric | Value |
|--------|-------|
| Total Emails in Database | 143,221 |
| Emails with BI Extracted | 5,000+ |
| TD SYNNEX Emails | 103,470 |
| Average Quality Score | 8/10 (high-quality mode) |
| Processing Rate (HQ) | 0.34 emails/min |
| Processing Rate (Prod) | 432 emails/min |
| Success Rate | 60% (high-quality mode) |
| Average Processing Time | 104.5 seconds |

### Quality Scoring System

```python
def calculate_quality_score(bi_data: Dict) -> int:
    score = 0
    
    # Basic extraction (2 points)
    if bi_data.get('workflow_state'): score += 1
    if bi_data.get('priority'): score += 1
    
    # Entity extraction (3 points)
    if bi_data.get('entities', {}).get('po_numbers'): score += 1
    if bi_data.get('entities', {}).get('companies'): score += 1
    if bi_data.get('entities', {}).get('amounts'): score += 1
    
    # Actionable intelligence (5 points)
    if bi_data.get('action_items'): score += 2
    if bi_data.get('recommendations'): score += 1
    if bi_data.get('deal_intelligence'): score += 1
    if bi_data.get('financial_impact'): score += 1
    
    return min(score, 10)
```

---

## Deployment Guide

### Prerequisites
- Ubuntu 20.04+ or compatible Linux
- Python 3.9+
- Node.js 20.11+
- SQLite 3.35+
- 64GB RAM recommended
- 8+ CPU cores

### Installation Steps

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/CrewAI_Team.git
cd CrewAI_Team
```

2. **Install Dependencies**
```bash
# Python dependencies
pip install -r requirements.txt
pip install llama-cpp-python

# Node.js dependencies
pnpm install
```

3. **Download Model**
```bash
cd models
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

4. **Build llama.cpp**
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
mkdir build && cd build
cmake .. -DLLAMA_NATIVE=ON -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF
make -j$(nproc)
```

5. **Initialize Database**
```bash
sqlite3 data/crewai_enhanced.db < schema/create_tables.sql
```

6. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

7. **Start Services**
```bash
# Start Redis
redis-server

# Start backend
pnpm run dev:server

# Start frontend
pnpm run dev:client

# Start email processor
python3 high_quality_bi_processor.py 100
```

### Production Deployment

```bash
# Build for production
pnpm run build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. LLM Timeouts
**Problem**: Emails timing out during LLM processing
**Solution**: 
- Increase timeout in processor: `self.timeout = 180`
- Reduce context size: `self.n_ctx = 2048`
- Use production mode for bulk processing

#### 2. Low Quality Scores
**Problem**: BI extraction quality below 5/10
**Solution**:
- Use high_quality_bi_processor.py
- Ensure email has sufficient content (>200 chars)
- Check model file integrity

#### 3. Database Lock Errors
**Problem**: SQLite database locked
**Solution**:
```bash
# Kill stuck processes
pkill -f "python.*processor"
# Vacuum database
sqlite3 data/crewai_enhanced.db "VACUUM;"
```

#### 4. Memory Issues
**Problem**: Out of memory during processing
**Solution**:
- Reduce batch size
- Lower n_ctx parameter
- Use streaming mode for large emails

#### 5. Slow Processing
**Problem**: Processing rate below expected
**Solution**:
- Check CPU usage: `htop`
- Optimize thread count: `self.n_threads = cpu_count() // 2`
- Use production mode for non-critical emails

### Monitoring Commands

```bash
# Check processing status
sqlite3 data/crewai_enhanced.db "
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN phase2_result IS NOT NULL THEN 1 ELSE 0 END) as processed,
  AVG(CASE WHEN json_extract(phase2_result, '$.quality_score') 
    THEN json_extract(phase2_result, '$.quality_score') ELSE 0 END) as avg_quality
FROM emails_enhanced;"

# Monitor real-time processing
tail -f /tmp/bi_processing.log

# Check processor status
ps aux | grep -E "python.*processor"

# View recent high-quality extractions
sqlite3 data/crewai_enhanced.db "
SELECT subject, json_extract(phase2_result, '$.quality_score') as quality
FROM emails_enhanced
WHERE phase2_result LIKE '%high_quality_bi%'
ORDER BY analyzed_at DESC
LIMIT 10;"
```

---

## API Reference

### Python Processing Functions

```python
# High-quality BI extraction
processor = HighQualityBIProcessor()
processor.run(limit=100)

# Production mode processing
processor = ProductionTDProcessor()
processor.run_continuous(target_count=10000)

# Get processing metrics
def get_processing_metrics():
    conn = sqlite3.connect('./data/crewai_enhanced.db')
    metrics = conn.execute("""
        SELECT 
            COUNT(*) as total_emails,
            SUM(CASE WHEN phase2_result IS NOT NULL THEN 1 ELSE 0 END) as processed,
            AVG(quality_score) as avg_quality
        FROM emails_enhanced
    """).fetchone()
    return metrics
```

### TypeScript API Types

```typescript
interface EmailProcessingResult {
  emailId: string
  emailType: 'Quote Request' | 'Order Processing' | 'Support Ticket' | 'Escalation'
  workflowState: 'START' | 'IN_PROGRESS' | 'COMPLETION'
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
  qualityScore: number
  
  dealIntelligence?: {
    productsRequested: string[]
    estimatedValue: string
    marginOpportunity: string
    winProbability: string
  }
  
  actionItems: Array<{
    action: string
    owner: string
    deadline: string
    priority: string
  }>
  
  entities: {
    companies: string[]
    people: string[]
    poNumbers: string[]
    amounts: string[]
  }
  
  processingMetadata: {
    processor: string
    model: string
    processedAt: string
    processingTime: number
  }
}
```

---

## Future Enhancements

### Planned Features
1. **GPU Acceleration**: Integrate CUDA support for 10x speed improvement
2. **Multi-Model Ensemble**: Combine multiple LLMs for better accuracy
3. **Real-time Stream Processing**: Process emails as they arrive
4. **Advanced Analytics Dashboard**: Power BI integration
5. **Automated Action Execution**: Direct integration with CRM/ERP
6. **Voice Interface**: Natural language queries for BI
7. **Mobile App**: iOS/Android apps for executives

### Roadmap
- **Q3 2025**: GPU acceleration, streaming pipeline
- **Q4 2025**: Multi-model support, advanced analytics
- **Q1 2026**: Mobile apps, voice interface
- **Q2 2026**: Full automation suite

---

## Support and Maintenance

### Contact Information
- **Technical Lead**: Development Team
- **Email**: support@tdsynnex.com
- **Documentation**: https://docs.tdsynnex.com/email-ai

### Version History
- **v2.3.0** (Current): High-quality BI extraction with llama.cpp
- **v2.2.0**: Migration from Ollama to llama.cpp
- **v2.1.0**: Added BusinessIntelligenceDashboard
- **v2.0.0**: Three-phase processing pipeline
- **v1.0.0**: Initial release with basic extraction

### License
Proprietary - TD SYNNEX Internal Use Only

---

*Last Updated: August 8, 2025*
*Documentation Version: 1.0.0*