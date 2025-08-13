# CrewAI Team / Walmart Grocery Agent - API Documentation

**Version:** v2.3.0  
**Branch:** main-consolidated  
**Last Updated:** August 7, 2025  
**Node.js:** 20.11+  
**TypeScript:** 5.3+

## Project Overview

The CrewAI Team project is an enterprise AI agent framework with a specialized Walmart Grocery Agent system. The project features adaptive email processing, real-time grocery NLP with Qwen3:0.6b model integration, and comprehensive business intelligence capabilities.

### Current Status

✅ **Operational Features:**
- 143,850 unique emails consolidated with chain analysis
- Business Intelligence Dashboard fully integrated
- Walmart NLP integration with 87.5% intent detection accuracy
- Real-time WebSocket communication
- Comprehensive security middleware (CSRF, rate limiting, auth)
- ChromaDB resilience improvements
- Performance optimizations

⚠️ **Development Status:**
- Email LLM processing: Framework ready, pending full production integration
- Microservices architecture: Fully operational across ports 3005-3010

## Architecture Overview

### Core Technology Stack

- **Frontend:** React 18.2.0 + TypeScript 5.0 + Vite 7.0
- **Backend:** Node.js 20.11 + Express 4.18.2
- **API Layer:** tRPC 10.45 (Type-safe APIs)
- **Database:** SQLite with better-sqlite3 (app.db, walmart_grocery.db, crewai_enhanced.db)
- **LLM Integration:** Ollama (Qwen3:0.6b for NLP, Llama3.2:3b for emails)
- **Vector Store:** ChromaDB 1.7.3 (with ResilientVectorStore wrapper)
- **Queue Management:** Redis + BullMQ 5.56
- **WebSocket:** Native WebSocket + Socket.IO 4.7
- **Security:** JWT, CSRF tokens, rate limiting, comprehensive middleware

### Microservices Architecture

| Service | Port | Description | Status |
|---------|------|-------------|---------|
| Main API Server | 3000 | Core application server | ✅ Active |
| Grocery Service | 3005 | Core grocery functionality | ✅ Active |
| Cache Warmer | 3006 | Performance optimization | ✅ Active |
| Pricing Service | 3007 | Product pricing logic | ✅ Active |
| NLP Service | 3008 | Qwen3:0.6b model processing | ✅ Active |
| Deal Engine | 3009 | Deal processing | ✅ Active |
| Memory Monitor | 3010 | System monitoring | ✅ Active |
| WebSocket Gateway | 8080 | Real-time communication | ✅ Active |

## API Documentation

### Base URLs

- **Development:** `http://localhost:3000`
- **WebSocket:** `ws://localhost:8080` (Walmart specific)
- **tRPC WebSocket:** `ws://localhost:3000/trpc-ws`

### Authentication

#### JWT Token Authentication
```typescript
// Headers required for authenticated endpoints
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

#### CSRF Protection
All state-changing operations require CSRF tokens:

```bash
# Get CSRF token
GET /api/csrf-token
Response: { csrfToken: "abc123..." }

# Use token in subsequent requests
POST /api/protected-endpoint
Headers: {
  "X-CSRF-Token": "abc123...",
  "Content-Type": "application/json"
}
```

### Core API Endpoints

#### Health & Status
```bash
# System health check
GET /health
Response: {
  "status": "healthy|degraded",
  "services": {
    "api": "running",
    "ollama": "connected|timeout|error",
    "chromadb": "connected|timeout|error", 
    "database": "connected|error"
  },
  "timestamp": "2025-08-07T...",
  "responseTime": 125
}

# Credential health check
GET /api/health/credentials
Response: {
  "status": "healthy",
  "credentials": { "initialized": true }
}
```

#### Rate Limiting Status (Admin Only)
```bash
GET /api/rate-limit-status
Headers: { "Authorization": "Bearer <admin_token>" }
Response: {
  "requests": 45,
  "limit": 100,
  "remaining": 55,
  "reset": 1693920000000
}
```

### tRPC API Routes

#### Authentication Router (`/trpc/auth.*`)
```typescript
// Login
auth.login.mutate({
  email: "user@example.com",
  password: "password"
})

// Register
auth.register.mutate({
  email: "user@example.com", 
  password: "password",
  name: "User Name"
})

// Verify session
auth.verify.query()
```

#### Walmart Grocery Router (`/trpc/walmartGrocery.*`)

##### Product Search
```typescript
walmartGrocery.searchProducts.mutate({
  query: "organic milk",
  category: "dairy",
  minPrice: 2.00,
  maxPrice: 8.00,
  inStock: true,
  limit: 20
})

// Response
{
  success: true,
  products: [
    {
      id: "walmart-123",
      name: "Organic Whole Milk",
      price: { regular: 4.98, currency: "USD" },
      availability: { inStock: true },
      images: [{ url: "...", type: "primary" }]
    }
  ],
  analysis: "AI-generated recommendations...",
  metadata: { totalResults: 15, searchId: "search-123" }
}
```

##### Process Grocery Input (NLP)
```typescript
walmartGrocery.processGroceryInput.mutate({
  conversationId: "conv-123",
  userId: "user-456",
  input: "I need milk, bread, and 2 pounds of chicken",
  location: {
    zipCode: "90210",
    city: "Beverly Hills", 
    state: "CA"
  }
})

// Response
{
  success: true,
  response: "I found these items for your list...",
  groceryList: {
    items: [
      { name: "Milk", quantity: 1, price: 3.48 },
      { name: "Bread", quantity: 1, price: 2.50 },
      { name: "Chicken Breast", quantity: 2, price: 8.99 }
    ],
    subtotal: 14.97,
    estimatedTax: 1.20,
    total: 16.17,
    itemCount: 3,
    deliveryEligible: false
  },
  suggestions: ["Add $18.83 more for free delivery"]
}
```

##### List Management
```typescript
// Get user's grocery lists
walmartGrocery.getLists.query({ userId: "user-123" })

// Create new list
walmartGrocery.createList.mutate({
  userId: "user-123",
  name: "Weekly Shopping",
  description: "Regular weekly groceries"
})

// Add items to list
walmartGrocery.addItemToList.mutate({
  listId: "list-456",
  items: [
    { productId: "product-789", quantity: 2, notes: "Organic preferred" }
  ]
})
```

##### Real-time Subscriptions
```typescript
// Subscribe to Walmart updates
walmartGrocery.onUpdate.subscription({
  events: ["grocery", "recommendations", "totals"],
  userId: "user-123"
})

// Event types received:
{
  type: "grocery_input_processed",
  data: { conversationId, userId, listTotal, itemCount, timestamp }
}
```

#### Email Management Router (`/trpc/emails.*`)
```typescript
// Get analyzed emails
emails.getAnalyzedEmails.query({
  limit: 50,
  offset: 0,
  filters: { hasBusinessIntelligence: true }
})

// Get email chains
emails.getEmailChains.query({
  limit: 20,
  sortBy: "completeness_score"
})

// Get business intelligence
emails.getBusinessIntelligence.query({
  dateRange: { start: "2025-01-01", end: "2025-08-07" },
  categories: ["deals", "partnerships", "negotiations"]
})
```

### REST API Endpoints

#### NLP Processing (`/api/nlp/*`)

##### Process Natural Language
```bash
POST /api/nlp/process
Content-Type: application/json

{
  "text": "I need 2 gallons of milk and some bread",
  "userId": "user-123",
  "sessionId": "session-456"
}

# Response
{
  "success": true,
  "intent": "add_items",
  "confidence": 0.89,
  "items": ["milk", "bread"],
  "quantities": [2, 1],
  "action": "add_to_list",
  "products": [
    {
      "id": "walmart-milk-1",
      "name": "Great Value Whole Milk",
      "brand": "Great Value",
      "price": 3.48,
      "inStock": true
    }
  ],
  "timestamp": "2025-08-07T..."
}
```

##### NLP History
```bash
GET /api/nlp/history?userId=user-123&limit=10

# Response
{
  "success": true,
  "history": [
    {
      "query": "I need milk",
      "intent": "add_items", 
      "confidence": 0.92,
      "entities": { "items": ["milk"], "quantities": [1] },
      "timestamp": "2025-08-07T..."
    }
  ]
}
```

##### NLP Health Check
```bash
GET /api/nlp/health

# Response
{
  "success": true,
  "status": "healthy",
  "model": "qwen3:0.6b",
  "ollamaConnected": true,
  "timestamp": "2025-08-07T..."
}
```

#### WebSocket Monitoring (`/api/websocket/*`)
```bash
# Get active connections
GET /api/websocket/connections

# WebSocket health status  
GET /api/websocket/health
```

#### Email Analysis (`/api/email-analysis/*`)
```bash
# Trigger email analysis
POST /api/email-analysis/analyze
{
  "emailIds": ["email-1", "email-2"],
  "analysisType": "business_intelligence"
}

# Get analysis results
GET /api/email-analysis/results/batch-123
```

#### Metrics & Monitoring (`/api/metrics/*`)
```bash
# System performance metrics
GET /api/metrics/performance

# Rate limiting metrics
GET /api/metrics/rate-limits

# Database performance
GET /api/metrics/database
```

## WebSocket APIs

### Walmart WebSocket (`ws://localhost:8080/walmart`)

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080/walmart');

ws.on('connect', () => {
  console.log('Connected to Walmart WebSocket');
});
```

#### Event Types
```javascript
// NLP Processing Events
ws.on('nlp_processing_start', (data) => {
  // { sessionId, text, timestamp }
});

ws.on('nlp_result', (data) => {
  // { sessionId, intent, confidence, items, products }
});

ws.on('product_matches', (data) => {
  // { sessionId, products: [...] }
});

// Grocery List Events  
ws.on('grocery_input_processed', (data) => {
  // { conversationId, userId, listTotal, itemCount }
});

ws.on('totals_calculated', (data) => {
  // { itemCount, subtotal, total, savings }
});
```

### tRPC WebSocket (`ws://localhost:3000/trpc-ws`)

Used for tRPC subscriptions and real-time data synchronization.

## Database Schema

### Primary Databases

#### app.db (Main Application)
- `emails` - Email storage and analysis results
- `email_chains` - Email chain analysis with completeness scoring  
- `conversations` - Agent conversations
- `business_intelligence` - Extracted business data
- `users` - User accounts and authentication

#### walmart_grocery.db (Walmart Specific)
- `grocery_lists` - User grocery lists with due_date support
- `grocery_items` - Individual grocery items
- `walmart_products` - Product catalog cache
- `nlp_intents` - NLP processing history and learning data
- `schema_migrations` - Database version tracking

#### crewai_enhanced.db (Enhanced Features)
- Advanced analytics and ML model data
- Agent learning and performance metrics

### Recent Schema Updates

#### Migration 016 - Due Date Support
```sql
-- Added to grocery_lists table
ALTER TABLE grocery_lists ADD COLUMN due_date DATETIME DEFAULT NULL;

-- Performance indexes
CREATE INDEX idx_grocery_lists_due_date ON grocery_lists(due_date);
CREATE INDEX idx_grocery_lists_user_due_date ON grocery_lists(user_id, due_date);
```

## Setup and Installation

### Prerequisites
- Node.js 20.11+
- Python 3.9+ (for Ollama/ML services)
- SQLite 3.35+
- Redis (optional, falls back to memory)
- Ollama with Qwen3:0.6b model

### Development Setup

```bash
# Clone and install
git clone <repository>
cd CrewAI_Team
npm install

# Environment setup
cp .env.example .env
# Edit .env with your configuration

# Database initialization
npm run init:db
npm run migrate

# Install Ollama and models
# Follow Ollama installation guide
ollama pull qwen:0.6b
ollama pull llama3.2:3b

# Start development servers
npm run dev              # Full stack (frontend + backend)
npm run dev-server      # Backend + Walmart frontend
npm run dev:server      # Backend only
```

### Production Build

```bash
# Optimized production build
npm run build:production:fast

# Docker build (if needed)
npm run docker:build
npm run docker:run
```

### Service Management

```bash
# Local service management
./local-services.sh start    # Start all services
./local-services.sh health   # Check service health
./local-services.sh stop     # Stop all services

# Individual service management
npm run start:pricing-service
npm run dev:pricing-service
```

## Troubleshooting Guide

### Recent Fixes Implemented

#### CSRF Middleware Ordering Fix
**Issue:** CSRF token validation failing due to middleware order
**Solution:** Moved `cookieParser()` to early position in middleware stack

```typescript
// FIXED: Cookie parser now comes before CSRF validation
app.use(cookieParser()); // ← Moved to position 81
// ... other middleware
app.use(csrfValidator([...])); // ← Now works correctly
```

#### ChromaDB Connection Resilience  
**Issue:** ChromaDB connection failures causing system instability
**Solution:** Implemented ResilientVectorStore with fallback mechanisms

```typescript
// Auto-retry with exponential backoff
// Graceful degradation when ChromaDB unavailable
// Health checks with timeout protection
```

#### WebSocket Error Handling
**Issue:** WebSocket infinite loops and connection state issues
**Solution:** Enhanced connection state management and error boundaries

```typescript
// Proper connection lifecycle management
// Cleanup on connection failures
// Rate limiting for WebSocket connections
```

#### Performance Optimizations
**Issue:** High memory usage and slow response times
**Solution:** Multiple performance enhancements

- Response compression (60-70% bandwidth reduction)
- Database query optimization with indexes
- Connection pooling and reuse
- Memory optimization flags for Node.js

### Common Issues & Solutions

#### 1. CSRF Token Validation Errors
```bash
# Symptoms
POST /api/... → 403 Forbidden: "CSRF token validation failed"

# Solution
# Ensure you fetch a CSRF token first:
GET /api/csrf-token
# Include token in subsequent requests:
POST /api/endpoint
Headers: { "X-CSRF-Token": "<token>" }
```

#### 2. Ollama Connection Issues
```bash
# Check Ollama status
ollama ps

# If no models running:
ollama serve
ollama pull qwen:0.6b

# Health check
curl http://localhost:11434/api/tags
```

#### 3. Database Connection Errors
```bash
# Check database files exist
ls -la data/
# Should show: app.db, walmart_grocery.db, crewai_enhanced.db

# Reinitialize if corrupted
npm run init:db
npm run migrate
```

#### 4. WebSocket Connection Failures
```bash
# Check WebSocket server is running
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:8080/walmart

# Expected: 101 Switching Protocols
```

#### 5. Port Conflicts
```bash
# Check for port conflicts
netstat -tulpn | grep :3000
netstat -tulpn | grep :8080

# Kill conflicting processes
sudo kill -9 <PID>
```

#### 6. Memory Issues
```bash
# Monitor memory usage
npm run monitor

# Use memory-optimized start
NODE_OPTIONS='--max-old-space-size=4096 --optimize-for-size' npm start
```

#### 7. ChromaDB Connection Issues
```bash
# Start ChromaDB manually (if needed)
docker run -p 8000:8000 chromadb/chroma:latest

# Health check
curl http://localhost:8000/api/v1/heartbeat
```

### Service Startup Troubleshooting

#### NLP Service (Port 3008) Issues
```bash
# Check Qwen model availability
ollama list | grep qwen

# Test NLP service directly
curl -X POST http://localhost:3008/process \
  -H "Content-Type: application/json" \
  -d '{"text":"I need milk"}'
```

#### Database Migration Issues
```bash
# Check migration status
npm run db:status

# Manual migration
sqlite3 data/walmart_grocery.db < src/database/migrations/016_add_due_date_column.sql

# Rollback if needed (backup first!)
npm run db:rollback
```

### Network & Configuration Issues

#### CORS Errors
```typescript
// Check CORS configuration in security headers
// Default allowed origins:
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", 
  "http://localhost:5174",
  "http://localhost:5175"
];
```

#### Environment Variables
```bash
# Required environment variables
VITE_API_BASE_URL=http://localhost:3000
NODE_ENV=development|production
CHROMA_BASE_URL=http://localhost:8000
OLLAMA_BASE_URL=http://localhost:11434
```

## Testing

### Test Suites Available

#### Unit Tests
```bash
npm run test:unit                    # Core unit tests
npm run test:ui                      # UI component tests  
npm run test:coverage                # With coverage report
```

#### Integration Tests
```bash
npm run test:integration             # API integration tests
npm run test:microservices          # Microservice integration
npm run test:microservices:parallel # Parallel execution
```

#### End-to-End Tests
```bash
npm run test:e2e                    # Full E2E test suite
npm run test:e2e:headed             # With browser UI
npm run test:e2e:walmart            # Walmart-specific tests
npm run test:walmart-comprehensive  # Comprehensive Walmart tests
```

#### Browser Compatibility Tests
```bash
npm run test:browser-compat         # All browsers
npm run test:browser-compat:chrome  # Chrome only
npm run test:browser-compat:firefox # Firefox only
```

#### Performance Tests
```bash
npm run benchmark:performance       # Performance benchmarks
npm run test:microservices:performance # Service performance
```

### Test Data & Validation

#### Database Testing
```bash
npm run db:admin                    # Database admin tools
npm run db:performance             # Performance analysis
npm run validate:fixes             # Validate recent fixes
```

#### NLP Model Testing
```bash
npm run test:nlp-intents           # Test intent detection
npm run test:nlp-search            # Test NLP search
npm run test:qwen3-simple          # Simple Qwen3 tests
```

## Configuration

### Environment Variables

#### Core Application
```bash
NODE_ENV=development|production
PORT=3000
VITE_PORT=5178

# API Configuration  
API_BASE_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000

# Database
DATABASE_PATH=./data/app.db
WALMART_DATABASE_PATH=./data/walmart_grocery.db

# External Services
OLLAMA_BASE_URL=http://localhost:11434
CHROMA_BASE_URL=http://localhost:8000
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=your-jwt-secret
CSRF_SECRET=your-csrf-secret

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

#### Microservices Configuration
```bash
# Service Ports
GROCERY_SERVICE_PORT=3005
CACHE_WARMER_PORT=3006
PRICING_SERVICE_PORT=3007
NLP_SERVICE_PORT=3008
DEAL_ENGINE_PORT=3009
MEMORY_MONITOR_PORT=3010
WEBSOCKET_PORT=8080

# Model Configuration
NLP_MODEL=qwen:0.6b
EMAIL_MODEL=llama3.2:3b
EMBEDDING_MODEL=llama3.2:3b
```

#### Performance Settings
```bash
# Node.js Memory
NODE_OPTIONS=--max-old-space-size=4096 --optimize-for-size

# Rate Limiting
API_RATE_LIMIT=100
AUTH_RATE_LIMIT=10
UPLOAD_RATE_LIMIT=5
WEBSOCKET_RATE_LIMIT=50

# Timeouts
API_TIMEOUT=30000
LLM_TIMEOUT=60000
WEBSOCKET_TIMEOUT=10000
```

## Deployment

### Production Build Process

```bash
# Full production build
npm run build:production

# Fast production build (optimized)
npm run build:production:fast

# Docker deployment
npm run docker:build
npm run docker:run
```

### Performance Optimizations

#### Implemented Optimizations (August 2025)

1. **Response Compression**
   - 60-70% bandwidth reduction
   - Gzip compression for JSON/text content
   - Threshold: 1KB minimum

2. **Database Optimizations**
   - Proper indexing on all query paths
   - Connection pooling and reuse
   - Query optimization with prepared statements

3. **Memory Management**
   - Node.js memory flags optimization
   - Garbage collection tuning
   - Resource cleanup on shutdown

4. **Caching Strategy**
   - RAG system caching for frequent queries
   - Product data caching with TTL
   - Conversation state caching

### Monitoring & Health Checks

#### Built-in Monitoring
```bash
# Performance monitoring
npm run monitor
npm run perf:report
npm run perf:analyze

# Service health monitoring  
./local-services.sh health
curl http://localhost:3000/health
```

#### Metrics Collection
- Request/response time tracking
- Error rate monitoring
- Memory usage tracking
- Database performance metrics
- WebSocket connection monitoring
- LLM processing metrics

### Production Deployment Checklist

#### Pre-deployment
- [ ] Run full test suite: `npm run test:all`
- [ ] Performance benchmarks: `npm run benchmark:performance`  
- [ ] Security audit: Check CSRF, rate limiting, CORS
- [ ] Database migration status: `npm run db:status`
- [ ] Environment variables configured
- [ ] SSL certificates installed (if applicable)

#### Post-deployment
- [ ] Health check endpoints responding
- [ ] WebSocket connections working
- [ ] NLP service responding (qwen:0.6b)
- [ ] Database migrations applied
- [ ] Monitoring systems active
- [ ] Error logging functional

### Security Considerations

#### Authentication & Authorization
- JWT token-based authentication
- Role-based access control (admin, user, agent)
- Protected routes with middleware

#### Data Protection
- CSRF token validation on state-changing operations
- Rate limiting on all endpoints
- Request size limits (10MB max)
- Input validation with Zod schemas

#### Infrastructure Security
- CORS configuration for allowed origins
- Security headers (helmet.js)
- SQL injection protection (prepared statements)
- XSS protection via input sanitization

---

## Support & Maintenance

### Recent Updates (August 7, 2025)

- **CSRF Security**: Fixed middleware ordering for proper token validation
- **ChromaDB Resilience**: Added fallback mechanisms for connection failures
- **Performance**: Implemented compression and caching optimizations  
- **WebSocket**: Enhanced error handling and connection management
- **NLP Integration**: Qwen3:0.6b model fully operational with 87.5% accuracy
- **Database**: Added due_date support to grocery lists with proper indexing

### Logging & Debugging

#### Log Levels
- `ERROR`: Critical failures requiring immediate attention
- `WARN`: Issues that don't stop operation but need monitoring
- `INFO`: General operational information
- `DEBUG`: Detailed debugging information (development only)

#### Key Log Categories
- `WALMART`: Walmart grocery agent operations
- `NLP_ROUTER`: Natural language processing 
- `WEBSOCKET`: WebSocket connection management
- `DATABASE`: Database operations and migrations
- `SECURITY`: Authentication, CSRF, rate limiting events

For additional support, check the project documentation in `/docs/` or examine specific service logs for detailed troubleshooting information.