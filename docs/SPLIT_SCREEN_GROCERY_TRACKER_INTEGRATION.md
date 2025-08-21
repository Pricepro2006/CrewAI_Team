# Split Screen Grocery Tracker Integration Guide

## Overview

The Split Screen Grocery Tracker is a comprehensive React component for the CrewAI Team system that provides real-time grocery list management with integrated budget tracking. This document provides complete installation and integration instructions.

## Features

### Left Pane - Grocery Receipt
- **Product Search**: Real-time Walmart product search with auto-suggestions
- **Receipt Management**: Add, remove, edit quantities with visual feedback
- **Category Organization**: Items grouped by category with icons
- **Running Totals**: Live calculation of subtotal, tax, and total
- **Item Details**: Product images, pricing, savings indicators
- **Quantity Controls**: Intuitive +/- buttons with validation

### Right Pane - Budget Tracker
- **Monthly Budget**: Editable budget with visual progress indicators
- **Category Breakdown**: Budget allocation per category with progress bars
- **Real-time Alerts**: Automatic warnings at 90% and 100% thresholds
- **Budget Insights**: Smart recommendations and usage analytics
- **Visual Indicators**: Color-coded progress (green/yellow/red)
- **Spending Analytics**: Track spending patterns and trends

### Real-time Features
- **WebSocket Integration**: Live updates across browser tabs
- **Auto-save**: Automatic session persistence every 30 seconds
- **Price Monitoring**: Real-time price change notifications
- **Budget Alerts**: Instant notifications when approaching limits
- **State Synchronization**: Seamless updates across components

## Installation

### 1. Install Dependencies

```bash
npm install lucide-react class-variance-authority @radix-ui/react-slot
```

### 2. Copy Component Files

Copy the following files to your project:

```
src/ui/components/Walmart/SplitScreenGroceryTracker.tsx
src/ui/components/Walmart/SplitScreenGroceryTracker.module.css
src/ui/hooks/useGroceryTracker.ts
src/types/grocery-tracker.ts
```

### 3. Update API Router

Add the following tRPC procedures to your backend:

```typescript
// src/api/routes/grocery.router.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';

export const groceryRouter = router({
  // Budget Categories
  budgetCategories: router({
    getAll: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        // Return user's budget categories
      }),
      
    update: publicProcedure
      .input(z.object({ 
        categoryId: z.string(),
        allocated: z.number(),
        spent: z.number()
      }))
      .mutation(async ({ input }) => {
        // Update category budget
      }),
      
    create: publicProcedure
      .input(z.object({
        name: z.string(),
        allocated: z.number(),
        color: z.string(),
        icon: z.string()
      }))
      .mutation(async ({ input }) => {
        // Create new category
      })
  }),

  // Budget Alerts
  budgetAlerts: router({
    getActive: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        // Return active alerts for user
      }),
      
    acknowledge: publicProcedure
      .input(z.object({ alertId: z.string() }))
      .mutation(async ({ input }) => {
        // Mark alert as acknowledged
      }),
      
    dismiss: publicProcedure
      .input(z.object({ alertId: z.string() }))
      .mutation(async ({ input }) => {
        // Remove alert
      })
  }),

  // Spending Logs
  spendingLogs: router({
    create: publicProcedure
      .input(z.object({
        categoryId: z.string(),
        amount: z.number(),
        description: z.string(),
        type: z.enum(['expense', 'budget_allocation', 'adjustment'])
      }))
      .mutation(async ({ input }) => {
        // Log spending transaction
      }),
      
    getRecent: publicProcedure
      .input(z.object({ 
        userId: z.string(),
        limit: z.number().default(20)
      }))
      .query(async ({ input }) => {
        // Return recent spending logs
      })
  }),

  // Receipt Management
  receiptItems: router({
    add: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        productId: z.string(),
        name: z.string(),
        category: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        imageUrl: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        // Add item to receipt
      }),
      
    updateQuantity: publicProcedure
      .input(z.object({
        itemId: z.string(),
        quantity: z.number()
      }))
      .mutation(async ({ input }) => {
        // Update item quantity
      }),
      
    remove: publicProcedure
      .input(z.object({ itemId: z.string() }))
      .mutation(async ({ input }) => {
        // Remove item from receipt
      })
  }),

  // Receipt Sessions
  receiptSessions: router({
    create: publicProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input }) => {
        // Create new receipt session
      }),
      
    save: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        name: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        // Save current session
      }),
      
    load: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        // Load saved session
      }),
      
    getAll: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        // Get all user sessions
      })
  }),

  // Receipt State
  receiptState: router({
    get: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        // Get current receipt state
      }),
      
    update: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        subtotal: z.number(),
        tax: z.number(),
        total: z.number()
      }))
      .mutation(async ({ input }) => {
        // Update receipt totals
      })
  })
});
```

### 4. Database Schema

Add the following tables to your database:

```sql
-- Budget Categories
CREATE TABLE budget_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  allocated REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  percentage REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budget Alerts
CREATE TABLE budget_alerts (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warning', 'danger', 'info')),
  threshold REAL NOT NULL,
  current_amount REAL NOT NULL,
  message TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged BOOLEAN DEFAULT FALSE,
  auto_hide BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES budget_categories (id)
);

-- Spending Logs
CREATE TABLE spending_logs (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('expense', 'budget_allocation', 'adjustment')),
  item_id TEXT,
  receipt_id TEXT,
  metadata TEXT, -- JSON storage
  FOREIGN KEY (category_id) REFERENCES budget_categories (id)
);

-- Receipt Sessions
CREATE TABLE receipt_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'saved', 'completed', 'cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  metadata TEXT -- JSON storage for location, store, etc.
);

-- Receipt Items
CREATE TABLE receipt_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  original_price REAL,
  image_url TEXT,
  in_stock BOOLEAN DEFAULT TRUE,
  unit TEXT NOT NULL DEFAULT 'each',
  sku TEXT,
  notes TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES receipt_sessions (id)
);

-- Indexes for performance
CREATE INDEX idx_budget_categories_user_id ON budget_categories (user_id);
CREATE INDEX idx_budget_alerts_category_id ON budget_alerts (category_id);
CREATE INDEX idx_spending_logs_category_id ON spending_logs (category_id);
CREATE INDEX idx_spending_logs_timestamp ON spending_logs (timestamp);
CREATE INDEX idx_receipt_sessions_user_id ON receipt_sessions (user_id);
CREATE INDEX idx_receipt_items_session_id ON receipt_items (session_id);
```

### 5. WebSocket Events

Add WebSocket event handlers to your server:

```typescript
// src/api/websocket/grocery-events.ts
import type { WebSocketMessage } from '../../types/grocery-tracker';

export const groceryWebSocketEvents = {
  // Handle item additions
  'item-added': async (data: any, broadcast: Function) => {
    // Broadcast to all connected clients
    broadcast({
      type: 'item-added',
      data,
      timestamp: new Date()
    });
  },

  // Handle spending updates
  'spending-updated': async (data: any, broadcast: Function) => {
    // Check for budget alerts
    const alerts = await checkBudgetThresholds(data.categoryId, data.newAmount);
    
    // Broadcast spending update
    broadcast({
      type: 'spending-updated',
      data,
      timestamp: new Date()
    });
    
    // Broadcast any alerts
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        broadcast({
          type: 'budget-alert',
          data: alert,
          timestamp: new Date()
        });
      });
    }
  },

  // Handle budget updates
  'budget-updated': async (data: any, broadcast: Function) => {
    broadcast({
      type: 'budget-updated',
      data,
      timestamp: new Date()
    });
  },

  // Handle session updates
  'session-updated': async (data: any, broadcast: Function) => {
    broadcast({
      type: 'session-updated',
      data,
      timestamp: new Date()
    });
  }
};

async function checkBudgetThresholds(categoryId: string, newAmount: number) {
  // Implementation to check if spending exceeds thresholds
  // Return array of alerts if thresholds are crossed
  return [];
}
```

## Component Usage

### Basic Usage

```typescript
import React from 'react';
import { SplitScreenGroceryTracker } from './ui/components/Walmart/SplitScreenGroceryTracker';

function App() {
  const handleError = (error: Error) => {
    console.error('Grocery tracker error:', error);
    // Handle error (show toast, log to service, etc.)
  };

  const handleBudgetAlert = (alert: BudgetAlert) => {
    console.log('Budget alert:', alert);
    // Handle alert (show notification, play sound, etc.)
  };

  const handleItemAdded = (item: ReceiptItem) => {
    console.log('Item added:', item);
    // Handle item addition (analytics, notifications, etc.)
  };

  return (
    <div className="app">
      <SplitScreenGroceryTracker
        userId="user123"
        initialBudget={600}
        taxRate={0.095} // 9.5%
        autoSave={true}
        enableWebSocket={true}
        onError={handleError}
        onBudgetAlert={handleBudgetAlert}
        onItemAdded={handleItemAdded}
        className="my-grocery-tracker"
      />
    </div>
  );
}

export default App;
```

### Advanced Usage with Custom Hook

```typescript
import React from 'react';
import { useGroceryTracker } from './ui/hooks/useGroceryTracker';
import type { BudgetAlert } from './types/grocery-tracker';

function CustomGroceryInterface() {
  const { state, actions, computed } = useGroceryTracker({
    userId: 'advanced-user',
    initialBudget: 1000,
    autoSave: true,
    enableWebSocket: true,
    onBudgetAlert: (alert: BudgetAlert) => {
      // Custom alert handling
      if (alert.type === 'danger') {
        // Show urgent notification
        showUrgentAlert(alert.message);
      }
    }
  });

  const {
    searchState,
    receiptState: { currentSession },
    budgetState: { categories, monthlyBudget }
  } = state;

  return (
    <div className="custom-grocery-interface">
      <div className="budget-summary">
        <h2>Budget Overview</h2>
        <p>Monthly Budget: ${monthlyBudget}</p>
        <p>Total Spent: ${computed.totalCost}</p>
        <p>Utilization: {computed.budgetUtilization.toFixed(1)}%</p>
      </div>
      
      <div className="quick-actions">
        <button onClick={() => actions.searchProducts({ query: 'milk' })}>
          Quick Add Milk
        </button>
        <button onClick={() => actions.clearReceipt()}>
          Clear Cart
        </button>
        <button onClick={() => actions.saveSession('My Shopping List')}>
          Save List
        </button>
      </div>
      
      {/* Rest of custom interface */}
    </div>
  );
}

function showUrgentAlert(message: string) {
  // Custom urgent alert implementation
  alert(`BUDGET ALERT: ${message}`);
}
```

## Styling Customization

### CSS Variables

Customize the component appearance using CSS variables:

```css
.my-grocery-tracker {
  --grocery-primary-color: #3b82f6;
  --grocery-success-color: #10b981;
  --grocery-warning-color: #f59e0b;
  --grocery-danger-color: #ef4444;
  --grocery-border-radius: 0.5rem;
  --grocery-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### Theme Integration

Integrate with your existing theme system:

```css
/* Dark theme support */
[data-theme="dark"] .split-screen-grocery-tracker {
  --grocery-bg-primary: #1f2937;
  --grocery-bg-secondary: #374151;
  --grocery-text-primary: #f9fafb;
  --grocery-text-secondary: #d1d5db;
  --grocery-border-color: #4b5563;
}

/* Custom color scheme */
.brand-theme .split-screen-grocery-tracker {
  --grocery-primary-color: var(--brand-primary);
  --grocery-success-color: var(--brand-success);
  --grocery-warning-color: var(--brand-warning);
}
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load the component for better performance
import { lazy, Suspense } from 'react';

const SplitScreenGroceryTracker = lazy(() => 
  import('./ui/components/Walmart/SplitScreenGroceryTracker')
);

function App() {
  return (
    <Suspense fallback={
      <div className="loading-grocery-tracker">
        <div className="spinner" />
        <p>Loading Grocery Tracker...</p>
      </div>
    }>
      <SplitScreenGroceryTracker />
    </Suspense>
  );
}
```

### Memory Management

```typescript
// Configure hook options for optimal performance
const { state, actions } = useGroceryTracker({
  autoSaveInterval: 60000, // Save every minute instead of 30 seconds
  enableWebSocket: false, // Disable if not needed
  onError: (error) => {
    // Log errors to external service
    errorLogger.log(error);
  }
});
```

## Testing

### Unit Tests

```typescript
// src/ui/components/Walmart/__tests__/SplitScreenGroceryTracker.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SplitScreenGroceryTracker } from '../SplitScreenGroceryTracker';

describe('SplitScreenGroceryTracker', () => {
  it('renders the component with initial state', () => {
    render(<SplitScreenGroceryTracker />);
    
    expect(screen.getByText('Grocery Tracker')).toBeInTheDocument();
    expect(screen.getByText('Budget Tracker')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search products to add...')).toBeInTheDocument();
  });

  it('allows adding items to receipt', async () => {
    render(<SplitScreenGroceryTracker />);
    
    const searchInput = screen.getByPlaceholderText('Search products to add...');
    fireEvent.change(searchInput, { target: { value: 'banana' } });
    
    await waitFor(() => {
      expect(screen.getByText('Search result for "banana"')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Search result for "banana"'));
    
    await waitFor(() => {
      expect(screen.getByText('1 items')).toBeInTheDocument();
    });
  });

  it('shows budget alerts when thresholds are exceeded', async () => {
    render(
      <SplitScreenGroceryTracker 
        initialBudget={10} // Low budget to trigger alerts
      />
    );
    
    // Add expensive item
    const searchInput = screen.getByPlaceholderText('Search products to add...');
    fireEvent.change(searchInput, { target: { value: 'expensive item' } });
    
    // ... trigger alert scenario
    
    await waitFor(() => {
      expect(screen.getByText(/Budget exceeded/)).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

```typescript
// src/ui/hooks/__tests__/useGroceryTracker.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGroceryTracker } from '../useGroceryTracker';

describe('useGroceryTracker', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useGroceryTracker());
    
    expect(result.current.state.budgetState.monthlyBudget).toBe(500);
    expect(result.current.state.receiptState.currentSession).toBeTruthy();
    expect(result.current.computed.totalItems).toBe(0);
  });

  it('adds items and updates totals correctly', async () => {
    const { result } = renderHook(() => useGroceryTracker());
    
    await act(async () => {
      await result.current.actions.addItem({
        productId: 'test-1',
        name: 'Test Product',
        category: 'Fresh Produce',
        price: 5.99,
        imageUrl: '/test.jpg',
        inStock: true,
        unit: 'each'
      });
    });
    
    expect(result.current.computed.totalItems).toBe(1);
    expect(result.current.computed.totalCost).toBeCloseTo(6.51); // Including tax
  });
});
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   ```
   Solution: Check WebSocket server configuration and CORS settings
   ```

2. **Budget Alerts Not Showing**
   ```
   Solution: Verify alert thresholds and budget category allocations
   ```

3. **Search Not Working**
   ```
   Solution: Ensure Walmart API integration is properly configured
   ```

4. **Auto-save Issues**
   ```
   Solution: Check localStorage availability and session management
   ```

### Debug Mode

Enable debug logging:

```typescript
const { state, actions } = useGroceryTracker({
  onError: (error) => {
    console.group('🛒 Grocery Tracker Error');
    console.error('Error:', error);
    console.log('Current state:', state);
    console.groupEnd();
  }
});

// Enable WebSocket debugging
if (process.env.NODE_ENV === 'development') {
  window.groceryTrackerDebug = { state, actions };
}
```

## Support

For issues and feature requests:

1. Check the component documentation
2. Review the TypeScript interfaces in `grocery-tracker.ts`
3. Test with the provided examples
4. Enable debug mode for detailed logging

## Future Enhancements

- [ ] Barcode scanning integration
- [ ] Voice search functionality  
- [ ] Recipe-based shopping lists
- [ ] Store location integration
- [ ] Coupon and discount tracking
- [ ] Nutritional information display
- [ ] Smart reordering suggestions
- [ ] Export to external shopping apps

This component provides a solid foundation for grocery management within the CrewAI Team ecosystem and can be extended based on specific business requirements.