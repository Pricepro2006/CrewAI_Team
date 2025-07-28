# Error Handling Guide

This guide covers the comprehensive error handling system implemented in the CrewAI Team application.

## Table of Contents

1. [Overview](#overview)
2. [Error Handling Components](#error-handling-components)
3. [Error Recovery Patterns](#error-recovery-patterns)
4. [Implementation Examples](#implementation-examples)
5. [Best Practices](#best-practices)
6. [Testing Error Scenarios](#testing-error-scenarios)

## Overview

The error handling system provides multiple layers of error management:

- **Global Error Handlers**: Catch unhandled errors and promise rejections
- **Error Boundaries**: React components that catch JavaScript errors
- **Toast Notifications**: Non-intrusive alerts for user feedback
- **Error Modals**: Critical error dialogs requiring user attention
- **Network Status**: Real-time network connectivity feedback
- **Loading States**: Graceful loading indicators
- **Error Recovery**: Automatic retry mechanisms

## Error Handling Components

### 1. ErrorBoundary

The main error boundary component that catches React errors:

```tsx
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';

// Basic usage
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary 
  fallback={<CustomErrorUI />}
  onError={(error, errorInfo) => logError(error)}
>
  <YourComponent />
</ErrorBoundary>

// Isolated error boundary (doesn't take full screen)
<ErrorBoundary isolate>
  <RiskyComponent />
</ErrorBoundary>
```

### 2. Toast Notifications

For non-critical user feedback:

```tsx
import { useToast } from '@/ui/components/Toast';

function MyComponent() {
  const toast = useToast();

  // Success toast
  toast.success('Operation completed!');

  // Error toast with action
  toast.error('Failed to save', {
    message: 'Check your connection and try again',
    action: {
      label: 'Retry',
      onClick: () => saveData()
    }
  });

  // Warning toast (doesn't auto-dismiss)
  toast.warning('Session expiring', {
    duration: 0
  });

  // Info toast
  toast.info('New update available');
}
```

### 3. Error Modal

For critical errors requiring immediate attention:

```tsx
import { ErrorModal } from '@/ui/components/ErrorModal';

<ErrorModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Database Error"
  error={error}
  severity="critical"
  onRetry={handleRetry}
  actions={[
    {
      label: 'Contact Support',
      onClick: () => window.location.href = 'mailto:support@example.com'
    }
  ]}
/>
```

### 4. Network Status

Automatic network connectivity monitoring:

```tsx
import { NetworkStatus } from '@/ui/components/NetworkStatus';

// Add to your app root
<NetworkStatus 
  position="top"
  showWhenOnline={true}
  autoHide={true}
  autoHideDelay={3000}
/>
```

### 5. Loading States

Various loading indicators:

```tsx
import { LoadingState, Skeleton, LoadingCard } from '@/ui/components/LoadingState';

// Inline loading
<LoadingState size="small" text="Loading..." />

// Full screen loading
<LoadingState fullScreen text="Please wait..." />

// Skeleton loader
{isLoading ? (
  <Skeleton width="100%" height={20} />
) : (
  <div>{content}</div>
)}

// Loading card placeholder
<LoadingCard lines={3} showAvatar />
```

## Error Recovery Patterns

### 1. Automatic Retry with Exponential Backoff

```tsx
import { useErrorRecovery } from '@/ui/hooks/useErrorRecovery';

function DataFetcher() {
  const errorRecovery = useErrorRecovery({
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    onMaxRetriesExceeded: (error) => {
      // Show error modal or fallback UI
    }
  });

  const fetchData = async () => {
    try {
      const data = await api.getData();
      return data;
    } catch (error) {
      errorRecovery.handleError(error, fetchData);
    }
  };
}
```

### 2. Circuit Breaker Pattern

```tsx
import { useCircuitBreaker } from '@/ui/hooks/useErrorRecovery';

function ApiService() {
  const circuitBreaker = useCircuitBreaker(5, 60000); // 5 failures, 1 minute timeout

  const callApi = async () => {
    return circuitBreaker.execute(
      async () => {
        // Risky operation
        return await externalApi.call();
      },
      () => {
        // Fallback when circuit is open
        return getCachedData();
      }
    );
  };
}
```

### 3. Error Recovery Boundary

```tsx
import { ErrorRecoveryBoundary } from '@/ui/components/ErrorRecovery';

<ErrorRecoveryBoundary
  maxRetries={3}
  showNetworkStatus
  onError={(error) => logError(error)}
>
  <YourComponent />
</ErrorRecoveryBoundary>
```

## Implementation Examples

### Example 1: Form with Error Handling

```tsx
function UserForm() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRecovery = useErrorRecovery();

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      await api.saveUser(data);
      toast.success('User saved successfully!');
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        errorRecovery.handleError(error, () => handleSubmit(data));
      } else if (error.code === 'VALIDATION_ERROR') {
        toast.error('Validation failed', {
          message: error.message
        });
      } else {
        // Show error modal for unexpected errors
        showErrorModal(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoadingState size="small" /> : 'Save'}
      </Button>
    </form>
  );
}
```

### Example 2: Data Table with Error States

```tsx
function DataTable() {
  const { data, error, isLoading, refetch } = useQuery(['tableData'], fetchData);

  if (isLoading) {
    return <LoadingCard lines={5} />;
  }

  if (error) {
    return (
      <ErrorFallback
        error={error}
        onReset={refetch}
        isIsolated
      />
    );
  }

  return (
    <ErrorBoundary isolate>
      <table>
        {/* Table content */}
      </table>
    </ErrorBoundary>
  );
}
```

### Example 3: Async Operation with Progress

```tsx
function FileUploader() {
  const toast = useToast();
  const [progress, setProgress] = useState(0);
  const circuitBreaker = useCircuitBreaker();

  const uploadFile = async (file: File) => {
    try {
      await circuitBreaker.execute(async () => {
        const result = await api.uploadFile(file, {
          onProgress: (percent) => setProgress(percent)
        });
        
        toast.success('File uploaded!', {
          message: `${file.name} uploaded successfully`
        });
        
        return result;
      });
    } catch (error) {
      if (circuitBreaker.state === 'open') {
        toast.error('Upload service unavailable', {
          message: 'Too many failures. Please try again later.'
        });
      } else {
        toast.error('Upload failed', {
          message: error.message,
          action: {
            label: 'Retry',
            onClick: () => uploadFile(file)
          }
        });
      }
    }
  };
}
```

## Best Practices

### 1. Error Boundary Placement

- Place error boundaries at strategic component tree levels
- Use isolated boundaries for independent features
- Don't overuse - one per major feature is usually enough

### 2. Error Message Guidelines

- Be specific but user-friendly
- Provide actionable next steps
- Avoid technical jargon for end users
- Include error codes for support reference

### 3. Toast vs Modal Decision

Use **Toasts** for:
- Success confirmations
- Non-critical warnings
- Temporary network issues
- Background operation updates

Use **Modals** for:
- Critical errors requiring action
- Data loss warnings
- Authentication errors
- Payment failures

### 4. Loading State Best Practices

- Show loading states immediately (no delay)
- Use skeletons for content that maintains layout
- Provide progress indicators for long operations
- Always handle the error case

### 5. Network Error Handling

```tsx
// Good: Specific network error handling
if (error.code === 'NETWORK_ERROR') {
  if (!isOnline) {
    toast.warning('You are offline', {
      message: 'Changes will sync when connection is restored'
    });
  } else {
    errorRecovery.handleError(error, retryOperation);
  }
}

// Good: Graceful degradation
const data = await circuitBreaker.execute(
  () => fetchFromAPI(),
  () => getFromCache() // Fallback to cache
);
```

## Testing Error Scenarios

### Unit Testing Error Boundaries

```tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';

test('catches and displays errors', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});
```

### Integration Testing Error Flows

```tsx
test('handles network error with retry', async () => {
  // Mock API to fail first, then succeed
  api.getData
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({ data: 'success' });

  const { rerender } = render(<DataComponent />);

  // Should show error state
  expect(screen.getByText('Network error')).toBeInTheDocument();

  // Click retry
  fireEvent.click(screen.getByText('Try Again'));

  // Should show success
  await waitFor(() => {
    expect(screen.getByText('success')).toBeInTheDocument();
  });
});
```

### E2E Testing Error Scenarios

```tsx
// Cypress example
describe('Error Handling', () => {
  it('shows offline banner when network is disconnected', () => {
    cy.visit('/');
    
    // Simulate offline
    cy.window().then((win) => {
      cy.stub(win.navigator, 'onLine').value(false);
      win.dispatchEvent(new Event('offline'));
    });

    cy.contains('You are offline').should('be.visible');
  });
});
```

## Summary

The error handling system provides:

1. **Multiple Layers**: Global handlers, boundaries, and component-level handling
2. **User-Friendly Feedback**: Toast notifications and error modals
3. **Automatic Recovery**: Retry mechanisms and circuit breakers
4. **Network Awareness**: Real-time connectivity status
5. **Graceful Loading**: Skeleton screens and progress indicators
6. **Testing Support**: Comprehensive test utilities

By following these patterns and best practices, you can create a robust application that handles errors gracefully and provides excellent user experience even when things go wrong.