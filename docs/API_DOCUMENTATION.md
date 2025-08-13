# tRPC API Documentation

## Overview

The CrewAI Team system uses tRPC for type-safe client-server communication with 12 specialized routers providing comprehensive functionality for email processing, agent management, and business intelligence.

**API Architecture:**
- **Type Safety**: End-to-end TypeScript with automatic type inference
- **Real-time Updates**: WebSocket integration for live data
- **Security**: CSRF protection, authentication, and rate limiting
- **Performance**: Optimized queries with caching and connection pooling

## API Structure

### Main Router Configuration

```typescript
export const appRouter = createRouter({
  auth: authRouter,                    // Authentication endpoints
  agent: agentRouter,                  // Agent management
  task: taskRouter,                    // Task coordination
  rag: ragRouter,                     // RAG system integration
  chat: chatRouter,                   // AI chat interfaces
  ws: websocketRouter,                // WebSocket endpoints
  health: healthRouter,               // System health monitoring
  dataCollection: dataCollectionRouter, // Bright Data integration
  emails: emailRouter,                // Email analytics and management
  emailAssignment: emailAssignmentRouter, // Email assignment functionality
  metrics: metricsRouter,             // Performance metrics
  iemsEmails: iemsEmailRouter,        // IEMS email dashboard
  deals: dealsRouter,                 // Deal data management
  walmartGrocery: walmartGroceryRouter, // Walmart grocery automation
  workflow: workflowRouter,           // Workflow intelligence
  security: securityRouter,           // Security and CSRF management
  monitoring: monitoringRouter        // System observability
});
```

## Core API Endpoints

### 1. Email Router (`/api/trpc/emails`)

#### Email Management

**Get Emails Table Data**
```typescript
emails.getEmailsTable.query({
  page: 1,
  pageSize: 50,
  sortBy: "received_date",
  sortOrder: "desc",
  filters: {
    status: ["red", "yellow", "green"],
    workflowState: ["START_POINT", "IN_PROGRESS", "COMPLETION"],
    priority: ["critical", "high", "medium", "low"],
    dateRange: {
      start: "2025-01-01T00:00:00Z",
      end: "2025-12-31T23:59:59Z"
    }
  },
  search: "PO-123456"
})

// Response
{
  emails: Array<{
    id: string;
    messageId: string;
    subject: string;
    requestedBy: string;
    receivedDate: string;
    status: "red" | "yellow" | "green";
    workflowState: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
    priority: "critical" | "high" | "medium" | "low";
    slaStatus: "on-track" | "at-risk" | "overdue";
    processingTime: number;
  }>;
  totalCount: number;
  hasMore: boolean;
}
```

**Get Email by ID**
```typescript
emails.getEmailById.query({ id: "550e8400-e29b-41d4-a716-446655440000" })

// Response
{
  id: string;
  messageId: string;
  subject: string;
  body: string;
  sender: { email: string; name: string };
  recipients: Array<{ email: string; name: string; type: "to" | "cc" | "bcc" }>;
  receivedAt: string;
  analysis: {
    workflow: string;
    priority: string;
    confidence: number;
    entities: {
      poNumbers: string[];
      quoteNumbers: string[];
      contacts: Array<{ name: string; email: string; role: string }>;
    };
    actionItems: Array<{
      task: string;
      owner: string;
      deadline: string;
      status: string;
    }>;
  };
}
```

**Update Workflow State**
```typescript
emails.updateWorkflowState.mutate({
  emailId: "550e8400-e29b-41d4-a716-446655440000",
  newState: "In Progress"
})

// Response
{ success: true; updatedAt: string }
```

#### Batch Operations

**Bulk Update Emails**
```typescript
emails.bulkUpdate.mutate({
  emailIds: ["id1", "id2", "id3"],
  action: "mark-read",
  value: "true"
})

// Response
{ 
  success: true; 
  updatedCount: number;
  failedIds: string[];
}
```

**Batch Create Emails**
```typescript
emails.batchCreate.mutate({
  emails: Array<{
    messageId: string;
    emailAlias: string;
    requestedBy: string;
    subject: string;
    body: string;
    receivedDate: string;
    priority: "critical" | "high" | "medium" | "low";
  }>
})
```

#### Analytics and Reporting

**Get Email Statistics**
```typescript
emails.getEmailStats.query()

// Response
{
  totalEmails: number;
  processingStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  workflowDistribution: {
    [workflow: string]: number;
  };
  priorityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  slaPerformance: {
    onTrack: number;
    atRisk: number;
    overdue: number;
  };
  averageProcessingTime: number;
}
```

### 2. Health Router (`/api/trpc/health`)

**System Health Check**
```typescript
health.getSystemHealth.query()

// Response
{
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: { status: "up" | "down"; responseTime: number };
    redis: { status: "up" | "down"; responseTime: number };
    ollama: { status: "up" | "down"; responseTime: number };
    chromadb: { status: "up" | "down"; responseTime: number };
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}
```

**Email Pipeline Health**
```typescript
health.getEmailPipelineHealth.query()

// Response
{
  status: "healthy" | "degraded" | "unhealthy";
  pipeline: {
    active: boolean;
    batchesProcessed: number;
    averageProcessingTime: number;
    errorRate: number;
  };
  database: {
    connected: boolean;
    emailCount: number;
    lastProcessed: string;
  };
  queue: {
    length: number;
    processing: number;
    failed: number;
  };
}
```

### 3. Agent Router (`/api/trpc/agent`)

**Get Agent Status**
```typescript
agent.getAgentStatus.query()

// Response
{
  agents: Array<{
    id: string;
    name: string;
    type: "research" | "email-analysis" | "code" | "data-analysis";
    status: "idle" | "working" | "error";
    currentTask: string | null;
    performance: {
      tasksCompleted: number;
      averageResponseTime: number;
      successRate: number;
    };
    lastActivity: string;
  }>;
  orchestrator: {
    status: "active" | "idle";
    totalTasksProcessed: number;
    activeAgents: number;
  };
}
```

**Execute Agent Task**
```typescript
agent.executeTask.mutate({
  agentType: "research",
  task: {
    type: "web-search",
    query: "latest AI trends 2025",
    maxResults: 10
  },
  priority: "high"
})

// Response
{
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  result?: any;
  estimatedCompletion?: string;
}
```

### 4. Walmart Grocery Router (`/api/trpc/walmartGrocery`)

*Enhanced with Order History Data (August 9, 2025)*

**Product Search (with Historical Pricing)**
```typescript
walmartGrocery.searchProducts.query({
  query: "organic bananas",
  filters: {
    category: "produce",
    priceRange: { min: 0, max: 10 },
    brand: ["Great Value", "Marketside"]
  },
  sort: "price-asc",
  limit: 20,
  includeHistory: true  // NEW: Include price history
})

// Response
{
  products: Array<{
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    discount?: number;
    brand: string;
    category: string;
    inStock: boolean;
    rating: number;
    reviewCount: number;
    image: string;
  }>;
  totalResults: number;
  filters: {
    availableCategories: string[];
    availableBrands: string[];
    priceRange: { min: number; max: number };
  };
}
```

**Manage Shopping Cart**
```typescript
walmartGrocery.addToCart.mutate({
  productId: "12345",
  quantity: 2,
  userId: "user-123"
})

walmartGrocery.getCart.query({ userId: "user-123" })

// Response
{
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  total: number;
  itemCount: number;
  estimatedTax: number;
  estimatedTotal: number;
}
```

**Order Management**
```typescript
walmartGrocery.getOrderHistory.query({
  userId: "user-123",
  limit: 10,
  status: "completed"
})

// Response
{
  orders: Array<{
    orderId: string;
    date: string;
    status: "pending" | "confirmed" | "delivered" | "cancelled";
    total: number;
    itemCount: number;
    deliveryDate?: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  }>;
  totalOrders: number;
}
```

### 5. Business Intelligence Router (`/api/trpc/iemsEmails`)

**Get Business Metrics**
```typescript
iemsEmails.getBusinessMetrics.query({
  dateRange: {
    start: "2025-01-01",
    end: "2025-12-31"
  }
})

// Response
{
  totalBusinessValue: number;
  metrics: {
    uniquePONumbers: number;
    uniqueQuoteNumbers: number;
    activeCustomers: number;
    highPriorityRate: number;
  };
  breakdown: {
    byWorkflow: { [workflow: string]: number };
    byMonth: Array<{ month: string; value: number }>;
    byCustomer: Array<{ customer: string; value: number }>;
  };
  trends: {
    valueGrowth: number;
    customerGrowth: number;
    volumeGrowth: number;
  };
}
```

### 6. WebSocket Router (`/api/trpc/ws`)

**Real-time Email Processing Updates**
```typescript
// Subscription for live email processing status
ws.emailProcessingUpdates.subscribe({
  onData: (data) => {
    // {
    //   type: "processing_started" | "processing_completed" | "processing_failed";
    //   emailId: string;
    //   progress?: number;
    //   result?: any;
    //   timestamp: string;
    // }
  }
})
```

**Agent Status Updates**
```typescript
// Subscription for real-time agent status
ws.agentStatusUpdates.subscribe({
  onData: (data) => {
    // {
    //   agentId: string;
    //   status: "idle" | "working" | "error";
    //   currentTask?: string;
    //   timestamp: string;
    // }
  }
})
```

### 7. Security Router (`/api/trpc/security`)

**CSRF Token Management**
```typescript
security.getCSRFToken.query()

// Response
{ token: string; expiresAt: string }

security.validateCSRFToken.mutate({ token: "csrf-token-value" })

// Response
{ valid: boolean; expiresAt?: string }
```

### 8. Monitoring Router (`/api/trpc/monitoring`)

**Performance Metrics**
```typescript
monitoring.getPerformanceMetrics.query({
  timeRange: "24h" | "7d" | "30d",
  metrics: ["response_time", "throughput", "error_rate"]
})

// Response
{
  metrics: {
    responseTime: {
      avg: number;
      p95: number;
      p99: number;
    };
    throughput: {
      requestsPerSecond: number;
      emailsPerMinute: number;
    };
    errorRate: {
      percentage: number;
      totalErrors: number;
    };
  };
  timeSeries: Array<{
    timestamp: string;
    values: { [metric: string]: number };
  }>;
}
```

## Error Handling

All tRPC endpoints implement standardized error handling:

```typescript
// Error Response Format
{
  error: {
    code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR";
    message: string;
    data?: {
      validationErrors?: Array<{
        field: string;
        message: string;
      }>;
      retryAfter?: number;
    };
  };
}
```

## Rate Limiting

API endpoints are protected with intelligent rate limiting:

- **Standard Endpoints**: 1000 requests per hour per IP
- **Heavy Operations**: 100 requests per hour per IP
- **WebSocket Connections**: 10 concurrent connections per user
- **Email Processing**: 50 batch operations per hour

## Authentication

```typescript
// Protected endpoint example
protectedProcedure
  .input(z.object({ data: z.any() }))
  .mutation(async ({ input, ctx }) => {
    // ctx.user contains authenticated user info
    // ctx.session contains session data
  })
```

## Type Safety

All endpoints are fully typed with automatic inference:

```typescript
// Client usage with full type safety
const { data, error, isLoading } = api.emails.getEmailsTable.useQuery({
  page: 1,
  pageSize: 50,
  // TypeScript enforces correct parameter types
});

// data is automatically typed as the response schema
// No manual type casting required
```

This API provides comprehensive functionality for enterprise email processing with type safety, real-time updates, and robust error handling.
## New Walmart Data Endpoints (August 9, 2025)

### Order History Analysis

**Get Order History**
```typescript
walmartGrocery.getOrderHistory.query({
  customerId?: string,  // Optional: filter by customer (hashed)
  dateRange?: {
    start: string;  // ISO date
    end: string;    // ISO date
  },
  limit?: number
})

// Response
{
  orders: Array<{
    orderId: string;
    orderDate: string;
    total: number;
    itemCount: number;
    store: string;
    fulfillmentType: string;
  }>;
  totalOrders: number;
  totalSpent: number;
}
```

**Get Pricing History**
```typescript
walmartGrocery.getPricingHistory.query({
  productId: string,
  storeId?: string,
  dateRange?: {
    start: string;
    end: string;
  }
})

// Response
{
  product: {
    id: string;
    name: string;
    currentPrice: number;
  },
  priceHistory: Array<{
    date: string;
    price: number;
    store?: string;
    priceChange?: number;
    percentChange?: number;
  }>;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
}
```

**Get Store Locations**
```typescript
walmartGrocery.getStoreLocations.query({
  city?: string,
  state?: string,
  capabilities?: Array<'pickup' | 'delivery' | 'curbside'>
})

// Response
{
  stores: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    capabilities: {
      pickup: boolean;
      delivery: boolean;
      curbside: boolean;
    };
    totalOrders: number;
  }>;
  totalStores: number;
}
```

**Get Product Categories**
```typescript
walmartGrocery.getProductCategories.query()

// Response
{
  categories: Array<{
    path: string;  // e.g., "Food/Produce"
    productCount: number;
    percentage: number;
    topProducts: Array<{
      id: string;
      name: string;
      orderCount: number;
    }>;
  }>;
  totalCategories: number;
}
```

**Get Top Products**
```typescript
walmartGrocery.getTopProducts.query({
  limit?: number,
  metric: 'orders' | 'revenue' | 'frequency',
  category?: string
})

// Response
{
  products: Array<{
    id: string;
    name: string;
    brand: string;
    category: string;
    orderCount: number;
    totalRevenue: number;
    averagePrice: number;
    priceRange: {
      min: number;
      max: number;
    };
  }>;
}
```

### Analytics Endpoints

**Get Customer Analytics** (Anonymized)
```typescript
walmartGrocery.getCustomerAnalytics.query()

// Response
{
  totalCustomers: number;
  averageOrderValue: number;
  averageOrdersPerCustomer: number;
  topCategories: string[];
  orderDistribution: {
    pickup: number;
    delivery: number;
    curbside: number;
  };
}
```

**Get Price Trends**
```typescript
walmartGrocery.getPriceTrends.query({
  category?: string,
  dateRange: {
    start: string;
    end: string;
  }
})

// Response
{
  trends: Array<{
    date: string;
    averagePrice: number;
    priceIndex: number;  // 100 = baseline
    productCount: number;
  }>;
  summary: {
    overallChange: number;
    percentChange: number;
    inflationRate: number;
  };
}
```

## Database Statistics

As of August 9, 2025:
- **Total Orders:** 25
- **Unique Products:** 161
- **Order Line Items:** 229
- **Store Locations:** 6
- **Date Range:** March 19 - August 5, 2025
- **Average Order Value:** $53.22

---

*API Documentation Updated: August 9, 2025*
EOF < /dev/null
