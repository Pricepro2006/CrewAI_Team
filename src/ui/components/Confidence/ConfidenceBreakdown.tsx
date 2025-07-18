import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { ConfidenceScore } from './ConfidenceScore';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export interface ConfidenceMetrics {
  overall: number;
  factuality: number;
  relevance: number;
  coherence: number;
  retrieval?: number;
  generation?: number;
}

export interface ConfidenceBreakdownProps {
  metrics: ConfidenceMetrics;
  title?: string;
  defaultExpanded?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const ConfidenceBreakdown: React.FC<ConfidenceBreakdownProps> = ({
  metrics,
  title = 'Confidence Breakdown',
  defaultExpanded = false,
  showDetails = true,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const metricLabels = {
    factuality: 'Factual Accuracy',
    relevance: 'Query Relevance',
    coherence: 'Response Coherence',
    retrieval: 'Source Quality',
    generation: 'Generation Confidence',
  };

  const metricDescriptions = {
    factuality: 'How well the response aligns with verified information',
    relevance: 'How well the response addresses your query',
    coherence: 'How logical and well-structured the response is',
    retrieval: 'Quality and relevance of retrieved sources',
    generation: 'Model confidence in generated content',
  };

  return (
    <div className={cn('confidence-breakdown bg-gray-50 rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {showDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span>{isExpanded ? 'Hide' : 'Show'} Details</span>
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Overall Score */}
      <div className="mb-4">
        <ConfidenceScore
          score={metrics.overall}
          label="Overall Confidence"
          size="lg"
          showBar={true}
        />
      </div>

      {/* Detailed Metrics */}
      {showDetails && isExpanded && (
        <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
          {/* Quality Metrics */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Quality Metrics</h4>
            {(['factuality', 'relevance', 'coherence'] as const).map((metric) => (
              <div key={metric} className="group">
                <ConfidenceScore
                  score={metrics[metric]}
                  label={metricLabels[metric]}
                  size="sm"
                  showBar={true}
                />
                <p className="text-xs text-gray-500 mt-1 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {metricDescriptions[metric]}
                </p>
              </div>
            ))}
          </div>

          {/* Process Metrics (if available) */}
          {(metrics.retrieval !== undefined || metrics.generation !== undefined) && (
            <div className="space-y-2 pt-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Process Metrics</h4>
              {metrics.retrieval !== undefined && (
                <div className="group">
                  <ConfidenceScore
                    score={metrics.retrieval}
                    label={metricLabels.retrieval}
                    size="sm"
                    showBar={true}
                  />
                  <p className="text-xs text-gray-500 mt-1 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {metricDescriptions.retrieval}
                  </p>
                </div>
              )}
              {metrics.generation !== undefined && (
                <div className="group">
                  <ConfidenceScore
                    score={metrics.generation}
                    label={metricLabels.generation}
                    size="sm"
                    showBar={true}
                  />
                  <p className="text-xs text-gray-500 mt-1 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {metricDescriptions.generation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confidence Summary */}
      {!isExpanded && showDetails && (
        <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
          <span>Factuality: {Math.round(metrics.factuality * 100)}%</span>
          <span>•</span>
          <span>Relevance: {Math.round(metrics.relevance * 100)}%</span>
          <span>•</span>
          <span>Coherence: {Math.round(metrics.coherence * 100)}%</span>
        </div>
      )}
    </div>
  );
};