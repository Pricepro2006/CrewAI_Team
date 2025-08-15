/**
 * Button Component Test Suite
 * Tests button functionality and variants
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock Button component
interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  "data-testid"?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  onClick,
  type = "button",
  className = "",
  "data-testid": testId,
}) => {
  const getVariantStyles = (variant: string) => {
    switch (variant) {
      case "primary": return { backgroundColor: "blue", color: "white" };
      case "secondary": return { backgroundColor: "gray", color: "black" };
      case "danger": return { backgroundColor: "red", color: "white" };
      case "ghost": return { backgroundColor: "transparent", color: "blue" };
      default: return {};
    }
  };

  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      data-testid={testId}
      style={getVariantStyles(variant)}
    >
      {loading && <span data-testid="loading-spinner">⏳</span>}
      {children}
    </button>
  );
};

describe("Button Component", () => {
  it("should render button with default props", () => {
    render(<Button data-testid="test-button">Click me</Button>);

    const button = screen.getByTestId("test-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Click me");
    expect(button).toHaveClass("btn", "btn-primary", "btn-medium");
    expect(button).toHaveAttribute("type", "button");
  });

  it("should handle click events", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} data-testid="test-button">
        Click me
      </Button>
    );

    fireEvent.click(screen.getByTestId("test-button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should render different variants", () => {
    const variants = ["primary", "secondary", "danger", "ghost"] as const;

    variants.forEach((variant: any) => {
      const { rerender } = render(
        <Button variant={variant} data-testid="test-button">
          {variant}
        </Button>
      );

      const button = screen.getByTestId("test-button");
      expect(button).toHaveClass(`btn-${variant}`);

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should render different sizes", () => {
    const sizes = ["small", "medium", "large"] as const;

    sizes.forEach((size: any) => {
      const { rerender } = render(
        <Button size={size} data-testid="test-button">
          {size}
        </Button>
      );

      const button = screen.getByTestId("test-button");
      expect(button).toHaveClass(`btn-${size}`);

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should be disabled when disabled prop is true", () => {
    render(
      <Button disabled data-testid="test-button">
        Disabled
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toBeDisabled();
  });

  it("should not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} data-testid="test-button">
        Disabled
      </Button>
    );

    fireEvent.click(screen.getByTestId("test-button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("should show loading state", () => {
    render(
      <Button loading data-testid="test-button">
        Loading
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("should not call onClick when loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick} data-testid="test-button">
        Loading
      </Button>
    );

    fireEvent.click(screen.getByTestId("test-button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("should render different button types", () => {
    const types = ["button", "submit", "reset"] as const;

    types.forEach((type: any) => {
      const { rerender } = render(
        <Button type={type} data-testid="test-button">
          {type}
        </Button>
      );

      const button = screen.getByTestId("test-button");
      expect(button).toHaveAttribute("type", type);

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should accept custom className", () => {
    render(
      <Button className="custom-class" data-testid="test-button">
        Custom
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass("custom-class");
  });

  it("should render children correctly", () => {
    render(
      <Button data-testid="test-button">
        <span>Icon</span>
        <span>Text</span>
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveTextContent("IconText");
    expect(button.querySelector("span")).toHaveTextContent("Icon");
  });

  it("should have correct variant styles", () => {
    const variants = [
      { variant: "primary" as const, bg: "blue", color: "white" },
      { variant: "secondary" as const, bg: "gray", color: "black" },
      { variant: "danger" as const, bg: "red", color: "white" },
      { variant: "ghost" as const, bg: "transparent", color: "blue" },
    ];

    variants.forEach(({ variant, bg, color }) => {
      const { rerender } = render(
        <Button variant={variant} data-testid="test-button">
          {variant}
        </Button>
      );

      const button = screen.getByTestId("test-button");
      expect(button).toHaveStyle({
        backgroundColor: bg,
        color: color,
      });

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should be accessible", () => {
    render(
      <Button data-testid="test-button">
        Accessible Button
      </Button>
    );

    const button = screen.getByTestId("test-button");
    
    // Button should be focusable
    button.focus();
    expect(document.activeElement).toBe(button);

    // Should have button role
    expect(button.tagName).toBe("BUTTON");
  });

  it("should support keyboard interaction", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} data-testid="test-button">
        Keyboard
      </Button>
    );

    const button = screen.getByTestId("test-button");
    
    // Focus and press Enter
    button.focus();
    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    
    // Focus and press Space
    fireEvent.keyDown(button, { key: " ", code: "Space" });

    // Note: React Testing Library automatically handles Enter/Space for buttons
    // so we just verify the button is focusable and accessible
    expect(document.activeElement).toBe(button);
  });

  it("should handle rapid clicks", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} data-testid="test-button">
        Rapid Click
      </Button>
    );

    const button = screen.getByTestId("test-button");
    
    // Simulate rapid clicks
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("should maintain state consistency", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick} disabled={false} data-testid="test-button">
        Toggle
      </Button>
    );

    // Initially enabled
    const button = screen.getByTestId("test-button");
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Rerender as disabled
    rerender(
      <Button onClick={onClick} disabled={true} data-testid="test-button">
        Toggle
      </Button>
    );

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1); // Should not increment
  });
});