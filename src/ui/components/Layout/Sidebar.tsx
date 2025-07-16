import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { trpc } from '../../App';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Get recent conversations
  const conversations = trpc.chat.list.useQuery({ limit: 10, offset: 0 });

  const menuItems = [
    { path: '/chat', icon: '💬', label: 'New Chat' },
    { path: '/agents', icon: '🤖', label: 'Agents' },
    { path: '/knowledge', icon: '📚', label: 'Knowledge Base' },
    { path: '/settings', icon: '⚙️', label: 'Settings' }
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      <div className="sidebar-content">
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {!isCollapsed && (
          <div className="recent-conversations">
            <h3>Recent Chats</h3>
            {conversations.isLoading && <p>Loading conversations...</p>}
            {conversations.error && <p>Error loading conversations</p>}
            {conversations.data && Array.isArray(conversations.data) && conversations.data.map(conv => (
              <Link
                key={conv.id}
                to={`/chat/${conv.id}`}
                className={`conversation-link ${
                  location.pathname === `/chat/${conv.id}` ? 'active' : ''
                }`}
              >
                <span className="conversation-title">
                  {conv.title || 'Untitled Chat'}
                </span>
                <span className="conversation-date">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
            {conversations.data && !Array.isArray(conversations.data) && (
              <p>No conversations yet</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
