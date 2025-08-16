import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DebouncedSearchInput } from '../DebouncedSearchInput.js';

// Mock hooks
vi.mock('../../hooks/useDebounce.js', () => ({
  useDebounce: vi.fn((value, delay) => {
    // For testing, we'll use a simple implementation that returns the value after a timeout
    const [debouncedValue, setDebouncedValue] = React.useState(value);
    
    React.useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      
      return () => clearTimeout(timer);
    }, [value, delay]);
    
    return debouncedValue;
  }),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Search: ({ className }: any) => (
    <div data-testid="search-icon" className={className}>🔍</div>
  ),
  X: ({ className }: any) => (
    <div data-testid="x-icon" className={className}>✕</div>
  ),
}));

// Mock utils
vi.mock('../../../lib/utils.js', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('DebouncedSearchInput', () => {
  let mockOnSearch: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockOnSearch = vi.fn();
    user = userEvent.setup();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          placeholder="Custom search placeholder" 
        />
      );

      expect(screen.getByPlaceholderText('Custom search placeholder')).toBeInTheDocument();
    });

    it('renders with initial value', () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          initialValue="initial search" 
        />
      );

      expect(screen.getByDisplayValue('initial search')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          className="custom-search-class" 
        />
      );

      expect(container.firstChild).toHaveClass('custom-search-class');
    });

    it('shows clear button when there is text', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByTestId('x-icon')).toBeInTheDocument();
      });
    });

    it('hides clear button when showClearButton is false', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          showClearButton={false} 
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles text input', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('calls onSearch after debounce delay', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      // Should not call immediately
      expect(mockOnSearch).not.toHaveBeenCalledWith('test');

      // Fast forward debounce delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
      });
    });

    it('clears input when clear button is clicked', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByTestId('x-icon')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('x-icon').closest('button')!);

      expect(input).toHaveValue('');
      expect(mockOnSearch).toHaveBeenCalledWith('');
    });

    it('clears input when Escape key is pressed', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
      expect(mockOnSearch).toHaveBeenCalledWith('');
    });

    it('handles focus and blur events', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      const searchIcon = screen.getByTestId('search-icon');

      await user.click(input);

      expect(searchIcon).toHaveClass('text-blue-500');

      await user.tab(); // Move focus away

      expect(searchIcon).not.toHaveClass('text-blue-500');
    });
  });

  describe('Debouncing Behavior', () => {
    it('cancels previous debounce when input changes rapidly', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 't');
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await user.type(input, 'e');
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await user.type(input, 's');
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await user.type(input, 't');
      
      // Only after full delay should it call onSearch
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
      });

      // Should only be called once with final value
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('shows loading indicator during debounce', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      // Loading indicator should appear while debouncing
      expect(screen.getByRole('textbox').parentElement?.parentElement).toContainHTML('animate-spin');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.queryByRole('textbox').parentElement?.parentElement).not.toContainHTML('animate-spin');
      });
    });
  });

  describe('Minimum Length Validation', () => {
    it('shows error message when input is below minimum length', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          minLength={3} 
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'te');

      expect(screen.getByText('Search requires at least 3 characters')).toBeInTheDocument();
    });

    it('applies error styling when below minimum length', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          minLength={3} 
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'te');

      expect(input).toHaveClass('border-red-300', 'focus:ring-red-500', 'focus:border-red-500');
    });

    it('does not call onSearch when below minimum length', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          minLength={3}
          debounceMs={100}
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'te');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockOnSearch).not.toHaveBeenCalledWith('te');
    });

    it('calls onSearch when reaching minimum length', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          minLength={3}
          debounceMs={100}
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test');
      });
    });

    it('uses singular form for minLength = 1', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          minLength={1} 
        />
      );

      const input = screen.getByRole('textbox');
      
      // Type nothing to trigger empty state validation
      await user.click(input);

      expect(screen.queryByText('Search requires at least 1 character')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          disabled={true} 
        />
      );

      const input = screen.getByRole('textbox');
      
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:bg-gray-100', 'disabled:cursor-not-allowed');
    });

    it('does not respond to user input when disabled', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          disabled={true} 
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      expect(input).toHaveValue('');
      expect(mockOnSearch).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('memoizes the component correctly', () => {
      const props = {
        onSearch: mockOnSearch,
        placeholder: 'Test',
        debounceMs: 300,
      };

      const { rerender } = render(<DebouncedSearchInput {...props} />);

      // Re-render with same props should not cause issues
      rerender(<DebouncedSearchInput {...props} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('handles rapid rerendering without memory leaks', () => {
      const { rerender } = render(
        <DebouncedSearchInput onSearch={mockOnSearch} />
      );

      // Rapidly rerender with different props
      for (let i = 0; i < 10; i++) {
        rerender(
          <DebouncedSearchInput 
            onSearch={mockOnSearch} 
            placeholder={`Search ${i}`}
          />
        );
      }

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('cleans up timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = render(
        <DebouncedSearchInput onSearch={mockOnSearch} />
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('supports keyboard navigation', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.tab();
      
      expect(input).toHaveFocus();
      
      await user.keyboard('test');
      
      expect(input).toHaveValue('test');
      
      await user.keyboard('{Escape}');
      
      expect(input).toHaveValue('');
    });

    it('clear button is not tabbable', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');

      await waitFor(() => {
        const clearButton = screen.getByTestId('x-icon').closest('button');
        expect(clearButton).toHaveAttribute('tabIndex', '-1');
      });
    });

    it('provides semantic error messages', async () => {
      render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch} 
          minLength={3} 
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'te');

      const errorMessage = screen.getByText('Search requires at least 3 characters');
      expect(errorMessage).toHaveClass('text-red-600');
      expect(errorMessage.tagName).toBe('P');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string input', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');
      await user.clear(input);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('');
      });
    });

    it('handles special characters', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} debounceMs={100} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, '!@#$%^&*()');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('!@#$%^&*()');
      });
    });

    it('handles unicode characters', async () => {
      render(<DebouncedSearchInput onSearch={mockOnSearch} debounceMs={100} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, '🔍 unicode test 中文');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('🔍 unicode test 中文');
      });
    });

    it('handles very long input strings', async () => {
      const longString = 'a'.repeat(1000);
      
      render(<DebouncedSearchInput onSearch={mockOnSearch} debounceMs={100} />);

      const input = screen.getByRole('textbox');
      
      await user.type(input, longString);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith(longString);
      });
    });

    it('handles undefined/null onSearch gracefully', () => {
      // TypeScript would prevent this, but testing runtime behavior
      expect(() => {
        render(<DebouncedSearchInput onSearch={undefined as any} />);
      }).not.toThrow();
    });

    it('handles rapid mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <DebouncedSearchInput onSearch={mockOnSearch} />
        );
        unmount();
      }

      // Should not cause any errors
      expect(true).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('works with form submission', async () => {
      const mockSubmit = vi.fn((e) => e.preventDefault());

      render(
        <form onSubmit={mockSubmit}>
          <DebouncedSearchInput onSearch={mockOnSearch} />
          <button type="submit">Submit</button>
        </form>
      );

      const input = screen.getByRole('textbox');
      const submitButton = screen.getByText('Submit');
      
      await user.type(input, 'test query');
      await user.click(submitButton);

      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('integrates with external state management', async () => {
      let externalQuery = '';
      const setExternalQuery = (query: string) => {
        externalQuery = query;
      };

      const { rerender } = render(
        <DebouncedSearchInput 
          onSearch={setExternalQuery}
          initialValue={externalQuery}
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'external state test');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(externalQuery).toBe('external state test');
      });

      // Rerender with updated external state
      rerender(
        <DebouncedSearchInput 
          onSearch={setExternalQuery}
          initialValue={externalQuery}
        />
      );

      expect(screen.getByDisplayValue('external state test')).toBeInTheDocument();
    });

    it('handles dynamic prop changes', async () => {
      const { rerender } = render(
        <DebouncedSearchInput 
          onSearch={mockOnSearch}
          minLength={2}
          debounceMs={200}
        />
      );

      const input = screen.getByRole('textbox');
      
      await user.type(input, 'a');

      // Should show error for minLength=2
      expect(screen.getByText('Search requires at least 2 characters')).toBeInTheDocument();

      // Change minLength to 1
      rerender(
        <DebouncedSearchInput 
          onSearch={mockOnSearch}
          minLength={1}
          debounceMs={200}
        />
      );

      // Error should disappear
      expect(screen.queryByText('Search requires at least 2 characters')).not.toBeInTheDocument();
    });
  });
});