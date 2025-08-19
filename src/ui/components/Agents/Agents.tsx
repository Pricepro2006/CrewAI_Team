import React from "react";
import { useNavigate } from "react-router-dom";
import { trpc as api } from "../../utils/trpc";
import "./Agents.css";

interface AgentData {
  type: string;
  available: boolean;
  description: string;
  capabilities: string[];
  tools: string[];
  models: {
    general: string;
    toolSelection: string;
  };
}

interface Agent {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  icon: React.ReactNode;
  status: "online" | "offline" | "busy";
}

const getAgentIcon = (type: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    ResearchAgent: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    CodeAgent: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www?.w3?.org/2000/svg"
      >
        <polyline
          points="16 18 22 12 16 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="8 6 2 12 8 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    DataAnalysisAgent: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www?.w3?.org/2000/svg"
      >
        <path
          d="M18 20V10M12 20V4M6 20V14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    WriterAgent: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www?.w3?.org/2000/svg"
      >
        <path
          d="M14 2L18 6L7 17L3 17L3 13L14 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 2L18 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    ToolExecutorAgent: (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www?.w3?.org/2000/svg"
      >
        <path
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  };

  return (
    icons[type] || (
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 8v4M12 16h.01"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  );
};

const formatAgentName = (type: string): string => {
  return type
    .replace(/Agent$/, " Agent")
    .replace(/([A-Z])/g, " $1")
    .trim();
};

const mapCapabilitiesToExpertise = (capabilities: string[] = []): string[] => {
  return capabilities.map((cap: string) =>
    cap
      .split("_")
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  );
};

export const Agents: React.FC = () => {
  const navigate = useNavigate();

  // Fetch agents data from API with proper null checking
  const agentListQuery = api.agent?.list?.useQuery?.();
  const {
    data: agentsData,
    isLoading,
    error,
  } = agentListQuery || { data: undefined, isLoading: false, error: null };

  // Poll agent status every 5 seconds for real-time updates
  const agentStatusQuery = api.agent?.status?.useQuery?.(undefined, {
    refetchInterval: 5000, // Refresh every 5 seconds
    refetchIntervalInBackground: true,
  });
  const { data: agentStatus } = agentStatusQuery || { data: undefined };

  // Transform API data to match our UI interface
  const agents: Agent[] = React.useMemo(() => {
    if (!agentsData) return [];

    // Handle the response structure - it contains an agents array
    const agentsList = Array.isArray(agentsData) ? agentsData : agentsData?.agents || [];

    return agentsList.map((agent: AgentData) => {
      // Check if this agent is currently active/busy
      const isActive = Array.isArray(agentStatus) && agentStatus.some(
        (status: { type: string; status: string }) => 
          status.type === agent.type && status.status === "busy",
      );

      return {
        id: agent?.type?.toLowerCase().replace("agent", "-agent") || 'unknown-agent',
        name: formatAgentName(agent.type || 'Unknown Agent'),
        description: agent.description || 'No description available',
        expertise: mapCapabilitiesToExpertise(agent.capabilities),
        icon: getAgentIcon(agent.type || ''),
        status: isActive ? "busy" as const : agent.available ? "online" as const : "offline" as const,
      };
    });
  }, [agentsData, agentStatus]);

  const handleChatWithAll = () => {
    navigate("/chat");
  };

  const getStatusColor = (status: Agent["status"]): string => {
    switch (status) {
      case "online":
        return "#10b981";
      case "offline":
        return "#ef4444";
      case "busy":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="agents-container">
        <div className="agents-header">
          <h1 className="agents-title">AI Agents</h1>
          <p className="agents-description">Loading agents...</p>
        </div>
        <div className="agents-grid">
          {/* Loading skeleton */}
          {[1, 2, 3, 4, 5].map((i: number) => (
            <div key={i} className="agent-card" style={{ opacity: 0.5 }}>
              <div className="agent-card-header">
                <div className="agent-icon">
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: "#e5e7eb",
                      borderRadius: "50%",
                    }}
                  />
                </div>
                <div
                  className="agent-status"
                  style={{ backgroundColor: "#e5e7eb" }}
                />
              </div>
              <div
                style={{
                  height: 24,
                  backgroundColor: "#e5e7eb",
                  marginBottom: 8,
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  height: 48,
                  backgroundColor: "#e5e7eb",
                  marginBottom: 16,
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  height: 80,
                  backgroundColor: "#e5e7eb",
                  borderRadius: 4,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="agents-container">
        <div className="agents-header">
          <h1 className="agents-title">AI Agents</h1>
          <p className="agents-description" style={{ color: "#ef4444" }}>
            Error loading agents. Please try again later.
          </p>
          <button
            className="chat-with-all-button"
            onClick={() => window?.location?.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-container">
      <div className="agents-header">
        <h1 className="agents-title">AI Agents</h1>
        <p className="agents-description">
          Our specialized AI agents work together to handle your requests. The
          Master Orchestrator automatically routes your questions to the most
          appropriate agent.
        </p>
        <button className="chat-with-all-button" onClick={handleChatWithAll}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Chat with AI Team
        </button>
      </div>

      <div className="agents-grid">
        {agents?.map((agent: Agent) => (
          <div key={agent.id} className="agent-card">
            <div className="agent-card-header">
              <div className="agent-icon">{agent.icon}</div>
              <div
                className="agent-status"
                style={{ backgroundColor: getStatusColor(agent.status) }}
              />
            </div>
            <h3 className="agent-name">{agent.name}</h3>
            <p className="agent-description">{agent.description}</p>
            <div className="agent-expertise">
              <h4 className="expertise-title">Expertise:</h4>
              <div className="expertise-tags">
                {agent?.expertise?.map((skill: string, index: number) => (
                  <span key={index} className="expertise-tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div className="agent-status-text">
              Status:{" "}
              <span className={`status-${agent.status}`}>{agent.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="agents-info">
        <h2>How It Works</h2>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-number">1</div>
            <h3>Ask Your Question</h3>
            <p>Simply type your question or request in the chat interface.</p>
          </div>
          <div className="info-card">
            <div className="info-number">2</div>
            <h3>Automatic Routing</h3>
            <p>
              The Master Orchestrator analyzes your query and routes it to the
              best agent.
            </p>
          </div>
          <div className="info-card">
            <div className="info-number">3</div>
            <h3>Expert Processing</h3>
            <p>
              The selected agent processes your request using specialized
              knowledge.
            </p>
          </div>
          <div className="info-card">
            <div className="info-number">4</div>
            <h3>Get Results</h3>
            <p>
              Receive comprehensive, accurate responses tailored to your needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agents;
