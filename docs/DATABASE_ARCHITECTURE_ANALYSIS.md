# CrewAI Team Database Architecture Analysis

## Executive Summary

The CrewAI Team project uses a dual-database architecture combining SQLite for relational data storage and ChromaDB for vector embeddings. This architecture supports both traditional CRUD operations and AI-powered semantic search capabilities.

## Database Technologies

### 1. SQLite (Primary Database)

- **Library**: better-sqlite3
- **Location**: `./data/app.db` (configurable via `DATABASE_PATH`)
- **Purpose**: Stores structured relational data
- **Connection Management**: Direct synchronous connections

### 2. ChromaDB (Vector Database)

- **Type**: Vector embedding database
- **Default URL**: `http://localhost:8000`
- **Purpose**: Stores document embeddings for RAG (Retrieval Augmented Generation)
- **Collection**: `agent-knowledge`

## Database Schema

### SQLite Tables

#### 1. **conversations** Table

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### 2. **messages** Table

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

#### 3. **users** Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
```

#### 4. **refresh_tokens** Table

```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

#### 5. **tasks** Table

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  data TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  duration INTEGER,
  metadata TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created ON tasks(created_at);
```

## Service Architecture

### 1. **ConversationService**

- **Location**: `/src/api/services/ConversationService.ts`
- **Database**: SQLite
- **Tables Used**: `conversations`, `messages`
- **Key Methods**:
  - `create()`: Creates new conversations
  - `addMessage()`: Adds messages to conversations
  - `list()`: Retrieves conversation history
  - `updateTitle()`: Updates conversation titles
  - `delete()`: Removes conversations

### 2. **UserService**

- **Location**: `/src/api/services/UserService.ts`
- **Database**: SQLite
- **Tables Used**: `users`, `refresh_tokens`
- **Key Features**:
  - JWT-based authentication
  - Password hashing with bcrypt
  - Refresh token management
  - Role-based access control (USER, ADMIN, MODERATOR)

### 3. **VectorStore (RAG System)**

- **Location**: `/src/core/rag/VectorStore.ts`
- **Database**: ChromaDB
- **Key Features**:
  - Document embedding using nomic-embed-text model
  - Semantic search capabilities
  - Document chunking and indexing
  - Metadata-based filtering

## Database Connectivity

### Connection Initialization Flow

1. **Application Startup**
   - `initializeDatabase()` script creates necessary directories
   - SQLite database file is created if not exists
   - Tables are created with proper indexes

2. **Service Initialization** (`/src/api/trpc/context.ts`)
   - ConversationService connects to SQLite
   - UserService connects to SQLite
   - RAGSystem initializes ChromaDB connection
   - All services are singleton instances

3. **Health Monitoring** (`/src/api/routes/health.router.ts`)
   - SQLite: Direct connection test with `SELECT 1`
   - ChromaDB: HTTP heartbeat endpoint check
   - Database size and statistics collection

## Configuration

### Environment Variables

```env
# Database Configuration
DATABASE_PATH=./data/app.db
VECTOR_DB_PATH=./data/vectordb

# ChromaDB Configuration
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Security
JWT_SECRET=your-secret-key-here
```

### Application Config (`/src/config/app.config.ts`)

```typescript
database: {
  path: process.env.DATABASE_PATH || "./data/app.db";
}
```

## Data Flow Patterns

### 1. Conversation Flow

```
User Input → API → ConversationService → SQLite → Response
                ↓
           MasterOrchestrator → Agents → Tasks
```

### 2. RAG Flow

```
Document → DocumentProcessor → VectorStore → ChromaDB
Query → EmbeddingService → VectorStore → Semantic Search → Results
```

### 3. Authentication Flow

```
Login → UserService → SQLite (users) → JWT Generation
Token Refresh → UserService → SQLite (refresh_tokens) → New JWT
```

## Performance Considerations

### SQLite Optimizations

- Synchronous mode for better performance
- Proper indexing on frequently queried columns
- Connection pooling not required (single connection)

### ChromaDB Optimizations

- Batch embedding generation
- Metadata filtering for targeted searches
- Collection-based organization

## Security Measures

1. **Authentication**
   - Bcrypt password hashing (10 rounds)
   - JWT tokens with configurable expiration
   - Refresh token rotation

2. **Database Access**
   - Parameterized queries prevent SQL injection
   - Foreign key constraints ensure data integrity
   - Cascading deletes for data consistency

## Backup and Recovery

### Recommended Backup Strategy

1. **SQLite**: Regular file-based backups of `app.db`
2. **ChromaDB**: Export collections to JSON format
3. **Data Directory**: Full backup of `/data` folder

## Monitoring and Health Checks

The health check system provides comprehensive monitoring:

- Database connectivity status
- Response times
- Database size metrics
- Service availability

## Future Considerations

1. **Migration System**: Consider implementing a formal migration system for schema changes
2. **Connection Pooling**: For high-traffic scenarios, consider pg-pool for PostgreSQL migration
3. **Caching Layer**: Redis integration for frequently accessed data
4. **Audit Logging**: Comprehensive audit trail for all database operations

## Conclusion

The current database architecture effectively supports the CrewAI Team's requirements with:

- Reliable SQLite for structured data
- Powerful ChromaDB for AI/ML workloads
- Clear separation of concerns
- Comprehensive health monitoring
- Secure authentication and authorization

The architecture is well-suited for development and small to medium production deployments, with clear upgrade paths for scaling.
