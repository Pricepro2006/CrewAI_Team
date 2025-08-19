/**
 * AgentCard Component Test Suite
 * Tests agent card display and interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock AgentCard component
interface AgentCardProps {
  id: string;
  name: string;
  status: "active" | "idle" | "busy" | "offline";
  type: string;
  description?: string;
  onConnect?: (id: string) => void;
  onDisconnect?: (id: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  id,
  name,
  status,
  type,
  description,
  onConnect,
  onDisconnect,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "green";
      case "busy":
        return "orange";
      case "idle":
        return "blue";
      case "offline":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <div className="agent-card" data-testid={`agent-card-${id}`}>
      <div className="agent-header">
        <h3 data-testid={`agent-name-${id}`}>{name}</h3>
        <span
          className={`status-indicator ${status}`}
          data-testid={`agent-status-${id}`}
          style={{ color: getStatusColor(status) }}
        >
          {status}
        </span>
      </div>
      <div className="agent-details">
        <p data-testid={`agent-type-${id}`}>Type: {type}</p>
        {description && (
          <p data-testid={`agent-description-${id}`}>{description}</p>
        )}
      </div>
      <div className="agent-actions">
        {status === "offline" ? (
          <button
            onClick={() => onConnect?.(id)}
            data-testid={`connect-btn-${id}`}
            className="connect-btn"
          >
            Connect
          </button>
        ) : (
          <button
            onClick={() => onDisconnect?.(id)}
            data-testid={`disconnect-btn-${id}`}
            className="disconnect-btn"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};

describe("AgentCard Component", () => {
  const mockAgent = {
    id: "agent-1",
    name: "Research Agent",
    status: "active" as const,
    type: "research",
    description: "Handles research tasks and data gathering",
  };

  it("should render agent information correctly", () => {
    render(<AgentCard {...mockAgent} />);

    expect(screen.getByTestId("agent-card-agent-1")).toBeInTheDocument();
    expect(screen.getByTestId("agent-name-agent-1")).toHaveTextContent("Research Agent");
    expect(screen.getByTestId("agent-status-agent-1")).toHaveTextContent("active");
    expect(screen.getByTestId("agent-type-agent-1")).toHaveTextContent("Type: research");
    expect(screen.getByTestId("agent-description-agent-1")).toHaveTextContent(
      "Handles research tasks and data gathering"
    );
  });

  it("should render without description", () => {
    const agentWithoutDescription = {
      ...mockAgent,
      description: undefined,
    };

    render(<AgentCard {...agentWithoutDescription} />);

    expect(screen.getByTestId("agent-name-agent-1")).toHaveTextContent("Research Agent");
    expect(screen.queryByTestId("agent-description-agent-1")).not.toBeInTheDocument();
  });

  it("should show connect button for offline agents", () => {
    const offlineAgent = {
      ...mockAgent,
      status: "offline" as const,
    };

    render(<AgentCard {...offlineAgent} />);

    expect(screen.getByTestId("connect-btn-agent-1")).toBeInTheDocument();
    expect(screen.queryByTestId("disconnect-btn-agent-1")).not.toBeInTheDocument();
  });

  it("should show disconnect button for online agents", () => {
    render(<AgentCard {...mockAgent} />);

    expect(screen.getByTestId("disconnect-btn-agent-1")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-btn-agent-1")).not.toBeInTheDocument();
  });

  it("should call onConnect when connect button is clicked", () => {
    const onConnect = vi.fn();
    const offlineAgent = {
      ...mockAgent,
      status: "offline" as const,
    };

    render(<AgentCard {...offlineAgent} onConnect={onConnect} />);

    fireEvent.click(screen.getByTestId("connect-btn-agent-1"));

    expect(onConnect).toHaveBeenCalledWith("agent-1");
  });

  it("should call onDisconnect when disconnect button is clicked", () => {
    const onDisconnect = vi.fn();

    render(<AgentCard {...mockAgent} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByTestId("disconnect-btn-agent-1"));

    expect(onDisconnect).toHaveBeenCalledWith("agent-1");
  });

  it("should display correct status colors", () => {
    const statuses = [
      { status: "active" as const, color: "green" },
      { status: "busy" as const, color: "orange" },
      { status: "idle" as const, color: "blue" },
      { status: "offline" as const, color: "red" },
    ];

    statuses.forEach(({ status, color }) => {
      const { rerender } = render(
        <AgentCard {...mockAgent} status={status} />
      );

      const statusElement = screen.getByTestId("agent-status-agent-1");
      expect(statusElement).toHaveStyle({ color });

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should handle different agent types", () => {
    const agentTypes = ["research", "analysis", "data", "communication"];

    agentTypes.forEach((type: any) => {
      const { rerender } = render(
        <AgentCard {...mockAgent} type={type} />
      );

      expect(screen.getByTestId("agent-type-agent-1")).toHaveTextContent(`Type: ${type}`);

      rerender(<div />); // Clear for next iteration
    });
  });

  it("should be accessible", () => {
    render(<AgentCard {...mockAgent} />);

    const connectButton = screen.getByTestId("disconnect-btn-agent-1");
    expect(connectButton).toBeEnabled();

    // Test keyboard navigation
    connectButton.focus();
    expect(document.activeElement).toBe(connectButton);
  });

  it("should handle long agent names gracefully", () => {
    const longNameAgent = {
      ...mockAgent,
      name: "Very Long Agent Name That Might Overflow",
    };

    render(<AgentCard {...longNameAgent} />);

    expect(screen.getByTestId("agent-name-agent-1")).toHaveTextContent(
      "Very Long Agent Name That Might Overflow"
    );
  });

  it("should handle special characters in agent data", () => {
    const specialAgent = {
      ...mockAgent,
      name: "Agent & Co. (v2.0)",
      description: "Handles <special> characters & symbols",
    };

    render(<AgentCard {...specialAgent} />);

    expect(screen.getByTestId("agent-name-agent-1")).toHaveTextContent("Agent & Co. (v2.0)");
    expect(screen.getByTestId("agent-description-agent-1")).toHaveTextContent(
      "Handles <special> characters & symbols"
    );
  });
});