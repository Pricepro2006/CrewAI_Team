/**
 * NLP Search Input Component
 * Enhanced natural language search interface with real-time suggestions
 * and intelligent query processing for Walmart Grocery Agent
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Mic, MicOff, Sparkles, Clock, ArrowRight, X } from 'lucide-react';
import { useWalmartWebSocket } from '../../../hooks/useWalmartWebSocket';
import { NLPQuery, NLPResult, SuggestedAction } from '../types/WalmartTypes';
import './NLPInterface.css';

interface NLPSearchInputProps {
  onSearch: (query: string) => void;
  onResult: (result: NLPResult) => void;
  placeholder?: string;
  showSuggestions?: boolean;
  showHistory?: boolean;
  autoFocus?: boolean;
  className?: string;
}

interface SearchSuggestion {
  text: string;
  type: 'history' | 'suggestion' | 'trending';
  confidence?: number;
  icon?: React.ReactNode;
}

export const NLPSearchInput: React.FC<NLPSearchInputProps> = ({
  onSearch,
  onResult,
  placeholder = "Ask me anything about groceries... (e.g., 'Find organic milk under $5')",
  showSuggestions = true,
  showHistory = true,
  autoFocus = false,
  className = ''
}) => {
  // State management
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionDropdown, setShowSuggestionDropdown] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionDropdownRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // WebSocket integration for real-time NLP processing
  const {
    isConnected,
    sendMessage,
    nlpProcessing,
    nlpResult,
    lastMessage
  } = useWalmartWebSocket({
    autoConnect: true,
    userId: 'current-user' // Should come from auth context
  });
  
  // Handle NLP results
  useEffect(() => {
    if (nlpResult) {
      onResult(nlpResult);
      
      // Add successful queries to history
      if (nlpResult.confidence > 0.7 && query.trim()) {
        setSearchHistory(prev => {
          const newHistory = [query.trim(), ...prev.filter(h => h !== query.trim())];
          return newHistory.slice(0, 10); // Keep last 10 searches
        });
        
        // Clear input after successful search
        setQuery('');
        setShowSuggestionDropdown(false);
      }
    }
  }, [nlpResult, onResult, query]);
  
  // Load search history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('walmart-search-history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.warn('Failed to load search history:', e);
      }
    }
  }, []);
  
  // Save search history to localStorage
  useEffect(() => {
    localStorage.setItem('walmart-search-history', JSON.stringify(searchHistory));
  }, [searchHistory]);
  
  // Auto-focus input if specified
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Generate suggestions based on current query
  const generateSuggestions = useCallback((currentQuery: string) => {
    if (!currentQuery.trim()) {
      // Show recent history and trending suggestions when input is empty
      const historySuggestions: SearchSuggestion[] = searchHistory.slice(0, 5).map(item => ({
        text: item,
        type: 'history',
        icon: <Clock size={14} />
      }));
      
      const trendingSuggestions: SearchSuggestion[] = [
        { text: "Find organic produce on sale", type: 'trending', icon: <Sparkles size={14} /> },
        { text: "Compare protein powder prices", type: 'trending', icon: <Sparkles size={14} /> },
        { text: "Show gluten-free breakfast options", type: 'trending', icon: <Sparkles size={14} /> },
      ];
      
      setSuggestions([...historySuggestions, ...trendingSuggestions]);
      return;
    }
    
    // AI-powered suggestions based on partial query
    const querySuggestions: SearchSuggestion[] = [];
    
    // Smart completion suggestions
    const completions = [
      "under $10",
      "on sale this week",
      "with free shipping",
      "in my local store",
      "with highest ratings"
    ];
    
    if (currentQuery.toLowerCase().includes('find') || currentQuery.toLowerCase().includes('show')) {
      completions.forEach(completion => {
        querySuggestions.push({
          text: `${currentQuery} ${completion}`,
          type: 'suggestion',
          confidence: 0.8,
          icon: <ArrowRight size={14} />
        });
      });
    }
    
    // Category-based suggestions
    const categories = ['organic', 'dairy', 'produce', 'meat', 'bakery', 'frozen'];
    categories.forEach(category => {
      if (category.includes(currentQuery.toLowerCase()) || currentQuery.toLowerCase().includes(category)) {
        querySuggestions.push({
          text: `Find ${category} products`,
          type: 'suggestion',
          confidence: 0.9,
          icon: <Sparkles size={14} />
        });
      }
    });
    
    setSuggestions(querySuggestions.slice(0, 8));
  }, [searchHistory]);
  
  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedSuggestionIndex(-1);
    
    if (showSuggestions) {
      generateSuggestions(value);
      setShowSuggestionDropdown(true);
    }
  }, [showSuggestions, generateSuggestions]);
  
  // Handle search submission
  const handleSearch = useCallback((searchQuery?: string) => {
    const finalQuery = searchQuery || query.trim();
    
    if (!finalQuery) return;
    
    // Close suggestions dropdown
    setShowSuggestionDropdown(false);
    setSelectedSuggestionIndex(-1);
    
    // Trigger search callback
    onSearch(finalQuery);
    
    // Send to NLP processing via WebSocket
    if (isConnected) {
      const nlpQuery: NLPQuery = {
        text: finalQuery,
        context: {
          previousQueries: searchHistory.slice(0, 3),
          userPreferences: {
            // Should come from user store
            favoriteStores: ['Walmart Supercenter'],
            dietaryRestrictions: [],
            preferredBrands: []
          }
        }
      };
      
      sendMessage({
        type: 'nlp_query',
        data: nlpQuery,
        timestamp: new Date().toISOString()
      });
    }
  }, [query, onSearch, isConnected, sendMessage, searchHistory]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestionDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSearch(suggestions[selectedSuggestionIndex].text);
        } else {
          handleSearch();
        }
        break;
        
      case 'Escape':
        setShowSuggestionDropdown(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestionDropdown, suggestions, selectedSuggestionIndex, handleSearch]);
  
  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    handleSearch(suggestion.text);
  }, [handleSearch]);
  
  // Voice search functionality
  const startVoiceSearch = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search is not supported in this browser');
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleSearch(transcript);
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  }, [handleSearch]);
  
  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionDropdownRef.current &&
        !suggestionDropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestionDropdown(false);
        setSelectedSuggestionIndex(-1);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className={`nlp-search-container ${className}`}>
      <div className="nlp-search-input-wrapper">
        <div className={`nlp-search-input ${nlpProcessing ? 'processing' : ''}`}>
          <div className="search-icon">
            {nlpProcessing ? (
              <div className="processing-spinner">
                <Sparkles className="sparkles-icon" />
              </div>
            ) : (
              <Search size={20} />
            )}
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => showSuggestions && setShowSuggestionDropdown(true)}
            placeholder={placeholder}
            disabled={nlpProcessing}
            className="search-input-field"
            aria-label="Natural language search"
            aria-expanded={showSuggestionDropdown}
            aria-autocomplete="list"
            role="combobox"
          />
          
          <div className="search-actions">
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setShowSuggestionDropdown(false);
                  inputRef.current?.focus();
                }}
                className="clear-button"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
            
            <button
              onClick={isListening ? stopVoiceSearch : startVoiceSearch}
              className={`voice-button ${isListening ? 'listening' : ''}`}
              aria-label={isListening ? 'Stop voice search' : 'Start voice search'}\n            >\n              {isListening ? <MicOff size={18} /> : <Mic size={18} />}\n            </button>\n            \n            <button\n              onClick={() => handleSearch()}\n              disabled={!query.trim() || nlpProcessing}\n              className=\"search-button\"\n              aria-label=\"Search\"\n            >\n              {nlpProcessing ? 'Processing...' : 'Search'}\n            </button>\n          </div>\n        </div>\n        \n        {/* Connection Status */}\n        {!isConnected && (\n          <div className=\"connection-warning\">\n            <span>Offline mode - basic search only</span>\n          </div>\n        )}\n      </div>\n      \n      {/* Suggestions Dropdown */}\n      {showSuggestionDropdown && suggestions.length > 0 && (\n        <div ref={suggestionDropdownRef} className=\"suggestions-dropdown\">\n          <div className=\"suggestions-list\">\n            {suggestions.map((suggestion, index) => (\n              <div\n                key={`${suggestion.type}-${index}`}\n                className={`suggestion-item ${\n                  index === selectedSuggestionIndex ? 'selected' : ''\n                } ${suggestion.type}`}\n                onClick={() => handleSuggestionClick(suggestion)}\n                role=\"option\"\n                aria-selected={index === selectedSuggestionIndex}\n              >\n                <div className=\"suggestion-icon\">\n                  {suggestion.icon}\n                </div>\n                <div className=\"suggestion-content\">\n                  <span className=\"suggestion-text\">{suggestion.text}</span>\n                  {suggestion.confidence && (\n                    <span className=\"suggestion-confidence\">\n                      {Math.round(suggestion.confidence * 100)}% match\n                    </span>\n                  )}\n                </div>\n                <div className=\"suggestion-type-badge\">\n                  {suggestion.type}\n                </div>\n              </div>\n            ))}\n          </div>\n          \n          {showHistory && searchHistory.length > 0 && (\n            <div className=\"suggestions-footer\">\n              <button\n                onClick={() => {\n                  setSearchHistory([]);\n                  generateSuggestions(query);\n                }}\n                className=\"clear-history-button\"\n              >\n                Clear search history\n              </button>\n            </div>\n          )}\n        </div>\n      )}\n      \n      {/* Processing Status */}\n      {nlpProcessing && (\n        <div className=\"nlp-processing-status\">\n          <div className=\"processing-indicator\">\n            <Sparkles className=\"processing-icon\" />\n            <span>AI is analyzing your request...</span>\n          </div>\n        </div>\n      )}\n    </div>\n  );\n};"