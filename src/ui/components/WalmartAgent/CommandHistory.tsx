import React, { useState, useCallback, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Edit2,
  Trash2,
  Play,
  Copy,
  Search,
  Filter,
  Calendar,
  Hash,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';

export interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: number;
  status: 'success' | 'error' | 'pending' | 'cancelled';
  result?: string;
  executionTime?: number;
  category?: string;
  itemsAffected?: number;
}

export interface CommandHistoryProps {
  commands?: CommandHistoryItem[];
  maxCommands?: number;
  showResults?: boolean;
  showTimestamps?: boolean;
  showCategories?: boolean;
  groupByDate?: boolean;
  onReplay?: (command: string) => void;
  onEdit?: (command: string) => void;
  onDelete?: (commandId: string) => void;
  onClear?: () => void;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const COMMAND_CATEGORIES = {
  add: { label: 'Add Items', color: 'text-green-600', icon: <MessageSquare size={14} /> },
  remove: { label: 'Remove Items', color: 'text-red-600', icon: <XCircle size={14} /> },
  modify: { label: 'Modify Items', color: 'text-blue-600', icon: <Edit2 size={14} /> },
  query: { label: 'Queries', color: 'text-purple-600', icon: <Search size={14} /> },
  list: { label: 'List Management', color: 'text-orange-600', icon: <Hash size={14} /> },
};

const CommandHistory: React.FC<CommandHistoryProps> = ({
  commands = [],
  maxCommands = 20,
  showResults = true,
  showTimestamps = true,
  showCategories = true,
  groupByDate = false,
  onReplay,
  onEdit,
  onDelete,
  onClear,
  className = '',
  isCollapsed = false,
  onToggleCollapsed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Filter and sort commands
  const filteredCommands = useMemo(() => {
    let filtered = commands.slice(0, maxCommands);

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered?.filter(cmd =>
        cmd?.command?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.result?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered?.filter(cmd => cmd.category === selectedCategory);
    }

    // Apply status filter
    if (selectedStatus) {
      filtered = filtered?.filter(cmd => cmd.status === selectedStatus);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [commands, maxCommands, searchQuery, selectedCategory, selectedStatus]);

  // Group commands by date if enabled
  const groupedCommands = useMemo(() => {
    if (!groupByDate) {
      return { 'All Commands': filteredCommands };
    }

    const groups: Record<string, CommandHistoryItem[]> = {};
    const now = Date.now();
    
    filteredCommands.forEach(cmd => {
      const cmdDate = new Date(cmd.timestamp);
      const today = new Date(now);
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      
      let groupKey: string;
      
      if (cmdDate.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (cmdDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = cmdDate.toLocaleDateString();
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(cmd);
    });

    return groups;
  }, [filteredCommands, groupByDate]);

  // Get unique categories from commands
  const availableCategories = useMemo(() => {
    const categories = new Set(commands?.map(cmd => cmd.category).filter(Boolean));
    return Array.from(categories);
  }, [commands]);

  // Handle command replay
  const handleReplay = useCallback((command: string) => {
    onReplay?.(command);
  }, [onReplay]);

  // Handle command editing
  const handleEditStart = useCallback((commandId: string, currentCommand: string) => {
    setEditingCommand(commandId);
    setEditValue(currentCommand);
  }, []);

  const handleEditSave = useCallback(() => {
    if (editingCommand && editValue.trim() && onEdit) {
      onEdit(editValue.trim());
      setEditingCommand(null);
      setEditValue('');
    }
  }, [editingCommand, editValue, onEdit]);

  const handleEditCancel = useCallback(() => {
    setEditingCommand(null);
    setEditValue('');
  }, []);

  // Handle command deletion
  const handleDelete = useCallback((commandId: string) => {
    if (onDelete && confirm('Are you sure you want to delete this command?')) {
      onDelete(commandId);
    }
  }, [onDelete]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator?.clipboard?.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  // Get status icon and color
  const getStatusDisplay = useCallback((status: string) => {
    switch (status) {
      case 'success':
        return { icon: <CheckCircle size={14} />, color: 'text-green-600', label: 'Success' };
      case 'error':
        return { icon: <AlertCircle size={14} />, color: 'text-red-600', label: 'Error' };
      case 'pending':
        return { icon: <Clock size={14} />, color: 'text-yellow-600', label: 'Pending' };
      case 'cancelled':
        return { icon: <XCircle size={14} />, color: 'text-gray-600', label: 'Cancelled' };
      default:
        return { icon: <Clock size={14} />, color: 'text-gray-600', label: 'Unknown' };
    }
  }, []);

  // Get category info
  const getCategoryInfo = useCallback((category?: string) => {
    if (!category) return null;
    return COMMAND_CATEGORIES[category as keyof typeof COMMAND_CATEGORIES] || {
      label: category,
      color: 'text-gray-600',
      icon: <Hash size={14} />,
    };
  }, []);

  if (commands?.length || 0 === 0) {
    return (
      <div className={`command-history empty ${className}`}>
        <div className="empty-state">
          <Clock size={48} />
          <h3>No command history</h3>
          <p>Your recent commands will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`command-history ${isCollapsed ? 'collapsed' : 'expanded'} ${className}`}>
      {/* Header */}
      <div className="history-header">
        <div className="header-content">
          <div className="title-section">
            <Clock size={20} />
            <h3>Recent Commands</h3>
            <span className="command-count">({filteredCommands?.length || 0})</span>
          </div>
          
          <div className="header-actions">
            {onClear && commands?.length || 0 > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="clear-btn"
                title="Clear all commands"
              >
                <Trash2 size={16} />
                <span>Clear All</span>
              </button>
            )}
            
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="collapse-toggle"
                title={isCollapsed ? 'Expand history' : 'Collapse history'}
              >
                {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {!isCollapsed && (
          <div className="history-filters">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e?.target?.value)}
                className="search-input"
              />
            </div>
            
            {showCategories && availableCategories?.length || 0 > 0 && (
              <select
                value={selectedCategory}
                onChange={(e: any) => setSelectedCategory(e?.target?.value)}
                className="category-filter"
              >
                <option value="">All Categories</option>
                {availableCategories?.map(category => (
                  <option key={category} value={category}>
                    {getCategoryInfo(category)?.label || category}
                  </option>
                ))}
              </select>
            )}
            
            <select
              value={selectedStatus}
              onChange={(e: any) => setSelectedStatus(e?.target?.value)}
              className="status-filter"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      {/* Command List */}
      {!isCollapsed && (
        <div className="history-content">
          {Object.entries(groupedCommands).map(([groupName, groupCommands]) => (
            <div key={groupName} className="command-group">
              {groupByDate && (
                <div className="group-header">
                  <Calendar size={16} />
                  <h4>{groupName}</h4>
                  <span className="group-count">({groupCommands?.length || 0})</span>
                </div>
              )}
              
              <div className="commands-list">
                {groupCommands?.map((cmd: any) => (
                  <div key={cmd.id} className={`command-item status-${cmd.status}`}>
                    <div className="command-main">
                      <div className="command-header">
                        <div className="command-meta">
                          {showCategories && cmd.category && (
                            <div className="command-category">
                              {getCategoryInfo(cmd.category)?.icon}
                              <span className={getCategoryInfo(cmd.category)?.color}>
                                {getCategoryInfo(cmd.category)?.label}
                              </span>
                            </div>
                          )}
                          
                          <div className="command-status">
                            <span className={getStatusDisplay(cmd.status).color}>
                              {getStatusDisplay(cmd.status).icon}
                              {getStatusDisplay(cmd.status).label}
                            </span>
                          </div>
                          
                          {showTimestamps && (
                            <div className="command-timestamp">
                              <Clock size={12} />
                              <span>{formatTimestamp(cmd.timestamp)}</span>
                            </div>
                          )}
                          
                          {cmd.executionTime && (
                            <div className="execution-time">
                              {cmd.executionTime}ms
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="command-content">
                        {editingCommand === cmd.id ? (
                          <div className="command-editor">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e: any) => setEditValue(e?.target?.value)}
                              className="edit-input"
                              autoFocus
                              onKeyPress={(e: any) => {
                                if (e.key === 'Enter') handleEditSave();
                                if (e.key === 'Escape') handleEditCancel();
                              }}
                            />
                            <div className="edit-actions">
                              <button
                                type="button"
                                onClick={handleEditSave}
                                className="save-btn"
                                disabled={!editValue.trim()}
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={handleEditCancel}
                                className="cancel-btn"
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="command-text">
                            <span className="command-content-text">{cmd.command}</span>
                            {cmd.itemsAffected && (
                              <span className="items-affected">
                                ({cmd.itemsAffected} items affected)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {showResults && cmd.result && cmd.status === 'success' && (
                        <div className="command-result">
                          <div className="result-label">Result:</div>
                          <div className="result-text">{cmd.result}</div>
                        </div>
                      )}

                      {cmd.status === 'error' && cmd.result && (
                        <div className="command-error">
                          <div className="error-label">Error:</div>
                          <div className="error-text">{cmd.result}</div>
                        </div>
                      )}
                    </div>

                    <div className="command-actions">
                      {onReplay && (
                        <button
                          type="button"
                          onClick={() => handleReplay(cmd.command)}
                          className="action-btn replay"
                          title="Replay command"
                        >
                          <Play size={14} />
                        </button>
                      )}
                      
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => handleEditStart(cmd.id, cmd.command)}
                          className="action-btn edit"
                          title="Edit and replay"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => handleCopy(cmd.command)}
                        className="action-btn copy"
                        title="Copy command"
                      >
                        <Copy size={14} />
                      </button>
                      
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(cmd.id)}
                          className="action-btn delete"
                          title="Delete command"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {filteredCommands?.length || 0 === 0 && (
            <div className="no-results">
              <Search size={32} />
              <h4>No commands found</h4>
              <p>Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommandHistory;
export type { CommandHistoryItem, CommandHistoryProps };