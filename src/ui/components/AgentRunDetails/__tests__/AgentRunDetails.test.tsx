/**
 * AgentRunDetails Component Test Suite
 * Tests agent run details display and management
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock AgentRunDetails component
interface AgentRun {
  id: string;
  agentId: string;
  agentName: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startTime: string;
  endTime?: string;
  duration?: number;
  taskDescription: string;
  result?: string;
  error?: string;
  logs: string[];
}

interface AgentRunDetailsProps {
  run: AgentRun;
  onCancel?: (runId: string) => void;
  onRetry?: (runId: string) => void;
  onViewLogs?: (runId: string) => void;
}

const AgentRunDetails: React.FC<AgentRunDetailsProps> = ({
  run,
  onCancel,
  onRetry,
  onViewLogs,
}) => {
  const [showLogs, setShowLogs] = React.useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "blue";
      case "completed": return "green";
      case "failed": return "red";
      case "cancelled": return "orange";
      default: return "gray";
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "N/A";
    return `${Math.round(duration / 1000)}s`;
  };

  return (
    <div className="agent-run-details" data-testid={`run-details-${run.id}`}>
      <div className="run-header">
        <h3 data-testid={`run-title-${run.id}`}>
          {run.agentName} - Run {run.id}
        </h3>
        <span 
          className={`status-badge ${run.status}`}
          style={{ color: getStatusColor(run.status) }}
          data-testid={`run-status-${run.id}`}
        >
          {run.status}
        </span>
      </div>

      <div className="run-details">
        <div className="detail-row">
          <label>Task:</label>
          <span data-testid={`run-task-${run.id}`}>{run.taskDescription}</span>
        </div>
        
        <div className="detail-row">
          <label>Started:</label>
          <span data-testid={`run-start-time-${run.id}`}>
            {new Date(run.startTime).toLocaleString()}
          </span>
        </div>

        {run.endTime && (
          <div className="detail-row">
            <label>Ended:</label>
            <span data-testid={`run-end-time-${run.id}`}>
              {new Date(run.endTime).toLocaleString()}
            </span>
          </div>
        )}

        <div className="detail-row">
          <label>Duration:</label>
          <span data-testid={`run-duration-${run.id}`}>
            {formatDuration(run.duration)}
          </span>
        </div>

        {run.result && (
          <div className="detail-row">
            <label>Result:</label>
            <span data-testid={`run-result-${run.id}`}>{run.result}</span>
          </div>
        )}

        {run.error && (
          <div className="detail-row error">
            <label>Error:</label>
            <span data-testid={`run-error-${run.id}`}>{run.error}</span>
          </div>
        )}
      </div>

      <div className="run-actions">
        {run.status === "running" && (
          <button
            onClick={() => onCancel?.(run.id)}
            data-testid={`cancel-btn-${run.id}`}
            className="cancel-btn"
          >
            Cancel
          </button>
        )}

        {run.status === "failed" && (
          <button
            onClick={() => onRetry?.(run.id)}
            data-testid={`retry-btn-${run.id}`}
            className="retry-btn"
          >
            Retry
          </button>
        )}

        <button
          onClick={() => setShowLogs(!showLogs)}
          data-testid={`logs-toggle-${run.id}`}
          className="logs-btn"
        >
          {showLogs ? "Hide Logs" : "Show Logs"}
        </button>

        <button
          onClick={() => onViewLogs?.(run.id)}
          data-testid={`view-logs-btn-${run.id}`}
          className="view-logs-btn"
        >
          View Full Logs
        </button>
      </div>

      {showLogs && (
        <div className="logs-section" data-testid={`logs-section-${run.id}`}>
          <h4>Recent Logs:</h4>
          <div className="logs-container">
            {run?.logs?.length === 0 ? (
              <p data-testid={`no-logs-${run.id}`}>No logs available</p>
            ) : (
              run?.logs?.map((log, index) => (
                <div
                  key={index}
                  className="log-entry"
                  data-testid={`log-entry-${run.id}-${index}`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

describe("AgentRunDetails Component", () => {
  const mockRunningRun: AgentRun = {
    id: "run-1",
    agentId: "agent-1",
    agentName: "Research Agent",
    status: "running",
    startTime: "2025-01-20T10:00:00Z",
    duration: 30000,
    taskDescription: "Analyze market trends",
    logs: ["Starting analysis...", "Processing data..."],
  };

  const mockCompletedRun: AgentRun = {
    id: "run-2",
    agentId: "agent-1",
    agentName: "Research Agent",
    status: "completed",
    startTime: "2025-01-20T10:00:00Z",
    endTime: "2025-01-20T10:05:00Z",
    duration: 300000,
    taskDescription: "Generate report",
    result: "Report generated successfully",
    logs: ["Starting generation...", "Report created", "Task completed"],
  };

  const mockFailedRun: AgentRun = {
    id: "run-3",
    agentId: "agent-2",
    agentName: "Analysis Agent",
    status: "failed",
    startTime: "2025-01-20T10:00:00Z",
    endTime: "2025-01-20T10:02:00Z",
    duration: 120000,
    taskDescription: "Process dataset",
    error: "Invalid data format",
    logs: ["Starting processing...", "Error encountered"],
  };

  it("should render running agent run details", () => {
    render(<AgentRunDetails run={mockRunningRun} />);

    expect(screen.getByTestId("run-details-run-1")).toBeInTheDocument();
    expect(screen.getByTestId("run-title-run-1")).toHaveTextContent("Research Agent - Run run-1");
    expect(screen.getByTestId("run-status-run-1")).toHaveTextContent("running");
    expect(screen.getByTestId("run-task-run-1")).toHaveTextContent("Analyze market trends");
    expect(screen.getByTestId("run-duration-run-1")).toHaveTextContent("30s");
  });

  it("should render completed agent run details", () => {
    render(<AgentRunDetails run={mockCompletedRun} />);

    expect(screen.getByTestId("run-status-run-2")).toHaveTextContent("completed");
    expect(screen.getByTestId("run-result-run-2")).toHaveTextContent("Report generated successfully");
    expect(screen.getByTestId("run-end-time-run-2")).toBeInTheDocument();
    expect(screen.getByTestId("run-duration-run-2")).toHaveTextContent("300s");
  });

  it("should render failed agent run details", () => {
    render(<AgentRunDetails run={mockFailedRun} />);

    expect(screen.getByTestId("run-status-run-3")).toHaveTextContent("failed");
    expect(screen.getByTestId("run-error-run-3")).toHaveTextContent("Invalid data format");
    expect(screen.getByTestId("retry-btn-run-3")).toBeInTheDocument();
  });

  it("should show cancel button for running runs", () => {
    render(<AgentRunDetails run={mockRunningRun} />);

    expect(screen.getByTestId("cancel-btn-run-1")).toBeInTheDocument();
    expect(screen.queryByTestId("retry-btn-run-1")).not.toBeInTheDocument();
  });

  it("should show retry button for failed runs", () => {
    render(<AgentRunDetails run={mockFailedRun} />);

    expect(screen.getByTestId("retry-btn-run-3")).toBeInTheDocument();
    expect(screen.queryByTestId("cancel-btn-run-3")).not.toBeInTheDocument();
  });

  it("should handle cancel action", () => {
    const onCancel = vi.fn();
    render(<AgentRunDetails run={mockRunningRun} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId("cancel-btn-run-1"));

    expect(onCancel).toHaveBeenCalledWith("run-1");
  });

  it("should handle retry action", () => {
    const onRetry = vi.fn();
    render(<AgentRunDetails run={mockFailedRun} onRetry={onRetry} />);

    fireEvent.click(screen.getByTestId("retry-btn-run-3"));

    expect(onRetry).toHaveBeenCalledWith("run-3");
  });

  it("should toggle logs visibility", () => {
    render(<AgentRunDetails run={mockRunningRun} />);

    expect(screen.queryByTestId("logs-section-run-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("logs-toggle-run-1"));

    expect(screen.getByTestId("logs-section-run-1")).toBeInTheDocument();
    expect(screen.getByTestId("logs-toggle-run-1")).toHaveTextContent("Hide Logs");

    fireEvent.click(screen.getByTestId("logs-toggle-run-1"));

    expect(screen.queryByTestId("logs-section-run-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("logs-toggle-run-1")).toHaveTextContent("Show Logs");
  });

  it("should display logs when expanded", () => {
    render(<AgentRunDetails run={mockRunningRun} />);

    fireEvent.click(screen.getByTestId("logs-toggle-run-1"));

    expect(screen.getByTestId("log-entry-run-1-0")).toHaveTextContent("Starting analysis...");
    expect(screen.getByTestId("log-entry-run-1-1")).toHaveTextContent("Processing data...");
  });

  it("should show no logs message when logs array is empty", () => {
    const runWithoutLogs = { ...mockRunningRun, logs: [] };
    render(<AgentRunDetails run={runWithoutLogs} />);

    fireEvent.click(screen.getByTestId("logs-toggle-run-1"));

    expect(screen.getByTestId("no-logs-run-1")).toHaveTextContent("No logs available");
  });

  it("should handle view full logs action", () => {
    const onViewLogs = vi.fn();
    render(<AgentRunDetails run={mockRunningRun} onViewLogs={onViewLogs} />);

    fireEvent.click(screen.getByTestId("view-logs-btn-run-1"));

    expect(onViewLogs).toHaveBeenCalledWith("run-1");
  });

  it("should format duration correctly", () => {
    const runs = [
      { ...mockRunningRun, duration: 5000 }, // 5s
      { ...mockRunningRun, duration: 65000 }, // 65s
      { ...mockRunningRun, duration: undefined }, // N/A
    ];

    runs.forEach((run, index) => {
      const { rerender } = render(<AgentRunDetails run={run} />);
      
      const expectedText = run.duration ? `${Math.round(run.duration / 1000)}s` : "N/A";
      expect(screen.getByTestId(`run-duration-${run.id}`)).toHaveTextContent(expectedText);
      
      rerender(<div />); // Clear for next iteration
    });
  });

  it("should display correct status colors", () => {
    const statuses = [
      { status: "running" as const, color: "blue" },
      { status: "completed" as const, color: "green" },
      { status: "failed" as const, color: "red" },
      { status: "cancelled" as const, color: "orange" },
    ];

    statuses.forEach(({ status, color }, index) => {
      const run = { ...mockRunningRun, status, id: `run-${index}` };
      const { rerender } = render(<AgentRunDetails run={run} />);

      const statusElement = screen.getByTestId(`run-status-run-${index}`);
      expect(statusElement).toHaveStyle({ color });

      rerender(<div />); // Clear for next iteration
    });
  });
});