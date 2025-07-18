import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import type { Message } from './types';
import {
  ConfidenceIndicator,
  ConfidenceBreakdown,
  ConfidenceWarning,
  InlineConfidence,
  ConfidenceFeedback,
  type ConfidenceMetrics,
  type FeedbackData,
} from '../Confidence';

export interface ConfidenceMessageProps {
  message: Message & {
    confidence?: {
      score: number;
      metrics?: ConfidenceMetrics;
      warnings?: Array<{
        type: 'uncertainty' | 'source' | 'fallback' | 'review';
        message: string;
        details?: string[];
      }>;
      sources?: Array<{
        title: string;
        url?: string;
        confidence: number;
      }>;
    };
    feedbackId?: string;
  };
  onFeedback?: (feedbackId: string, data: FeedbackData) => void;
  showConfidence?: boolean;
  className?: string;
}

export const ConfidenceMessage: React.FC<ConfidenceMessageProps> = ({
  message,
  onFeedback,
  showConfidence = true,
  className,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const isAssistant = message.role === 'assistant';
  const hasConfidence = isAssistant && message.confidence && showConfidence;

  // Parse message content for inline confidence markers
  const renderContent = (content: string) => {
    if (!hasConfidence) return content;

    // Simple regex to find confidence markers like {{text|0.85}}
    const confidenceRegex = /\{\{([^|]+)\|([0-9.]+)\}\}/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = confidenceRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Add confidence-marked text
      const text = match[1];
      const score = parseFloat(match[2]);
      parts.push(
        <InlineConfidence
          key={match.index}
          text={text}
          score={score}
          showIcon={false}
        />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const getConfidenceLevel = (score: number): 'high' | 'medium' | 'low' | 'very_low' => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'low';
    return 'very_low';
  };

  return (
    <div
      className={cn(
        'message-container',
        isAssistant ? 'assistant-message' : 'user-message',
        className
      )}
    >
      <div className="message-header">
        <span className="message-role">{message.role}</span>
        {hasConfidence && (
          <ConfidenceIndicator
            level={getConfidenceLevel(message.confidence!.score)}
            score={message.confidence!.score}
            compact
          />
        )}
      </div>

      <div className="message-content">
        {typeof message.content === 'string' 
          ? renderContent(message.content)
          : message.content}
      </div>

      {hasConfidence && (
        <div className="mt-4 space-y-3">
          {/* Warnings */}
          {message.confidence!.warnings?.map((warning, index) => (
            <ConfidenceWarning
              key={index}
              type={warning.type}
              message={warning.message}
              details={warning.details}
              severity={warning.type === 'fallback' ? 'error' : 'warning'}
            />
          ))}

          {/* Sources */}
          {message.confidence!.sources && message.confidence!.sources.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Sources</h4>
              <ul className="space-y-1">
                {message.confidence!.sources.map((source, index) => (
                  <li key={index} className="text-sm">
                    <span className="text-gray-600">•</span>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:underline"
                      >
                        {source.title}
                      </a>
                    ) : (
                      <span className="ml-2 text-gray-700">{source.title}</span>
                    )}
                    <span className="ml-2 text-gray-500 text-xs">
                      ({Math.round(source.confidence * 100)}% confidence)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence Breakdown Toggle */}
          {message.confidence!.metrics && (
            <div>
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showBreakdown ? 'Hide' : 'Show'} confidence details
              </button>
              
              {showBreakdown && (
                <div className="mt-3">
                  <ConfidenceBreakdown
                    metrics={message.confidence!.metrics}
                    defaultExpanded={false}
                    showDetails={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {message.feedbackId && onFeedback && (
            <ConfidenceFeedback
              feedbackId={message.feedbackId}
              onSubmit={onFeedback}
              compact
              showComment={false}
            />
          )}
        </div>
      )}
    </div>
  );
};