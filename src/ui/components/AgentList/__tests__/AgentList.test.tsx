/**
 * AgentList Component Test Suite
 * Tests agent list functionality and filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock AgentList component
interface Agent {
  id: string;
  name: string;
  status: "active" | "idle" | "busy" | "offline";
  type: string;
  description?: string;
}

interface AgentListProps {
  agents: Agent[];
  loading?: boolean;
  error?: string;
  onAgentSelect?: (agent: Agent) => void;
  onAgentConnect?: (id: string) => void;
  onAgentDisconnect?: (id: string) => void;
  filterStatus?: string;
  searchTerm?: string;
}

const AgentList: React.FC<AgentListProps> = ({
  agents,
  loading = false,
  error,
  onAgentSelect,
  onAgentConnect,
  onAgentDisconnect,
  filterStatus,
  searchTerm,
}) => {
  const [localSearch, setLocalSearch] = React.useState(searchTerm || "");
  const [localFilter, setLocalFilter] = React.useState(filterStatus || "all");

  const filteredAgents = agents?.filter((agent: any) => {
    const matchesSearch = agent?.name?.toLowerCase().includes(localSearch.toLowerCase()) ||
                         agent?.type?.toLowerCase().includes(localSearch.toLowerCase());
    const matchesFilter = localFilter === "all" || agent.status === localFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div data-testid="agent-list-loading" className="loading">
        Loading agents...
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="agent-list-error" className="error">
        Error: {error}
      </div>
    );
  }

  return (
    <div data-testid="agent-list" className="agent-list">
      <div className="agent-list-controls">
        <input
          type="text"
          placeholder="Search agents..."
          value={localSearch}
          onChange={(e: any) => setLocalSearch(e?.target?.value)}
          data-testid="agent-search"
        />
        <select
          value={localFilter}
          onChange={(e: any) => setLocalFilter(e?.target?.value)}
          data-testid="agent-filter"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div className="agent-count" data-testid="agent-count">
        Showing {filteredAgents?.length || 0} of {agents?.length || 0} agents
      </div>

      {filteredAgents?.length || 0 === 0 ? (
        <div data-testid="no-agents" className="no-agents">
          No agents found matching your criteria
        </div>
      ) : (
        <div className="agents-grid" data-testid="agents-grid">
          {filteredAgents?.map((agent: any) => (
            <div
              key={agent.id}
              className="agent-item"
              data-testid={`agent-item-${agent.id}`}
              onClick={() => onAgentSelect?.(agent)}
            >
              <h3 data-testid={`agent-name-${agent.id}`}>{agent.name}</h3>
              <p data-testid={`agent-status-${agent.id}`}>Status: {agent.status}</p>
              <p data-testid={`agent-type-${agent.id}`}>Type: {agent.type}</p>
              {agent.description && (
                <p data-testid={`agent-description-${agent.id}`}>{agent.description}</p>
              )}
              <div className="agent-actions">
                {agent.status === "offline" ? (
                  <button
                    onClick={(e: any) => {
                      e.stopPropagation();
                      onAgentConnect?.(agent.id);
                    }}
                    data-testid={`connect-${agent.id}`}
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={(e: any) => {
                      e.stopPropagation();
                      onAgentDisconnect?.(agent.id);
                    }}
                    data-testid={`disconnect-${agent.id}`}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

describe("AgentList Component", () => {
  const mockAgents: Agent[] = [
    {
      id: "agent-1",
      name: "Research Agent",
      status: "active",
      type: "research",
      description: "Handles research tasks",
    },
    {
      id: "agent-2",
      name: "Analysis Agent",
      status: "idle",
      type: "analysis",
      description: "Performs data analysis",
    },
    {
      id: "agent-3",
      name: "Communication Agent",
      status: "busy",
      type: "communication",
    },
    {
      id: "agent-4",
      name: "Data Agent",
      status: "offline",
      type: "data",
    },
  ];

  it("should render agent list correctly", () => {
    render(<AgentList agents={mockAgents} />);

    expect(screen.getByTestId("agent-list")).toBeInTheDocument();
    expect(screen.getByTestId("agents-grid")).toBeInTheDocument();
    expect(screen.getByTestId("agent-count")).toHaveTextContent("Showing 4 of 4 agents");

    // Check if all agents are rendered
    mockAgents.forEach((agent: any) => {
      expect(screen.getByTestId(`agent-item-${agent.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`agent-name-${agent.id}`)).toHaveTextContent(agent.name);
      expect(screen.getByTestId(`agent-status-${agent.id}`)).toHaveTextContent(`Status: ${agent.status}`);
      expect(screen.getByTestId(`agent-type-${agent.id}`)).toHaveTextContent(`Type: ${agent.type}`);
    });
  });

  it("should show loading state", () => {
    render(<AgentList agents={[]} loading={true} />);

    expect(screen.getByTestId("agent-list-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading agents...")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-list")).not.toBeInTheDocument();
  });

  it("should show error state", () => {
    render(<AgentList agents={[]} error="Failed to load agents" />);

    expect(screen.getByTestId("agent-list-error")).toBeInTheDocument();
    expect(screen.getByText("Error: Failed to load agents")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-list")).not.toBeInTheDocument();
  });

  it("should filter agents by search term", async () => {
    render(<AgentList agents={mockAgents} />);

    const searchInput = screen.getByTestId("agent-search");
    fireEvent.change(searchInput, { target: { value: "research" } });

    await waitFor(() => {
      expect(screen.getByTestId("agent-count")).toHaveTextContent("Showing 1 of 4 agents");
      expect(screen.getByTestId("agent-item-agent-1")).toBeInTheDocument();
      expect(screen.queryByTestId("agent-item-agent-2")).not.toBeInTheDocument();
    });
  });

  it("should filter agents by status", async () => {
    render(<AgentList agents={mockAgents} />);

    const filterSelect = screen.getByTestId("agent-filter");
    fireEvent.change(filterSelect, { target: { value: "active" } });

    await waitFor(() => {
      expect(screen.getByTestId("agent-count")).toHaveTextContent("Showing 1 of 4 agents");
      expect(screen.getByTestId("agent-item-agent-1")).toBeInTheDocument();
      expect(screen.queryByTestId("agent-item-agent-2")).not.toBeInTheDocument();
    });
  });

  it("should show no agents message when filtered list is empty", async () => {
    render(<AgentList agents={mockAgents} />);

    const searchInput = screen.getByTestId("agent-search");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    await waitFor(() => {
      expect(screen.getByTestId("no-agents")).toBeInTheDocument();
      expect(screen.getByText("No agents found matching your criteria")).toBeInTheDocument();
      expect(screen.queryByTestId("agents-grid")).not.toBeInTheDocument();
    });
  });

  it("should handle agent selection", () => {
    const onAgentSelect = vi.fn();
    render(<AgentList agents={mockAgents} onAgentSelect={onAgentSelect} />);

    fireEvent.click(screen.getByTestId("agent-item-agent-1"));

    expect(onAgentSelect).toHaveBeenCalledWith(mockAgents[0]);
  });

  it("should handle agent connection", () => {
    const onAgentConnect = vi.fn();
    render(<AgentList agents={mockAgents} onAgentConnect={onAgentConnect} />);

    fireEvent.click(screen.getByTestId("connect-agent-4"));

    expect(onAgentConnect).toHaveBeenCalledWith("agent-4");
  });

  it("should handle agent disconnection", () => {
    const onAgentDisconnect = vi.fn();
    render(<AgentList agents={mockAgents} onAgentDisconnect={onAgentDisconnect} />);

    fireEvent.click(screen.getByTestId("disconnect-agent-1"));

    expect(onAgentDisconnect).toHaveBeenCalledWith("agent-1");
  });

  it("should prevent event propagation on button clicks", () => {
    const onAgentSelect = vi.fn();
    const onAgentConnect = vi.fn();
    render(
      <AgentList
        agents={mockAgents}
        onAgentSelect={onAgentSelect}
        onAgentConnect={onAgentConnect}
      />
    );

    fireEvent.click(screen.getByTestId("connect-agent-4"));

    expect(onAgentConnect).toHaveBeenCalledWith("agent-4");
    expect(onAgentSelect).not.toHaveBeenCalled();
  });

  it("should combine search and filter", async () => {
    render(<AgentList agents={mockAgents} />);

    const searchInput = screen.getByTestId("agent-search");
    const filterSelect = screen.getByTestId("agent-filter");

    fireEvent.change(searchInput, { target: { value: "agent" } });
    fireEvent.change(filterSelect, { target: { value: "idle" } });

    await waitFor(() => {
      expect(screen.getByTestId("agent-count")).toHaveTextContent("Showing 1 of 4 agents");
      expect(screen.getByTestId("agent-item-agent-2")).toBeInTheDocument();
    });
  });

  it("should render agents with and without descriptions", () => {
    render(<AgentList agents={mockAgents} />);

    // Agent with description
    expect(screen.getByTestId("agent-description-agent-1")).toBeInTheDocument();
    expect(screen.getByTestId("agent-description-agent-1")).toHaveTextContent("Handles research tasks");

    // Agent without description
    expect(screen.queryByTestId("agent-description-agent-3")).not.toBeInTheDocument();
  });

  it("should be case-insensitive for search", async () => {
    render(<AgentList agents={mockAgents} />);

    const searchInput = screen.getByTestId("agent-search");
    fireEvent.change(searchInput, { target: { value: "RESEARCH" } });

    await waitFor(() => {
      expect(screen.getByTestId("agent-count")).toHaveTextContent("Showing 1 of 4 agents");
      expect(screen.getByTestId("agent-item-agent-1")).toBeInTheDocument();
    });
  });

  it("should search by both name and type", async () => {
    render(<AgentList agents={mockAgents} />);

    const searchInput = screen.getByTestId("agent-search");
    fireEvent.change(searchInput, { target: { value: "communication" } });

    await waitFor(() => {
      expect(screen.getByTestId("agent-count")).toHaveTextContent("Showing 1 of 4 agents");
      expect(screen.getByTestId("agent-item-agent-3")).toBeInTheDocument();
    });
  });
});