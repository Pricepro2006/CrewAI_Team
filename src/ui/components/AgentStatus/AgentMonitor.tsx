import React, { useEffect, useState } from "react";
import { api } from "@/lib/trpc";
import {
  useAgentStatus,
  useTaskQueue,
  useSystemHealth,
} from "../../hooks/useWebSocket";
import "./AgentMonitor.css";

interface AgentStatus {
  id: string;
  type: string;
  status: "idle" | "busy" | "error";
  currentTask?: string;
  lastActivity: Date;
  tasksCompleted: number;
  errors: number;
}

export const AgentMonitor: React.FC = () => {
  const [activeAgents, setActiveAgents] = useState<AgentStatus[]>([]);

  // Poll for agent status - use type assertion to bypass tRPC inference issues
  const agentStatus = (api.agent.status as any).useQuery(undefined, {
    refetchInterval: 1000, // Refresh every second
    enabled: true,
    trpc: {
      ssr: false,
    },
  });

  useEffect(() => {
    if (agentStatus?.data && Array.isArray(agentStatus.data)) {
      setActiveAgents(agentStatus.data);
    }
  }, [agentStatus?.data]);

  if (activeAgents.length === 0) {
    return null;
  }

  return (
    <div className="agent-monitor">
      <h3>Active Agents</h3>
      <div className="agent-list">
        {activeAgents.map((agent) => (
          <div key={agent.id} className={`agent-status agent-${agent.status}`}>
            <div className="agent-header">
              <span className="agent-icon">
                {agent.type === "ResearchAgent" && "🔍"}
                {agent.type === "CodeAgent" && "💻"}
                {agent.type === "DataAnalysisAgent" && "📊"}
                {agent.type === "WriterAgent" && "✍️"}
                {agent.type === "ToolExecutorAgent" && "🔧"}
              </span>
              <span className="agent-name">{agent.type}</span>
              <span className={`status-indicator status-${agent.status}`}>
                {agent.status}
              </span>
            </div>
            {agent.currentTask && (
              <div className="agent-task">
                <small>{agent.currentTask}</small>
              </div>
            )}
            <div className="agent-stats">
              <small>
                Tasks: {agent.tasksCompleted} | Errors: {agent.errors}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
