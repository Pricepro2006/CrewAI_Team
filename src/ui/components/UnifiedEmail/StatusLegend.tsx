import React from "react";

export const StatusLegend: React.FC = () => {
  const statuses = [
    {
      color: "#10B981",
      label: "Completed",
      description: "Workflow finished successfully",
    },
    {
      color: "#F59E0B",
      label: "In Progress",
      description: "Currently being processed",
    },
    {
      color: "#EF4444",
      label: "Critical",
      description: "Requires immediate attention",
    },
    {
      color: "#6B7280",
      label: "Pending",
      description: "Waiting to be processed",
    },
  ];

  return (
    <div className="status-legend">
      <h4>Status Legend</h4>
      <div className="legend-items">
        {statuses?.map((status, index) => (
          <div key={index} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: status.color }}
            ></span>
            <span className="legend-label">{status.label}</span>
            <span className="legend-description">{status.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
