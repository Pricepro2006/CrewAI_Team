import React from 'react';
import type { Message } from './types';
import { SafeContent, SafeText } from '../SafeContent';
import './MessageList.css';

interface MessageListProps {
  messages: Message[];
  isProcessing: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isProcessing }) => {
  const formatContent = (content: string) => {
    // Handle undefined or null content
    if (!content) {
      return <p className="text-gray-500">No content</p>;
    }
    
    // Convert markdown to HTML safely
    const convertedContent = convertMarkdownToHTML(content);
    
    // Use SafeContent to render with XSS protection
    return <SafeContent content={convertedContent} level="moderate" />;
  };
  
  // Safe markdown to HTML conversion
  const convertMarkdownToHTML = (markdown: string): string => {
    let html = markdown;
    
    // Escape HTML first to prevent XSS
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    
    // Convert code blocks
    html = html.replace(/```([^`]+)```/g, '<pre class="code-block"><code>$1</code></pre>');
    
    // Convert headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^# (.+)$/gm, '<h5>$1</h5>');
    
    // Convert bold text
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert italic text
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Convert lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
    
    // Wrap consecutive list items in ul/ol tags
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      return `<ul>${match}</ul>`;
    });
    
    // Convert line breaks to paragraphs
    const lines = html.split('\n');
    html = lines
      .map(line => {
        if (line.trim() && !line.startsWith('<')) {
          return `<p>${line}</p>`;
        }
        return line;
      })
      .join('\n');
    
    return html;
  };

  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <div key={index} className={`message message-${message.role}`}>
          <div className="message-role">
            {message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : 'ℹ️'}
            <span>{message.role}</span>
          </div>
          <div className="message-content">
            {formatContent(message.content)}
          </div>
          {message.timestamp && (
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      ))}
      
      {isProcessing && (
        <div className="message message-assistant">
          <div className="message-role">
            🤖 <span>assistant</span>
          </div>
          <div className="message-content">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
