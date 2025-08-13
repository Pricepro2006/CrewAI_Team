/**
 * Unit Tests for NLP Search Input Component
 * Tests voice input, search suggestions, and NLP integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalmartNLPSearch } from '../../../src/ui/components/Walmart/WalmartNLPSearch.js';
import { api } from '../../../src/utils/trpc.js';

// Mock tRPC API
vi.mock('../../../src/utils/trpc.js', () => ({
  api: {
    walmartGrocery: {
      searchProducts: {
        useMutation: vi.fn()
      },
      addToCart: {
        useMutation: vi.fn()
      }
    }
  }
}));

// Mock WebSocket hook
vi.mock('../../../src/ui/hooks/useWalmartWebSocket.js', () => ({
  useWalmartWebSocket: () => ({
    isConnected: true,
    nlpProcessing: false,
    nlpResult: null,
    productMatches: [],
    sessionId: 'test-session-123',
    error: null
  })
}));

// Mock Web Speech API
const mockSpeechRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  continuous: false,
  interimResults: false,
  lang: 'en-US'
};

Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: vi.fn(() => mockSpeechRecognition)
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: vi.fn(() => mockSpeechRecognition)
});

// Mock axios for NLP API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('NLP Search Input Component', () => {
  let queryClient: QueryClient;
  let mockSearchProducts: any;
  let mockAddToCart: any;
  let user: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockSearchProducts = {
      mutate: vi.fn(),
      isLoading: false,
      isError: false,
      error: null
    };

    mockAddToCart = {
      mutate: vi.fn(),
      isLoading: false,
      isError: false,
      error: null
    };

    (api.walmartGrocery.searchProducts.useMutation as any).mockReturnValue(mockSearchProducts);
    (api.walmartGrocery.addToCart.useMutation as any).mockReturnValue(mockAddToCart);

    user = userEvent.setup();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WalmartNLPSearch />
      </QueryClientProvider>
    );
  };

  describe('Basic Rendering', () => {
    it('should render search input field', () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should render voice input button', () => {
      renderComponent();
      
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      expect(voiceButton).toBeInTheDocument();
    });

    it('should render search button', () => {
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toBeInTheDocument();
    });

    it('should show connection status indicator', () => {
      renderComponent();
      
      const connectionIndicator = screen.getByTestId('websocket-status');
      expect(connectionIndicator).toBeInTheDocument();
      expect(connectionIndicator).toHaveClass('connected');
    });
  });

  describe('Text Input Functionality', () => {
    it('should update input value when typing', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'I need milk and bread');
      
      expect(searchInput).toHaveValue('I need milk and bread');
    });

    it('should trigger search on Enter key', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'search_products',
          confidence: 0.95,
          items: ['milk', 'bread'],
          quantities: [],
          action: 'search'
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'I need milk and bread');
      await user.keyboard('{Enter}');
      
      expect(axios.default.post).toHaveBeenCalledWith('/api/nlp/process', {
        text: 'I need milk and bread',
        userId: 'user123',
        sessionId: 'test-session-123'
      });
    });

    it('should show loading state during NLP processing', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      const searchButton = screen.getByRole('button', { name: /search/i });
      
      await user.type(searchInput, 'Find coffee');
      await user.click(searchButton);
      
      expect(screen.getByTestId('nlp-processing')).toBeInTheDocument();
      expect(screen.getByText(/processing your request/i)).toBeInTheDocument();
    });

    it('should clear input after successful search', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'search_products',
          confidence: 0.95,
          items: ['coffee'],
          quantities: [],
          action: 'search'
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'Find coffee');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Voice Input Functionality', () => {
    it('should start voice recognition when voice button clicked', async () => {
      renderComponent();
      
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      await user.click(voiceButton);
      
      expect(mockSpeechRecognition.start).toHaveBeenCalled();
      expect(screen.getByTestId('voice-recording')).toBeInTheDocument();
    });

    it('should show recording indicator during voice input', async () => {
      renderComponent();
      
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      await user.click(voiceButton);
      
      expect(screen.getByTestId('voice-recording')).toBeInTheDocument();
      expect(screen.getByText(/listening/i)).toBeInTheDocument();
    });

    it('should handle voice recognition results', async () => {
      renderComponent();
      
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      await user.click(voiceButton);
      
      // Simulate speech recognition result
      const onResult = mockSpeechRecognition.addEventListener.mock.calls
        .find(call => call[0] === 'result')[1];
      
      if (onResult) {
        onResult({
          results: [{
            0: { transcript: 'Add organic milk to my cart' },
            isFinal: true
          }]
        });
      }
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
        expect(searchInput).toHaveValue('Add organic milk to my cart');
      });
    });

    it('should handle voice recognition errors', async () => {
      renderComponent();
      
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      await user.click(voiceButton);
      
      // Simulate speech recognition error
      const onError = mockSpeechRecognition.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1];
      
      if (onError) {
        onError({ error: 'no-speech' });
      }
      
      await waitFor(() => {
        expect(screen.getByText(/no speech detected/i)).toBeInTheDocument();
      });
    });

    it('should stop recording when stop button clicked', async () => {
      renderComponent();
      
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      await user.click(voiceButton);
      
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      await user.click(stopButton);
      
      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
    });
  });

  describe('NLP Processing and Results', () => {
    it('should handle search intent correctly', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'search_products',
          confidence: 0.95,
          items: ['milk', 'bread'],
          quantities: [],
          action: 'search'
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'I need milk and bread');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockSearchProducts.mutate).toHaveBeenCalledWith({
          query: 'milk bread',
          limit: 20
        });
      });
    });

    it('should handle add to cart intent', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'add_items',
          confidence: 0.92,
          items: ['apples'],
          quantities: ['5'],
          action: 'add_to_cart',
          products: [{
            id: 'apple-123',
            name: 'Fresh Red Apples',
            brand: 'Great Value',
            price: 3.99,
            inStock: true
          }]
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'Add 5 apples to my cart');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/found 1 product to add/i)).toBeInTheDocument();
        expect(screen.getByText(/fresh red apples/i)).toBeInTheDocument();
      });
    });

    it('should display NLP confidence score', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'search_products',
          confidence: 0.87,
          items: ['coffee'],
          quantities: [],
          action: 'search'
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'Find coffee');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByTestId('nlp-insight')).toBeInTheDocument();
        expect(screen.getByText(/87% confident/i)).toBeInTheDocument();
      });
    });

    it('should show fallback message for low confidence', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'unknown',
          confidence: 0.45,
          items: [],
          quantities: [],
          action: 'search'
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'some unclear request');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/not sure what you meant/i)).toBeInTheDocument();
        expect(screen.getByText(/try rephrasing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Suggestions', () => {
    it('should show search suggestions as user types', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'mil');
      
      await waitFor(() => {
        expect(screen.getByTestId('search-suggestions')).toBeInTheDocument();
        expect(screen.getByText(/milk/i)).toBeInTheDocument();
        expect(screen.getByText(/almond milk/i)).toBeInTheDocument();
      });
    });

    it('should select suggestion when clicked', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'mil');
      
      await waitFor(() => {
        const suggestion = screen.getByText(/organic milk/i);
        expect(suggestion).toBeInTheDocument();
      });
      
      const suggestion = screen.getByText(/organic milk/i);
      await user.click(suggestion);
      
      expect(searchInput).toHaveValue('organic milk');
    });

    it('should navigate suggestions with keyboard', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'mil');
      
      await waitFor(() => {
        expect(screen.getByTestId('search-suggestions')).toBeInTheDocument();
      });
      
      // Navigate down
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('suggestion-0')).toHaveClass('highlighted');
      
      // Navigate down again
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('suggestion-1')).toHaveClass('highlighted');
      
      // Select with Enter
      await user.keyboard('{Enter}');
      expect(searchInput).toHaveValue(); // Should have selected suggestion
    });
  });

  describe('Error Handling', () => {
    it('should handle NLP service errors', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockRejectedValue(new Error('NLP service unavailable'));

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'Find milk');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/please try again/i)).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      renderComponent();
      
      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'Find milk');
      await user.keyboard('{Enter}');
      
      expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument();
    });

    it('should validate input length', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'a'.repeat(501)); // Exceed max length
      await user.keyboard('{Enter}');
      
      expect(screen.getByText(/search query too long/i)).toBeInTheDocument();
    });

    it('should handle empty search gracefully', async () => {
      renderComponent();
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);
      
      expect(screen.getByText(/please enter a search query/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();
      
      const searchInput = screen.getByLabelText(/search for products/i);
      expect(searchInput).toBeInTheDocument();
      
      const voiceButton = screen.getByLabelText(/voice search/i);
      expect(voiceButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      
      // Tab should focus the input
      await user.tab();
      expect(searchInput).toHaveFocus();
      
      // Tab should move to voice button
      await user.tab();
      const voiceButton = screen.getByRole('button', { name: /voice search/i });
      expect(voiceButton).toHaveFocus();
    });

    it('should announce search results to screen readers', async () => {
      const axios = await import('axios');
      (axios.default.post as any).mockResolvedValue({
        data: {
          intent: 'search_products',
          confidence: 0.95,
          items: ['milk'],
          quantities: [],
          action: 'search'
        }
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      await user.type(searchInput, 'milk');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/search completed/i);
      });
    });

    it('should have high contrast focus indicators', () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      searchInput.focus();
      
      expect(searchInput).toHaveClass('focus:ring-2');
      expect(searchInput).toHaveClass('focus:ring-blue-500');
    });
  });

  describe('Performance', () => {
    it('should debounce search suggestions', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      
      // Type rapidly
      await user.type(searchInput, 'milk');
      
      // Should not trigger immediate API calls
      expect(setTimeout).toHaveBeenCalled();
    });

    it('should cancel previous requests when new search starts', async () => {
      const axios = await import('axios');
      const mockCancel = vi.fn();
      (axios.default.post as any).mockReturnValue({
        cancel: mockCancel
      });

      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/tell me what you need/i);
      
      // Start first search
      await user.type(searchInput, 'milk');
      await user.keyboard('{Enter}');
      
      // Start second search quickly
      await user.clear(searchInput);
      await user.type(searchInput, 'bread');
      await user.keyboard('{Enter}');
      
      // First request should be cancelled
      expect(mockCancel).toHaveBeenCalled();
    });
  });
});