# Email Dashboard Baseline Architecture

## Current System Overview

The current Email Dashboard is part of the CrewAI Team project, built with a modern tech stack focusing on AI-powered email management and analysis.

### Technology Stack

#### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **Shadcn/ui** component library
- **tRPC** for type-safe API communication
- **React Query** for server state management
- **Zustand** for client state management

#### Backend
- **Node.js** with TypeScript
- **Express.js** server framework
- **tRPC** server implementation
- **SQLite** with better-sqlite3
- **WebSocket** for real-time updates
- **Ollama** integration for AI capabilities

#### Infrastructure
- **pnpm** for package management
- **Docker** support for containerization
- **GitHub Actions** for CI/CD
- **ESLint** and **Prettier** for code quality

### Current Architecture Components

#### 1. Frontend Structure
```
src/
├── client/
│   ├── components/
│   │   ├── email/
│   │   │   ├── EmailList.tsx (card-based layout)
│   │   │   ├── EmailCard.tsx
│   │   │   ├── EmailDetail.tsx
│   │   │   └── EmailFilters.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainLayout.tsx
│   │   └── ui/ (shadcn components)
│   ├── hooks/
│   │   ├── useEmails.ts
│   │   ├── useWebSocket.ts
│   │   └── useFilters.ts
│   ├── lib/
│   │   ├── trpc.ts
│   │   └── utils.ts
│   └── pages/
│       ├── Dashboard.tsx
│       └── EmailDashboard.tsx
```

#### 2. Backend Structure
```
src/
├── api/
│   ├── routes/
│   │   ├── email.router.ts
│   │   ├── agent.router.ts
│   │   └── websocket.router.ts
│   ├── services/
│   │   ├── EmailStorageService.ts
│   │   ├── ConversationService.ts
│   │   └── WebSocketService.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimiter.ts
│   │   └── security.ts
│   └── server.ts
```

### Current Data Flow

1. **Email Ingestion**
   - Emails are fetched from Microsoft Graph API
   - Stored in SQLite database
   - Analyzed by AI agents for workflow classification

2. **Email Processing**
   - Quick analysis for immediate classification
   - Deep analysis for detailed workflow understanding
   - Entity extraction (PO numbers, quotes, etc.)
   - Action item identification

3. **UI Presentation**
   - Card-based layout showing email summaries
   - Filter sidebar for workflow categories
   - Real-time updates via WebSocket

### Current Database Schema

```sql
-- Simplified current schema
CREATE TABLE emails (
    id TEXT PRIMARY KEY,
    graphId TEXT UNIQUE,
    subject TEXT,
    from TEXT,
    to TEXT,
    receivedDateTime TEXT,
    isRead BOOLEAN,
    hasAttachments BOOLEAN,
    bodyPreview TEXT,
    body TEXT,
    importance TEXT,
    categories TEXT, -- JSON array
    analysisResult TEXT -- JSON with AI analysis
);

CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    topic TEXT,
    lastDeliveredDateTime TEXT,
    uniqueSenders TEXT,
    hasAttachments BOOLEAN,
    preview TEXT
);
```

### Current Features

1. **Email Management**
   - View emails in card format
   - Filter by categories/workflows
   - Search functionality
   - Mark as read/unread

2. **AI Analysis**
   - Workflow classification
   - Priority detection
   - Entity extraction
   - Action item identification

3. **Real-time Updates**
   - WebSocket connection for live updates
   - Notification system
   - Auto-refresh capabilities

### Current Limitations

1. **UI/UX Issues**
   - Card-based layout not optimal for high-volume email management
   - Limited sorting capabilities
   - No table view for quick scanning
   - Missing status indicators

2. **Performance Concerns**
   - Card rendering performance with large datasets
   - Limited pagination options
   - No virtual scrolling

3. **Feature Gaps**
   - No bulk operations
   - Limited export functionality
   - Missing advanced filtering
   - No saved filter presets

### Integration Points

1. **Microsoft Graph API**
   - OAuth2 authentication
   - Email fetching
   - Attachment handling

2. **Ollama AI Integration**
   - Local LLM for analysis
   - Custom prompts for workflow detection
   - Entity extraction models

3. **WebSocket Server**
   - Real-time event broadcasting
   - Client synchronization
   - Status updates

### Security Measures

1. **Authentication**
   - Session-based auth
   - JWT tokens for API access
   - Role-based permissions

2. **Data Protection**
   - SQLite encryption at rest
   - HTTPS for all communications
   - Input sanitization

3. **Rate Limiting**
   - API endpoint protection
   - WebSocket connection limits
   - Resource usage monitoring

### Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   React Client  │────▶│   Express API   │
└─────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │     SQLite      │
         │              └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   WebSocket     │     │   Ollama LLM    │
└─────────────────┘     └─────────────────┘
```

### Migration Considerations

1. **Data Migration**
   - Preserve existing email data
   - Transform analysis results
   - Maintain user preferences

2. **API Compatibility**
   - Gradual endpoint migration
   - Backward compatibility period
   - Version management

3. **Feature Parity**
   - Ensure all current features work
   - Add new table-based features
   - Maintain real-time capabilities

### Development Workflow

1. **Local Development**
   ```bash
   pnpm install
   pnpm dev
   ```

2. **Testing**
   ```bash
   pnpm test
   pnpm test:e2e
   ```

3. **Building**
   ```bash
   pnpm build
   pnpm start
   ```

### Configuration Management

1. **Environment Variables**
   - `.env` for local development
   - `.env.production` for production
   - Secure credential storage

2. **Feature Flags**
   - Toggle between old/new UI
   - Gradual feature rollout
   - A/B testing support

This baseline architecture document provides the foundation for understanding the current system before implementing the new table-based email dashboard. All changes will be made incrementally to ensure system stability and data integrity.