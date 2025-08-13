/**
 * Unit Tests for Search Interface with Virtualization
 * Tests search results rendering, filtering, virtualization performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalmartAdvancedSearch } from '../../../src/ui/components/Walmart/WalmartAdvancedSearch.js';
import type { WalmartProduct } from '../../../src/types/walmart-grocery.js';

// Mock react-window for virtualization
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height }: any) => (
    <div 
      data-testid="virtual-list" 
      style={{ height }}
      data-item-count={itemCount}
      data-item-size={itemSize}
    >
      {Array.from({ length: Math.min(itemCount, 10) }).map((_, index) =>
        children({ index, style: {} })
      )}
    </div>
  )
}));

// Mock tRPC API
vi.mock('../../../src/utils/trpc.js', () => ({
  api: {
    walmartGrocery: {
      searchProducts: {
        useQuery: vi.fn(),
        useMutation: vi.fn()
      },
      getCategories: {
        useQuery: vi.fn()
      },
      getBrands: {
        useQuery: vi.fn()
      }
    }
  }
}));

// Mock intersection observer for virtualization
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

describe('Search Interface with Virtualization', () => {
  let queryClient: QueryClient;
  let user: any;

  const mockProducts: WalmartProduct[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `prod-${i}`,
    name: `Product ${i}`,
    brand: `Brand ${i % 10}`,
    current_price: 10 + (i % 50),
    regular_price: 12 + (i % 50),
    in_stock: i % 3 !== 0,
    category: `Category ${i % 5}`,
    image_url: `https://example.com/product-${i}.jpg`,
    description: `Description for product ${i}`,
    unit: 'each',
    size: '1 unit'
  }));

  const mockSearchQuery = {
    data: {
      products: mockProducts.slice(0, 20),
      total: 1000,
      hasMore: true,
      facets: {
        categories: { 'Category 0': 200, 'Category 1': 200, 'Category 2': 200 },
        brands: { 'Brand 0': 100, 'Brand 1': 100, 'Brand 2': 100 },
        priceRanges: { '$0-20': 500, '$20-40': 300, '$40+': 200 }
      }
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn()
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    user = userEvent.setup();

    // Mock API responses
    const { api } = require('../../../src/utils/trpc.js');
    api.walmartGrocery.searchProducts.useQuery.mockReturnValue(mockSearchQuery);
    api.walmartGrocery.getCategories.useQuery.mockReturnValue({
      data: ['Category 0', 'Category 1', 'Category 2', 'Category 3', 'Category 4'],
      isLoading: false
    });
    api.walmartGrocery.getBrands.useQuery.mockReturnValue({
      data: ['Brand 0', 'Brand 1', 'Brand 2', 'Brand 3', 'Brand 4'],
      isLoading: false
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WalmartAdvancedSearch {...props} />
      </QueryClientProvider>
    );
  };

  describe('Basic Rendering and Search', () => {
    it('should render search input and filters', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      expect(screen.getByText(/filters/i)).toBeInTheDocument();
      expect(screen.getByText(/sort by/i)).toBeInTheDocument();
    });

    it('should display search results count', () => {
      renderComponent();
      
      expect(screen.getByText(/1000 results/i)).toBeInTheDocument();
    });

    it('should show loading state during search', () => {
      const { api } = require('../../../src/utils/trpc.js');
      api.walmartGrocery.searchProducts.useQuery.mockReturnValue({
        ...mockSearchQuery,
        isLoading: true
      });

      renderComponent();
      
      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it('should handle search errors gracefully', () => {
      const { api } = require('../../../src/utils/trpc.js');
      api.walmartGrocery.searchProducts.useQuery.mockReturnValue({
        ...mockSearchQuery,
        isError: true,
        error: { message: 'Search service unavailable' }
      });

      renderComponent();
      
      expect(screen.getByText(/search service unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Virtualization Performance', () => {
    it('should render virtual list for large result sets', () => {
      renderComponent();
      
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
      expect(virtualList).toHaveAttribute('data-item-count', '20'); // Rendered items
    });

    it('should only render visible items in viewport', () => {
      renderComponent();
      
      // Should not render all 1000 items, only those in viewport
      const productCards = screen.getAllByTestId(/product-card/);
      expect(productCards.length).toBeLessThanOrEqual(10); // Mock limit
    });

    it('should handle scrolling and load more items', async () => {
      const { api } = require('../../../src/utils/trpc.js');
      const mockRefetch = vi.fn();
      api.walmartGrocery.searchProducts.useQuery.mockReturnValue({
        ...mockSearchQuery,
        refetch: mockRefetch
      });

      renderComponent();
      
      const virtualList = screen.getByTestId('virtual-list');
      
      // Simulate scroll to bottom
      fireEvent.scroll(virtualList, { target: { scrollTop: 1000 } });
      
      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('should implement infinite scrolling', async () => {
      let currentPage = 0;
      const { api } = require('../../../src/utils/trpc.js');
      
      api.walmartGrocery.searchProducts.useQuery.mockImplementation(() => ({
        ...mockSearchQuery,
        data: {
          ...mockSearchQuery.data,
          products: mockProducts.slice(currentPage * 20, (currentPage + 1) * 20),
          hasMore: currentPage < 50
        },
        refetch: () => {
          currentPage++;
          return Promise.resolve();
        }
      }));

      renderComponent();
      
      // Initially should show first 20 items
      expect(screen.getByText(/product 0/i)).toBeInTheDocument();
      expect(screen.queryByText(/product 25/i)).not.toBeInTheDocument();
      
      // Scroll to trigger load more
      const virtualList = screen.getByTestId('virtual-list');
      fireEvent.scroll(virtualList, { target: { scrollTop: 2000 } });
      
      await waitFor(() => {
        expect(screen.getByText(/loading more/i)).toBeInTheDocument();
      });
    });

    it('should maintain scroll position during updates', async () => {
      renderComponent();
      
      const virtualList = screen.getByTestId('virtual-list');
      
      // Set scroll position
      fireEvent.scroll(virtualList, { target: { scrollTop: 500 } });
      
      // Trigger re-render
      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, ' updated');
      
      // Scroll position should be maintained
      expect(virtualList.scrollTop).toBe(500);
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter by category', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Category 0');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'Category 0'
          })
        );
      });
    });

    it('should filter by brand', async () => {
      renderComponent();
      
      const brandFilter = screen.getByLabelText(/brand/i);
      await user.selectOptions(brandFilter, 'Brand 1');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            brand: 'Brand 1'
          })
        );
      });
    });

    it('should filter by price range', async () => {
      renderComponent();
      
      const minPriceInput = screen.getByLabelText(/minimum price/i);
      const maxPriceInput = screen.getByLabelText(/maximum price/i);
      
      await user.type(minPriceInput, '10');
      await user.type(maxPriceInput, '50');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            minPrice: 10,
            maxPrice: 50
          })
        );
      });
    });

    it('should filter by stock availability', async () => {
      renderComponent();
      
      const inStockCheckbox = screen.getByLabelText(/in stock only/i);
      await user.click(inStockCheckbox);
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            inStock: true
          })
        );
      });
    });

    it('should sort by price ascending', async () => {
      renderComponent();
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'price_asc');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'price',
            sortOrder: 'asc'
          })
        );
      });
    });

    it('should sort by relevance', async () => {
      renderComponent();
      
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'relevance');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'relevance'
          })
        );
      });
    });

    it('should combine multiple filters', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText(/category/i);
      const inStockCheckbox = screen.getByLabelText(/in stock only/i);
      const sortSelect = screen.getByLabelText(/sort by/i);
      
      await user.selectOptions(categoryFilter, 'Category 0');
      await user.click(inStockCheckbox);
      await user.selectOptions(sortSelect, 'price_desc');
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'Category 0',
            inStock: true,
            sortBy: 'price',
            sortOrder: 'desc'
          })
        );
      });
    });

    it('should clear all filters', async () => {
      renderComponent();
      
      // Apply some filters
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Category 0');
      
      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(categoryFilter).toHaveValue('');
      });
    });
  });

  describe('Search Facets and Statistics', () => {
    it('should display faceted search results', () => {
      renderComponent();
      
      expect(screen.getByText(/category 0.*200/i)).toBeInTheDocument();
      expect(screen.getByText(/brand 0.*100/i)).toBeInTheDocument();
      expect(screen.getByText(/\$0-20.*500/i)).toBeInTheDocument();
    });

    it('should apply filters from facet clicks', async () => {
      renderComponent();
      
      const categoryFacet = screen.getByText(/category 0.*200/i);
      await user.click(categoryFacet);
      
      await waitFor(() => {
        const { api } = require('../../../src/utils/trpc.js');
        expect(api.walmartGrocery.searchProducts.useQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'Category 0'
          })
        );
      });
    });

    it('should show active filter tags', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Category 0');
      
      await waitFor(() => {
        expect(screen.getByTestId('active-filter')).toBeInTheDocument();
        expect(screen.getByText(/category: category 0/i)).toBeInTheDocument();
      });
    });

    it('should remove individual filter tags', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Category 0');
      
      await waitFor(() => {
        const removeFilterButton = screen.getByRole('button', { name: /remove category filter/i });
        expect(removeFilterButton).toBeInTheDocument();
      });
      
      const removeFilterButton = screen.getByRole('button', { name: /remove category filter/i });
      await user.click(removeFilterButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('active-filter')).not.toBeInTheDocument();
      });
    });
  });

  describe('Product Grid and Cards', () => {
    it('should render product cards in grid layout', () => {
      renderComponent();
      
      const productGrid = screen.getByTestId('product-grid');
      expect(productGrid).toBeInTheDocument();
      expect(productGrid).toHaveClass('grid');
    });

    it('should show product images, names, and prices', () => {
      renderComponent();
      
      expect(screen.getByText(/product 0/i)).toBeInTheDocument();
      expect(screen.getByText(/\$10/)).toBeInTheDocument();
      expect(screen.getByAltText(/product 0/i)).toBeInTheDocument();
    });

    it('should handle missing product images', () => {
      const productsWithMissingImages = mockProducts.map(p => ({
        ...p,
        image_url: ''
      }));

      const { api } = require('../../../src/utils/trpc.js');
      api.walmartGrocery.searchProducts.useQuery.mockReturnValue({
        ...mockSearchQuery,
        data: {
          ...mockSearchQuery.data,
          products: productsWithMissingImages.slice(0, 20)
        }
      });

      renderComponent();
      
      const placeholderImages = screen.getAllByTestId('placeholder-image');
      expect(placeholderImages.length).toBeGreaterThan(0);
    });

    it('should show sale price indicators', () => {
      const productsOnSale = mockProducts.map(p => ({
        ...p,
        current_price: p.regular_price - 2
      }));

      const { api } = require('../../../src/utils/trpc.js');
      api.walmartGrocery.searchProducts.useQuery.mockReturnValue({
        ...mockSearchQuery,
        data: {
          ...mockSearchQuery.data,
          products: productsOnSale.slice(0, 20)
        }
      });

      renderComponent();
      
      expect(screen.getAllByTestId('sale-badge')).toHaveLength(10); // Mock limit
    });

    it('should show out of stock indicators', () => {
      renderComponent();
      
      const outOfStockBadges = screen.getAllByText(/out of stock/i);
      expect(outOfStockBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('should adapt grid layout for mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      renderComponent();
      
      const productGrid = screen.getByTestId('product-grid');
      expect(productGrid).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    });

    it('should adapt grid layout for tablet', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      renderComponent();
      
      const productGrid = screen.getByTestId('product-grid');
      expect(productGrid).toHaveClass('md:grid-cols-3');
    });

    it('should adapt grid layout for desktop', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });

      renderComponent();
      
      const productGrid = screen.getByTestId('product-grid');
      expect(productGrid).toHaveClass('lg:grid-cols-4');
    });

    it('should collapse filters on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      renderComponent();
      
      const filtersButton = screen.getByRole('button', { name: /show filters/i });
      expect(filtersButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderComponent();
      
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /search filters/i })).toBeInTheDocument();
      expect(screen.getByRole('main', { name: /search results/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation through results', async () => {
      renderComponent();
      
      const firstProduct = screen.getAllByRole('article')[0];
      firstProduct.focus();
      
      await user.keyboard('{ArrowDown}');
      
      const secondProduct = screen.getAllByRole('article')[1];
      expect(secondProduct).toHaveFocus();
    });

    it('should announce filter changes to screen readers', async () => {
      renderComponent();
      
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'Category 0');
      
      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toHaveTextContent(/filtered by category 0/i);
      });
    });

    it('should provide skip links for large result sets', () => {
      renderComponent();
      
      const skipLink = screen.getByRole('link', { name: /skip to results/i });
      expect(skipLink).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce search input', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search products/i);
      
      // Type rapidly
      await user.type(searchInput, 'test query');
      
      // Should debounce API calls
      expect(setTimeout).toHaveBeenCalled();
    });

    it('should cache search results', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search products/i);
      
      // First search
      await user.type(searchInput, 'milk');
      await user.keyboard('{Enter}');
      
      // Navigate away and back
      await user.clear(searchInput);
      await user.type(searchInput, 'bread');
      await user.keyboard('{Enter}');
      
      await user.clear(searchInput);
      await user.type(searchInput, 'milk'); // Same as first search
      await user.keyboard('{Enter}');
      
      // Should use cached results
      const { api } = require('../../../src/utils/trpc.js');
      const searchCalls = api.walmartGrocery.searchProducts.useQuery.mock.calls.filter(
        call => call[0]?.query === 'milk'
      );
      expect(searchCalls.length).toBe(2); // Initial + cache check
    });

    it('should implement lazy loading for product images', () => {
      renderComponent();
      
      const productImages = screen.getAllByRole('img');
      productImages.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });
});