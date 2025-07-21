import React, { useState, useCallback, useMemo } from 'react';
import { Search, Filter, X, Save, Upload, ChevronDown } from 'lucide-react';

/**
 * Advanced Filter Panel Component
 * Implements 2025 best practices for multi-column filtering
 * Agent 14: Advanced Filtering & Search
 */

interface FilterRule {
  id: string;
  column: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'greaterThan' | 'lessThan' | 'between' | 'in' | 'notIn';
  value: string | string[] | { min: string; max: string };
  enabled: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  description: string;
  rules: FilterRule[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdvancedFilterPanelProps {
  columns: Array<{
    id: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'status' | 'email' | 'select';
    options?: string[]; // For select columns
  }>;
  onFilterChange: (rules: FilterRule[]) => void;
  onPresetSave: (preset: Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onPresetLoad: (preset: FilterPreset) => void;
  onPresetDelete: (presetId: string) => void;
  presets: FilterPreset[];
  globalSearch: string;
  onGlobalSearchChange: (search: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  columns,
  onFilterChange,
  onPresetSave,
  onPresetLoad,
  onPresetDelete,
  presets,
  globalSearch,
  onGlobalSearchChange,
  isOpen,
  onToggle,
  className = ''
}) => {
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchMode, setSearchMode] = useState<'simple' | 'advanced'>('simple');

  // Operator options based on column type
  const getOperatorOptions = useCallback((columnType: string) => {
    const baseOperators = [
      { value: 'contains', label: 'Contains' },
      { value: 'equals', label: 'Equals' },
      { value: 'startsWith', label: 'Starts with' },
      { value: 'endsWith', label: 'Ends with' }
    ];

    if (columnType === 'number' || columnType === 'date') {
      return [
        ...baseOperators,
        { value: 'greaterThan', label: 'Greater than' },
        { value: 'lessThan', label: 'Less than' },
        { value: 'between', label: 'Between' }
      ];
    }

    if (columnType === 'select' || columnType === 'status') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'in', label: 'In' },
        { value: 'notIn', label: 'Not in' }
      ];
    }

    return [
      ...baseOperators,
      { value: 'regex', label: 'Regex pattern' }
    ];
  }, []);

  // Add new filter rule
  const addFilterRule = useCallback(() => {
    const newRule: FilterRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      column: columns[0]?.id || '',
      operator: 'contains',
      value: '',
      enabled: true
    };
    const updatedRules = [...filterRules, newRule];
    setFilterRules(updatedRules);
    onFilterChange(updatedRules.filter(rule => rule.enabled));
  }, [filterRules, columns, onFilterChange]);

  // Update filter rule
  const updateFilterRule = useCallback((ruleId: string, updates: Partial<FilterRule>) => {
    const updatedRules = filterRules.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    );
    setFilterRules(updatedRules);
    onFilterChange(updatedRules.filter(rule => rule.enabled));
  }, [filterRules, onFilterChange]);

  // Remove filter rule
  const removeFilterRule = useCallback((ruleId: string) => {
    const updatedRules = filterRules.filter(rule => rule.id !== ruleId);
    setFilterRules(updatedRules);
    onFilterChange(updatedRules.filter(rule => rule.enabled));
  }, [filterRules, onFilterChange]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterRules([]);
    onFilterChange([]);
    onGlobalSearchChange('');
  }, [onFilterChange, onGlobalSearchChange]);

  // Save current filters as preset
  const savePreset = useCallback(() => {
    if (!newPresetName.trim()) return;

    const preset: Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt'> = {
      name: newPresetName,
      description: newPresetDescription,
      rules: filterRules.filter(rule => rule.enabled),
      isDefault: false
    };

    onPresetSave(preset);
    setNewPresetName('');
    setNewPresetDescription('');
    setShowSaveDialog(false);
  }, [newPresetName, newPresetDescription, filterRules, onPresetSave]);

  // Load preset
  const loadPreset = useCallback((preset: FilterPreset) => {
    setFilterRules(preset.rules);
    onFilterChange(preset.rules.filter(rule => rule.enabled));
    setShowPresets(false);
  }, [onFilterChange]);

  // Render value input based on operator and column type
  const renderValueInput = useCallback((rule: FilterRule, column: any) => {
    const isMultiValue = rule.operator === 'in' || rule.operator === 'notIn';
    const isRangeValue = rule.operator === 'between';

    if (isRangeValue) {
      const rangeValue = rule.value as { min: string; max: string } || { min: '', max: '' };
      return (
        <div className="flex space-x-2">
          <input
            type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
            value={rangeValue.min}
            onChange={(e) => updateFilterRule(rule.id, {
              value: { ...rangeValue, min: e.target.value }
            })}
            placeholder="Min"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
            value={rangeValue.max}
            onChange={(e) => updateFilterRule(rule.id, {
              value: { ...rangeValue, max: e.target.value }
            })}
            placeholder="Max"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
    }

    if (isMultiValue) {
      const arrayValue = Array.isArray(rule.value) ? rule.value : [];
      return (
        <select
          multiple
          value={arrayValue}
          onChange={(e) => {
            const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
            updateFilterRule(rule.id, { value: selectedValues });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          size={Math.min(4, column.options?.length || 4)}
        >
          {column.options?.map((option: string) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (column.type === 'select' || column.type === 'status') {
      return (
        <select
          value={rule.value as string}
          onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select option...</option>
          {column.options?.map((option: string) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
        value={rule.value as string}
        onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
        placeholder={rule.operator === 'regex' ? 'Enter regex pattern...' : 'Enter value...'}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
      />
    );
  }, [updateFilterRule]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return filterRules.filter(rule => rule.enabled && rule.value).length + (globalSearch ? 1 : 0);
  }, [filterRules, globalSearch]);

  return (
    <div className={`advanced-filter-panel bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggle}
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
            >
              <Filter className="w-5 h-5" />
              <span className="font-medium">Advanced Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search Mode Toggle */}
            <div className="flex bg-gray-100 rounded-md p-1">
              <button
                onClick={() => setSearchMode('simple')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  searchMode === 'simple' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setSearchMode('advanced')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  searchMode === 'advanced' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Advanced
              </button>
            </div>

            {/* Preset Actions */}
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              title="Load Preset"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              title="Save Preset"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={clearAllFilters}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              title="Clear All"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Search */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => onGlobalSearchChange(e.target.value)}
              placeholder="Search across all columns..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-4">
          {/* Advanced Filter Rules */}
          {searchMode === 'advanced' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Filter Rules</h4>
                <button
                  onClick={addFilterRule}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                >
                  Add Rule
                </button>
              </div>

              {filterRules.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No filter rules defined. Click &ldquo;Add Rule&rdquo; to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {filterRules.map((rule, index) => {
                    const column = columns.find(col => col.id === rule.column);
                    return (
                      <div
                        key={rule.id}
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        {/* Rule Index */}
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>

                        {/* Enable/Disable Toggle */}
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => updateFilterRule(rule.id, { enabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </label>

                        {/* Column Select */}
                        <select
                          value={rule.column}
                          onChange={(e) => updateFilterRule(rule.id, { column: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          {columns.map(col => (
                            <option key={col.id} value={col.id}>{col.label}</option>
                          ))}
                        </select>

                        {/* Operator Select */}
                        <select
                          value={rule.operator}
                          onChange={(e) => updateFilterRule(rule.id, { 
                            operator: e.target.value as FilterRule['operator'],
                            value: '' // Reset value when operator changes
                          })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          {getOperatorOptions(column?.type || 'text').map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>

                        {/* Value Input */}
                        <div className="flex-1">
                          {renderValueInput(rule, column)}
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeFilterRule(rule.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                          title="Remove Rule"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Preset Management */}
          {showPresets && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Filter Presets</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {presets.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No saved presets</p>
                ) : (
                  presets.map(preset => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100"
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => loadPreset(preset)}>
                        <div className="font-medium text-sm text-gray-900">{preset.name}</div>
                        {preset.description && (
                          <div className="text-xs text-gray-600">{preset.description}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          {preset.rules.length} rules • {new Date(preset.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPresetDelete(preset.id);
                        }}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Delete Preset"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Save Filter Preset</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Enter preset name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={newPresetDescription}
                  onChange={(e) => setNewPresetDescription(e.target.value)}
                  placeholder="Enter description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={savePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilterPanel;