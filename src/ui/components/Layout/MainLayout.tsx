import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { CSRFStatusBadge } from '../Security/CSRFMonitor';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="main-layout">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      <div className="layout-content">
        <main className="main-content">
          <Outlet />
        </main>
        {/* CSRF status badge in bottom right corner */}
        <div className="fixed bottom-4 right-4 z-10">
          <CSRFStatusBadge />
        </div>
      </div>
    </div>
  );
};
