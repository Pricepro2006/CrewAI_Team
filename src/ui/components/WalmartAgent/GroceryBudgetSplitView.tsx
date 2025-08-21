import React, { useState } from 'react';
import { GroceryListEnhanced } from './GroceryListEnhanced';
import { WalmartBudgetTracker } from '../Walmart/WalmartBudgetTracker';
import { List, PieChart, Maximize2, Minimize2 } from 'lucide-react';
import './GroceryBudgetSplitView.css';

interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
  price?: number;
  checked?: boolean;
}

interface SplitViewProps {
  onListUpdate?: (items: GroceryItem[]) => void;
  onBudgetUpdate?: (budget: number) => void;
}

export const GroceryBudgetSplitView: React.FC<SplitViewProps> = ({ 
  onListUpdate, 
  onBudgetUpdate 
}) => {
  const [splitPosition, setSplitPosition] = useState(50); // Percentage for left panel
  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelExpanded, setLeftPanelExpanded] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.split-view-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitPosition(Math.min(Math.max(newPosition, 20), 80)); // Limit between 20% and 80%
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // Return undefined when not dragging to satisfy TypeScript
    return undefined;
  }, [isDragging]);

  const toggleLeftPanel = () => {
    if (leftPanelExpanded) {
      setLeftPanelExpanded(false);
      setSplitPosition(50);
    } else {
      setLeftPanelExpanded(true);
      setRightPanelExpanded(false);
      setSplitPosition(100);
    }
  };

  const toggleRightPanel = () => {
    if (rightPanelExpanded) {
      setRightPanelExpanded(false);
      setSplitPosition(50);
    } else {
      setRightPanelExpanded(true);
      setLeftPanelExpanded(false);
      setSplitPosition(0);
    }
  };

  return (
    <div className="split-view-wrapper">
      <div className="split-view-header">
        <h2 className="split-view-title">
          Grocery Planning Dashboard
        </h2>
        <div className="split-view-controls">
          <button 
            className="split-control-btn"
            onClick={() => setSplitPosition(50)}
            title="Reset to 50/50 split"
          >
            Reset Split
          </button>
        </div>
      </div>

      <div className="split-view-container">
        {/* Left Panel - Grocery List */}
        <div 
          className={`split-panel left-panel ${leftPanelExpanded ? 'expanded' : ''}`}
          style={{ width: `${splitPosition}%` }}
        >
          <div className="panel-header">
            <div className="panel-title">
              <List size={20} />
              <span>Grocery List</span>
            </div>
            <button 
              className="panel-expand-btn"
              onClick={toggleLeftPanel}
              title={leftPanelExpanded ? "Restore" : "Maximize"}
            >
              {leftPanelExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          <div className="panel-content">
            <GroceryListEnhanced />
          </div>
        </div>

        {/* Splitter */}
        {!leftPanelExpanded && !rightPanelExpanded && (
          <div 
            className={`split-divider ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
          >
            <div className="divider-handle">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {/* Right Panel - Budget Tracker */}
        <div 
          className={`split-panel right-panel ${rightPanelExpanded ? 'expanded' : ''}`}
          style={{ width: `${100 - splitPosition}%` }}
        >
          <div className="panel-header">
            <div className="panel-title">
              <PieChart size={20} />
              <span>Budget Tracker</span>
            </div>
            <button 
              className="panel-expand-btn"
              onClick={toggleRightPanel}
              title={rightPanelExpanded ? "Restore" : "Maximize"}
            >
              {rightPanelExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          <div className="panel-content">
            <WalmartBudgetTracker />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="split-view-status">
        <span className="status-item">
          Split: {Math.round(splitPosition)}% / {Math.round(100 - splitPosition)}%
        </span>
        <span className="status-item">
          Drag divider to resize panels
        </span>
      </div>
    </div>
  );
};