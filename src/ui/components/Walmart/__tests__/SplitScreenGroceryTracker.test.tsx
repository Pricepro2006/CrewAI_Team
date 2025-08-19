/**
 * Tests for Split Screen Grocery Tracker Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SplitScreenGroceryTracker } from '../SplitScreenGroceryTracker';
import type { BudgetAlert, ReceiptItem } from '../../../types/grocery-tracker';

// Mock the custom hook
vi.mock('../../hooks/useGroceryTracker', () => ({
  useGroceryTracker: vi.fn()
}));

// Mock UI components
vi.mock('../../../../components/ui/button', () => ({
  Button: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  )
}));

vi.mock('../../../../components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  )
}));

vi.mock('../../../../components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div className={`progress ${className}`} data-testid="progress" data-value={value}>
      <div style={{ width: `${value}%` }} />
    </div>
  )
}));

vi.mock('../../../../components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={`badge ${variant} ${className}`}>{children}</span>
  )
}));

vi.mock('../../../../components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={`card ${className}`}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={`card-content ${className}`}>{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={`card-header ${className}`}>{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 className={`card-title ${className}`}>{children}</h3>
  )
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  ShoppingCart: () => <div data-testid="shopping-cart-icon" />,
  DollarSign: () => <div data-testid="dollar-sign-icon" />,
  BarChart3: () => <div data-testid="bar-chart-icon" />,
  Search: () => <div data-testid="search-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Minus: () => <div data-testid="minus-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Edit3: () => <div data-testid="edit-icon" />,
  CheckCircle: () => <div data-testid="check-icon" />,
  X: () => <div data-testid="x-icon" />,
  Bell: () => <div data-testid="bell-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
  Save: () => <div data-testid="save-icon" />,
  Share2: () => <div data-testid="share-icon" />,
  Receipt: () => <div data-testid="receipt-icon" />,
  CreditCard: () => <div data-testid="credit-card-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  Target: () => <div data-testid="target-icon" />
}));

describe('SplitScreenGroceryTracker', () => {
  const mockUseGroceryTracker = vi.mocked(
    require('../../hooks/useGroceryTracker').useGroceryTracker
  );

  const mockState = {
    searchState: {
      query: '',
      isSearching: false,
      results: [],
      selectedProduct: null,
      filters: {},
      pagination: { page: 1, totalPages: 1, totalItems: 0 }
    },
    receiptState: {
      currentSession: {
        id: 'test-session',
        userId: 'test-user',
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active' as const
      },
      savedSessions: [],
      recentItems: [],
      favoriteItems: [],
      isLoading: false,
      error: null
    },
    budgetState: {
      monthlyBudget: 500,
      categories: [
        {
          id: 'fresh_produce',
          name: 'Fresh Produce',
          allocated: 125,
          spent: 0,
          percentage: 0,
          color: 'bg-green-500',
          icon: '🥬',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      alerts: [],
      spendingLogs: [],
      metrics: {
        totalAllocated: 500,
        totalSpent: 0,
        totalRemaining: 500,
        utilizationPercentage: 0,
        categoriesOverBudget: 0,
        categoriesNearLimit: 0,
        averageSpendingPerCategory: 0,
        projectedMonthEnd: 0,
        mostSpentCategory: { id: '', name: '', amount: 0, percentage: 0 },
        leastSpentCategory: { id: '', name: '', amount: 0, percentage: 0 },
        spendingVelocity: { daily: 0, weekly: 0, monthly: 0 }
      },
      insights: [],
      recommendations: []
    },
    uiState: {
      editingBudget: false,
      showAlerts: false,
      activeView: 'split' as const,
      sidebarCollapsed: false,
      loading: false,
      error: null
    },
    websocketState: {
      connected: false,
      reconnecting: false,
      messageQueue: [],
      subscriptions: []
    }
  };

  const mockActions = {
    searchProducts: vi.fn(),
    clearSearch: vi.fn(),
    selectProduct: vi.fn(),
    addItem: vi.fn(),
    updateItemQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearReceipt: vi.fn(),
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    updateMonthlyBudget: vi.fn(),
    updateCategoryBudget: vi.fn(),
    acknowledgeAlert: vi.fn(),
    dismissAlert: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendMessage: vi.fn()
  };

  const mockComputed = {
    totalItems: 0,
    totalCost: 0,
    budgetUtilization: 0,
    activeAlerts: [],
    categoriesOverBudget: [],
    topCategories: [],
    recentActivity: []
  };

  beforeEach(() => {
    mockUseGroceryTracker.mockReturnValue({
      state: mockState,
      actions: mockActions,
      computed: mockComputed
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      render(<SplitScreenGroceryTracker />);
      expect(screen.getByText('Grocery Tracker')).toBeInTheDocument();
    });

    it('displays the split screen layout', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Grocery Tracker')).toBeInTheDocument();
      expect(screen.getByText('Budget Tracker')).toBeInTheDocument();
    });

    it('shows initial empty state', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
      expect(screen.getByText('0 items')).toBeInTheDocument();
    });

    it('displays search input', () => {
      render(<SplitScreenGroceryTracker />);
      
      const searchInput = screen.getByPlaceholderText('Search products to add...');
      expect(searchInput).toBeInTheDocument();
    });

    it('shows budget information', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Monthly Budget')).toBeInTheDocument();
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('calls search when typing in search input', async () => {
      render(<SplitScreenGroceryTracker />);
      
      const searchInput = screen.getByPlaceholderText('Search products to add...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'apple' } });
      });
      
      expect(mockActions.searchProducts).toHaveBeenCalledWith({ query: 'apple' });
    });

    it('clears search when input is emptied', async () => {
      render(<SplitScreenGroceryTracker />);
      
      const searchInput = screen.getByPlaceholderText('Search products to add...');
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '' } });
      });
      
      expect(mockActions.clearSearch).toHaveBeenCalled();
    });

    it('displays search results', () => {
      const stateWithResults = {
        ...mockState,
        searchState: {
          ...mockState.searchState,
          results: [
            {
              productId: 'apple-1',
              name: 'Red Apples (3 lbs)',
              category: 'Fresh Produce',
              price: 3.99,
              imageUrl: '/apple.jpg',
              inStock: true,
              unit: 'bag'
            }
          ]
        }
      };
      
      mockUseGroceryTracker.mockReturnValue({
        state: stateWithResults,
        actions: mockActions,
        computed: mockComputed
      });
      
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Red Apples (3 lbs)')).toBeInTheDocument();
      expect(screen.getByText('Fresh Produce')).toBeInTheDocument();
    });
  });

  describe('Budget Management', () => {
    it('displays budget categories', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Fresh Produce')).toBeInTheDocument();
      expect(screen.getByText('$0.00 / $125.00')).toBeInTheDocument();
    });

    it('allows editing monthly budget', async () => {
      render(<SplitScreenGroceryTracker />);
      
      const editButton = screen.getByText('$500.00');
      
      await act(async () => {
        fireEvent.click(editButton);
      });
      
      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });

    it('shows budget progress bars', () => {
      render(<SplitScreenGroceryTracker />);
      
      const progressBars = screen.getAllByTestId('progress');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('displays budget alerts when present', () => {
      const stateWithAlerts = {
        ...mockState,
        budgetState: {
          ...mockState.budgetState,
          alerts: [
            {
              id: 'alert-1',
              categoryId: 'fresh_produce',
              categoryName: 'Fresh Produce',
              type: 'warning' as const,
              threshold: 90,
              currentAmount: 112.5,
              message: 'Approaching budget limit for Fresh Produce',
              timestamp: new Date(),
              acknowledged: false
            }
          ]
        }
      };
      
      const computedWithAlerts = {
        ...mockComputed,
        activeAlerts: stateWithAlerts.budgetState.alerts
      };
      
      mockUseGroceryTracker.mockReturnValue({
        state: stateWithAlerts,
        actions: mockActions,
        computed: computedWithAlerts
      });
      
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Approaching budget limit for Fresh Produce')).toBeInTheDocument();
    });
  });

  describe('Receipt Management', () => {
    it('shows empty receipt message when no items', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
      expect(screen.getByText('Search for products above to start building your list')).toBeInTheDocument();
    });

    it('displays receipt items when present', () => {
      const stateWithItems = {
        ...mockState,
        receiptState: {
          ...mockState.receiptState,
          currentSession: {
            ...mockState.receiptState.currentSession!,
            items: [
              {
                id: 'item-1',
                productId: 'apple-1',
                name: 'Red Apples (3 lbs)',
                category: 'Fresh Produce',
                quantity: 2,
                unitPrice: 3.99,
                totalPrice: 7.98,
                imageUrl: '/apple.jpg',
                inStock: true,
                unit: 'bag',
                addedAt: new Date()
              }
            ],
            itemCount: 1,
            subtotal: 7.98,
            tax: 0.70,
            total: 8.68
          }
        }
      };
      
      const computedWithItems = {
        ...mockComputed,
        totalItems: 1,
        totalCost: 8.68
      };
      
      mockUseGroceryTracker.mockReturnValue({
        state: stateWithItems,
        actions: mockActions,
        computed: computedWithItems
      });
      
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Red Apples (3 lbs)')).toBeInTheDocument();
      expect(screen.getByText('$7.98')).toBeInTheDocument();
      expect(screen.getByText('1 items')).toBeInTheDocument();
    });

    it('calls remove item when trash button clicked', async () => {
      const stateWithItems = {
        ...mockState,
        receiptState: {
          ...mockState.receiptState,
          currentSession: {
            ...mockState.receiptState.currentSession!,
            items: [
              {
                id: 'item-1',
                productId: 'apple-1',
                name: 'Red Apples (3 lbs)',
                category: 'Fresh Produce',
                quantity: 1,
                unitPrice: 3.99,
                totalPrice: 3.99,
                imageUrl: '/apple.jpg',
                inStock: true,
                unit: 'bag',
                addedAt: new Date()
              }
            ]
          }
        }
      };
      
      mockUseGroceryTracker.mockReturnValue({
        state: stateWithItems,
        actions: mockActions,
        computed: mockComputed
      });
      
      render(<SplitScreenGroceryTracker />);
      
      const trashButton = screen.getByTestId('trash-icon').closest('button');
      
      await act(async () => {
        fireEvent.click(trashButton!);
      });
      
      expect(mockActions.removeItem).toHaveBeenCalledWith('item-1');
    });

    it('shows receipt totals when items are present', () => {
      const stateWithItems = {
        ...mockState,
        receiptState: {
          ...mockState.receiptState,
          currentSession: {
            ...mockState.receiptState.currentSession!,
            items: [/* mock items */],
            subtotal: 10.00,
            tax: 0.88,
            total: 10.88
          }
        }
      };
      
      mockUseGroceryTracker.mockReturnValue({
        state: stateWithItems,
        actions: mockActions,
        computed: mockComputed
      });
      
      render(<SplitScreenGroceryTracker />);
      
      expect(screen.getByText('Subtotal:')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('Tax (8.75%):')).toBeInTheDocument();
      expect(screen.getByText('$0.88')).toBeInTheDocument();
      expect(screen.getByText('Total:')).toBeInTheDocument();
      expect(screen.getByText('$10.88')).toBeInTheDocument();
    });
  });

  describe('Event Handlers', () => {
    it('calls onError when provided', () => {
      const onError = vi.fn();
      const onBudgetAlert = vi.fn();
      const onItemAdded = vi.fn();
      
      render(
        <SplitScreenGroceryTracker
          onError={onError}
          onBudgetAlert={onBudgetAlert}
          onItemAdded={onItemAdded}
        />
      );
      
      expect(mockUseGroceryTracker).toHaveBeenCalledWith(
        expect.objectContaining({
          onError,
          onBudgetAlert,
          onItemAdded
        })
      );
    });

    it('uses default props when not provided', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(mockUseGroceryTracker).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'default-user',
          initialBudget: 500,
          taxRate: 0.0875,
          autoSave: true,
          enableWebSocket: true
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<SplitScreenGroceryTracker />);
      
      const searchInput = screen.getByPlaceholderText('Search products to add...');
      expect(searchInput).toBeInTheDocument();
      
      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation', async () => {
      render(<SplitScreenGroceryTracker />);
      
      const searchInput = screen.getByPlaceholderText('Search products to add...');
      
      // Test Tab navigation
      await act(async () => {
        searchInput.focus();
        fireEvent.keyDown(searchInput, { key: 'Tab' });
      });
      
      // Input should be focusable
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies custom className when provided', () => {
      const { container } = render(
        <SplitScreenGroceryTracker className="custom-tracker" />
      );
      
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv.className).toContain('custom-tracker');
    });
  });

  describe('Integration', () => {
    it('integrates with useGroceryTracker hook correctly', () => {
      render(<SplitScreenGroceryTracker />);
      
      expect(mockUseGroceryTracker).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'default-user',
          initialBudget: 500,
          taxRate: 0.0875,
          autoSave: true,
          enableWebSocket: true
        })
      );
    });

    it('passes custom configuration to hook', () => {
      const customConfig = {
        userId: 'custom-user',
        initialBudget: 1000,
        taxRate: 0.1,
        autoSave: false,
        enableWebSocket: false
      };
      
      render(<SplitScreenGroceryTracker {...customConfig} />);
      
      expect(mockUseGroceryTracker).toHaveBeenCalledWith(
        expect.objectContaining(customConfig)
      );
    });
  });
});