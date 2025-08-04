/**
 * Tooltip Component Test Suite
 * Tests tooltip functionality and positioning
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock Tooltip component
interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  trigger?: "hover" | "click" | "focus";
  delay?: number;
  disabled?: boolean;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
  trigger = "hover",
  delay = 200,
  disabled = false,
  className = "",
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [timeoutId, setTimeoutId] = React.useState<NodeJS.Timeout | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  const showTooltip = React.useCallback(() => {
    if (disabled) return;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    
    setTimeoutId(id);
  }, [delay, disabled, timeoutId]);

  const hideTooltip = React.useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  }, [timeoutId]);

  const handleMouseEnter = () => {
    if (trigger === "hover") {
      showTooltip();
    }
  };

  const handleMouseLeave = () => {
    if (trigger === "hover") {
      hideTooltip();
    }
  };

  const handleClick = () => {
    if (trigger === "click") {
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    }
  };

  const handleFocus = () => {
    if (trigger === "focus") {
      showTooltip();
    }
  };

  const handleBlur = () => {
    if (trigger === "focus") {
      hideTooltip();
    }
  };

  const getTooltipPosition = () => {
    switch (position) {
      case "top":
        return { bottom: "100%", left: "50%", transform: "translateX(-50%)" };
      case "bottom":
        return { top: "100%", left: "50%", transform: "translateX(-50%)" };
      case "left":
        return { right: "100%", top: "50%", transform: "translateY(-50%)" };
      case "right":
        return { left: "100%", top: "50%", transform: "translateY(-50%)" };
      default:
        return { bottom: "100%", left: "50%", transform: "translateX(-50%)" };
    }
  };

  React.useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (
    <div 
      className={`tooltip-container ${className}`}
      style={{ position: "relative", display: "inline-block" }}
      data-testid="tooltip-container"
    >
      {React.cloneElement(children, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onClick: handleClick,
        onFocus: handleFocus,
        onBlur: handleBlur,
        "data-testid": children.props["data-testid"] || "tooltip-trigger",
      })}
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${position}`}
          style={{
            position: "absolute",
            zIndex: 1000,
            padding: "8px 12px",
            backgroundColor: "black",
            color: "white",
            borderRadius: "4px",
            fontSize: "14px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            ...getTooltipPosition(),
          }}
          data-testid="tooltip-content"
          role="tooltip"
        >
          {content}
          <div
            className={`tooltip-arrow tooltip-arrow-${position}`}
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              borderStyle: "solid",
              ...(position === "top" && {
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                borderWidth: "5px 5px 0 5px",
                borderColor: "black transparent transparent transparent",
              }),
              ...(position === "bottom" && {
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                borderWidth: "0 5px 5px 5px",
                borderColor: "transparent transparent black transparent",
              }),
              ...(position === "left" && {
                left: "100%",
                top: "50%",
                transform: "translateY(-50%)",
                borderWidth: "5px 0 5px 5px",
                borderColor: "transparent transparent transparent black",
              }),
              ...(position === "right" && {
                right: "100%",
                top: "50%",
                transform: "translateY(-50%)",
                borderWidth: "5px 5px 5px 0",
                borderColor: "transparent black transparent transparent",
              }),
            }}
          />
        </div>
      )}
    </div>
  );
};

describe("Tooltip Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render tooltip container with children", () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByTestId("tooltip-container")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  it("should show tooltip on hover", async () => {
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
      expect(screen.getByText("Tooltip text")).toBeInTheDocument();
    });
  });

  it("should hide tooltip on mouse leave", async () => {
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });

    fireEvent.mouseLeave(button);

    await waitFor(() => {
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });
  });

  it("should work with click trigger", async () => {
    render(
      <Tooltip content="Click tooltip" trigger="click" delay={0}>
        <button>Click me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    // Click to show
    fireEvent.click(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });

    // Click to hide
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });
  });

  it("should work with focus trigger", async () => {
    render(
      <Tooltip content="Focus tooltip" trigger="focus" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.focus(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });

    fireEvent.blur(button);

    await waitFor(() => {
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });
  });

  it("should respect delay", async () => {
    render(
      <Tooltip content="Delayed tooltip" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);

    // Should not be visible immediately
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();

    // Advance time by less than delay
    vi.advanceTimersByTime(300);
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();

    // Advance time past delay
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });
  });

  it("should not show tooltip when disabled", async () => {
    render(
      <Tooltip content="Disabled tooltip" disabled={true} delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });
  });

  it("should render different positions", async () => {
    const positions = ["top", "bottom", "left", "right"] as const;

    for (const position of positions) {
      const { rerender } = render(
        <Tooltip content="Positioned tooltip" position={position} delay={0}>
          <button>Hover me</button>
        </Tooltip>
      );

      const button = screen.getByRole("button");

      fireEvent.mouseEnter(button);
      vi.runAllTimers();

      await waitFor(() => {
        const tooltip = screen.getByTestId("tooltip-content");
        expect(tooltip).toHaveClass(`tooltip-${position}`);
      });

      fireEvent.mouseLeave(button);

      await waitFor(() => {
        expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
      });

      rerender(<div />); // Clear for next iteration
    }
  });

  it("should accept custom className", () => {
    render(
      <Tooltip content="Custom tooltip" className="custom-tooltip">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByTestId("tooltip-container")).toHaveClass("custom-tooltip");
  });

  it("should have proper accessibility attributes", async () => {
    render(
      <Tooltip content="Accessible tooltip" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    vi.runAllTimers();

    await waitFor(() => {
      const tooltip = screen.getByTestId("tooltip-content");
      expect(tooltip).toHaveAttribute("role", "tooltip");
    });
  });

  it("should render complex content", async () => {
    const complexContent = (
      <div>
        <strong>Complex Tooltip</strong>
        <p>With multiple elements</p>
      </div>
    );

    render(
      <Tooltip content={complexContent} delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.getByText("Complex Tooltip")).toBeInTheDocument();
      expect(screen.getByText("With multiple elements")).toBeInTheDocument();
    });
  });

  it("should cancel tooltip show on quick mouse leave", async () => {
    render(
      <Tooltip content="Quick tooltip" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    fireEvent.mouseEnter(button);
    
    // Leave before delay completes
    vi.advanceTimersByTime(200);
    fireEvent.mouseLeave(button);
    
    // Complete the original delay
    vi.advanceTimersByTime(400);

    await waitFor(() => {
      expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    });
  });

  it("should handle multiple trigger events correctly", async () => {
    render(
      <Tooltip content="Multi-trigger tooltip" trigger="hover" delay={0}>
        <button>Multi trigger</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");

    // Test that click doesn't trigger tooltip when trigger is hover
    fireEvent.click(button);
    vi.runAllTimers();

    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();

    // Test that hover does trigger tooltip
    fireEvent.mouseEnter(button);
    vi.runAllTimers();

    await waitFor(() => {
      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    });
  });

  it("should clean up timers on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    
    const { unmount } = render(
      <Tooltip content="Cleanup tooltip" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });
});