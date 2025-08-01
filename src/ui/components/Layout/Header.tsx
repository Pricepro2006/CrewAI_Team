import React from "react";
import { Link } from "react-router-dom";
import "./Header.css";

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon">🤖</span>
          <span className="logo-text">AI Agent Team</span>
        </Link>

        <nav className="header-nav">
          <Link to="/chat" className="nav-link">
            Chat
          </Link>
          <Link to="/agents" className="nav-link">
            Agents
          </Link>
          <Link to="/knowledge" className="nav-link">
            Knowledge
          </Link>
          <Link to="/settings" className="nav-link">
            Settings
          </Link>
        </nav>

        <div className="header-actions">
          <button className="icon-button" title="Notifications">
            🔔
          </button>
          <button className="icon-button" title="Help">
            ❓
          </button>
        </div>
      </div>
    </header>
  );
};
