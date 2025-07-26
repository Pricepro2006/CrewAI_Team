# Email Dashboard Technical Specification

## Enhanced Two-Stage Email Analysis

### Stage 1: Quick Categorization (qwen3:0.6b)
```typescript
interface QuickAnalysis {
  workflow: string[];
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  intent: 'Action Required' | 'FYI' | 'Request' | 'Update';
  urgency: 'Immediate' | '24 Hours' | '72 Hours' | 'No Rush';
  confidence: number;
}
```

### Stage 2: Deep Workflow Analysis (granite3.3:2b)
```typescript
interface DeepWorkflowAnalysis extends QuickAnalysis {
  detailedWorkflow: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  actionItems: {
    action: string;
    deadline?: string;
    assignee?: string;
    priority: number;
  }[];
  contextualSummary: string;
  relatedEmails?: string[];
  suggestedResponse?: string;
}
```

### Action Summary Extraction
```typescript
interface ActionSummary {
  primaryAction: string; // Max 100 chars for UI display
  detailedActions: string[];
  requiredBy?: Date;
  assignedTo?: string;
  status: 'pending' | 'in-progress' | 'blocked' | 'completed';
}
```

## Database Schema Updates

```sql
-- Main emails table
CREATE TABLE emails (
  id VARCHAR(255) PRIMARY KEY,
  graph_id VARCHAR(255) UNIQUE,
  thread_id VARCHAR(255),
  subject TEXT NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  received_at TIMESTAMP NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  raw_content TEXT,
  body_preview TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_received_at (received_at DESC),
  INDEX idx_sender_email (sender_email),
  INDEX idx_thread_id (thread_id)
);

-- Enhanced email analysis table
CREATE TABLE email_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id VARCHAR(255) REFERENCES emails(id) ON DELETE CASCADE,
  -- Stage 1 results
  quick_workflow VARCHAR(100),
  quick_priority VARCHAR(50),
  quick_intent VARCHAR(50),
  quick_urgency VARCHAR(50),
  quick_confidence DECIMAL(3,2),
  quick_model VARCHAR(50),
  quick_processing_time INTEGER,
  -- Stage 2 results  
  deep_workflow_primary VARCHAR(100),
  deep_workflow_secondary TEXT, -- JSON array
  deep_confidence DECIMAL(3,2),
  action_summary VARCHAR(100), -- For UI display
  action_details TEXT, -- JSON array of detailed actions
  contextual_summary TEXT,
  suggested_response TEXT,
  related_emails TEXT, -- JSON array of email IDs
  deep_model VARCHAR(50),
  deep_processing_time INTEGER,
  -- Workflow state
  workflow_state VARCHAR(50),
  workflow_updated_at TIMESTAMP,
  -- Metadata
  total_processing_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_id (email_id),
  INDEX idx_workflow (deep_workflow_primary),
  INDEX idx_priority (quick_priority),
  INDEX idx_created_at (created_at DESC)
);

-- Action tracking table
CREATE TABLE email_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id VARCHAR(255) REFERENCES emails(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  action_type VARCHAR(50), -- 'reply', 'forward', 'task', 'approval', etc.
  deadline TIMESTAMP,
  assigned_to VARCHAR(255),
  assigned_by VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_id (email_id),
  INDEX idx_status (status),
  INDEX idx_deadline (deadline)
);

-- Email threads table
CREATE TABLE email_threads (
  id VARCHAR(255) PRIMARY KEY,
  subject TEXT,
  participants TEXT, -- JSON array
  first_email_id VARCHAR(255),
  last_email_id VARCHAR(255),
  email_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email attachments table
CREATE TABLE email_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id VARCHAR(255) REFERENCES emails(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  content_type VARCHAR(100),
  size_bytes INTEGER,
  graph_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_id (email_id)
);
```

## API Endpoints Specification

### Email List API
```typescript
// GET /api/emails
interface EmailListRequest {
  page?: number;
  limit?: number; // Default: 50
  filters?: {
    workflow?: string[];
    priority?: string[];
    intent?: string[];
    dateFrom?: string;
    dateTo?: string;
    sender?: string;
    isRead?: boolean;
    search?: string;
  };
  sort?: {
    field: 'received_at' | 'priority' | 'workflow';
    order: 'asc' | 'desc';
  };
}

interface EmailListResponse {
  emails: EmailWithAnalysis[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    workflows: { name: string; count: number }[];
    priorities: { name: string; count: number }[];
  };
}
```

### Email Detail API
```typescript
// GET /api/emails/:id
interface EmailDetailResponse {
  email: {
    id: string;
    subject: string;
    sender: {
      email: string;
      name: string;
    };
    recipients: {
      to: { email: string; name: string }[];
      cc?: { email: string; name: string }[];
    };
    receivedAt: string;
    isRead: boolean;
    isFlagged: boolean;
    body: string;
    attachments: {
      filename: string;
      contentType: string;
      size: number;
    }[];
  };
  analysis: {
    quick: QuickAnalysis;
    deep: DeepWorkflowAnalysis;
    actionSummary: ActionSummary;
    entities: EmailEntities;
    processingMetadata: {
      stage1Time: number;
      stage2Time: number;
      totalTime: number;
      models: {
        stage1: string;
        stage2: string;
      };
    };
  };
  thread?: {
    id: string;
    emails: {
      id: string;
      subject: string;
      sender: string;
      receivedAt: string;
    }[];
  };
  relatedEmails?: {
    id: string;
    subject: string;
    relevance: number;
  }[];
}
```

### WebSocket Events
```typescript
// WebSocket event types
interface EmailWebSocketEvents {
  'email:new': {
    id: string;
    subject: string;
    sender: {
      email: string;
      name: string;
    };
    receivedAt: string;
    preview: string;
  };
  
  'email:analyzed': {
    id: string;
    workflow: string;
    priority: string;
    actionSummary: string;
    confidence: number;
  };
  
  'email:updated': {
    id: string;
    changes: {
      isRead?: boolean;
      isFlagged?: boolean;
      workflowState?: string;
    };
  };
  
  'stats:updated': {
    total: number;
    unread: number;
    byWorkflow: Record<string, number>;
    byPriority: Record<string, number>;
    pendingActions: number;
  };
  
  'action:completed': {
    emailId: string;
    actionId: string;
    completedBy: string;
  };
}
```

## Frontend Components Structure

### Email Dashboard Layout
```tsx
<EmailDashboard>
  <div className="email-dashboard-container">
    {/* Sidebar */}
    <aside className="email-sidebar">
      <EmailStats />
      <EmailFilters />
      <WorkflowLegend />
    </aside>
    
    {/* Main Content */}
    <main className="email-main">
      {/* Header */}
      <EmailHeader>
        <SearchBar />
        <ViewToggle /> {/* List/Grid view */}
        <BulkActions />
      </EmailHeader>
      
      {/* Email List */}
      <EmailList>
        <VirtualScroll>
          {emails.map(email => (
            <EmailListItem key={email.id} email={email} />
          ))}
        </VirtualScroll>
      </EmailList>
    </main>
    
    {/* Detail Panel */}
    {selectedEmail && (
      <aside className="email-detail-panel">
        <EmailDetail emailId={selectedEmail} />
      </aside>
    )}
  </div>
</EmailDashboard>
```

### Email List Item Component
```tsx
interface EmailListItemProps {
  email: EmailWithAnalysis;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const EmailListItem: React.FC<EmailListItemProps> = ({ email, isSelected, onSelect }) => {
  const workflowColor = WORKFLOW_COLORS[email.analysis.workflow];
  
  return (
    <div 
      className={cn(
        "email-list-item",
        "border-l-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors",
        !email.isRead && "bg-blue-50",
        isSelected && "bg-gray-100"
      )}
      style={{
        borderLeftColor: workflowColor.border
      }}
      onClick={() => onSelect(email.id)}
    >
      <div className="flex items-start gap-3">
        {/* Workflow Indicator */}
        <div className="flex-shrink-0 mt-1">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: workflowColor.dot }}
            title={email.analysis.workflow}
          />
        </div>
        
        {/* Email Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {email.sender.name || email.sender.email}
            </h4>
            <time className="text-xs text-gray-500">
              {formatRelativeTime(email.receivedAt)}
            </time>
          </div>
          
          <p className="text-sm text-gray-700 mb-1 line-clamp-2">
            {email.subject}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 italic">
              {email.analysis.actionSummary}
            </span>
            
            <div className="flex items-center gap-2">
              {email.analysis.priority === 'Critical' && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">
                  Critical
                </span>
              )}
              {email.hasAttachments && (
                <PaperClipIcon className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Color System Implementation
```typescript
// Workflow color mappings
export const WORKFLOW_COLORS = {
  'Order Management': {
    bg: 'bg-red-50',
    border: 'border-red-500',
    dot: 'bg-red-500',
    text: 'text-red-700'
  },
  'Shipping/Logistics': {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    dot: 'bg-blue-500',
    text: 'text-blue-700'
  },
  'Quote Processing': {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    dot: 'bg-purple-500',
    text: 'text-purple-700'
  },
  'Customer Support': {
    bg: 'bg-green-50',
    border: 'border-green-500',
    dot: 'bg-green-500',
    text: 'text-green-700'
  },
  'Deal Registration': {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    dot: 'bg-yellow-500',
    text: 'text-yellow-700'
  },
  'Approval Workflows': {
    bg: 'bg-indigo-50',
    border: 'border-indigo-500',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700'
  },
  'Renewal Processing': {
    bg: 'bg-pink-50',
    border: 'border-pink-500',
    dot: 'bg-pink-500',
    text: 'text-pink-700'
  },
  'Vendor Management': {
    bg: 'bg-gray-50',
    border: 'border-gray-500',
    dot: 'bg-gray-500',
    text: 'text-gray-700'
  }
};

// Priority indicators
export const PRIORITY_STYLES = {
  'Critical': 'bg-red-100 text-red-800 ring-red-600',
  'High': 'bg-orange-100 text-orange-800 ring-orange-600',
  'Medium': 'bg-yellow-100 text-yellow-800 ring-yellow-600',
  'Low': 'bg-gray-100 text-gray-800 ring-gray-600'
};
```

## Performance Optimizations

### 1. Virtual Scrolling with react-window
```tsx
import { FixedSizeList as List } from 'react-window';

const EmailVirtualList: React.FC<{ emails: Email[] }> = ({ emails }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <EmailListItem email={emails[index]} />
    </div>
  );
  
  return (
    <List
      height={window.innerHeight - 200}
      itemCount={emails.length}
      itemSize={80} // Estimated height of each email item
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### 2. Optimistic Updates
```typescript
const markAsRead = async (emailId: string) => {
  // Optimistic update
  setEmails(prev => 
    prev.map(email => 
      email.id === emailId 
        ? { ...email, isRead: true }
        : email
    )
  );
  
  try {
    await api.markEmailAsRead(emailId);
  } catch (error) {
    // Revert on error
    setEmails(prev => 
      prev.map(email => 
        email.id === emailId 
          ? { ...email, isRead: false }
          : email
      )
    );
    toast.error('Failed to mark email as read');
  }
};
```

### 3. Debounced Search
```typescript
const useEmailSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  return { searchTerm, setSearchTerm, debouncedSearchTerm };
};
```

### 4. Intelligent Caching
```typescript
const useEmailCache = () => {
  const queryClient = useQueryClient();
  
  // Prefetch next page
  const prefetchNextPage = (currentPage: number) => {
    queryClient.prefetchQuery({
      queryKey: ['emails', { page: currentPage + 1 }],
      queryFn: () => fetchEmails({ page: currentPage + 1 }),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
  
  // Cache individual email details when fetched in list
  const cacheEmailDetails = (emails: EmailWithAnalysis[]) => {
    emails.forEach(email => {
      queryClient.setQueryData(['email', email.id], email);
    });
  };
  
  return { prefetchNextPage, cacheEmailDetails };
};
```

## Real-time Update Implementation

### WebSocket Hook
```typescript
interface UseWebSocketOptions {
  onEmailNew?: (email: EmailNotification) => void;
  onEmailAnalyzed?: (analysis: EmailAnalysisNotification) => void;
  onStatsUpdated?: (stats: EmailStats) => void;
}

export const useEmailWebSocket = (options: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  
  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'email:new':
            options.onEmailNew?.(data.payload);
            break;
          case 'email:analyzed':
            options.onEmailAnalyzed?.(data.payload);
            break;
          case 'stats:updated':
            options.onStatsUpdated?.(data.payload);
            break;
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        handleReconnect();
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      handleReconnect();
    }
  }, [options]);
  
  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      const timeout = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current),
        30000
      );
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connect();
      }, timeout);
    }
  }, [connect]);
  
  useEffect(() => {
    connect();
    
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
  
  return { isConnected };
};
```

## Testing Strategy

### Unit Tests
```typescript
// EmailListItem.test.tsx
describe('EmailListItem', () => {
  it('should display correct workflow color', () => {
    const email = mockEmail({ workflow: 'Order Management' });
    const { container } = render(<EmailListItem email={email} />);
    
    const borderElement = container.querySelector('.email-list-item');
    expect(borderElement).toHaveStyle({
      borderLeftColor: WORKFLOW_COLORS['Order Management'].border
    });
  });
  
  it('should show unread indicator', () => {
    const email = mockEmail({ isRead: false });
    const { container } = render(<EmailListItem email={email} />);
    
    expect(container.querySelector('.email-list-item')).toHaveClass('bg-blue-50');
  });
  
  it('should display action summary', () => {
    const email = mockEmail({ actionSummary: 'Review and approve order' });
    const { getByText } = render(<EmailListItem email={email} />);
    
    expect(getByText('Review and approve order')).toBeInTheDocument();
  });
});
```

### Integration Tests
```typescript
// EmailDashboard.integration.test.tsx
describe('EmailDashboard Integration', () => {
  it('should load and display emails', async () => {
    const { getByText, findByText } = render(<EmailDashboard />);
    
    // Wait for emails to load
    await findByText('Order from Acme Corp');
    
    // Check that workflow filters are populated
    expect(getByText('Order Management (5)')).toBeInTheDocument();
    expect(getByText('Shipping/Logistics (3)')).toBeInTheDocument();
  });
  
  it('should update in real-time when new email arrives', async () => {
    const { findByText } = render(<EmailDashboard />);
    
    // Simulate WebSocket message
    mockWebSocket.send({
      type: 'email:new',
      payload: {
        id: 'new-email-1',
        subject: 'Urgent: New Order',
        sender: { email: 'customer@example.com' }
      }
    });
    
    await findByText('Urgent: New Order');
  });
});
```

This technical specification provides the complete blueprint for implementing the Email Dashboard with all requested features including two-stage analysis, color-coded UI, action summaries, and real-time updates.