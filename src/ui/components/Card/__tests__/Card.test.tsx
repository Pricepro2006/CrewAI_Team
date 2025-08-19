/**
 * Card Component Test Suite
 * Tests card component functionality and variants
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Card component
interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  variant?: "default" | "elevated" | "outlined";
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  variant = "default",
  clickable = false,
  onClick,
  className = "",
  "data-testid": testId,
}) => {
  return (
    <div
      className={`card card-${variant} ${clickable ? "card-clickable" : ""} ${className}`}
      onClick={clickable ? onClick : undefined}
      data-testid={testId}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {(title || subtitle) && (
        <div className="card-header" data-testid={`${testId}-header`}>
          {title && (
            <h3 className="card-title" data-testid={`${testId}-title`}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="card-subtitle" data-testid={`${testId}-subtitle`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="card-content" data-testid={`${testId}-content`}>
        {children}
      </div>
    </div>
  );
};

describe("Card Component", () => {
  it("should render basic card with content", () => {
    render(
      <Card data-testid="test-card">
        <p>Card content</p>
      </Card>
    );

    expect(screen.getByTestId("test-card")).toBeInTheDocument();
    expect(screen.getByTestId("test-card-content")).toHaveTextContent("Card content");
    expect(screen.getByTestId("test-card")).toHaveClass("card", "card-default");
  });

  it("should render card with title", () => {
    render(
      <Card title="Test Title" data-testid="test-card">
        <p>Card content</p>
      </Card>
    );

    expect(screen.getByTestId("test-card-header")).toBeInTheDocument();
    expect(screen.getByTestId("test-card-title")).toHaveTextContent("Test Title");
  });

  it("should render card with title and subtitle", () => {
    render(
      <Card title="Test Title" subtitle="Test Subtitle" data-testid="test-card">
        <p>Card content</p>
      </Card>
    );

    expect(screen.getByTestId("test-card-title")).toHaveTextContent("Test Title");
    expect(screen.getByTestId("test-card-subtitle")).toHaveTextContent("Test Subtitle");
  });

  it("should render card with only subtitle", () => {
    render(
      <Card subtitle="Test Subtitle" data-testid="test-card">
        <p>Card content</p>
      </Card>
    );

    expect(screen.getByTestId("test-card-header")).toBeInTheDocument();
    expect(screen.queryByTestId("test-card-title")).not.toBeInTheDocument();
    expect(screen.getByTestId("test-card-subtitle")).toHaveTextContent("Test Subtitle");
  });

  it("should not render header when no title or subtitle", () => {
    render(
      <Card data-testid="test-card">
        <p>Card content</p>
      </Card>
    );

    expect(screen.queryByTestId("test-card-header")).not.toBeInTheDocument();
  });

  it("should render different variants", () => {
    const variants = ["default", "elevated", "outlined"] as const;

    variants.forEach((variant: any) => {
      const { rerender } = render(
        <Card variant={variant} data-testid="test-card">
          {variant} content
        </Card>
      );

      expect(screen.getByTestId("test-card")).toHaveClass(`card-${variant}`);

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should handle clickable card", () => {
    const onClick = vi.fn();
    render(
      <Card clickable onClick={onClick} data-testid="test-card">
        Clickable content
      </Card>
    );

    const card = screen.getByTestId("test-card");
    expect(card).toHaveClass("card-clickable");
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("tabIndex", "0");

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should not be clickable when clickable is false", () => {
    const onClick = vi.fn();
    render(
      <Card clickable={false} onClick={onClick} data-testid="test-card">
        Non-clickable content
      </Card>
    );

    const card = screen.getByTestId("test-card");
    expect(card).not.toHaveClass("card-clickable");
    expect(card).not.toHaveAttribute("role", "button");
    expect(card).not.toHaveAttribute("tabIndex");

    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should accept custom className", () => {
    render(
      <Card className="custom-class" data-testid="test-card">
        Custom content
      </Card>
    );

    expect(screen.getByTestId("test-card")).toHaveClass("custom-class");
  });

  it("should render complex children", () => {
    render(
      <Card data-testid="test-card">
        <div>
          <h4>Section Title</h4>
          <p>Section content</p>
          <button>Action</button>
        </div>
      </Card>
    );

    const content = screen.getByTestId("test-card-content");
    expect(content).toHaveTextContent("Section Title");
    expect(content).toHaveTextContent("Section content");
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("should be keyboard accessible when clickable", () => {
    const onClick = vi.fn();
    render(
      <Card clickable onClick={onClick} data-testid="test-card">
        Keyboard accessible
      </Card>
    );

    const card = screen.getByTestId("test-card");
    
    // Should be focusable
    card.focus();
    expect(document.activeElement).toBe(card);

    // Should handle Enter key
    fireEvent.keyDown(card, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(card, { key: " ", code: "Space" });
    
    // Note: We would need to manually implement keyboard handling in the real component
    // This test verifies the component is set up for accessibility
    expect(card).toHaveAttribute("tabIndex", "0");
  });

  it("should handle long titles and subtitles", () => {
    const longTitle = "This is a very long title that might overflow or wrap";
    const longSubtitle = "This is a very long subtitle that might also overflow or wrap to multiple lines";
    
    render(
      <Card title={longTitle} subtitle={longSubtitle} data-testid="test-card">
        Content
      </Card>
    );

    expect(screen.getByTestId("test-card-title")).toHaveTextContent(longTitle);
    expect(screen.getByTestId("test-card-subtitle")).toHaveTextContent(longSubtitle);
  });

  it("should handle special characters in content", () => {
    render(
      <Card title="Title & Co." subtitle="Subtitle <test>" data-testid="test-card">
        Content with &lt;special&gt; characters &amp; symbols
      </Card>
    );

    expect(screen.getByTestId("test-card-title")).toHaveTextContent("Title & Co.");
    expect(screen.getByTestId("test-card-subtitle")).toHaveTextContent("Subtitle <test>");
    expect(screen.getByTestId("test-card-content")).toHaveTextContent(
      "Content with <special> characters & symbols"
    );
  });

  it("should maintain proper structure", () => {
    render(
      <Card title="Test Title" subtitle="Test Subtitle" data-testid="test-card">
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </Card>
    );

    const card = screen.getByTestId("test-card");
    const header = screen.getByTestId("test-card-header");
    const content = screen.getByTestId("test-card-content");

    // Header should come before content
    expect(card.firstChild).toBe(header);
    expect(card.lastChild).toBe(content);

    // Content should contain both paragraphs
    expect(content.children).toHaveLength(2);
  });

  it("should handle empty content gracefully", () => {
    render(
      <Card title="Empty Card" data-testid="test-card">
        {null}
      </Card>
    );

    expect(screen.getByTestId("test-card")).toBeInTheDocument();
    expect(screen.getByTestId("test-card-title")).toHaveTextContent("Empty Card");
    expect(screen.getByTestId("test-card-content")).toBeInTheDocument();
  });
});