# 🏗️ CrewAI Team - Simplified Architecture Documentation
## Actual System Boundaries & Data Flows - August 15, 2025

---

## 📋 ARCHITECTURE OVERVIEW

**Design Philosophy**: Honest documentation reflecting actual implementation, not aspirational architecture.

This document describes the **actual working system** as implemented, avoiding over-engineered descriptions and focusing on real service boundaries, data flows, and operational patterns.

---

## 🌐 SYSTEM TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────┐
│                     CrewAI Team System                         │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Frontend      │    │   Backend API    │    │  Database   │ │
│  │   (React)       │◄──►│   (Node.js)      │◄──►│  (SQLite)   │ │
│  │   Port 3000     │    │   Port 3001      │    │  Local File │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│           ▲                       │                             │
│           │              ┌────────▼─────────┐                   │
│           │              │  WebSocket       │                   │
│           └──────────────│  Gateway         │                   │
│                          │  Port 8080       │                   │
│                          └──────────────────┘                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Walmart Microservices (Separate)              │ │
│  │                                                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ │
│  │  │Grocery   │ │Pricing   │ │NLP       │ │Memory    │      │ │
│  │  │:3005     │ │:3007     │ │:3008     │ │:3010     │      │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │ │
│  │                                                             │ │
│  │              walmart_grocery.db (Separate)                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏢 SERVICE BOUNDARIES

### Primary Application Stack

#### Frontend Service (React)
- **Port**: 3000 (development), build artifacts for production
- **Technology**: React 18.2, TypeScript 5.0, tRPC client
- **Responsibilities**:
  - User interface rendering
  - Client-side state management
  - API communication via tRPC
  - Real-time updates via WebSocket
- **Data Sources**: Backend API, WebSocket Gateway
- **Build Status**: ✅ Stable, compiles successfully

#### Backend API Service (Node.js)
- **Port**: 3001
- **Technology**: Node.js 20.11, Express, tRPC server
- **Responsibilities**:
  - API endpoint management
  - Business logic orchestration
  - Database operations
  - Authentication and authorization
  - Email processing coordination
- **Data Sources**: SQLite database (crewai_enhanced.db)
- **Status**: ✅ Operational, type-safe endpoints

#### Database Layer (SQLite)
- **File**: `./data/crewai_enhanced.db`
- **Technology**: better-sqlite3 with async operations
- **Responsibilities**:
  - Email data storage (143,221 emails)
  - Chain analysis results (29,495 chains)
  - User authentication data
  - Processing status tracking
- **Status**: ✅ Stable with proper indexing

#### WebSocket Gateway
- **Port**: 8080
- **Technology**: Socket.io with JWT authentication
- **Responsibilities**:
  - Real-time progress notifications
  - Live system status updates
  - Client connection management
- **Status**: ✅ Infrastructure ready, integration in progress

### Walmart Grocery System (Separate)

#### Grocery Service (:3005)
- **Responsibilities**: Order management, product catalog
- **Database**: walmart_grocery.db (separate from main system)
- **Status**: ✅ Framework complete

#### NLP Service (:3008)
- **Technology**: Qwen3:0.6b model (522MB)
- **Responsibilities**: Product categorization, intent detection
- **Status**: ✅ Model integration ready

#### Pricing Service (:3007)
- **Responsibilities**: Price tracking, deal analysis
- **Status**: 🚧 Real data integration in progress

#### Memory Monitor (:3010)
- **Responsibilities**: System health, performance metrics
- **Status**: ✅ Basic monitoring operational

---

## 📊 DATA FLOW PATTERNS

### Email Processing Flow

```
Email Data (143,221 emails)
    │
    ▼ Phase 1 (Rule-based) ✅ 100% Complete
┌─────────────────────────────┐
│ Entity Extraction           │
│ • PO numbers                │
│ • Customer names            │
│ • Case numbers              │
│ • Priority scoring          │
└─────────────────────────────┘
    │
    ▼ Phase 2 (LLM) 🚧 0.3% Complete
┌─────────────────────────────┐
│ LLM Analysis (426 emails)   │
│ • Context understanding     │
│ • Business intelligence     │
│ • Action item extraction    │
│ • Relationship mapping      │
└─────────────────────────────┘
    │
    ▼ Phase 3 (Strategic) 📋 Designed
┌─────────────────────────────┐
│ Strategic Analysis          │
│ • Cross-email patterns      │
│ • Business value            │
│ • Executive insights        │
│ • Trend analysis            │
└─────────────────────────────┘
```

### Frontend-Backend Communication

```
React Frontend (Port 3000)
    │
    │ tRPC (Type-safe)
    ▼
Node.js Backend (Port 3001)
    │
    │ SQL Queries
    ▼
SQLite Database
    │
    │ Results
    ▲
    │
WebSocket Updates (Port 8080)
    │
    ▼
Frontend Real-time Updates
```

### Walmart System Data Flow

```
Walmart Orders
    │
    ▼
Grocery Service (:3005)
    │
    ├─► walmart_grocery.db (Storage)
    │
    ├─► Pricing Service (:3007) → Price Analysis
    │
    ├─► NLP Service (:3008) → Qwen3 Processing
    │
    └─► Memory Monitor (:3010) → System Health
```

---

## 🔧 INTEGRATION PATTERNS

### Authentication Flow
1. **User Login** → Frontend form submission
2. **Credential Validation** → Backend JWT creation
3. **Token Storage** → Frontend secure storage
4. **API Requests** → Bearer token in headers
5. **WebSocket Connection** → Token-based authentication

### Real-time Updates
1. **Processing Event** → Backend service completion
2. **WebSocket Emit** → Gateway broadcasts update
3. **Frontend Reception** → React state update
4. **UI Refresh** → User sees live progress

### Database Operations
1. **API Request** → tRPC endpoint call
2. **Validation** → Zod schema verification
3. **Database Query** → Async SQLite operations
4. **Response Formation** → Type-safe result formatting
5. **Frontend Update** → React component re-render

---

## 🚦 OPERATIONAL STATUS

### ✅ Production-Ready Components
- **Build System**: TypeScript compilation successful
- **Security Layer**: JWT, validation, password hashing
- **Database Operations**: Async queries, proper indexing
- **Frontend Interface**: Responsive React components
- **API Layer**: Type-safe tRPC endpoints

### 🚧 Active Development
- **LLM Integration**: Scaling email processing pipeline
- **Agent System**: MasterOrchestrator integration
- **WebSocket Features**: Real-time processing updates
- **Business Intelligence**: Analytics dashboard completion

### 📋 Planned Features
- **Advanced Agents**: Multi-agent coordination
- **Performance Optimization**: Concurrent user support
- **Extended Analytics**: Predictive intelligence
- **System Monitoring**: Comprehensive health tracking

---

## 🔍 ACTUAL VS DESIGNED ARCHITECTURE

### What's Actually Implemented
- **Monolithic Backend**: Single Node.js service despite "microservice" terminology
- **Shared Database**: All services connect to same SQLite file
- **Type-safe Communication**: tRPC provides real end-to-end type safety
- **Async Operations**: Database calls properly async-ified
- **Security Hardening**: Production-ready security implementation

### What's Still Architectural Vision
- **True Microservices**: Independent services with separate databases
- **Service Mesh**: Complex service discovery and communication
- **Advanced Orchestration**: Multi-agent coordination patterns
- **Horizontal Scaling**: Support for distributed deployment

---

## ⚡ PERFORMANCE CHARACTERISTICS

### Current System Limits
- **Concurrent Users**: ~100-200 (SQLite constraint)
- **Database Queries**: ~200/second sustained
- **Email Processing**: 0 emails/minute in production (scaling needed)
- **Memory Usage**: 256-512MB stable operation
- **WebSocket Connections**: 50+ concurrent (tested)

### Optimization Opportunities
- **Connection Pooling**: Already implemented for SQLite constraints
- **Query Optimization**: Proper indexing on critical fields
- **Caching Layer**: Redis integration available but not heavily utilized
- **Bundle Optimization**: Frontend assets properly minimized

---

## 🛡️ SECURITY IMPLEMENTATION

### Authentication & Authorization
- **JWT Tokens**: Proper expiration and refresh patterns
- **Password Security**: BCrypt with 10 salt rounds
- **Session Management**: Secure token storage and rotation

### Input Validation & Protection
- **Zod Schemas**: Comprehensive input validation
- **SQL Injection**: Parameterized queries prevent injection
- **XSS Protection**: React built-in protections + CSP headers
- **CSRF Prevention**: Token-based CSRF protection

### Network Security
- **CORS Configuration**: Proper origin restrictions
- **Rate Limiting**: API endpoint protection
- **Security Headers**: Comprehensive HTTP security headers
- **WebSocket Authentication**: Token-based connection security

---

## 📈 SCALABILITY CONSIDERATIONS

### Current Architecture Scalability
- **Database**: SQLite limits to ~100 concurrent writes
- **Application Layer**: Single Node.js process
- **Frontend**: Static assets, CDN-ready
- **WebSocket**: Memory usage grows with connections

### Path to Scale
1. **PostgreSQL Migration**: Support for higher concurrency
2. **Load Balancing**: Multiple Node.js instances
3. **Caching Layer**: Redis for frequently accessed data
4. **CDN Integration**: Static asset distribution

---

## 🔮 EVOLUTION ROADMAP

### Near-term Architecture Goals
- **Complete LLM Integration**: Process remaining email backlog
- **Agent System Integration**: Connect MasterOrchestrator
- **Real-time Features**: WebSocket-based live updates
- **Performance Monitoring**: Comprehensive metrics

### Long-term Architecture Vision
- **True Microservices**: Independent, scalable services
- **Multi-database**: Service-specific data stores
- **Container Orchestration**: Kubernetes deployment
- **Advanced Intelligence**: Multi-model AI orchestration

---

## 📋 DEPLOYMENT PATTERNS

### Development Environment
- **Local Services**: All components run locally
- **Hot Reload**: Frontend and backend development
- **Database**: Local SQLite file with migrations
- **Testing**: Jest unit tests, integration testing framework

### Production Considerations
- **Build Process**: TypeScript compilation and bundling
- **Environment Variables**: Proper secret management
- **Health Checks**: Service monitoring and alerting
- **Backup Strategy**: Database backup and recovery

---

*Architecture Documentation*  
*Version: 2.4.0*  
*Last Updated: August 15, 2025*  
*Reflects: Actual implemented system post-TypeScript and security fixes*