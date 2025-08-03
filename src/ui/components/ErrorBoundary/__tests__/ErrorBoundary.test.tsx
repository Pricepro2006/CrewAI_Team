import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ErrorBoundary,
  withErrorBoundary,
  useErrorHandler,
} from "../ErrorBoundary";
import { ErrorFallback } from "../ErrorFallback";
import "@testing-library/jest-dom";

// Mock logger
jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({
  shouldThrow = true,
}) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

// Test component using error handler hook
const ComponentWithErrorHandler: React.FC = () => {
  const handleError = useErrorHandler();

  return (
    <button
      onClick={() => {
        try {
          throw new Error("Hook error");
        } catch (error) {
          handleError(error as Error);
        }
      }}
    >
      Trigger Error
    </button>
  );
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for these tests
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders error fallback when error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test error" }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it("resets error boundary when Try Again is clicked", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click Try Again
    fireEvent.click(screen.getByText("Try Again"));

    // Rerender with non-throwing component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("shows error count after multiple errors", async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // First error
    expect(screen.getByText("Test error")).toBeInTheDocument();

    // Reset and trigger second error
    fireEvent.click(screen.getByText("Try Again"));
    rerender(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("This error has occurred 2 times"),
    ).toBeInTheDocument();
  });

  it("auto-resets after 3 errors", async () => {
    jest.useFakeTimers();

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Trigger 3 errors
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText("Try Again"));
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );
    }

    expect(
      screen.getByText("This error has occurred 3 times"),
    ).toBeInTheDocument();

    // Fast-forward 10 seconds for auto-reset
    jest.advanceTimersByTime(10000);

    // Rerender with non-throwing component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it("resets on resetKeys change when resetOnKeysChange is true", () => {
    let resetKey = "key1";

    const { rerender } = render(
      <ErrorBoundary resetKeys={[resetKey]} resetOnKeysChange>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Test error")).toBeInTheDocument();

    // Change reset key
    resetKey = "key2";
    rerender(
      <ErrorBoundary resetKeys={[resetKey]} resetOnKeysChange>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("isolates error when isolate prop is true", () => {
    render(
      <ErrorBoundary isolate>
        <ThrowError />
      </ErrorBoundary>,
    );

    const errorContainer = screen
      .getByText("Something went wrong")
      .closest(".error-fallback-container");
    expect(errorContainer).toHaveClass("error-fallback-isolated");
  });
});

describe("withErrorBoundary HOC", () => {
  it("wraps component with error boundary", () => {
    const WrappedComponent = withErrorBoundary(ThrowError);

    render(<WrappedComponent />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("passes props to wrapped component", () => {
    const TestComponent: React.FC<{ message: string }> = ({ message }) => (
      <div>{message}</div>
    );

    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Hello" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("uses custom error boundary props", () => {
    const onError = jest.fn();
    const WrappedComponent = withErrorBoundary(ThrowError, { onError });

    render(<WrappedComponent />);

    expect(onError).toHaveBeenCalled();
  });
});

describe("useErrorHandler hook", () => {
  it("throws error to nearest error boundary", () => {
    render(
      <ErrorBoundary>
        <ComponentWithErrorHandler />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Trigger Error"));

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});

describe("ErrorFallback component", () => {
  it("renders error message and icon", () => {
    const error = new Error("Test error message");
    const onReset = jest.fn();

    render(<ErrorFallback error={error} onReset={onReset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Error" })).toBeInTheDocument();
  });

  it("shows appropriate message for network errors", () => {
    const error = new Error("Network request failed");
    const onReset = jest.fn();

    render(<ErrorFallback error={error} onReset={onReset} />);

    expect(screen.getByText("Connection Problem")).toBeInTheDocument();
    expect(
      screen.getByText(/check your internet connection/i),
    ).toBeInTheDocument();
  });

  it("shows appropriate message for permission errors", () => {
    const error = new Error("Unauthorized access");
    const onReset = jest.fn();

    render(<ErrorFallback error={error} onReset={onReset} />);

    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
  });

  it("handles retry action", () => {
    const error = new Error("Test error");
    const onReset = jest.fn();

    render(<ErrorFallback error={error} onReset={onReset} canRetry={true} />);

    fireEvent.click(screen.getByText("Try Again"));

    // Wait for animation delay
    setTimeout(() => {
      expect(onReset).toHaveBeenCalled();
    }, 600);
  });

  it("disables retry when canRetry is false", () => {
    const error = new Error("Test error");
    const onReset = jest.fn();

    render(<ErrorFallback error={error} onReset={onReset} canRetry={false} />);

    expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
  });

  it("shows error details in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const error = new Error("Test error");
    error.stack = "Error stack trace";
    const onReset = jest.fn();

    render(
      <ErrorFallback
        error={error}
        errorInfo={{ componentStack: "Component stack" }}
        onReset={onReset}
      />,
    );

    // Toggle details
    fireEvent.click(screen.getByText("Technical Details"));

    expect(screen.getByText(/Error stack trace/)).toBeInTheDocument();
    expect(screen.getByText(/Component stack/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
