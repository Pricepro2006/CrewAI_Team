/**
 * TaskCard Component Test Suite
 * Tests task card functionality and status management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock TaskCard component
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  dueDate?: string;
  tags?: string[];
}

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: Task["status"]) => void;
  onAssign?: (taskId: string, assignee: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  compact?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStatusChange,
  onAssign,
  onEdit,
  onDelete,
  compact = false,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "gray";
      case "in_progress": return "blue";
      case "completed": return "green";
      case "failed": return "red";
      default: return "gray";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "green";
      case "medium": return "orange";
      case "high": return "red";
      default: return "gray";
    }
  };

  return (
    <div 
      className={`task-card ${compact ? "compact" : ""}`}
      data-testid={`task-card-${task.id}`}
    >
      <div className="task-header">
        <h3 data-testid={`task-title-${task.id}`}>{task.title}</h3>
        <div className="task-badges">
          <span 
            className={`status-badge ${task.status}`}
            style={{ backgroundColor: getStatusColor(task.status) }}
            data-testid={`task-status-${task.id}`}
          >
            {task?.status?.replace("_", " ")}
          </span>
          <span 
            className={`priority-badge ${task.priority}`}
            style={{ backgroundColor: getPriorityColor(task.priority) }}
            data-testid={`task-priority-${task.id}`}
          >
            {task.priority}
          </span>
        </div>
      </div>

      {!compact && task.description && (
        <p className="task-description" data-testid={`task-description-${task.id}`}>
          {task.description}
        </p>
      )}

      <div className="task-meta">
        {task.assignedTo && (
          <span data-testid={`task-assignee-${task.id}`}>
            Assigned to: {task.assignedTo}
          </span>
        )}
        {task.dueDate && (
          <span data-testid={`task-due-date-${task.id}`}>
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {task.tags && task?.tags?.length > 0 && (
        <div className="task-tags" data-testid={`task-tags-${task.id}`}>
          {task?.tags?.map((tag, index) => (
            <span 
              key={index} 
              className="tag"
              data-testid={`task-tag-${task.id}-${index}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="task-actions">
        <select
          value={task.status}
          onChange={(e: any) => onStatusChange?.(task.id, e?.target?.value as Task["status"])}
          data-testid={`status-select-${task.id}`}
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        <button
          onClick={() => onEdit?.(task)}
          data-testid={`edit-btn-${task.id}`}
        >
          Edit
        </button>

        <button
          onClick={() => onDelete?.(task.id)}
          data-testid={`delete-btn-${task.id}`}
          className="delete-btn"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

describe("TaskCard Component", () => {
  const mockTask: Task = {
    id: "task-1",
    title: "Sample Task",
    description: "This is a sample task description",
    status: "pending",
    priority: "medium",
    assignedTo: "john-doe",
    dueDate: "2025-02-01T00:00:00Z",
    tags: ["frontend", "urgent"],
  };

  it("should render task card correctly", () => {
    render(<TaskCard task={mockTask} />);

    expect(screen.getByTestId("task-card-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("task-title-task-1")).toHaveTextContent("Sample Task");
    expect(screen.getByTestId("task-description-task-1")).toHaveTextContent("This is a sample task description");
    expect(screen.getByTestId("task-status-task-1")).toHaveTextContent("pending");
    expect(screen.getByTestId("task-priority-task-1")).toHaveTextContent("medium");
  });

  it("should render compact version", () => {
    render(<TaskCard task={mockTask} compact={true} />);

    const card = screen.getByTestId("task-card-task-1");
    expect(card).toHaveClass("compact");
    expect(screen.queryByTestId("task-description-task-1")).not.toBeInTheDocument();
  });

  it("should display assignee information", () => {
    render(<TaskCard task={mockTask} />);

    expect(screen.getByTestId("task-assignee-task-1")).toHaveTextContent("Assigned to: john-doe");
  });

  it("should display due date", () => {
    render(<TaskCard task={mockTask} />);

    expect(screen.getByTestId("task-due-date-task-1")).toHaveTextContent("Due: 2/1/2025");
  });

  it("should display tags", () => {
    render(<TaskCard task={mockTask} />);

    expect(screen.getByTestId("task-tags-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("task-tag-task-1-0")).toHaveTextContent("frontend");
    expect(screen.getByTestId("task-tag-task-1-1")).toHaveTextContent("urgent");
  });

  it("should handle status change", () => {
    const onStatusChange = vi.fn();
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />);

    const statusSelect = screen.getByTestId("status-select-task-1");
    fireEvent.change(statusSelect, { target: { value: "completed" } });

    expect(onStatusChange).toHaveBeenCalledWith("task-1", "completed");
  });

  it("should handle edit action", () => {
    const onEdit = vi.fn();
    render(<TaskCard task={mockTask} onEdit={onEdit} />);

    fireEvent.click(screen.getByTestId("edit-btn-task-1"));

    expect(onEdit).toHaveBeenCalledWith(mockTask);
  });

  it("should handle delete action", () => {
    const onDelete = vi.fn();
    render(<TaskCard task={mockTask} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId("delete-btn-task-1"));

    expect(onDelete).toHaveBeenCalledWith("task-1");
  });

  it("should render without optional fields", () => {
    const minimalTask: Task = {
      id: "task-2",
      title: "Minimal Task",
      status: "pending",
      priority: "low",
    };

    render(<TaskCard task={minimalTask} />);

    expect(screen.getByTestId("task-title-task-2")).toHaveTextContent("Minimal Task");
    expect(screen.queryByTestId("task-description-task-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-assignee-task-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-due-date-task-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-tags-task-2")).not.toBeInTheDocument();
  });

  it("should show correct status colors", () => {
    const statuses: Task["status"][] = ["pending", "in_progress", "completed", "failed"];
    const expectedColors = ["gray", "blue", "green", "red"];

    statuses.forEach((status, index) => {
      const task = { ...mockTask, status, id: `task-${index}` };
      const { rerender } = render(<TaskCard task={task} />);

      const statusElement = screen.getByTestId(`task-status-task-${index}`);
      expect(statusElement).toHaveStyle({ backgroundColor: expectedColors[index] });

      rerender(<div />);
    });
  });

  it("should show correct priority colors", () => {
    const priorities: Task["priority"][] = ["low", "medium", "high"];
    const expectedColors = ["green", "orange", "red"];

    priorities.forEach((priority, index) => {
      const task = { ...mockTask, priority, id: `task-${index}` };
      const { rerender } = render(<TaskCard task={task} />);

      const priorityElement = screen.getByTestId(`task-priority-task-${index}`);
      expect(priorityElement).toHaveStyle({ backgroundColor: expectedColors[index] });

      rerender(<div />);
    });
  });

  it("should handle empty tags array", () => {
    const taskWithEmptyTags = { ...mockTask, tags: [] };
    render(<TaskCard task={taskWithEmptyTags} />);

    expect(screen.queryByTestId("task-tags-task-1")).not.toBeInTheDocument();
  });

  it("should format status text correctly", () => {
    const inProgressTask = { ...mockTask, status: "in_progress" as const };
    render(<TaskCard task={inProgressTask} />);

    expect(screen.getByTestId("task-status-task-1")).toHaveTextContent("in progress");
  });
});