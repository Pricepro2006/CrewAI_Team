# Email Dashboard System Architecture

## Executive Summary

The Email Dashboard is a modern, scalable email management system built with React, TypeScript, and Node.js. It provides real-time email tracking, advanced filtering, analytics, and workflow management capabilities for TD SYNNEX operations.

### Key Technologies
- **Frontend**: React 18, TypeScript, TanStack Query, Chart.js
- **Backend**: Node.js, tRPC, WebSocket
- **Database**: PostgreSQL 15 with read replicas
- **Cache**: Redis 7 with Sentinel
- **Container**: Docker with Kubernetes orchestration
- **Monitoring**: Prometheus, Grafana, ELK Stack

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        API_CLIENT[API Client]
    end
    
    subgraph "Edge Layer"
        CDN[CloudFront CDN]
        WAF[Web Application Firewall]
    end
    
    subgraph "Application Layer"
        INGRESS[NGINX Ingress]
        APP[Email Dashboard App<br/>3-10 pods]
        WS[WebSocket Service<br/>2-5 pods]
    end
    
    subgraph "Service Layer"
        TRPC[tRPC API Gateway]
        AUTH[Auth Service]
        EXPORT[Export Service]
        ANALYTICS[Analytics Engine]
    end
    
    subgraph "Data Layer"
        PG_PRIMARY[(PostgreSQL Primary)]
        PG_REPLICA[(PostgreSQL Replicas)]
        REDIS_PRIMARY[(Redis Primary)]
        REDIS_REPLICA[(Redis Replicas)]
    end
    
    subgraph "Integration Layer"
        QUEUE[Message Queue]
        EMAIL_SERVICE[Email Service]
        STORAGE[S3 Storage]
    end
    
    subgraph "Monitoring Layer"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        LOKI[Loki Logs]
        ALERTS[AlertManager]
    end
    
    WEB --> CDN
    CDN --> WAF
    WAF --> INGRESS
    API_CLIENT --> INGRESS
    
    INGRESS --> APP
    INGRESS --> WS
    
    APP --> TRPC
    TRPC --> AUTH
    TRPC --> EXPORT
    TRPC --> ANALYTICS
    
    APP --> REDIS_PRIMARY
    REDIS_PRIMARY --> REDIS_REPLICA
    
    TRPC --> PG_PRIMARY
    PG_PRIMARY --> PG_REPLICA
    
    APP --> QUEUE
    QUEUE --> EMAIL_SERVICE
    EXPORT --> STORAGE
    
    APP --> PROMETHEUS
    PROMETHEUS --> GRAFANA
    APP --> LOKI
    PROMETHEUS --> ALERTS
```

## Component Architecture

### Frontend Architecture

```
src/
├── components/
│   ├── common/          # Shared components
│   ├── email/           # Email-specific components
│   │   ├── EmailTable.tsx
│   │   ├── EmailDashboard.tsx
│   │   └── StatusIndicator.tsx
│   ├── filters/         # Filter components
│   ├── analytics/       # Analytics/charts
│   └── export/          # Export functionality
├── hooks/               # Custom React hooks
├── services/            # API services
├── store/              # State management
├── types/              # TypeScript definitions
└── utils/              # Utility functions
```

### Backend Architecture

```
src/
├── api/
│   ├── trpc/           # tRPC routers
│   │   ├── email.router.ts
│   │   ├── analytics.router.ts
│   │   └── export.router.ts
│   ├── services/       # Business logic
│   │   ├── EmailStorageService.ts
│   │   ├── WebSocketService.ts
│   │   └── AnalyticsService.ts
│   └── middleware/     # Express middleware
├── core/
│   ├── cache/          # Caching layer
│   ├── database/       # Database utilities
│   ├── queue/          # Message queue
│   └── security/       # Security utilities
├── utils/              # Shared utilities
└── types/              # TypeScript types
```

## Data Flow Architecture

### Email Processing Pipeline

```mermaid
sequenceDiagram
    participant ES as Email Source
    participant Q as Message Queue
    participant EP as Email Processor
    participant DB as PostgreSQL
    participant C as Redis Cache
    participant WS as WebSocket
    participant UI as User Interface
    
    ES->>Q: New Email Event
    Q->>EP: Process Email
    EP->>DB: Store Email Data
    EP->>C: Update Cache
    EP->>WS: Broadcast Update
    WS->>UI: Real-time Update
    UI->>C: Read Cached Data
    alt Cache Miss
        C->>DB: Fetch from Database
        DB->>C: Return Data
    end
    C->>UI: Return Email Data
```

### API Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant I as Ingress
    participant A as App Server
    participant T as tRPC Router
    participant S as Service Layer
    participant D as Database
    
    C->>I: HTTPS Request
    I->>I: Rate Limiting
    I->>I: WAF Check
    I->>A: Forward Request
    A->>A: Auth Middleware
    A->>T: Route to tRPC
    T->>S: Business Logic
    S->>D: Query Data
    D->>S: Return Results
    S->>S: Apply Business Rules
    S->>T: Formatted Response
    T->>A: JSON Response
    A->>I: HTTP Response
    I->>C: Cached Response
```

## Database Architecture

### Schema Design

```sql
-- Core Tables
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_alias VARCHAR(255) NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    summary TEXT,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(20),
    workflow_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE email_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID REFERENCES emails(id),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX idx_emails_requested_by ON emails(requested_by);
CREATE INDEX idx_emails_search ON emails USING gin(to_tsvector('english', 
    subject || ' ' || COALESCE(summary, '')));
```

### Data Partitioning Strategy

- **Time-based partitioning** for emails table (monthly)
- **List partitioning** for status (active vs archived)
- **Automatic partition management** via pg_partman

## Caching Architecture

### Redis Cache Structure

```
Cache Keys:
- email:{id}                     # Individual email
- emails:list:{hash}            # Paginated email lists
- analytics:summary:{date}      # Analytics summaries
- user:preferences:{userId}     # User preferences
- filters:presets:{userId}      # Saved filters

TTL Strategy:
- Individual emails: 1 hour
- List results: 5 minutes
- Analytics: 30 minutes
- User data: 24 hours
```

### Cache Invalidation

```mermaid
graph LR
    A[Write Operation] --> B{Cache Strategy}
    B -->|Single Item| C[Delete Specific Key]
    B -->|List Change| D[Delete Pattern Keys]
    B -->|Bulk Update| E[Flush Namespace]
    
    C --> F[Update Database]
    D --> F
    E --> F
    
    F --> G[Publish Event]
    G --> H[Update Subscribers]
```

## Security Architecture

### Authentication & Authorization

```mermaid
graph TB
    U[User Request] --> A[API Gateway]
    A --> B{Has Token?}
    B -->|No| C[Redirect to Login]
    B -->|Yes| D[Validate JWT]
    D --> E{Valid?}
    E -->|No| C
    E -->|Yes| F[Check Permissions]
    F --> G{Authorized?}
    G -->|No| H[403 Forbidden]
    G -->|Yes| I[Process Request]
```

### Security Layers

1. **Network Security**
   - WAF rules for common attacks
   - DDoS protection via CloudFront
   - TLS 1.3 for all connections

2. **Application Security**
   - JWT-based authentication
   - Role-based access control (RBAC)
   - Input validation and sanitization
   - CSRF protection
   - XSS prevention via CSP

3. **Data Security**
   - Encryption at rest (AES-256)
   - Encryption in transit (TLS)
   - PII data masking
   - Audit logging

## Scalability Design

### Horizontal Scaling

```yaml
Components:
- Application: 3-10 pods (CPU: 70%, Memory: 80%)
- WebSocket: 2-5 pods (Connections: 1000/pod)
- Database: 1 primary, 2 read replicas
- Redis: 1 primary, 2 replicas
```

### Load Distribution

```mermaid
graph TB
    LB[Load Balancer]
    
    subgraph "App Pods"
        A1[App Pod 1]
        A2[App Pod 2]
        A3[App Pod 3]
        AN[App Pod N]
    end
    
    subgraph "Database"
        P[(Primary)]
        R1[(Replica 1)]
        R2[(Replica 2)]
    end
    
    LB --> A1
    LB --> A2
    LB --> A3
    LB --> AN
    
    A1 -.->|Write| P
    A2 -.->|Write| P
    A3 -.->|Read| R1
    AN -.->|Read| R2
```

## High Availability

### Fault Tolerance

1. **Application Layer**
   - Multi-AZ deployment
   - Health checks and auto-restart
   - Circuit breakers for external services

2. **Data Layer**
   - PostgreSQL streaming replication
   - Redis Sentinel for automatic failover
   - Regular automated backups

3. **Infrastructure**
   - Kubernetes self-healing
   - Pod disruption budgets
   - Node anti-affinity rules

### Disaster Recovery

- **RTO**: 30 minutes
- **RPO**: 5 minutes
- **Backup Schedule**: Every 6 hours
- **Backup Retention**: 30 days
- **DR Site**: Secondary region standby

## Performance Optimization

### Query Optimization

1. **Database Queries**
   - Prepared statements
   - Connection pooling (20 connections)
   - Query result caching
   - Materialized views for analytics

2. **API Optimization**
   - Response compression (gzip)
   - ETags for cache validation
   - Pagination for large datasets
   - Field selection (GraphQL-like)

### Frontend Optimization

1. **Bundle Optimization**
   - Code splitting by route
   - Tree shaking
   - Lazy loading components
   - CDN for static assets

2. **Runtime Performance**
   - Virtual scrolling for large lists
   - React.memo for expensive components
   - Web Workers for heavy computations
   - Service Worker for offline support

## Monitoring Architecture

### Metrics Collection

```
Application Metrics:
- Request rate and latency
- Error rates by endpoint
- Active user sessions
- WebSocket connections

Infrastructure Metrics:
- CPU and memory usage
- Disk I/O
- Network throughput
- Pod restart count

Business Metrics:
- Emails processed/hour
- Average response time
- SLA compliance
- User activity patterns
```

### Observability Stack

```mermaid
graph TB
    A[Application] --> M[Metrics<br/>Prometheus]
    A --> L[Logs<br/>Loki]
    A --> T[Traces<br/>Jaeger]
    
    M --> G[Grafana]
    L --> G
    T --> G
    
    M --> AM[AlertManager]
    AM --> S[Slack]
    AM --> P[PagerDuty]
    AM --> E[Email]
```

## Integration Architecture

### External Systems

```mermaid
graph LR
    ED[Email Dashboard] --> ES[Email Service API]
    ED --> AS[Auth Service/LDAP]
    ED --> NS[Notification Service]
    ED --> BI[BI/Analytics Platform]
    
    ES --> ED
    NS --> ED
    
    subgraph "Data Flow"
        ED --> S3[S3 Storage]
        ED --> DW[Data Warehouse]
    end
```

### API Integration Patterns

1. **Synchronous APIs**
   - REST/tRPC for real-time operations
   - Circuit breaker pattern
   - Retry with exponential backoff

2. **Asynchronous Processing**
   - Message queue for email ingestion
   - Event-driven architecture
   - Webhook callbacks

## Development Architecture

### CI/CD Pipeline

```mermaid
graph LR
    D[Developer] --> G[Git Push]
    G --> GH[GitHub]
    GH --> CI[GitHub Actions]
    
    CI --> T[Tests]
    CI --> L[Linting]
    CI --> S[Security Scan]
    
    T --> B[Build Docker Image]
    B --> R[Push to Registry]
    R --> CD[ArgoCD]
    
    CD --> ST[Staging Deploy]
    ST --> IT[Integration Tests]
    IT --> PR[Production Deploy]
```

### Environment Strategy

| Environment | Purpose | Data | Access |
|-------------|---------|------|--------|
| Development | Local development | Synthetic | Developers |
| Staging | Integration testing | Anonymized | Dev + QA |
| Production | Live system | Real | Limited |
| DR | Disaster recovery | Real (replica) | Emergency |

## Future Architecture Considerations

### Planned Enhancements

1. **Microservices Migration**
   - Extract email processing service
   - Separate analytics service
   - Independent export service

2. **Event Sourcing**
   - Complete audit trail
   - Time-travel debugging
   - Event replay capability

3. **ML Integration**
   - Email categorization
   - Priority prediction
   - Anomaly detection

4. **Multi-Region Deployment**
   - Active-active configuration
   - Global load balancing
   - Data residency compliance

---

*Architecture Version: 1.0*
*Last Updated: January 2025*
*Review Cycle: Quarterly*