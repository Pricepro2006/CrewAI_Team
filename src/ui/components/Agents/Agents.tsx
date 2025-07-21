import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Agents.css';

interface Agent {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  icon: React.ReactNode;
  status: 'online' | 'offline' | 'busy';
}

export const Agents: React.FC = () => {
  const navigate = useNavigate();

  const agents: Agent[] = [
    {
      id: 'research-agent',
      name: 'Research Agent',
      description: 'Specializes in gathering information, analyzing data, and providing comprehensive research insights',
      expertise: ['Data Analysis', 'Web Research', 'Information Synthesis'],
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      status: 'online'
    },
    {
      id: 'code-agent',
      name: 'Code Agent',
      description: 'Expert in software development, code review, and technical implementation',
      expertise: ['Programming', 'Code Review', 'Architecture Design'],
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      status: 'online'
    },
    {
      id: 'data-analysis-agent',
      name: 'Data Analysis Agent',
      description: 'Processes complex data sets, creates visualizations, and provides analytical insights',
      expertise: ['Data Processing', 'Visualization', 'Statistical Analysis'],
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 20V10M12 20V4M6 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      status: 'online'
    },
    {
      id: 'email-analysis-agent',
      name: 'Email Analysis Agent',
      description: 'Specializes in email processing, categorization, and intelligent email management',
      expertise: ['Email Processing', 'Natural Language Processing', 'Categorization'],
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2"/>
          <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      status: 'online'
    },
    {
      id: 'writer-agent',
      name: 'Writer Agent',
      description: 'Creates high-quality written content, documentation, and creative writing',
      expertise: ['Content Creation', 'Documentation', 'Creative Writing'],
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2L18 6L7 17L3 17L3 13L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      status: 'online'
    }
  ];

  const handleChatWithAll = () => {
    navigate('/chat');
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online':
        return '#10b981';
      case 'offline':
        return '#ef4444';
      case 'busy':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="agents-container">
      <div className="agents-header">
        <h1 className="agents-title">AI Agents</h1>
        <p className="agents-description">
          Our specialized AI agents work together to handle your requests. The Master Orchestrator automatically routes your questions to the most appropriate agent.
        </p>
        <button className="chat-with-all-button" onClick={handleChatWithAll}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Chat with AI Team
        </button>
      </div>

      <div className="agents-grid">
        {agents.map((agent) => (
          <div key={agent.id} className="agent-card">
            <div className="agent-card-header">
              <div className="agent-icon">{agent.icon}</div>
              <div className="agent-status" style={{ backgroundColor: getStatusColor(agent.status) }} />
            </div>
            <h3 className="agent-name">{agent.name}</h3>
            <p className="agent-description">{agent.description}</p>
            <div className="agent-expertise">
              <h4 className="expertise-title">Expertise:</h4>
              <div className="expertise-tags">
                {agent.expertise.map((skill, index) => (
                  <span key={index} className="expertise-tag">{skill}</span>
                ))}
              </div>
            </div>
            <div className="agent-status-text">
              Status: <span className={`status-${agent.status}`}>{agent.status}</span>
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
            <p>The Master Orchestrator analyzes your query and routes it to the best agent.</p>
          </div>
          <div className="info-card">
            <div className="info-number">3</div>
            <h3>Expert Processing</h3>
            <p>The selected agent processes your request using specialized knowledge.</p>
          </div>
          <div className="info-card">
            <div className="info-number">4</div>
            <h3>Get Results</h3>
            <p>Receive comprehensive, accurate responses tailored to your needs.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agents;
