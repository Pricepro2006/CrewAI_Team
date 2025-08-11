# CrewAI Team - Complete Frontend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Walmart Grocery Agent](#walmart-grocery-agent)
5. [Email Management System](#email-management-system)
6. [Core Components](#core-components)
7. [Layout Components](#layout-components)
8. [Chat Interface](#chat-interface)
9. [Authentication System](#authentication-system)
10. [Error Handling](#error-handling)
11. [WebSocket Integration](#websocket-integration)
12. [Custom Hooks](#custom-hooks)
13. [State Management](#state-management)
14. [API Integration](#api-integration)
15. [Monitoring & Performance](#monitoring--performance)
16. [Testing](#testing)

---

## Overview

CrewAI Team is an enterprise AI agent framework with multiple integrated systems including email processing, Walmart grocery intelligence, chat interfaces, and comprehensive monitoring capabilities.

### Key Features
- 🛒 **Walmart Grocery Intelligence Agent** - AI-powered shopping assistant
- 📧 **Email Processing Dashboard** - Multi-phase email analysis system
- 💬 **Chat Interface** - AI-powered conversational system
- 📊 **Business Intelligence** - Advanced analytics and insights
- 🔌 **Real-time Updates** - WebSocket-powered live data
- 🛡️ **Security** - CSRF protection and authentication
- 📈 **Monitoring** - Comprehensive system health tracking

---

## Technology Stack

```typescript
{
  "frontend": {
    "framework": "React 18.2.0",
    "language": "TypeScript 5.0",
    "styling": "CSS Modules + Tailwind CSS",
    "build": "Vite 7.0",
    "state": "React Hooks + Context API",
    "routing": "React Router v6",
    "api": "tRPC + React Query",
    "websocket": "Native WebSocket + Custom Hooks",
    "charts": "Recharts",
    "icons": "Lucide React",
    "testing": "Playwright + Vitest"
  }
}
```

---

## Project Structure

```
src/ui/
├── components/          # React components
│   ├── WalmartAgent/   # Walmart-specific components
│   ├── Email/          # Email management components
│   ├── Chat/           # Chat interface components
│   ├── UnifiedEmail/   # Unified email dashboard
│   ├── Layout/         # Layout components
│   ├── Security/       # Security components
│   └── common/         # Shared components
├── hooks/              # Custom React hooks
├── services/           # Service layers
├── stores/             # State management
├── contexts/           # React contexts
├── utils/              # Utility functions
├── lib/                # Libraries and configs
└── monitoring/         # Monitoring components
```

---

## Walmart Grocery Agent

### 1. Main Component: WalmartGroceryAgent

**Location**: `/src/ui/components/WalmartAgent/WalmartGroceryAgent.tsx`

#### Component Structure

```typescript
interface WalmartGroceryAgentProps {
  // No required props - self-contained component
}

interface GroceryItem {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  imageUrl: string;
  category: string;
  unit: string;
  originalPrice?: number;
  savings?: number;
}
```

#### Navigation Tabs

| Tab ID | Label | Icon | Component | Description |
|--------|-------|------|-----------|-------------|
| `shopping` | Shopping | ShoppingCart | Inline | Product search and browsing |
| `grocery-list` | Grocery List | List | GroceryListEnhanced | Smart grocery list management |
| `budget-tracker` | Budget Tracker | PieChart | Inline | Budget monitoring and insights |
| `price-history` | Price History | BarChart3 | Inline | Historical price tracking |
| `live-pricing` | Live Pricing | Zap | WalmartLivePricing | Real-time price monitoring |

#### Key Functions

```typescript
// Search handling
const handleSearch = async () => {
  // Uses tRPC mutation: api.walmartGrocery.searchProducts
  // Returns SearchResult with items
}

// Item selection
const toggleItemSelection = (itemId: string) => {
  // Manages selectedItems Set
}

// Price alerts
const setPriceAlert = (itemId: string, targetPrice: number) => {
  // Manages priceAlerts Map
}

// Calculations
const calculateTotalPrice = () => number
const calculateTotalSavings = () => number
```

#### Shopping Tab Components

##### Search Section
- **Input Field** (`search-input`)
  - Placeholder: "Search for groceries (e.g., 'organic milk', 'fresh produce', 'snacks')"
  - Type: text
  - Events: onChange, onKeyPress (Enter triggers search)

- **Search Button** (`search-button`)
  - States: normal, loading (shows spinner), disabled
  - Icon: Search/Spinner
  - Text: "Search"/"Searching..."

##### Filter Chips
```typescript
const filters = [
  'All Categories',  // Default active
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'On Sale'
];
```

##### Results Grid
Each item card contains:
- Image with optional savings badge
- Item name and category
- Pricing (current/original)
- **Add to List** button (ShoppingCart/CheckCircle icons)
- **Set Alert** button (AlertCircle icon)
- Stock status overlay

##### AI Shopping Assistant
Three insight cards:
1. **Best Time to Shop** - Pricing pattern analysis
2. **Price Predictions** - Future trend forecasting
3. **Smart Substitutions** - Money-saving alternatives

---

### 2. Enhanced Grocery List Component

**Location**: `/src/ui/components/WalmartAgent/GroceryListEnhanced.tsx`

#### Key Features
- Natural language input for adding items
- Command history tracking
- Real-time price updates via WebSocket
- Smart suggestions based on shopping patterns
- Budget tracking with visual indicators

#### Interfaces

```typescript
interface GroceryItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  unit: string;
  imageUrl: string;
  inStock: boolean;
  notes?: string;
}

interface ListTotalCalculation {
  subtotal: number;
  originalSubtotal: number;
  itemSavings: number;
  promoDiscount: number;
  tax: number;
  deliveryFee: number;
  totalSavings: number;
  total: number;
  freeDeliveryEligible: boolean;
}
```

#### Sub-components

1. **NaturalLanguageInput** - AI-powered item addition
2. **CommandHistory** - Previous commands tracking
3. **ConnectionStatus** - WebSocket connection indicator

---

### 3. Live Pricing Component

**Location**: `/src/ui/components/WalmartAgent/WalmartLivePricing.tsx`

#### Features
- Real-time price monitoring
- Store location selection (ZIP code based)
- Price change alerts
- Service status indicators
- Cache management

#### Hooks Used
```typescript
useWalmartPrice()           // Individual price fetching
useWalmartSearch()          // Product search
useNearbyWalmartStores()    // Store locator
useWalmartPriceMonitor()    // Price monitoring
useClearPriceCache()        // Cache management
useWalmartPricingHealth()   // Service health check
```

---

## Email Management System

### Email Dashboard Components

**Location**: `/src/ui/components/Email/`

#### 1. EmailDashboard
Main email management interface with:
- Email list view
- Filtering and sorting
- Batch operations
- Statistics display

#### 2. EmailIngestionMonitoringDashboard
Real-time monitoring of email processing:
- Processing pipeline status
- Success/failure rates
- Performance metrics
- Queue status

#### 3. EmailStats
Statistical overview:
- Total emails processed
- Analysis completion rates
- Business intelligence extracted
- Chain completeness metrics

### Unified Email Dashboard

**Location**: `/src/ui/components/UnifiedEmail/`

#### Components

1. **UnifiedEmailDashboard** - Main container
2. **EmailListView** - Email list with status indicators
3. **MetricsBar** - Key performance metrics
4. **BusinessIntelligenceDashboard** - BI insights
5. **WorkflowAnalytics** - Processing workflow analysis
6. **AgentView** - Agent activity monitoring
7. **AnalyticsView** - Detailed analytics

---

## Core Components

### 1. Layout System

**Location**: `/src/ui/components/Layout/`

#### MainLayout
```typescript
interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showHeader?: boolean;
}
```

#### Sidebar
Navigation menu with:
- Dashboard
- Chat
- Agents
- Email Management
- Walmart Grocery Agent
- Web Scraping
- Knowledge Base
- Vector Search
- Settings

#### Header
- User profile dropdown
- Notifications
- System status indicator
- Quick actions

### 2. Chat Interface

**Location**: `/src/ui/components/Chat/`

#### Components

1. **ChatInterface** - Main chat container
2. **MessageList** - Message display with typing indicators
3. **InputBox** - Message input with attachments
4. **ConversationList** - Conversation history
5. **ConfidenceMessage** - AI confidence indicators

#### Message Types
```typescript
type MessageType = 'user' | 'assistant' | 'system' | 'error';

interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  confidence?: number;
  metadata?: Record<string, any>;
}
```

### 3. Authentication Components

**Location**: `/src/ui/components/Auth/`

#### Components
1. **AuthModal** - Authentication modal wrapper
2. **LoginForm** - User login interface
3. **RegisterForm** - User registration
4. **UserProfile** - Profile management

#### Auth Hook
```typescript
const useAuth = () => {
  return {
    user: User | null,
    isAuthenticated: boolean,
    login: (credentials) => Promise<void>,
    logout: () => void,
    register: (userData) => Promise<void>
  }
}
```

---

## Error Handling

### Error Boundary System

**Location**: `/src/ui/components/ErrorBoundary/`

#### Components
1. **ErrorBoundary** - Main error boundary
2. **ErrorFallback** - Fallback UI
3. **SectionErrorBoundary** - Section-level boundaries
4. **ErrorRecoveryBoundary** - Auto-recovery logic

#### Error Recovery Hook
```typescript
const useErrorRecovery = () => {
  return {
    error: Error | null,
    retry: () => void,
    reset: () => void,
    isRecovering: boolean
  }
}
```

### Error Modal

**Location**: `/src/ui/components/ErrorModal/`

Features:
- User-friendly error messages
- Retry mechanisms
- Error reporting
- Stack trace display (dev mode)

---

## WebSocket Integration

### WebSocket Hooks

**Location**: `/src/ui/hooks/`

#### 1. useWebSocket
Basic WebSocket connection management

```typescript
const useWebSocket = (url: string) => {
  return {
    sendMessage: (message: any) => void,
    lastMessage: any,
    readyState: number,
    connectionStatus: 'connecting' | 'connected' | 'disconnected'
  }
}
```

#### 2. useEnhancedWebSocket
Advanced WebSocket with auto-reconnect

#### 3. useWalmartWebSocket
Walmart-specific WebSocket connection

#### 4. useGroceryWebSocket
Grocery list real-time updates

### WebSocket Manager

**Location**: `/src/ui/services/WebSocketConnectionManager.ts`

Features:
- Connection pooling
- Auto-reconnection
- Message queuing
- Health monitoring

---

## Custom Hooks

### Data Fetching Hooks

| Hook | Purpose | Location |
|------|---------|----------|
| `useApiErrorRecovery` | API error recovery | `/hooks/useApiErrorRecovery.ts` |
| `useAutoSuggestions` | Auto-complete suggestions | `/hooks/useAutoSuggestions.ts` |
| `useConnectionWithFallback` | Connection fallback | `/hooks/useConnectionWithFallback.ts` |
| `useRetryMechanism` | Retry failed requests | `/hooks/useRetryMechanism.ts` |

### Security Hooks

| Hook | Purpose | Location |
|------|---------|----------|
| `useCSRF` | CSRF token management | `/hooks/useCSRF.tsx` |
| `useCSRFProtectedMutation` | Protected mutations | `/hooks/useCSRFProtectedMutation.ts` |
| `useTRPCWithCSRF` | tRPC with CSRF | `/hooks/useTRPCWithCSRF.ts` |

### Feature Hooks

| Hook | Purpose | Location |
|------|---------|----------|
| `useVoiceRecognition` | Voice input | `/hooks/useVoiceRecognition.ts` |
| `usePerformanceMonitor` | Performance tracking | `/hooks/usePerformanceMonitor.ts` |
| `useRealtimePrices` | Real-time pricing | `/hooks/useRealtimePrices.ts` |

---

## State Management

### Context Providers

**Location**: `/src/ui/contexts/`

1. **ErrorContext** - Global error handling
2. **AuthContext** - Authentication state
3. **WebSocketContext** - WebSocket connections
4. **ThemeContext** - Theme management

### State Stores

**Location**: `/src/ui/stores/`

1. **webSocketStateManager** - WebSocket state
2. **uiStateManager** - UI preferences
3. **cacheManager** - Data caching

---

## API Integration

### tRPC Setup

**Location**: `/src/ui/lib/api.ts`

```typescript
export const api = createTRPCReact<AppRouter>();
```

### API Endpoints

#### Walmart Grocery
- `api.walmartGrocery.searchProducts`
- `api.walmartGrocery.getProductDetails`
- `api.walmartGrocery.addToList`
- `api.walmartGrocery.processNaturalLanguage`

#### Email Management
- `api.email.getEmails`
- `api.email.analyzeEmail`
- `api.email.getBusinessIntelligence`
- `api.email.processChain`

#### System
- `api.system.getHealth`
- `api.system.getMetrics`
- `api.system.getStatus`

---

## Monitoring & Performance

### Monitoring Dashboard

**Location**: `/src/ui/monitoring/`

#### Components
1. **MonitoringDashboard** - Main dashboard
2. **SystemHealthIndicator** - Health status
3. **PerformancePanel** - Performance metrics
4. **DatabasePanel** - Database statistics
5. **AlertsPanel** - System alerts
6. **ConnectionMonitor** - Connection status
7. **MetricsChart** - Visual metrics

### Performance Utilities

**Location**: `/src/ui/utils/`

- `logger.ts` - Logging utility
- `errorLogger.ts` - Error tracking
- `errorTranslator.ts` - User-friendly errors
- `serviceWorkerManager.ts` - Service worker management

---

## Component Styling

### CSS Organization

```
styles/
├── globals.css         # Global styles
├── variables.css       # CSS variables
└── components/         # Component-specific styles
    ├── WalmartGroceryAgent.css
    ├── GroceryListEnhanced.css
    ├── NaturalLanguageInput.css
    └── CommandHistory.css
```

### CSS Classes Reference

#### Layout Classes
- `.walmart-agent` - Main container
- `.agent-header` - Header section
- `.agent-nav` - Navigation tabs
- `.agent-content` - Content area

#### Component Classes
- `.nav-tab` - Navigation buttons
- `.active` - Active state
- `.search-input` - Search field
- `.search-button` - Search button
- `.filter-chip` - Category filters
- `.grocery-item` - Product cards
- `.assistant-card` - AI assistant cards

#### State Classes
- `.selected` - Selected items
- `.out-of-stock` - Unavailable items
- `.loading` - Loading states
- `.error` - Error states
- `.success` - Success states

---

## Testing

### Test Structure

```
tests/
├── walmart-ui-comprehensive/
│   ├── simple-walmart-test.spec.ts
│   ├── comprehensive-walmart-test.spec.ts
│   ├── diagnostic-test.spec.ts
│   └── screenshots/
├── e2e/
│   ├── email-dashboard.spec.ts
│   ├── chat-interface.spec.ts
│   └── auth-flow.spec.ts
└── unit/
    ├── hooks/
    ├── components/
    └── utils/
```

### Running Tests

```bash
# Run all tests
npm run test

# Run Walmart tests with UI
npx playwright test tests/walmart-ui-comprehensive --headed

# Run specific test file
npx playwright test tests/walmart-ui-comprehensive/simple-walmart-test.spec.ts

# Run with specific config
npx playwright test --config=playwright.simple.config.ts
```

---

## Environment Configuration

### Required Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_WEBSOCKET_URL=ws://localhost:8080

# Feature Flags
VITE_ENABLE_WALMART=true
VITE_ENABLE_EMAIL=true
VITE_ENABLE_CHAT=true

# Services
VITE_OLLAMA_URL=http://localhost:11434
VITE_REDIS_URL=redis://localhost:6379

# Security
VITE_CSRF_ENABLED=true
VITE_AUTH_ENABLED=true
```

### Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5178 | Vite dev server |
| Backend API | 3001 | Express/tRPC server |
| WebSocket | 8080 | WebSocket gateway |
| Ollama | 11434 | LLM service |
| Redis | 6379 | Cache/queue |

---

## Development Guidelines

### Component Creation

1. **File Structure**
```typescript
// ComponentName.tsx
import React from 'react';
import './ComponentName.css';

interface ComponentNameProps {
  // Props definition
}

export const ComponentName: React.FC<ComponentNameProps> = (props) => {
  // Component logic
  return (
    <div className="component-name">
      {/* Component JSX */}
    </div>
  );
};
```

2. **Hook Creation**
```typescript
// useHookName.ts
import { useState, useEffect } from 'react';

export const useHookName = (params) => {
  // Hook logic
  return {
    // Return values
  };
};
```

3. **Testing**
```typescript
// component.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Component Name', () => {
  test('should render correctly', async ({ page }) => {
    // Test logic
  });
});
```

### Best Practices

1. **Component Guidelines**
   - Use functional components with hooks
   - Implement proper TypeScript types
   - Add loading and error states
   - Include accessibility attributes
   - Write component-specific CSS

2. **State Management**
   - Use local state for component-specific data
   - Use context for cross-component state
   - Implement proper memoization
   - Avoid unnecessary re-renders

3. **API Integration**
   - Use tRPC for type-safe APIs
   - Implement proper error handling
   - Add loading states
   - Cache responses when appropriate

4. **Performance**
   - Lazy load heavy components
   - Implement code splitting
   - Use React.memo for expensive components
   - Optimize re-renders

---

## Deployment

### Build Process

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Production Configuration

1. **Build Optimization**
   - Tree shaking enabled
   - Code splitting configured
   - Asset optimization
   - Source maps for debugging

2. **Security**
   - CSRF protection enabled
   - Content Security Policy
   - XSS prevention
   - Secure WebSocket connections

3. **Performance**
   - CDN for static assets
   - Gzip compression
   - Browser caching
   - Service worker for offline

---

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check WebSocket server (port 8080)
   - Verify CORS configuration
   - Check firewall settings

2. **API Errors**
   - Verify backend server (port 3001)
   - Check API endpoint URLs
   - Review CSRF token handling

3. **Build Errors**
   - Clear node_modules and reinstall
   - Check TypeScript errors
   - Verify environment variables

4. **Test Failures**
   - Ensure all services are running
   - Check test data initialization
   - Review selector changes

---

## Support & Resources

### Documentation
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [tRPC Documentation](https://trpc.io)
- [Playwright Testing](https://playwright.dev)

### Project Links
- Repository: `/home/pricepro2006/CrewAI_Team`
- Issues: GitHub Issues
- Wiki: Project Wiki

---

## Version History

- **v2.3.0** - Current stable release
  - Walmart Grocery Agent integration
  - Enhanced email processing
  - WebSocket real-time updates
  - Comprehensive testing suite

---

*Last Updated: August 8, 2025*
*Documentation Version: 1.0.0*