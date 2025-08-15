import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Clock,
  Zap,
  MessageCircle,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from 'lucide-react';
import useVoiceRecognition from '../../hooks/useVoiceRecognition.js';
import useAutoSuggestions from '../../hooks/useAutoSuggestions.js';

export interface NaturalLanguageInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (input: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isProcessing?: boolean;
  error?: string | null;
  success?: boolean;
  recentCommands?: string[];
  quickActions?: Array<{
    id: string;
    label: string;
    template: string;
    icon?: React.ReactNode;
  }>;
  showVoiceButton?: boolean;
  showSuggestions?: boolean;
  maxSuggestions?: number;
  className?: string;
  autoFocus?: boolean;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  onVoiceError?: (error: string) => void;
  onSuggestionSelected?: (suggestion: string) => void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

const QUICK_ACTIONS = [
  { id: 'add-basic', label: 'Add items', template: 'Add ', icon: <MessageCircle size={14} /> },
  { id: 'remove', label: 'Remove item', template: 'Remove ', icon: <X size={14} /> },
  { id: 'change-qty', label: 'Change quantity', template: 'Change quantity of ', icon: <RotateCcw size={14} /> },
  { id: 'whats-total', label: 'What\'s my total?', template: 'What\'s my total?', icon: <Zap size={14} /> },
  { id: 'find-deals', label: 'Find deals', template: 'Find deals on ', icon: <CheckCircle size={14} /> },
  { id: 'clear-list', label: 'Clear list', template: 'Clear my list', icon: <X size={14} /> },
];

const EXAMPLE_PHRASES = [
  'Add 2 gallons of milk and a dozen eggs',
  'I need bread, butter, and jam',
  'Remove the bananas',
  'Change milk quantity to 3',
  'Find the cheapest organic apples',
  'What\'s my total?',
];

const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Tell me what you need, like "Add 2 gallons of milk and some bananas"...',
  disabled = false,
  isProcessing = false,
  error = null,
  success = false,
  recentCommands = [],
  quickActions = QUICK_ACTIONS,
  showVoiceButton = true,
  showSuggestions = true,
  maxSuggestions = 6,
  className = '',
  autoFocus = false,
  onVoiceStart,
  onVoiceEnd,
  onVoiceError,
  onSuggestionSelected,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  });
  const [lastSubmittedCommand, setLastSubmittedCommand] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>(recentCommands);

  // Voice recognition hook
  const {
    isSupported: voiceSupported,
    isListening,
    isProcessing: voiceProcessing,
    transcript,
    interimTranscript,
    confidence,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useVoiceRecognition({
    continuous: false,
    interimResults: true,
    confidenceThreshold: 0.7,
    onResult: (result, conf, isFinal) => {
      if (isFinal && result.trim()) {
        const newValue = inputValue + (inputValue ? ' ' : '') + result.trim();
        setInputValue(newValue);
        onChange?.(newValue);
        onSuggestionSelected?.(result.trim());
      }
    },
    onStart: () => {
      onVoiceStart?.();
    },
    onEnd: () => {
      onVoiceEnd?.();
    },
    onError: (errorCode, message) => {
      onVoiceError?.(message || errorCode);
    },
  });

  // Auto-suggestions hook
  const {
    suggestions,
    isLoading: suggestionsLoading,
    selectedIndex,
    getSuggestions,
    clearSuggestions,
    selectNext,
    selectPrevious,
    selectSuggestion,
    updateContext,
  } = useAutoSuggestions({
    maxSuggestions,
    enableTemplates: true,
    enableCategoryFiltering: true,
    context: {
      recentCommands: commandHistory,
      popularProducts: [
        'milk', 'eggs', 'bread', 'butter', 'cheese', 'chicken', 'bananas', 'apples',
        'oranges', 'tomatoes', 'lettuce', 'onions', 'potatoes', 'carrots', 'yogurt',
      ],
      groceryCategories: [
        'produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'snacks', 'beverages',
      ],
    },
  });

  // Sync external value with internal state
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Update suggestions context when commands change
  useEffect(() => {
    updateContext({ recentCommands: commandHistory });
  }, [commandHistory, updateContext]);

  // Get suggestions when input changes
  useEffect(() => {
    if (showSuggestions && inputValue.trim()) {
      getSuggestions(inputValue);
    } else {
      clearSuggestions();
    }
  }, [inputValue, showSuggestions, getSuggestions, clearSuggestions]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef?.current?.focus();
    }
  }, [autoFocus]);

  // Validation
  const validateInput = useCallback((input: string): ValidationResult => {
    const trimmed = input.trim();
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!trimmed) {
      errors.push('Please enter a command');
      return { isValid: false, errors, warnings, suggestions };
    }

    if (trimmed?.length || 0 < 3) {
      warnings.push('Command seems very short');
    }

    if (trimmed?.length || 0 > 200) {
      warnings.push('Command is very long - consider breaking it down');
    }

    // Check for common patterns
    const hasAction = /\b(add|remove|delete|change|update|find|show|get|need|want)\b/i.test(trimmed);
    if (!hasAction) {
      suggestions.push('Try starting with an action word like "add", "remove", or "find"');
    }

    const hasQuantity = /\b\d+\b|\b(a|an|one|two|three|dozen|few|some|many)\b/i.test(trimmed);
    const hasProduct = /\b(milk|eggs|bread|butter|cheese|chicken|banana|apple)\b/i.test(trimmed);
    
    if (hasAction && !hasProduct && !trimmed.includes('total') && !trimmed.includes('clear')) {
      suggestions.push('Consider specifying what product you want');
    }

    return {
      isValid: errors?.length || 0 === 0,
      errors,
      warnings,
      suggestions,
    };
  }, []);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e?.target?.value;
    setInputValue(newValue);
    onChange?.(newValue);

    // Validate input
    const validation = validateInput(newValue);
    setValidationResult(validation);

    // Auto-resize textarea
    if (inputRef.current) {
      inputRef?.current?.style.height = 'auto';
      inputRef?.current?.style.height = `${Math.min(inputRef?.current?.scrollHeight, 120)}px`;
    }
  }, [onChange, validateInput]);

  // Handle form submission
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    
    const trimmed = inputValue.trim();
    if (!trimmed || disabled || isProcessing) return;

    const validation = validateInput(trimmed);
    if (!validation.isValid) {
      setValidationResult(validation);
      return;
    }

    // Add to command history
    setCommandHistory(prev => {
      const updated = [trimmed, ...prev?.filter(cmd => cmd !== trimmed)].slice(0, 10);
      return updated;
    });

    setLastSubmittedCommand(trimmed);
    onSubmit?.(trimmed);
    setInputValue('');
    onChange?.('');
    clearSuggestions();

    // Reset textarea height
    if (inputRef.current) {
      inputRef?.current?.style.height = 'auto';
    }
  }, [inputValue, disabled, isProcessing, validateInput, onSubmit, onChange, clearSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Submit on Enter (but not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Navigate suggestions
    if (suggestions?.length || 0 > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectPrevious();
      } else if (e.key === 'Tab' && selectedIndex >= 0) {
        e.preventDefault();
        const suggestion = selectSuggestion(selectedIndex);
        if (suggestion) {
          setInputValue(suggestion.text);
          onChange?.(suggestion.text);
          clearSuggestions();
          onSuggestionSelected?.(suggestion.text);
        }
      }
    }

    // Escape to clear suggestions
    if (e.key === 'Escape') {
      clearSuggestions();
    }
  }, [suggestions?.length || 0, selectedIndex, selectNext, selectPrevious, selectSuggestion, handleSubmit, onChange, clearSuggestions, onSuggestionSelected]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback(async () => {
    if (!voiceSupported) {
      alert('Voice recognition is not supported in your browser');
      return;
    }

    try {
      if (isListening) {
        stopVoice();
      } else {
        resetVoice();
        await startVoice();
      }
    } catch (error) {
      console.error('Voice recognition error:', error);
      onVoiceError?.(error instanceof Error ? error.message : 'Voice recognition failed');
    }
  }, [voiceSupported, isListening, stopVoice, resetVoice, startVoice, onVoiceError]);

  // Handle quick action selection
  const handleQuickAction = useCallback((template: string) => {
    setInputValue(template);
    onChange?.(template);
    setShowQuickActions(false);
    
    // Focus input and position cursor at end
    if (inputRef.current) {
      inputRef?.current?.focus();
      inputRef?.current?.setSelectionRange(template?.length || 0, template?.length || 0);
    }
  }, [onChange]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: any) => {
    setInputValue(suggestion.text);
    onChange?.(suggestion.text);
    clearSuggestions();
    onSuggestionSelected?.(suggestion.text);
    
    if (inputRef.current) {
      inputRef?.current?.focus();
    }
  }, [onChange, clearSuggestions, onSuggestionSelected]);

  // Determine input state
  const inputState = useMemo(() => {
    if (error) return 'error';
    if (success) return 'success';
    if (validationResult?.errors?.length > 0) return 'error';
    if (validationResult?.warnings?.length > 0) return 'warning';
    return 'default';
  }, [error, success, validationResult]);

  const showSuggestionsDropdown = showSuggestions && suggestions?.length || 0 > 0 && inputValue.trim();

  return (
    <div className={`natural-language-input ${className}`}>
      <div className="input-container">
        {/* Header */}
        <div className="input-header">
          <div className="header-content">
            <h3 className="input-title">What do you need?</h3>
            <div className="input-meta">
              <span className="help-text">
                Use natural language like "{EXAMPLE_PHRASES[Math.floor(Math.random() * EXAMPLE_PHRASES?.length || 0)]}"
              </span>
            </div>
          </div>
          
          {/* Quick Actions Toggle */}
          <button
            type="button"
            onClick={() => setShowQuickActions(!showQuickActions)}
            className={`quick-actions-toggle ${showQuickActions ? 'active' : ''}`}
            title="Show quick actions"
          >
            <Zap size={16} />
            <span className="toggle-text">Quick</span>
          </button>
        </div>

        {/* Quick Actions Panel */}
        {showQuickActions && (
          <div className="quick-actions-panel">
            <div className="quick-actions-grid">
              {quickActions?.map(action => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleQuickAction(action.template)}
                  className="quick-action-btn"
                  disabled={disabled}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Input */}
        <form onSubmit={handleSubmit} className="input-form">
          <div className={`input-wrapper ${inputState}`}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              className="main-input"
              rows={1}
              maxLength={500}
            />

            {/* Voice transcript overlay */}
            {(isListening || voiceProcessing) && (
              <div className="voice-overlay">
                <div className="voice-indicator">
                  <div className="pulse-ring" />
                  <Mic size={20} />
                </div>
                <div className="voice-text">
                  <div className="voice-status">
                    {isListening ? 'Listening...' : 'Processing...'}
                  </div>
                  {interimTranscript && (
                    <div className="interim-transcript">
                      "{interimTranscript}"
                    </div>
                  )}
                  {confidence > 0 && (
                    <div className="confidence-meter">
                      <div 
                        className="confidence-fill" 
                        style={{ width: `${confidence * 100}%` }}
                      />
                      <span className="confidence-text">
                        {Math.round(confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input Actions */}
            <div className="input-actions">
              {/* Character count */}
              <div className="char-counter">
                {inputValue?.length || 0}/500
              </div>

              {/* Voice button */}
              {showVoiceButton && voiceSupported && (
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`voice-btn ${isListening ? 'listening' : ''} ${voiceError ? 'error' : ''}`}
                  disabled={disabled || isProcessing}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  {(isListening || voiceProcessing) && (
                    <div className="voice-pulse" />
                  )}
                </button>
              )}

              {/* Submit button */}
              <button
                type="submit"
                className="submit-btn"
                disabled={!inputValue.trim() || disabled || isProcessing || !validationResult.isValid}
                title="Send message (Enter)"
              >
                {isProcessing ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="keyboard-hints">
            <div className="hint">
              <CornerDownLeft size={12} />
              <span>Enter to send</span>
            </div>
            <div className="hint">
              <ArrowUp size={12} />
              <ArrowDown size={12} />
              <span>Navigate suggestions</span>
            </div>
            <div className="hint">
              <span>Tab to select</span>
            </div>
          </div>
        </form>

        {/* Auto-suggestions dropdown */}
        {showSuggestionsDropdown && (
          <div className="suggestions-dropdown">
            <div className="suggestions-header">
              <span className="suggestions-title">Suggestions</span>
              {suggestionsLoading && (
                <Loader2 size={14} className="animate-spin" />
              )}
            </div>
            <div className="suggestions-list">
              {suggestions?.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                >
                  <div className="suggestion-content">
                    <div className="suggestion-text">{suggestion.text}</div>
                    <div className="suggestion-meta">
                      <span className={`suggestion-type type-${suggestion.type}`}>
                        {suggestion.type}
                      </span>
                      {suggestion.confidence > 0.8 && (
                        <span className="high-confidence">✨</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {(validationResult?.errors?.length > 0 || validationResult?.warnings?.length > 0 || validationResult?.suggestions?.length > 0 || error || voiceError) && (
          <div className="validation-messages">
            {/* Errors */}
            {(validationResult?.errors?.length > 0 || error || voiceError) && (
              <div className="message-group error">
                <AlertCircle size={16} />
                <div className="messages">
                  {validationResult?.errors?.map((err, i) => (
                    <div key={i} className="message">{err}</div>
                  ))}
                  {error && <div className="message">{error}</div>}
                  {voiceError && <div className="message">Voice: {voiceError}</div>}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validationResult?.warnings?.length > 0 && (
              <div className="message-group warning">
                <AlertCircle size={16} />
                <div className="messages">
                  {validationResult?.warnings?.map((warning, i) => (
                    <div key={i} className="message">{warning}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {validationResult?.suggestions?.length > 0 && (
              <div className="message-group suggestion">
                <MessageCircle size={16} />
                <div className="messages">
                  {validationResult?.suggestions?.map((suggestion, i) => (
                    <div key={i} className="message">{suggestion}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success State */}
        {success && lastSubmittedCommand && (
          <div className="success-message">
            <CheckCircle size={16} />
            <div className="success-content">
              <div className="success-title">Command processed successfully!</div>
              <div className="success-subtitle">"{lastSubmittedCommand}"</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NaturalLanguageInput;
export type { NaturalLanguageInputProps, ValidationResult };