import React, { useState } from 'react';
import NaturalLanguageInput from './NaturalLanguageInput.js';
import CommandHistory, { CommandHistoryItem } from './CommandHistory.js';
import './NaturalLanguageInput.css';
import './CommandHistory.css';

/**
 * Demo component to showcase the Natural Language Input with Voice Support
 * This demonstrates all the features including voice recognition, auto-suggestions,
 * command history, and inline validation.
 */
export const NaturalLanguageInputDemo: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([
    {
      id: 'demo-1',
      command: 'Add 2 gallons of milk and a dozen eggs',
      timestamp: Date.now() - 300000, // 5 minutes ago
      status: 'success',
      result: 'Added milk and eggs to your list',
      executionTime: 1200,
      category: 'add',
      itemsAffected: 2,
    },
    {
      id: 'demo-2',
      command: 'Remove bananas from my list',
      timestamp: Date.now() - 180000, // 3 minutes ago
      status: 'success',
      result: 'Removed bananas from your list',
      executionTime: 800,
      category: 'remove',
      itemsAffected: 1,
    },
    {
      id: 'demo-3',
      command: 'What\'s my total cost?',
      timestamp: Date.now() - 60000, // 1 minute ago
      status: 'success',
      result: 'Your current total is $24.67',
      executionTime: 500,
      category: 'query',
    },
    {
      id: 'demo-4',
      command: 'Add some invalid item xyz123',
      timestamp: Date.now() - 30000, // 30 seconds ago
      status: 'error',
      result: 'Could not find product "xyz123" in our catalog',
      executionTime: 2100,
      category: 'add',
    },
  ]);
  const [showHistory, setShowHistory] = useState(true);

  // Simulate processing a command
  const handleSubmit = async (input: string) => {
    const commandId = `demo-${Date.now()}`;
    
    // Add to history as pending
    const newCommand: CommandHistoryItem = {
      id: commandId,
      command: input,
      timestamp: Date.now(),
      status: 'pending',
      category: detectCategory(input),
    };
    
    setCommandHistory(prev => [newCommand, ...prev]);
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Simulate success/error based on input
      const isError = input.toLowerCase().includes('error') || 
                      input.toLowerCase().includes('fail') ||
                      input.toLowerCase().includes('invalid');
      
      if (isError) {
        // Update with error
        setCommandHistory(prev => prev?.map(cmd => 
          cmd.id === commandId
            ? {
                ...cmd,
                status: 'error' as const,
                result: 'This is a simulated error for demo purposes',
              }
            : cmd
        ));
        setError('This is a simulated error for demo purposes');
      } else {
        // Update with success
        setCommandHistory(prev => prev?.map(cmd => 
          cmd.id === commandId
            ? {
                ...cmd,
                status: 'success' as const,
                result: generateSuccessMessage(input),
                executionTime: 800 + Math.floor(Math.random() * 1500),
                itemsAffected: Math.floor(Math.random() * 5) + 1,
              }
            : cmd
        ));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
      
    } catch (err) {
      setCommandHistory(prev => prev?.map(cmd => 
        cmd.id === commandId
          ? {
              ...cmd,
              status: 'error' as const,
              result: 'Network error occurred',
            }
          : cmd
      ));
      setError('Network error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const detectCategory = (command: string): string => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('add') || lowerCommand.includes('need') || lowerCommand.includes('get')) {
      return 'add';
    } else if (lowerCommand.includes('remove') || lowerCommand.includes('delete')) {
      return 'remove';
    } else if (lowerCommand.includes('change') || lowerCommand.includes('update')) {
      return 'modify';
    } else if (lowerCommand.includes('total') || lowerCommand.includes('cost') || lowerCommand.includes('price')) {
      return 'query';
    } else if (lowerCommand.includes('clear') || lowerCommand.includes('empty')) {
      return 'list';
    }
    
    return 'query';
  };

  const generateSuccessMessage = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('add')) {
      return `Successfully processed your add request: "${input}"`;
    } else if (lowerInput.includes('remove')) {
      return `Successfully removed items as requested`;
    } else if (lowerInput.includes('total') || lowerInput.includes('cost')) {
      return `Your current total is $${(Math.random() * 100 + 10).toFixed(2)}`;
    } else if (lowerInput.includes('clear')) {
      return 'Successfully cleared your list';
    }
    
    return `Successfully processed: "${input}"`;
  };

  const handleCommandReplay = (command: string) => {
    setInputValue(command);
  };

  const handleCommandEdit = (command: string) => {
    setInputValue(command);
  };

  const handleCommandDelete = (commandId: string) => {
    setCommandHistory(prev => prev?.filter(cmd => cmd.id !== commandId));
  };

  const handleClearHistory = () => {
    setCommandHistory([]);
  };

  const recentCommands = commandHistory.slice(0, 5).map(cmd => cmd.command);

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '600', 
          color: '#1f2937',
          marginBottom: '8px'
        }}>
          Natural Language Input Demo
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#6b7280',
          marginBottom: '24px'
        }}>
          Complete natural language interface with voice support, auto-suggestions, and command history
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '12px',
            background: '#f3f4f6',
            borderRadius: '8px',
            textAlign: 'left'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>✨ Features</h3>
            <ul style={{ fontSize: '12px', color: '#6b7280', margin: 0, paddingLeft: '16px' }}>
              <li>Voice recognition</li>
              <li>Auto-suggestions</li>
              <li>Input validation</li>
              <li>Quick actions</li>
            </ul>
          </div>
          
          <div style={{
            padding: '12px',
            background: '#f3f4f6',
            borderRadius: '8px',
            textAlign: 'left'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>🎯 Try These</h3>
            <ul style={{ fontSize: '12px', color: '#6b7280', margin: 0, paddingLeft: '16px' }}>
              <li>"Add milk and eggs"</li>
              <li>"What's my total?"</li>
              <li>"Remove bananas"</li>
              <li>"Test error" (demo error)</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <NaturalLanguageInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder="Try saying 'Add 2 gallons of milk and some bananas' or click the microphone..."
          isProcessing={isProcessing}
          error={error}
          success={success}
          recentCommands={recentCommands}
          showVoiceButton={true}
          showSuggestions={true}
          maxSuggestions={6}
          autoFocus={true}
          onVoiceStart={() => setError(null)}
          onVoiceEnd={() => {}}
          onVoiceError={(error: any) => setError(`Voice error: ${error}`)}
          onSuggestionSelected={() => {}}
        />
      </div>

      {commandHistory?.length || 0 > 0 && (
        <div>
          <CommandHistory
            commands={commandHistory}
            maxCommands={20}
            showResults={true}
            showTimestamps={true}
            showCategories={true}
            groupByDate={true}
            onReplay={handleCommandReplay}
            onEdit={handleCommandEdit}
            onDelete={handleCommandDelete}
            onClear={handleClearHistory}
            isCollapsed={!showHistory}
            onToggleCollapsed={() => setShowHistory(!showHistory)}
          />
        </div>
      )}

      <div style={{
        marginTop: '40px',
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
          🚀 Integration Instructions
        </h3>
        <div style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>
            This demo shows how to integrate the NaturalLanguageInput and CommandHistory components 
            into your grocery list or any other application that needs natural language processing.
          </p>
          
          <div style={{ marginBottom: '12px' }}>
            <strong>Key Components:</strong>
            <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
              <li><code>NaturalLanguageInput</code> - Main input with voice support</li>
              <li><code>CommandHistory</code> - Command history with replay/edit</li>
              <li><code>useVoiceRecognition</code> - Voice recognition hook</li>
              <li><code>useAutoSuggestions</code> - Smart suggestions hook</li>
            </ul>
          </div>

          <div>
            <strong>Browser Support:</strong>
            <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
              <li>Voice recognition works in Chrome, Safari, Edge</li>
              <li>Graceful fallback for unsupported browsers</li>
              <li>Responsive design for mobile devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NaturalLanguageInputDemo;