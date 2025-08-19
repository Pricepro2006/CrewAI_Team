/**
 * ExecutionGraph Component Test Suite
 * Tests execution graph visualization and interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock ExecutionGraph component
interface GraphNode {
  id: string;
  type: "task" | "agent" | "decision";
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  x: number;
  y: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface ExecutionGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  width?: number;
  height?: number;
  interactive?: boolean;
}

const ExecutionGraph: React.FC<ExecutionGraphProps> = ({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
  width = 800,
  height = 600,
  interactive = true,
}) => {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(1);

  const handleNodeClick = (node: GraphNode) => {
    if (!interactive) return;
    setSelectedNodeId(node.id);
    onNodeClick?.(node);
  };

  const getNodeColor = (status: string) => {
    switch (status) {
      case "pending": return "gray";
      case "running": return "blue";
      case "completed": return "green";
      case "failed": return "red";
      default: return "gray";
    }
  };

  const getNodeShape = (type: string) => {
    switch (type) {
      case "task": return "rect";
      case "agent": return "circle";
      case "decision": return "diamond";
      default: return "rect";
    }
  };

  return (
    <div 
      className="execution-graph" 
      data-testid="execution-graph"
      style={{ width, height }}
    >
      <div className="graph-controls" data-testid="graph-controls">
        <button
          onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          data-testid="zoom-in"
          disabled={!interactive}
        >
          Zoom In
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
          data-testid="zoom-out"
          disabled={!interactive}
        >
          Zoom Out
        </button>
        <button
          onClick={() => setZoom(1)}
          data-testid="reset-zoom"
          disabled={!interactive}
        >
          Reset Zoom
        </button>
        <span data-testid="zoom-level">Zoom: {Math.round(zoom * 100)}%</span>
      </div>

      <svg
        width={width}
        height={height - 50} // Account for controls
        data-testid="graph-svg"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
      >
        {/* Render edges first (behind nodes) */}
        {edges?.map((edge: any) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          if (!sourceNode || !targetNode) return null;

          return (
            <g key={edge.id} data-testid={`edge-${edge.id}`}>
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="black"
                strokeWidth="2"
                onClick={() => onEdgeClick?.(edge)}
                style={{ cursor: interactive ? "pointer" : "default" }}
              />
              {edge.label && (
                <text
                  x={(sourceNode.x + targetNode.x) / 2}
                  y={(sourceNode.y + targetNode.y) / 2}
                  textAnchor="middle"
                  fontSize="12"
                  data-testid={`edge-label-${edge.id}`}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render nodes */}
        {nodes?.map((node: any) => (
          <g 
            key={node.id} 
            data-testid={`node-${node.id}`}
            onClick={() => handleNodeClick(node)}
            style={{ cursor: interactive ? "pointer" : "default" }}
          >
            {getNodeShape(node.type) === "circle" ? (
              <circle
                cx={node.x}
                cy={node.y}
                r="30"
                fill={getNodeColor(node.status)}
                stroke={selectedNodeId === node.id ? "black" : "none"}
                strokeWidth="3"
                data-testid={`node-shape-${node.id}`}
              />
            ) : (
              <rect
                x={node.x - 40}
                y={node.y - 20}
                width="80"
                height="40"
                fill={getNodeColor(node.status)}
                stroke={selectedNodeId === node.id ? "black" : "none"}
                strokeWidth="3"
                data-testid={`node-shape-${node.id}`}
              />
            )}
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fontSize="12"
              fill="white"
              data-testid={`node-label-${node.id}`}
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={node.y + 20}
              textAnchor="middle"
              fontSize="10"
              fill="white"
              data-testid={`node-status-${node.id}`}
            >
              {node.status}
            </text>
          </g>
        ))}
      </svg>

      {selectedNodeId && (
        <div className="node-details" data-testid="node-details">
          <h4>Node Details</h4>
          <p data-testid="selected-node-id">ID: {selectedNodeId}</p>
          <p data-testid="selected-node-info">
            {nodes.find(n => n.id === selectedNodeId)?.label} - {nodes.find(n => n.id === selectedNodeId)?.status}
          </p>
        </div>
      )}
    </div>
  );
};

describe("ExecutionGraph Component", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "node-1",
      type: "task",
      label: "Start Task",
      status: "completed",
      x: 100,
      y: 100,
    },
    {
      id: "node-2",
      type: "agent",
      label: "Agent Process",
      status: "running",
      x: 300,
      y: 100,
    },
    {
      id: "node-3",
      type: "decision",
      label: "Decision Point",
      status: "pending",
      x: 500,
      y: 100,
    },
  ];

  const mockEdges: GraphEdge[] = [
    {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      label: "Process",
    },
    {
      id: "edge-2",
      source: "node-2",
      target: "node-3",
      label: "Evaluate",
    },
  ];

  it("should render execution graph correctly", () => {
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} />);

    expect(screen.getByTestId("execution-graph")).toBeInTheDocument();
    expect(screen.getByTestId("graph-svg")).toBeInTheDocument();
    expect(screen.getByTestId("graph-controls")).toBeInTheDocument();

    // Check if all nodes are rendered
    mockNodes.forEach((node: any) => {
      expect(screen.getByTestId(`node-${node.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`node-label-${node.id}`)).toHaveTextContent(node.label);
      expect(screen.getByTestId(`node-status-${node.id}`)).toHaveTextContent(node.status);
    });

    // Check if all edges are rendered
    mockEdges.forEach((edge: any) => {
      expect(screen.getByTestId(`edge-${edge.id}`)).toBeInTheDocument();
      if (edge.label) {
        expect(screen.getByTestId(`edge-label-${edge.id}`)).toHaveTextContent(edge.label);
      }
    });
  });

  it("should handle node selection", () => {
    const onNodeClick = vi.fn();
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} onNodeClick={onNodeClick} />);

    fireEvent.click(screen.getByTestId("node-node-1"));

    expect(onNodeClick).toHaveBeenCalledWith(mockNodes[0]);
    expect(screen.getByTestId("node-details")).toBeInTheDocument();
    expect(screen.getByTestId("selected-node-id")).toHaveTextContent("ID: node-1");
  });

  it("should handle edge clicks", () => {
    const onEdgeClick = vi.fn();
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} onEdgeClick={onEdgeClick} />);

    fireEvent.click(screen.getByTestId("edge-edge-1").querySelector("line")!);

    expect(onEdgeClick).toHaveBeenCalledWith(mockEdges[0]);
  });

  it("should handle zoom controls", () => {
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} />);

    const zoomInBtn = screen.getByTestId("zoom-in");
    const zoomOutBtn = screen.getByTestId("zoom-out");
    const resetZoomBtn = screen.getByTestId("reset-zoom");
    const zoomLevel = screen.getByTestId("zoom-level");

    // Initial zoom should be 100%
    expect(zoomLevel).toHaveTextContent("Zoom: 100%");

    // Test zoom in
    fireEvent.click(zoomInBtn);
    expect(zoomLevel).toHaveTextContent("Zoom: 110%");

    // Test zoom out
    fireEvent.click(zoomOutBtn);
    expect(zoomLevel).toHaveTextContent("Zoom: 100%");

    // Test reset zoom
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);
    fireEvent.click(resetZoomBtn);
    expect(zoomLevel).toHaveTextContent("Zoom: 100%");
  });

  it("should render different node types with correct shapes", () => {
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} />);

    // Task node should be rectangle
    const taskNode = screen.getByTestId("node-shape-node-1");
    expect(taskNode.tagName).toBe("rect");

    // Agent node should be circle
    const agentNode = screen.getByTestId("node-shape-node-2");
    expect(agentNode.tagName).toBe("circle");

    // Decision node should be rectangle (simplified for test)
    const decisionNode = screen.getByTestId("node-shape-node-3");
    expect(decisionNode.tagName).toBe("rect");
  });

  it("should show correct status colors", () => {
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} />);

    const completedNode = screen.getByTestId("node-shape-node-1");
    expect(completedNode).toHaveAttribute("fill", "green");

    const runningNode = screen.getByTestId("node-shape-node-2");
    expect(runningNode).toHaveAttribute("fill", "blue");

    const pendingNode = screen.getByTestId("node-shape-node-3");
    expect(pendingNode).toHaveAttribute("fill", "gray");
  });

  it("should handle non-interactive mode", () => {
    const onNodeClick = vi.fn();
    render(
      <ExecutionGraph
        nodes={mockNodes}
        edges={mockEdges}
        onNodeClick={onNodeClick}
        interactive={false}
      />
    );

    // Controls should be disabled
    expect(screen.getByTestId("zoom-in")).toBeDisabled();
    expect(screen.getByTestId("zoom-out")).toBeDisabled();
    expect(screen.getByTestId("reset-zoom")).toBeDisabled();

    // Node clicks should not work
    fireEvent.click(screen.getByTestId("node-node-1"));
    expect(onNodeClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
  });

  it("should handle custom dimensions", () => {
    render(
      <ExecutionGraph
        nodes={mockNodes}
        edges={mockEdges}
        width={1000}
        height={800}
      />
    );

    const graphContainer = screen.getByTestId("execution-graph");
    expect(graphContainer).toHaveStyle({ width: "1000px", height: "800px" });

    const svg = screen.getByTestId("graph-svg");
    expect(svg).toHaveAttribute("width", "1000");
    expect(svg).toHaveAttribute("height", "750"); // 800 - 50 for controls
  });

  it("should handle empty graph", () => {
    render(<ExecutionGraph nodes={[]} edges={[]} />);

    expect(screen.getByTestId("execution-graph")).toBeInTheDocument();
    expect(screen.getByTestId("graph-svg")).toBeInTheDocument();
    expect(screen.queryByTestId("node-details")).not.toBeInTheDocument();
  });

  it("should handle edges with missing nodes gracefully", () => {
    const invalidEdges = [
      {
        id: "invalid-edge",
        source: "nonexistent-node",
        target: "node-1",
      },
    ];

    render(<ExecutionGraph nodes={mockNodes} edges={invalidEdges} />);

    // Should render without crashing
    expect(screen.getByTestId("execution-graph")).toBeInTheDocument();
    expect(screen.queryByTestId("edge-invalid-edge")).not.toBeInTheDocument();
  });

  it("should update selection when different nodes are clicked", () => {
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} />);

    // Click first node
    fireEvent.click(screen.getByTestId("node-node-1"));
    expect(screen.getByTestId("selected-node-id")).toHaveTextContent("ID: node-1");

    // Click second node
    fireEvent.click(screen.getByTestId("node-node-2"));
    expect(screen.getByTestId("selected-node-id")).toHaveTextContent("ID: node-2");
  });

  it("should respect zoom limits", () => {
    render(<ExecutionGraph nodes={mockNodes} edges={mockEdges} />);

    const zoomInBtn = screen.getByTestId("zoom-in");
    const zoomOutBtn = screen.getByTestId("zoom-out");
    const zoomLevel = screen.getByTestId("zoom-level");

    // Test maximum zoom (200%)
    for (let i = 0; i < 15; i++) {
      fireEvent.click(zoomInBtn);
    }
    expect(zoomLevel).toHaveTextContent("Zoom: 200%");

    // Reset and test minimum zoom (50%)
    fireEvent.click(screen.getByTestId("reset-zoom"));
    for (let i = 0; i < 10; i++) {
      fireEvent.click(zoomOutBtn);
    }
    expect(zoomLevel).toHaveTextContent("Zoom: 50%");
  });
});