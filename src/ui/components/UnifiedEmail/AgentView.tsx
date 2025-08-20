import React from "react";

interface AgentViewProps {
  agents?: any[];
  agentPerformance?: any;
}

export const AgentView: React.FC<AgentViewProps> = ({
  agents = [],
  agentPerformance,
}) => {
  return (
    <div className="agent-view">
      <h3>Agent Management</h3>

      <div className="agent-list">
        <h4>Active Agents ({agents?.length || 0})</h4>
        {agents?.map((agent, index) => (
          <div key={index} className="agent-item">
            <div className="agent-name">
              {agent.name || `Agent ${index + 1}`}
            </div>
            <div className="agent-status">{agent.status || "Active"}</div>
            <div className="agent-workload">
              Assigned: {agent.assignedEmails || 0} emails
            </div>
          </div>
        ))}
      </div>

      {agentPerformance && (
        <div className="agent-performance">
          <h4>Performance Metrics</h4>
          <pre>{JSON.stringify(agentPerformance, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
