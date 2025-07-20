import React from "react";
import { trpc } from "../../App";
import "./Dashboard.css";

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  description,
}) => (
  <div className="stats-card">
    <div className="stats-header">
      <div className="stats-icon">{icon}</div>
      <span className="stats-title">{title}</span>
    </div>
    <div className="stats-value">{value}</div>
    <div className="stats-description">{description}</div>
  </div>
);

interface AgentCardProps {
  name: string;
  status: "active" | "idle" | "busy";
  specialty: string;
}

const AgentCard: React.FC<AgentCardProps> = ({ name, status, specialty }) => (
  <div className="agent-card">
    <div className="agent-header">
      <div className={`agent-status ${status}`}></div>
      <span className="agent-name">{name}</span>
    </div>
    <div className="agent-specialty">{specialty}</div>
  </div>
);

export const Dashboard: React.FC = () => {
  // const { data: health } = trpc.health.detailed.useQuery(); // TODO: Implement health.detailed endpoint
  const health = null; // Placeholder until health endpoint is implemented
  // Note: agents.list endpoint not yet implemented, using mock data
  const agents = null; // TODO: Implement agents.list endpoint

  const stats = [
    {
      title: "Total Messages",
      value: 128,
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 12H8.01M12 12H12.01M16 12H16.01M21 12C21 16.418 16.97 20 12 20C10.5286 20.005 9.07479 19.6808 7.745 19.051L3 20L4.395 16.28C3.512 15.042 3 13.574 3 12C3 7.582 7.03 4 12 4C16.97 4 21 7.582 21 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      description: "up from last week",
    },
    {
      title: "Active Agents",
      value: 4,
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21M12.5 7C12.5 9.48528 10.4853 11.5 8 11.5C5.51472 11.5 3.5 9.48528 3.5 7C3.5 4.51472 5.51472 2.5 8 2.5C10.4853 2.5 12.5 4.51472 12.5 7ZM20.5 8.5V11.5M22 10H19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      description: "4 agents total",
    },
    {
      title: "Documents Processed",
      value: 35,
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 2V8H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 13H8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 17H8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 9H8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      description: "in the last 24 hours",
    },
    {
      title: "Workflows Created",
      value: 7,
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.267L13 2.267C12.696 2.08837 12.3511 1.99591 12 1.99591C11.6489 1.99591 11.304 2.08837 11 2.267L4 6.267C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.733L11 21.733C11.304 21.9116 11.6489 22.0041 12 22.0041C12.3511 22.0041 12.696 21.9116 13 21.733L20 17.733C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 4.21L12 6.81L16.5 4.21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 19.79V14.6L3 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12L16.5 14.6V19.79"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 22.08V17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      description: "in the last week",
    },
  ];

  const availableAgents = [
    {
      name: "Research Agent",
      status: "active" as const,
      specialty: "Information Gathering",
    },
    {
      name: "Code Agent",
      status: "idle" as const,
      specialty: "Code Generation",
    },
    {
      name: "Data Analysis Agent",
      status: "busy" as const,
      specialty: "Data Processing",
    },
    {
      name: "Writer Agent",
      status: "active" as const,
      specialty: "Content Creation",
    },
  ];

  const ollamaStatus = (health as any)?.services?.ollama || "disconnected";
  const isOllamaConnected = ollamaStatus === "connected";

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">
          Welcome back, User! Here&apos;s an overview of your AI Assistant.
        </p>
      </div>

      <div className="dashboard-content">
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        <div className="dashboard-sections">
          <div className="ollama-status-section">
            <h2>Ollama Status</h2>
            <div
              className={`ollama-status ${isOllamaConnected ? "connected" : "offline"}`}
            >
              <div className="status-indicator"></div>
              <span className="status-text">
                {isOllamaConnected ? "Connected" : "Offline"}
              </span>
            </div>
          </div>

          <div className="agents-section">
            <h2>Available Agents</h2>
            <div className="agent-grid">
              {availableAgents.map((agent, index) => (
                <AgentCard key={index} {...agent} />
              ))}
            </div>
            <p className="agents-count">4 of 4 agents available</p>
          </div>
        </div>
      </div>
    </div>
  );
};
