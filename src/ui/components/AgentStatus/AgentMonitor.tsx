import React, { useEffect, useState } from 'react';
import { trpc } from '../../App';
import './AgentMonitor.css';

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'active';
  currentTask?: string;
  progress?: number;
}

export const AgentMonitor: React.FC = () => {
  const [activeAgents, setActiveAgents] = useState<AgentStatus[]>([]);
  
  // Poll for agent status
  const agentStatus = trpc.agent.status.useQuery(undefined, {
    refetchInterval: 1000, // Refresh every second
    enabled: true
  });

  useEffect(() => {
    if (agentStatus.data?.agents && Array.isArray(agentStatus.data.agents)) {
      setActiveAgents(agentStatus.data.agents);
    }
  }, [agentStatus.data]);

  if (activeAgents.length === 0) {
    return null;
  }

  return (
    <div className="agent-monitor">
      <h3>Active Agents</h3>
      <div className="agent-list">
        {activeAgents.map(agent => (
          <div key={agent.id} className={`agent-status agent-${agent.status}`}>
            <div className="agent-header">
              <span className="agent-icon">
                {agent.name === 'ResearchAgent' && '🔍'}
                {agent.name === 'CodeAgent' && '💻'}
                {agent.name === 'DataAnalysisAgent' && '📊'}
                {agent.name === 'WriterAgent' && '✍️'}
                {agent.name === 'ToolExecutorAgent' && '🔧'}
              </span>
              <span className="agent-name">{agent.name}</span>
              <span className={`status-indicator status-${agent.status}`}>
                {agent.status}
              </span>
            </div>
            {agent.currentTask && (
              <div className="agent-task">
                <small>{agent.currentTask}</small>
              </div>
            )}
            {agent.progress !== undefined && (
              <div className="agent-progress">
                <div 
                  className="progress-bar"
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
