# CSRF Protection Implementation

This document outlines the comprehensive CSRF (Cross-Site Request Forgery) protection implementation for the CrewAI Team project.

## Overview

The frontend CSRF protection system provides seamless security integration with automatic token management, error handling, and recovery mechanisms. It works in conjunction with the backend CSRF middleware to protect against CSRF attacks.

## Architecture

### Backend Components

1. **CSRF Middleware** (`src/api/middleware/security/csrf.ts`)
   - Token generation and validation
   - Automatic token rotation
   - Secure cookie management with `__Host-` prefix
   - Comprehensive logging and monitoring

2. **CSRF Router** (`src/api/routes/csrf.router.ts`)
   - `/api/csrf-token` - Fetch or generate new tokens
   - `/api/csrf-token/validate` - Validate tokens (testing)

### Frontend Components

1. **CSRF Context & Provider** (`src/ui/hooks/useCSRF.ts`)
   - App-wide CSRF token management
   - Automatic token fetching and refreshing
   - Background token rotation
   - Error handling and recovery

2. **tRPC Integration** (`src/ui/hooks/useTRPCWithCSRF.ts`)
   - CSRF-protected tRPC client configuration
   - Automatic header injection
   - Enhanced error handling for CSRF failures

3. **UI Components** (`src/ui/components/Security/`)
   - `CSRFMonitor` - Visual status indicator
   - `CSRFStatusBadge` - Minimal status badge
   - `CSRFErrorBoundary` - Error boundary for CSRF failures
   - `CSRFErrorModal` - User-friendly error dialogs

4. **Enhanced Hooks** (`src/ui/hooks/useCSRFProtectedMutation.ts`)
   - `useCSRFProtectedMutation` - tRPC mutations with retry logic
   - `useCSRFBatchOperation` - Batch operations with protection
   - `useCSRFFormSubmit` - Form submissions with CSRF headers

## Key Features

### Automatic Token Management

- Tokens are fetched on app initialization
- Automatic rotation every 55 minutes (before 1-hour backend rotation)
- Background refresh when tab becomes visible
- Fallback to localStorage for offline scenarios

### Seamless Integration

- All tRPC mutations automatically include CSRF headers
- WebSocket connections include CSRF tokens in connection params
- Form submissions automatically protected
- No manual token management required

### Error Handling & Recovery

- Automatic retry with fresh tokens on CSRF failures
- User-friendly error modals with retry options
- Graceful degradation when tokens unavailable
- Comprehensive logging for debugging

### Security Features

- Secure `__Host-` prefixed cookies
- HttpOnly cookies to prevent XSS
- SameSite=Strict for additional protection
- Token validation on all mutations
- Automatic cleanup of expired tokens

## Usage Examples

### Basic Setup (Already Done)

The CSRF protection is automatically enabled application-wide:

```tsx
// App.tsx
function App() {
  return (
    <CSRFErrorBoundary>
      <CSRFProvider>
        <AppWithCSRF />
      </CSRFProvider>
    </CSRFErrorBoundary>
  );
}
```

### Using Protected Mutations

```tsx
import { useCSRFProtectedMutation } from "@/ui/hooks/useCSRFProtectedMutation";

function MyComponent() {
  const createUser = useCSRFProtectedMutation(api.user.create, {
    onSuccess: (data) => {
      console.log("User created:", data);
    },
    onCSRFError: (error) => {
      // Handle CSRF-specific errors
      showErrorModal(error);
    },
  });

  const handleCreateUser = () => {
    createUser.mutate({ name: "John", email: "john@example.com" });
  };

  return (
    <button onClick={handleCreateUser} disabled={createUser.isLoading}>
      {createUser.isRetrying ? "Retrying..." : "Create User"}
    </button>
  );
}
```

### Using Protected Form Submissions

```tsx
import { useCSRFFormSubmit } from "@/ui/hooks/useCSRFProtectedMutation";

function ContactForm() {
  const formSubmit = useCSRFFormSubmit({
    onSuccess: () => alert("Message sent!"),
    onError: (error) => alert("Error: " + error.message),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    await formSubmit.submit("/api/contact", formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={formSubmit.isSubmitting}>
        {formSubmit.isSubmitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
```

### Manual Token Management

```tsx
import { useCSRF } from "@/ui/hooks/useCSRF";

function TokenManager() {
  const { token, refreshToken, getHeaders, error } = useCSRF();

  const handleRefresh = async () => {
    try {
      await refreshToken();
      console.log("Token refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh token:", error);
    }
  };

  return (
    <div>
      <p>Token Status: {token ? "Active" : "Inactive"}</p>
      <button onClick={handleRefresh}>Refresh Token</button>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

## Monitoring & Debugging

### Development Tools

1. **CSRF Monitor Component** - Shows real-time token status
2. **Status Badge** - Minimal indicator in bottom-right corner
3. **Browser DevTools** - Check network requests for CSRF headers
4. **Console Logs** - Comprehensive logging of token operations

### Production Monitoring

- Server-side CSRF statistics via `getCSRFStats()`
- Error tracking for CSRF validation failures
- Performance metrics for token rotation
- Health checks for token generation

## Security Considerations

### Token Security

- Tokens never logged in plaintext
- SHA-256 hashed for logging purposes
- Automatic cleanup of expired tokens
- Rotation prevents long-term exposure

### Attack Mitigation

- Protects against CSRF attacks on all mutations
- Double-submit cookie pattern
- Origin validation on WebSocket connections
- Rate limiting on token endpoints

### Best Practices

- Always use provided hooks for mutations
- Never bypass CSRF protection
- Monitor CSRF error rates
- Regular security audits

## Troubleshooting

### Common Issues

1. **Token Not Found**
   - Check if CSRF router is properly registered
   - Verify cookie settings and domain configuration
   - Ensure HTTPS in production for `__Host-` cookies

2. **CSRF Validation Failures**
   - Check network requests include `x-csrf-token` header
   - Verify token matches between request and stored token
   - Look for token rotation timing issues

3. **WebSocket Connection Issues**
   - Ensure CSRF tokens included in connection params
   - Check origin validation configuration
   - Verify WebSocket URL and path

### Debug Mode

Enable detailed CSRF logging by setting `NODE_ENV=development`:

```javascript
// Additional logging in development
localStorage.setItem("csrf-debug", "true");
```

## Migration Guide

For existing components using tRPC or form submissions:

1. **tRPC Mutations**: Replace with `useCSRFProtectedMutation`
2. **Form Submissions**: Use `useCSRFFormSubmit` hook
3. **Batch Operations**: Use `useCSRFBatchOperation` hook
4. **Error Handling**: Add CSRF-specific error handling

The system is designed to be backward-compatible with minimal migration required.
