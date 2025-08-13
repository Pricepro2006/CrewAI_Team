# Walmart Grocery Agent - Microservices Architecture Documentation

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [System Architecture Diagrams](#system-architecture-diagrams)
4. [Microservices Components](#microservices-components)
5. [API Documentation](#api-documentation)
6. [WebSocket Communication](#websocket-communication)
7. [Service Discovery & Load Balancing](#service-discovery--load-balancing)
8. [Data Flow Architecture](#data-flow-architecture)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)
11. [Configuration Management](#configuration-management)
12. [Monitoring & Observability](#monitoring--observability)
13. [Developer Guide](#developer-guide)
14. [Operations Guide](#operations-guide)
15. [Performance Tuning](#performance-tuning)
16. [Troubleshooting Guide](#troubleshooting-guide)
17. [API Reference](#api-reference)

---

## Executive Summary

The Walmart Grocery Agent is a sophisticated microservices-based application designed to provide intelligent grocery shopping assistance through natural language processing, real-time pricing, and deal optimization. The architecture employs a distributed service mesh with intelligent load balancing, service discovery, and resilience patterns to ensure high availability and optimal performance.

### Key Architectural Decisions

- **Microservices Pattern**: Decomposed monolithic application into 6 specialized services
- **Service Mesh**: Implemented custom service discovery and load balancing with Redis-backed registry
- **Communication**: REST APIs, WebSocket for real-time updates, and gRPC for inter-service communication
- **Resilience**: Circuit breakers, retries, and health checks for fault tolerance
- **Caching**: Multi-layer caching strategy with Redis for performance optimization
- **Security**: JWT authentication, rate limiting, and network isolation

### System Capabilities

- Process 60+ grocery requests per minute
- Support 1000+ concurrent WebSocket connections
- Sub-100ms response time for cached requests
- 99.9% uptime through redundancy and health monitoring
- Auto-scaling based on load metrics

---

## Architecture Overview

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App]
        API_CLIENT[API Clients]
    end

    subgraph "Edge Layer"
        NGINX[Nginx Reverse Proxy<br/>Load Balancer]
        CDN[CDN<br/>Static Assets]
    end

    subgraph "API Gateway Layer"
        GATEWAY[API Gateway<br/>:3000]
        WS_GATEWAY[WebSocket Server<br/>:8080]
    end

    subgraph "Service Mesh"
        DISCOVERY[Service Discovery<br/>Registry]
        LB[Load Balancer]
        HEALTH[Health Checker]
        PROXY[Service Proxy]
    end

    subgraph "Microservices"
        NLP[NLP Service<br/>:3008]
        PRICING[Pricing Service<br/>:3007]
        CACHE_WARMER[Cache Warmer<br/>:3006]
        GROCERY[Grocery Service<br/>:3005]
        DEAL[Deal Engine<br/>:3009]
        MONITOR[Memory Monitor<br/>:3010]
    end

    subgraph "Data Layer"
        REDIS[(Redis Cache<br/>:6379)]
        SQLITE[(SQLite DB)]
        CHROMA[(ChromaDB<br/>Vector Store)]
    end

    subgraph "External Services"
        WALMART_API[Walmart API]
        BRIGHTDATA[BrightData<br/>Scraper]
        OLLAMA[Ollama LLM<br/>:11434]
    end

    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    
    NGINX --> GATEWAY
    NGINX --> WS_GATEWAY
    NGINX --> CDN
    
    GATEWAY --> DISCOVERY
    WS_GATEWAY --> DISCOVERY
    
    DISCOVERY --> LB
    LB --> NLP
    LB --> PRICING
    LB --> CACHE_WARMER
    LB --> GROCERY
    LB --> DEAL
    LB --> MONITOR
    
    NLP --> OLLAMA
    PRICING --> WALMART_API
    PRICING --> BRIGHTDATA
    GROCERY --> REDIS
    GROCERY --> SQLITE
    DEAL --> SQLITE
    NLP --> CHROMA
    
    HEALTH --> NLP
    HEALTH --> PRICING
    HEALTH --> CACHE_WARMER
    HEALTH --> GROCERY
    HEALTH --> DEAL
    HEALTH --> MONITOR
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant Nginx
    participant Gateway
    participant ServiceDiscovery
    participant LoadBalancer
    participant NLPService
    participant PricingService
    participant Cache
    participant Database

    User->>Nginx: HTTP Request
    Nginx->>Gateway: Forward Request
    Gateway->>ServiceDiscovery: Discover Service
    ServiceDiscovery->>LoadBalancer: Get Service Instance
    LoadBalancer->>NLPService: Route Request
    
    NLPService->>NLPService: Process NL Query
    NLPService->>Cache: Check Cache
    
    alt Cache Miss
        NLPService->>PricingService: Get Pricing Data
        PricingService->>Database: Query Products
        Database-->>PricingService: Product Data
        PricingService-->>NLPService: Pricing Info
        NLPService->>Cache: Store Result
    end
    
    NLPService-->>Gateway: Response
    Gateway-->>Nginx: Forward Response
    Nginx-->>User: HTTP Response
```

---

## System Architecture Diagrams

### Service Discovery Architecture

```mermaid
graph LR
    subgraph "Service Registration"
        SVC1[Service Instance 1]
        SVC2[Service Instance 2]
        SVC3[Service Instance 3]
    end

    subgraph "Service Registry (Redis)"
        REG[(Service Registry)]
        META[(Service Metadata)]
        HEALTH_DATA[(Health Status)]
    end

    subgraph "Discovery Components"
        SD[Service Discovery]
        HC[Health Checker]
        LB[Load Balancer]
    end

    subgraph "Client Applications"
        CLIENT1[API Gateway]
        CLIENT2[Service A]
        CLIENT3[Service B]
    end

    SVC1 -->|Register| REG
    SVC2 -->|Register| REG
    SVC3 -->|Register| REG
    
    HC -->|Monitor| SVC1
    HC -->|Monitor| SVC2
    HC -->|Monitor| SVC3
    HC -->|Update Status| HEALTH_DATA
    
    SD -->|Query| REG
    SD -->|Query| META
    SD -->|Query| HEALTH_DATA
    
    LB -->|Get Instances| SD
    LB -->|Route Traffic| SVC1
    LB -->|Route Traffic| SVC2
    LB -->|Route Traffic| SVC3
    
    CLIENT1 -->|Request Service| LB
    CLIENT2 -->|Request Service| LB
    CLIENT3 -->|Request Service| LB
```

### Data Flow Architecture

```mermaid
graph TB
    subgraph "Input Layer"
        NL[Natural Language Input]
        VOICE[Voice Input]
        RECEIPT[Receipt Upload]
    end

    subgraph "Processing Pipeline"
        subgraph "Stage 1: NLP Processing"
            TOKENIZE[Tokenization]
            ENTITY[Entity Extraction]
            INTENT[Intent Recognition]
        end

        subgraph "Stage 2: Data Enrichment"
            PRODUCT_MATCH[Product Matching]
            PRICE_FETCH[Price Fetching]
            DEAL_DETECT[Deal Detection]
        end

        subgraph "Stage 3: Optimization"
            BUDGET_OPT[Budget Optimization]
            SUBSTITUTE[Product Substitution]
            BUNDLE[Bundle Recommendations]
        end
    end

    subgraph "Output Layer"
        LIST[Grocery List]
        TOTAL[Price Totals]
        SAVINGS[Savings Analysis]
        RECS[Recommendations]
    end

    NL --> TOKENIZE
    VOICE --> TOKENIZE
    RECEIPT --> ENTITY
    
    TOKENIZE --> ENTITY
    ENTITY --> INTENT
    INTENT --> PRODUCT_MATCH
    
    PRODUCT_MATCH --> PRICE_FETCH
    PRICE_FETCH --> DEAL_DETECT
    DEAL_DETECT --> BUDGET_OPT
    
    BUDGET_OPT --> SUBSTITUTE
    SUBSTITUTE --> BUNDLE
    
    BUNDLE --> LIST
    BUNDLE --> TOTAL
    BUNDLE --> SAVINGS
    BUNDLE --> RECS
```

### Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open: Failure Threshold Exceeded
    Open --> HalfOpen: Timeout Expires
    HalfOpen --> Closed: Success
    HalfOpen --> Open: Failure
    
    state Closed {
        [*] --> Monitoring
        Monitoring --> Monitoring: Success
        Monitoring --> CountingFailures: Failure
        CountingFailures --> Monitoring: Below Threshold
        CountingFailures --> [*]: Threshold Exceeded
    }
    
    state Open {
        [*] --> Rejecting
        Rejecting --> Rejecting: Request
        Rejecting --> TimerRunning: Start Timer
        TimerRunning --> [*]: Timer Expires
    }
    
    state HalfOpen {
        [*] --> Testing
        Testing --> [*]: Test Request
    }
```

---

## Microservices Components

### 1. NLP Service (Port: 3008)

**Purpose**: Natural language processing for grocery queries

**Key Features**:
- Intent recognition and entity extraction
- Multi-language support
- Context preservation across conversations
- Synonym resolution and learning

**Technologies**:
- Node.js + TypeScript
- Ollama integration for LLM processing
- ChromaDB for vector embeddings
- Redis for session management

**Endpoints**:
- `POST /api/nlp/process` - Process natural language query
- `GET /api/nlp/intents` - Get supported intents
- `POST /api/nlp/train` - Train custom intents
- `GET /health` - Health check

### 2. Pricing Service (Port: 3007)

**Purpose**: Real-time price fetching and tracking

**Key Features**:
- Live Walmart price scraping
- Price history tracking
- Deal detection and alerts
- Competitive price analysis

**Technologies**:
- BrightData web scraping
- Redis caching layer
- SQLite for price history
- WebSocket for real-time updates

**Endpoints**:
- `GET /api/price/:productId` - Get current price
- `GET /api/price/history/:productId` - Price history
- `POST /api/price/track` - Setup price tracking
- `WS /ws/prices` - Real-time price updates

### 3. Cache Warmer Service (Port: 3006)

**Purpose**: Proactive cache population for performance

**Key Features**:
- Scheduled cache warming
- Popular item prioritization
- Predictive pre-caching
- Cache invalidation management

**Technologies**:
- Node-cron for scheduling
- Redis for cache storage
- Machine learning for prediction
- Metrics collection

**Endpoints**:
- `POST /admin/cache/warm` - Trigger cache warming
- `GET /admin/cache/stats` - Cache statistics
- `DELETE /admin/cache/invalidate` - Invalidate cache
- `GET /health` - Health check

### 4. Grocery Service (Port: 3005)

**Purpose**: Core grocery list management

**Key Features**:
- List creation and management
- Item quantity optimization
- Nutritional analysis
- Recipe integration

**Technologies**:
- SQLite for list persistence
- Redis for session storage
- Integration with nutrition APIs
- WebSocket for collaboration

**Endpoints**:
- `POST /api/lists` - Create grocery list
- `GET /api/lists/:userId` - Get user lists
- `PUT /api/lists/:listId/items` - Update list items
- `POST /api/lists/:listId/share` - Share list

### 5. Deal Detection Engine (Port: 3009)

**Purpose**: Identify and recommend deals

**Key Features**:
- Real-time deal scanning
- Personalized deal matching
- Bundle deal optimization
- Coupon integration

**Technologies**:
- Machine learning models
- Redis for deal caching
- WebSocket for alerts
- Integration with retailer APIs

**Endpoints**:
- `GET /api/deals/current` - Current deals
- `POST /api/deals/match` - Match deals to list
- `GET /api/deals/recommendations` - Personalized deals
- `WS /ws/deals` - Real-time deal alerts

### 6. Memory Monitor Service (Port: 3010)

**Purpose**: System health and resource monitoring

**Key Features**:
- Memory usage tracking
- Performance metrics collection
- Auto-scaling triggers
- Alert generation

**Technologies**:
- Node.js process monitoring
- Prometheus metrics export
- WebSocket for real-time stats
- Alert integration

**Endpoints**:
- `GET /admin/monitor/metrics` - System metrics
- `GET /admin/monitor/health` - Health status
- `POST /admin/monitor/alert` - Configure alerts
- `WS /ws/metrics` - Real-time metrics stream

---

## API Documentation

### REST API Specification

#### Base URL
```
Production: https://api.walmart-grocery.com
Development: http://localhost:3000
```

#### Authentication
```http
Authorization: Bearer <JWT_TOKEN>
X-API-Key: <API_KEY>
```

#### Common Headers
```http
Content-Type: application/json
Accept: application/json
X-Request-ID: <UUID>
X-Client-Version: 1.0.0
```

### Core API Endpoints

#### 1. Process Grocery Input

**Endpoint**: `POST /api/walmart-grocery/process-input`

**Request**:
```json
{
  "conversationId": "conv-123",
  "userId": "user-456",
  "input": "I need milk, eggs, and bread for tomorrow",
  "location": {
    "zipCode": "12345",
    "city": "Springfield",
    "state": "IL"
  }
}
```

**Response**:
```json
{
  "success": true,
  "response": "I've added milk, eggs, and bread to your list.",
  "groceryList": {
    "items": [
      {
        "id": "item-1",
        "productId": "walmart-123",
        "name": "Great Value Whole Milk",
        "quantity": 1,
        "price": 3.48,
        "savings": 0.50
      }
    ],
    "subtotal": 10.45,
    "estimatedTax": 0.84,
    "total": 11.29,
    "savings": 1.50,
    "itemCount": 3,
    "deliveryEligible": false,
    "deliveryThreshold": 35
  },
  "suggestions": [
    "You're $24.55 away from free delivery"
  ],
  "metadata": {
    "processed": true,
    "timestamp": "2025-08-06T10:30:00Z",
    "conversationId": "conv-123"
  }
}
```

#### 2. Search Products

**Endpoint**: `GET /api/walmart-grocery/search`

**Query Parameters**:
- `q` (required): Search query
- `category`: Product category filter
- `minPrice`: Minimum price
- `maxPrice`: Maximum price
- `inStock`: Boolean for stock filter
- `limit`: Results limit (default: 20)

**Response**:
```json
{
  "success": true,
  "products": [
    {
      "id": "prod-123",
      "walmartId": "walmart-456",
      "name": "Organic Bananas",
      "brand": "Fresh Produce",
      "category": {
        "id": "cat-1",
        "name": "Produce",
        "path": ["Grocery", "Produce", "Fruit"]
      },
      "price": {
        "regular": 0.58,
        "sale": 0.49,
        "unit": 0.49,
        "unitOfMeasure": "lb"
      },
      "availability": {
        "inStock": true,
        "quantity": 150
      },
      "ratings": {
        "average": 4.5,
        "count": 234
      }
    }
  ],
  "metadata": {
    "totalResults": 45,
    "searchId": "search-789",
    "cached": false
  }
}
```

#### 3. Calculate List Totals

**Endpoint**: `POST /api/walmart-grocery/calculate-totals`

**Request**:
```json
{
  "items": [
    {
      "productId": "prod-123",
      "quantity": 2,
      "price": 3.99,
      "originalPrice": 4.99
    }
  ],
  "location": {
    "zipCode": "12345",
    "state": "IL"
  },
  "promoCode": "SAVE10",
  "loyaltyMember": true
}
```

**Response**:
```json
{
  "success": true,
  "calculation": {
    "subtotal": 15.96,
    "originalSubtotal": 19.96,
    "itemSavings": 4.00,
    "promoDiscount": 1.60,
    "promoDescription": "10% off entire order",
    "loyaltyDiscount": 0.32,
    "tax": 1.15,
    "taxRate": 7.25,
    "deliveryFee": 4.95,
    "totalSavings": 5.92,
    "total": 20.14,
    "freeDeliveryEligible": false,
    "amountForFreeDelivery": 19.04
  }
}
```

### WebSocket Events

#### Connection

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.on('open', () => {
  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['grocery', 'prices', 'deals'],
    userId: 'user-123'
  }));
});
```

#### Event Types

**Grocery Input Processed**:
```json
{
  "type": "grocery_input_processed",
  "data": {
    "conversationId": "conv-123",
    "userId": "user-456",
    "listTotal": 45.67,
    "itemCount": 12,
    "timestamp": "2025-08-06T10:30:00Z"
  }
}
```

**Price Update**:
```json
{
  "type": "price_update",
  "data": {
    "productId": "prod-123",
    "oldPrice": 4.99,
    "newPrice": 3.99,
    "changePercent": -20,
    "timestamp": "2025-08-06T10:30:00Z"
  }
}
```

**Deal Alert**:
```json
{
  "type": "deal_alert",
  "data": {
    "dealId": "deal-789",
    "productId": "prod-123",
    "dealType": "price_drop",
    "savings": 2.00,
    "expiresAt": "2025-08-07T23:59:59Z"
  }
}
```

---

## Service Discovery & Load Balancing

### Service Registration

Services automatically register on startup:

```typescript
// Service registration example
const serviceRegistry = new ServiceRegistry({
  redisUrl: 'redis://localhost:6379',
  ttl: 30000 // 30 seconds TTL
});

await serviceRegistry.register({
  name: 'walmart-pricing',
  version: '1.0.0',
  protocol: 'http',
  host: 'localhost',
  port: 3007,
  metadata: {
    region: 'us-east',
    capabilities: ['pricing', 'history', 'tracking']
  }
});
```

### Load Balancing Strategies

#### 1. Round Robin
```yaml
strategy: round_robin
description: Distributes requests evenly across instances
use_case: General purpose, stateless services
```

#### 2. Least Connections
```yaml
strategy: least_connections
description: Routes to instance with fewest active connections
use_case: Long-running requests, WebSocket connections
```

#### 3. Weighted Round Robin
```yaml
strategy: weighted_round_robin
description: Distributes based on instance capacity
use_case: Heterogeneous instance sizes
weights:
  instance1: 3
  instance2: 2
  instance3: 1
```

#### 4. IP Hash
```yaml
strategy: ip_hash
description: Routes based on client IP
use_case: Session affinity requirements
```

#### 5. Response Time
```yaml
strategy: response_time
description: Routes to fastest responding instance
use_case: Performance-critical requests
```

### Health Checking

```yaml
health_check:
  endpoint: /health
  interval: 10s
  timeout: 5s
  unhealthy_threshold: 3
  healthy_threshold: 2
  
  checks:
    - type: http
      expected_status: 200
    - type: tcp
      port: 3007
    - type: custom
      script: check_database.sh
```

### Circuit Breaker Configuration

```yaml
circuit_breaker:
  failure_threshold: 5
  success_threshold: 2
  timeout: 60s
  half_open_requests: 3
  
  failure_conditions:
    - status_codes: [500, 502, 503, 504]
    - timeout: 10s
    - connection_refused: true
```

---

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant Gateway
    participant Auth Service
    participant Service
    participant Token Store

    User->>Client: Login Credentials
    Client->>Gateway: POST /auth/login
    Gateway->>Auth Service: Validate Credentials
    Auth Service->>Token Store: Check User
    Token Store-->>Auth Service: User Data
    Auth Service->>Auth Service: Generate JWT
    Auth Service->>Token Store: Store Refresh Token
    Auth Service-->>Gateway: JWT + Refresh Token
    Gateway-->>Client: Auth Response
    Client->>Client: Store Tokens
    
    Note over Client,Service: Subsequent Requests
    
    Client->>Gateway: API Request + JWT
    Gateway->>Gateway: Validate JWT
    Gateway->>Service: Forward Request
    Service-->>Gateway: Response
    Gateway-->>Client: API Response
```

### Security Layers

#### 1. Network Security
```yaml
network:
  firewall_rules:
    - allow: 80, 443 from: 0.0.0.0/0
    - allow: 3000-3010 from: 10.0.0.0/8
    - deny: all from: 0.0.0.0/0
  
  ssl_configuration:
    protocols: [TLSv1.2, TLSv1.3]
    ciphers: ECDHE-RSA-AES256-GCM-SHA512
    hsts: max-age=31536000; includeSubDomains
```

#### 2. Application Security
```yaml
application:
  authentication:
    type: JWT
    algorithm: RS256
    expiry: 1h
    refresh_expiry: 7d
  
  authorization:
    type: RBAC
    roles: [admin, user, guest]
    permissions:
      admin: [read, write, delete, admin]
      user: [read, write]
      guest: [read]
  
  rate_limiting:
    api: 100/minute
    websocket: 50/minute
    admin: 20/minute
```

#### 3. Data Security
```yaml
data:
  encryption:
    at_rest: AES-256
    in_transit: TLS 1.3
    key_management: AWS KMS
  
  pii_handling:
    anonymization: true
    retention: 90d
    deletion: automated
  
  compliance:
    - GDPR
    - CCPA
    - PCI-DSS
```

---

## Deployment Architecture

### Systemd Service Configuration

#### Main API Server
```ini
[Unit]
Description=Walmart Grocery API Server
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=walmart-grocery
Group=walmart-grocery
WorkingDirectory=/opt/walmart-grocery
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node dist/api/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

#### Service Health Monitoring
```bash
#!/bin/bash
# /usr/local/bin/walmart-health-check.sh

SERVICES=("walmart-api-server" "walmart-pricing" "walmart-nlp-queue")

for service in "${SERVICES[@]}"; do
    if ! systemctl is-active --quiet "$service"; then
        echo "Service $service is not running. Attempting restart..."
        systemctl restart "$service"
        
        # Send alert
        curl -X POST https://alerts.example.com/webhook \
            -H "Content-Type: application/json" \
            -d "{\"service\": \"$service\", \"status\": \"restarted\"}"
    fi
done
```

### Nginx Configuration

```nginx
# Load balancing configuration
upstream walmart_api {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
    keepalive 32;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

server {
    listen 443 ssl http2;
    server_name api.walmart-grocery.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/walmart-grocery.crt;
    ssl_certificate_key /etc/ssl/private/walmart-grocery.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_conn conn_limit 50;
        
        proxy_pass http://walmart_api/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/api/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  api-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  pricing-service:
    build:
      context: ./src/microservices/pricing-service
    ports:
      - "3007:3007"
    environment:
      - SERVICE_NAME=walmart-pricing
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  nlp-service:
    build:
      context: ./src/microservices/nlp-service
    ports:
      - "3008:3008"
    environment:
      - SERVICE_NAME=walmart-nlp
      - REDIS_URL=redis://redis:6379
      - OLLAMA_URL=http://ollama:11434
    depends_on:
      - redis
      - ollama
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  redis_data:
  ollama_data:
```

---

## Configuration Management

### Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=sqlite:///var/lib/walmart-grocery/data.db
REDIS_URL=redis://localhost:6379

# Services
SERVICE_DISCOVERY_URL=redis://localhost:6379
OLLAMA_URL=http://localhost:11434
BRIGHTDATA_API_KEY=your_api_key_here

# Security
JWT_SECRET=your_jwt_secret_here
API_KEY=your_api_key_here
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
SENTRY_DSN=https://sentry.io/your-dsn
LOG_LEVEL=info
METRICS_PORT=9090

# Features
ENABLE_CACHE_WARMER=true
ENABLE_WEBSOCKET=true
ENABLE_DEAL_ENGINE=true
```

### Service Configuration

```typescript
// config/services.config.ts
export const SERVICE_CONFIG = {
  'walmart-pricing': {
    host: process.env.PRICING_HOST || 'localhost',
    port: parseInt(process.env.PRICING_PORT || '3007'),
    protocol: 'http',
    health_endpoint: '/health',
    timeout: 10000,
    retries: 3,
    circuit_breaker: {
      failure_threshold: 5,
      reset_timeout: 60000
    },
    load_balancing: {
      strategy: 'least_connections',
      sticky_sessions: false
    },
    scaling: {
      min_instances: 1,
      max_instances: 5,
      scale_up_threshold: 80,
      scale_down_threshold: 20
    }
  }
};
```

---

## Monitoring & Observability

### Metrics Collection

```typescript
// Prometheus metrics
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const metrics = {
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  httpRequestTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  activeConnections: new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    labelNames: ['service']
  }),
  
  cacheHitRate: new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate percentage',
    labelNames: ['cache_type']
  })
};
```

### Logging Configuration

```typescript
// Winston logger configuration
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME,
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.File({ 
      filename: '/var/log/walmart-grocery/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/var/log/walmart-grocery/combined.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### Health Check Endpoints

```typescript
// Health check implementation
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      memory: checkMemory(),
      disk: checkDisk()
    }
  };
  
  const isHealthy = Object.values(health.checks)
    .every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Distributed Tracing

```yaml
# Jaeger configuration
tracing:
  enabled: true
  service_name: walmart-grocery
  sampler:
    type: probabilistic
    param: 0.1
  reporter:
    endpoint: http://jaeger:14268/api/traces
  headers:
    - X-Request-ID
    - X-User-ID
    - X-Session-ID
```

---

## Developer Guide

### Getting Started

#### Prerequisites
```bash
# System requirements
- Node.js 20.x or higher
- Redis 7.x
- SQLite 3.x
- Python 3.9+ (for Ollama)
- 8GB RAM minimum
- 20GB disk space
```

#### Installation
```bash
# Clone repository
git clone https://github.com/walmart/grocery-agent.git
cd grocery-agent

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Initialize database
npm run db:migrate
npm run db:seed

# Start development services
npm run dev:services

# Start main application
npm run dev
```

### Development Workflow

#### 1. Local Development
```bash
# Start all services in development mode
npm run dev:all

# Start specific service
npm run dev:pricing
npm run dev:nlp

# Run tests
npm test
npm run test:integration
npm run test:e2e

# Linting and formatting
npm run lint
npm run format
```

#### 2. Service Development
```typescript
// Creating a new service
import { ServiceBase } from '@/microservices/base';

export class MyNewService extends ServiceBase {
  constructor() {
    super({
      name: 'my-new-service',
      port: 3011,
      version: '1.0.0'
    });
  }
  
  protected setupRoutes(): void {
    this.app.get('/api/my-endpoint', this.handleRequest);
  }
  
  private handleRequest = async (req, res) => {
    // Implementation
  };
}
```

#### 3. Adding New Endpoints
```typescript
// In router file
export const myRouter = router({
  myEndpoint: publicProcedure
    .input(z.object({
      param: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      // Implementation
      return { success: true };
    })
});
```

### Testing Strategy

#### Unit Tests
```typescript
// service.test.ts
describe('PricingService', () => {
  let service: PricingService;
  
  beforeEach(() => {
    service = new PricingService();
  });
  
  it('should fetch current price', async () => {
    const price = await service.getPrice('product-123');
    expect(price).toBeDefined();
    expect(price.amount).toBeGreaterThan(0);
  });
});
```

#### Integration Tests
```typescript
// integration.test.ts
describe('Service Integration', () => {
  it('should process end-to-end request', async () => {
    const response = await request(app)
      .post('/api/process')
      .send({ input: 'I need milk' })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.groceryList).toBeDefined();
  });
});
```

#### Load Testing
```bash
# Using k6 for load testing
k6 run scripts/load-test.js

# Using Apache Bench
ab -n 1000 -c 100 http://localhost:3000/api/health
```

### Code Organization

```
src/
├── api/
│   ├── routes/          # API route handlers
│   ├── services/         # Business logic services
│   ├── middleware/       # Express middleware
│   └── websocket/        # WebSocket handlers
├── microservices/
│   ├── base/            # Base service classes
│   ├── discovery/       # Service discovery
│   ├── nlp-service/     # NLP microservice
│   ├── pricing-service/ # Pricing microservice
│   └── config/          # Service configurations
├── database/
│   ├── repositories/    # Data access layer
│   ├── migrations/      # Database migrations
│   └── models/          # Data models
├── core/
│   ├── cache/           # Caching logic
│   ├── queue/           # Queue management
│   └── monitoring/      # Monitoring utilities
└── utils/
    ├── logger/          # Logging utilities
    ├── errors/          # Error handling
    └── validation/      # Input validation
```

### Best Practices

#### 1. Error Handling
```typescript
// Consistent error handling
class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

// Usage
throw new ServiceError(
  'Product not found',
  'PRODUCT_NOT_FOUND',
  404
);
```

#### 2. Logging
```typescript
// Structured logging
logger.info('Request processed', {
  requestId: req.id,
  userId: req.user?.id,
  action: 'process_grocery_input',
  duration: Date.now() - startTime,
  metadata: {
    itemCount: items.length,
    total: calculateTotal(items)
  }
});
```

#### 3. Caching
```typescript
// Cache with TTL
const cacheKey = `price:${productId}`;
const cached = await cache.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const price = await fetchPrice(productId);
await cache.setex(cacheKey, 300, JSON.stringify(price));
return price;
```

---

## Operations Guide

### Service Management

#### Starting Services
```bash
# Start all services
systemctl start walmart-grocery.target

# Start individual service
systemctl start walmart-api-server
systemctl start walmart-pricing
systemctl start walmart-nlp-queue

# Check status
systemctl status walmart-grocery.target
```

#### Stopping Services
```bash
# Graceful shutdown
systemctl stop walmart-grocery.target

# Force stop (emergency)
systemctl kill walmart-api-server
```

#### Restarting Services
```bash
# Rolling restart
for service in walmart-api-server walmart-pricing walmart-nlp-queue; do
    systemctl restart $service
    sleep 5
done

# Full restart
systemctl restart walmart-grocery.target
```

### Health Monitoring

#### Health Check Script
```bash
#!/bin/bash
# /usr/local/bin/check-walmart-health.sh

SERVICES=(
    "http://localhost:3000/health"
    "http://localhost:3007/health"
    "http://localhost:3008/health"
)

for endpoint in "${SERVICES[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $endpoint)
    if [ $response -ne 200 ]; then
        echo "ALERT: Service unhealthy - $endpoint"
        # Send alert notification
    fi
done
```

#### Monitoring Dashboard
```bash
# Access Grafana dashboard
http://localhost:3001

# Access Prometheus metrics
http://localhost:9090

# View logs
journalctl -u walmart-api-server -f
tail -f /var/log/walmart-grocery/combined.log
```

### Backup & Recovery

#### Database Backup
```bash
#!/bin/bash
# Daily backup script

BACKUP_DIR="/backup/walmart-grocery"
DATE=$(date +%Y%m%d_%H%M%S)

# SQLite backup
sqlite3 /var/lib/walmart-grocery/data.db ".backup $BACKUP_DIR/data_$DATE.db"

# Redis backup
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# Compress and encrypt
tar -czf - $BACKUP_DIR/*_$DATE.* | \
    openssl enc -aes-256-cbc -salt -out $BACKUP_DIR/backup_$DATE.tar.gz.enc
```

#### Recovery Procedure
```bash
# Restore SQLite
sqlite3 /var/lib/walmart-grocery/data.db < backup.sql

# Restore Redis
redis-cli --pipe < redis_backup.txt

# Restart services
systemctl restart walmart-grocery.target
```

### Scaling Procedures

#### Manual Scaling
```bash
# Scale up pricing service
curl -X POST http://localhost:8000/services/walmart-pricing/scale \
    -H "Content-Type: application/json" \
    -d '{"instances": 3}'

# Verify scaling
curl http://localhost:8000/services | jq '.data.services["walmart-pricing"]'
```

#### Auto-Scaling Rules
```yaml
autoscaling:
  metrics:
    - type: cpu
      target: 70
      scale_up_threshold: 80
      scale_down_threshold: 20
    - type: memory
      target: 80
      scale_up_threshold: 90
      scale_down_threshold: 30
    - type: request_rate
      target: 100
      scale_up_threshold: 150
      scale_down_threshold: 50
  
  policies:
    scale_up:
      increment: 1
      cooldown: 300s
      max_instances: 10
    scale_down:
      decrement: 1
      cooldown: 600s
      min_instances: 1
```

### Incident Response

#### Incident Playbook
```markdown
1. **Detection**
   - Alert received from monitoring system
   - User reports issue
   - Automated health check failure

2. **Triage**
   - Check service health endpoints
   - Review error logs
   - Check system resources

3. **Mitigation**
   - Restart affected services
   - Scale up if load-related
   - Enable circuit breakers
   - Switch to backup services

4. **Resolution**
   - Identify root cause
   - Apply permanent fix
   - Update configuration
   - Deploy patch

5. **Post-Mortem**
   - Document incident timeline
   - Identify improvement areas
   - Update runbooks
   - Schedule follow-up actions
```

#### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| High Memory Usage | Service OOM kills | Increase memory limits, check for leaks |
| Slow Response Times | >5s API latency | Scale services, optimize queries, check cache |
| Connection Refused | 502/503 errors | Check service health, restart if needed |
| Database Lock | Timeout errors | Kill long-running queries, optimize indexes |
| Cache Miss Storm | Redis overload | Implement cache warming, use cache locks |

---

## Performance Tuning

### Database Optimization

#### Indexes
```sql
-- Critical indexes for performance
CREATE INDEX idx_products_walmart_id ON products(walmart_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_prices_product_date ON prices(product_id, created_at);
CREATE INDEX idx_lists_user_created ON grocery_lists(user_id, created_at);
CREATE INDEX idx_items_list_product ON list_items(list_id, product_id);
```

#### Query Optimization
```typescript
// Use query builder for complex queries
const products = await db
  .select()
  .from('products')
  .leftJoin('prices', 'products.id', 'prices.product_id')
  .where('products.category_id', categoryId)
  .andWhere('prices.current', true)
  .orderBy('prices.amount', 'asc')
  .limit(20);
```

### Caching Strategy

#### Multi-Layer Caching
```typescript
class CacheManager {
  private l1Cache = new Map(); // In-memory
  private l2Cache: Redis;       // Redis
  private l3Cache: CDN;         // CDN/Edge
  
  async get(key: string): Promise<any> {
    // Check L1 (fastest)
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key);
    }
    
    // Check L2
    const l2Value = await this.l2Cache.get(key);
    if (l2Value) {
      this.l1Cache.set(key, l2Value);
      return l2Value;
    }
    
    // Check L3
    const l3Value = await this.l3Cache.get(key);
    if (l3Value) {
      await this.l2Cache.set(key, l3Value);
      this.l1Cache.set(key, l3Value);
      return l3Value;
    }
    
    return null;
  }
}
```

### Connection Pooling

```typescript
// Database connection pool
const pool = new Pool({
  min: 2,
  max: 10,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection pool
const redis = new Redis.Cluster(
  [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 }
  ],
  {
    redisOptions: {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectionPoolSize: 10
    }
  }
);
```

### Memory Management

```typescript
// Garbage collection optimization
if (global.gc) {
  setInterval(() => {
    const memBefore = process.memoryUsage().heapUsed;
    global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    
    logger.debug('GC completed', {
      freed: (memBefore - memAfter) / 1024 / 1024,
      heapUsed: memAfter / 1024 / 1024
    });
  }, 60000); // Every minute
}

// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    logger.warn('High memory usage detected', {
      heapUsed: usage.heapUsed / 1024 / 1024,
      heapTotal: usage.heapTotal / 1024 / 1024,
      rss: usage.rss / 1024 / 1024
    });
  }
}, 30000); // Every 30 seconds
```

---

## Troubleshooting Guide

### Common Problems

#### 1. Service Won't Start
```bash
# Check logs
journalctl -u walmart-api-server -n 100

# Common causes:
- Port already in use: lsof -i :3000
- Missing environment variables: env | grep WALMART
- Database connection failed: nc -zv localhost 5432
- Redis not running: redis-cli ping
```

#### 2. High Latency
```bash
# Check service metrics
curl http://localhost:3000/metrics | grep response_time

# Analyze slow queries
sqlite3 data.db "EXPLAIN QUERY PLAN SELECT ..."

# Check cache hit rate
redis-cli INFO stats | grep hit
```

#### 3. Memory Leaks
```bash
# Monitor memory usage
watch -n 1 'ps aux | grep node | grep -v grep'

# Generate heap dump
kill -USR2 <PID>
node --inspect process_heap_dump.js

# Analyze with Chrome DevTools
```

#### 4. WebSocket Disconnections
```javascript
// Debug WebSocket issues
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${code} - ${reason}`);
  // Implement reconnection logic
});
```

### Debugging Tools

#### 1. Request Tracing
```bash
# Enable debug logging
DEBUG=* npm start

# Trace specific request
curl -H "X-Debug: true" http://localhost:3000/api/endpoint
```

#### 2. Performance Profiling
```bash
# CPU profiling
node --cpu-prof app.js

# Analyze with Chrome DevTools
node --inspect app.js
```

#### 3. Network Analysis
```bash
# Monitor network traffic
tcpdump -i any -w capture.pcap port 3000

# Analyze with Wireshark
wireshark capture.pcap
```

### Log Analysis

#### Log Aggregation
```bash
# Search logs for errors
grep ERROR /var/log/walmart-grocery/*.log

# Count errors by type
awk '/ERROR/ {print $5}' combined.log | sort | uniq -c

# Real-time log monitoring
tail -f /var/log/walmart-grocery/*.log | grep -E "ERROR|WARN"
```

#### Log Patterns
```regex
# Error pattern
\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]\s+\[ERROR\]\s+(.+):\s+(.+)

# Request pattern
\[REQUEST\]\s+(\w+)\s+(.+)\s+(\d{3})\s+(\d+)ms

# Performance pattern
\[PERFORMANCE\]\s+(.+)\s+took\s+(\d+)ms
```

---

## API Reference

### Complete REST API Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token
- `POST /auth/register` - User registration
- `GET /auth/verify` - Verify token

#### Grocery Management
- `GET /api/walmart-grocery/lists` - Get user lists
- `POST /api/walmart-grocery/lists` - Create list
- `PUT /api/walmart-grocery/lists/:id` - Update list
- `DELETE /api/walmart-grocery/lists/:id` - Delete list
- `POST /api/walmart-grocery/lists/:id/items` - Add items
- `DELETE /api/walmart-grocery/lists/:id/items/:itemId` - Remove item
- `POST /api/walmart-grocery/lists/:id/share` - Share list

#### Product Operations
- `GET /api/walmart-grocery/products/:id` - Get product details
- `GET /api/walmart-grocery/products/search` - Search products
- `GET /api/walmart-grocery/products/:id/reviews` - Get reviews
- `GET /api/walmart-grocery/products/:id/alternatives` - Get alternatives
- `GET /api/walmart-grocery/products/trending` - Trending products

#### Pricing & Deals
- `GET /api/walmart-grocery/prices/:productId` - Current price
- `GET /api/walmart-grocery/prices/:productId/history` - Price history
- `POST /api/walmart-grocery/prices/track` - Track price
- `GET /api/walmart-grocery/deals` - Current deals
- `GET /api/walmart-grocery/deals/:productId` - Product deals
- `POST /api/walmart-grocery/deals/alert` - Set deal alert

#### Orders
- `GET /api/walmart-grocery/orders` - Get user orders
- `GET /api/walmart-grocery/orders/:id` - Order details
- `POST /api/walmart-grocery/orders` - Create order
- `PUT /api/walmart-grocery/orders/:id/status` - Update status
- `GET /api/walmart-grocery/orders/:id/track` - Track order
- `POST /api/walmart-grocery/orders/:id/cancel` - Cancel order

#### User Preferences
- `GET /api/walmart-grocery/preferences` - Get preferences
- `PUT /api/walmart-grocery/preferences` - Update preferences
- `GET /api/walmart-grocery/history` - Purchase history
- `GET /api/walmart-grocery/recommendations` - Get recommendations

#### Admin Endpoints
- `GET /admin/health` - System health
- `GET /admin/metrics` - System metrics
- `POST /admin/cache/warm` - Warm cache
- `DELETE /admin/cache/invalidate` - Invalidate cache
- `GET /admin/services` - Service status
- `POST /admin/services/:name/scale` - Scale service

### WebSocket Events Reference

#### Client -> Server
```typescript
// Subscribe to events
{
  type: 'subscribe',
  events: ['grocery', 'prices', 'deals', 'orders'],
  userId: 'user-123'
}

// Unsubscribe
{
  type: 'unsubscribe',
  events: ['prices']
}

// Ping
{
  type: 'ping'
}
```

#### Server -> Client
```typescript
// Connection established
{
  type: 'connection_established',
  clientId: 'ws-client-123',
  timestamp: 1234567890
}

// Grocery update
{
  type: 'grocery_update',
  data: {
    listId: 'list-123',
    items: [],
    total: 45.67
  }
}

// Price change
{
  type: 'price_change',
  data: {
    productId: 'prod-123',
    oldPrice: 4.99,
    newPrice: 3.99
  }
}

// Deal alert
{
  type: 'deal_alert',
  data: {
    dealId: 'deal-123',
    products: [],
    savings: 10.00
  }
}

// Order status
{
  type: 'order_status',
  data: {
    orderId: 'order-123',
    status: 'out_for_delivery'
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|------------|
| AUTH_001 | Invalid credentials | 401 |
| AUTH_002 | Token expired | 401 |
| AUTH_003 | Insufficient permissions | 403 |
| PRODUCT_001 | Product not found | 404 |
| PRODUCT_002 | Invalid product ID | 400 |
| ORDER_001 | Order not found | 404 |
| ORDER_002 | Cannot cancel order | 400 |
| SYSTEM_001 | Internal server error | 500 |
| SYSTEM_002 | Service unavailable | 503 |
| RATE_001 | Rate limit exceeded | 429 |

---

## Conclusion

The Walmart Grocery Agent microservices architecture provides a robust, scalable, and maintainable foundation for intelligent grocery shopping assistance. The system leverages modern cloud-native patterns including service mesh, circuit breakers, and comprehensive observability to ensure high availability and optimal performance.

### Key Achievements
- **Modular Architecture**: Clean separation of concerns across 6 specialized microservices
- **High Performance**: Sub-100ms response times with intelligent caching
- **Scalability**: Auto-scaling based on load with support for 1000+ concurrent users
- **Resilience**: Circuit breakers and health monitoring for 99.9% uptime
- **Developer Experience**: Comprehensive documentation, testing, and debugging tools

### Future Enhancements
- Kubernetes deployment with Helm charts
- GraphQL API gateway
- Machine learning pipeline for personalization
- Multi-region deployment
- Advanced analytics dashboard
- Mobile SDK development

### Support & Resources
- **Documentation**: https://docs.walmart-grocery.com
- **API Reference**: https://api.walmart-grocery.com/docs
- **Support**: support@walmart-grocery.com
- **GitHub**: https://github.com/walmart/grocery-agent

---

*Version: 1.0.0 | Last Updated: August 6, 2025 | Phase 8 Task 3 Completion*