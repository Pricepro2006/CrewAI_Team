import React, { useState } from 'react';
import {
  ConfidenceScore,
  ConfidenceIndicator,
  ConfidenceBreakdown,
  ConfidenceWarning,
  ConfidenceTooltip,
  InlineConfidence,
  ConfidenceFeedback,
  type ConfidenceMetrics,
  type FeedbackData,
} from './index';

/**
 * Demo component showcasing all confidence visualization components
 * This can be used for testing and as a reference for implementation
 */
export const ConfidenceDemo: React.FC = () => {
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  const sampleMetrics: ConfidenceMetrics = {
    overall: 0.75,
    factuality: 0.82,
    relevance: 0.78,
    coherence: 0.85,
    retrieval: 0.72,
    generation: 0.68,
  };

  const handleFeedback = (feedbackId: string, data: FeedbackData) => {
    console.log('Feedback received:', { feedbackId, data });
    // In real implementation, send to API
  };

  const handleDismissWarning = (id: string) => {
    setDismissedWarnings(prev => new Set(prev).add(id));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Confidence Visualization Components
      </h1>

      {/* Confidence Scores */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Confidence Scores</h2>
        <div className="space-y-4">
          <ConfidenceScore score={0.92} label="High Confidence" size="lg" />
          <ConfidenceScore score={0.65} label="Medium Confidence" size="md" />
          <ConfidenceScore score={0.35} label="Low Confidence" size="sm" />
          <ConfidenceScore 
            score={0.78} 
            label="Custom Style" 
            showBar={false} 
            className="inline-block"
          />
        </div>
      </section>

      {/* Confidence Indicators */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Confidence Indicators</h2>
        <div className="space-y-3">
          <ConfidenceIndicator level="high" score={0.85} />
          <ConfidenceIndicator 
            level="medium" 
            score={0.62} 
            message="Response verified against 3 sources"
          />
          <ConfidenceIndicator 
            level="low" 
            score={0.45} 
            message="Limited information available"
          />
          <ConfidenceIndicator level="very_low" score={0.25} />
          
          <div className="flex gap-2 mt-4">
            <ConfidenceIndicator level="high" compact />
            <ConfidenceIndicator level="medium" compact />
            <ConfidenceIndicator level="low" compact />
            <ConfidenceIndicator level="very_low" compact />
          </div>
        </div>
      </section>

      {/* Confidence Breakdown */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Confidence Breakdown</h2>
        <ConfidenceBreakdown 
          metrics={sampleMetrics}
          defaultExpanded={true}
        />
      </section>

      {/* Confidence Warnings */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Confidence Warnings</h2>
        <div className="space-y-3">
          {!dismissedWarnings.has('warn1') && (
            <ConfidenceWarning
              type="uncertainty"
              message="This response contains some uncertain information"
              details={[
                'Limited sources available for verification',
                'Some claims could not be independently verified',
              ]}
              dismissible
              onDismiss={() => handleDismissWarning('warn1')}
            />
          )}
          
          <ConfidenceWarning
            type="source"
            severity="info"
            message="Information compiled from 5 verified sources"
          />
          
          <ConfidenceWarning
            type="review"
            message="This response should be reviewed by a domain expert"
            details={[
              'Complex technical content',
              'Potential safety implications',
            ]}
          />
          
          <ConfidenceWarning
            type="fallback"
            severity="error"
            message="Unable to generate confident response"
          />
        </div>
      </section>

      {/* Inline Confidence */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Inline Confidence</h2>
        <p className="text-gray-700 leading-relaxed">
          This is a sample paragraph with{' '}
          <InlineConfidence score={0.92} text="high confidence information" />{' '}
          mixed with{' '}
          <InlineConfidence score={0.65} text="medium confidence claims" />{' '}
          and some{' '}
          <InlineConfidence score={0.35} text="low confidence statements" showIcon={false} />.
          Hover over the underlined text to see confidence scores.
        </p>
        
        <div className="mt-4">
          <ConfidenceTooltip score={0.78} position="right">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Hover for Confidence
            </button>
          </ConfidenceTooltip>
        </div>
      </section>

      {/* Confidence Feedback */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Confidence Feedback</h2>
        <ConfidenceFeedback
          feedbackId="demo-feedback-1"
          onSubmit={handleFeedback}
        />
        
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <ConfidenceFeedback
            feedbackId="demo-feedback-2"
            onSubmit={handleFeedback}
            compact
          />
        </div>
      </section>

      {/* Combined Example */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Combined Example</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-medium">AI Response</h3>
            <ConfidenceIndicator level="medium" score={0.72} compact />
          </div>
          
          <p className="text-gray-700">
            This is a sample AI response with embedded confidence indicators.
            The system has <InlineConfidence score={0.85} text="high confidence" />{' '}
            in the main facts but <InlineConfidence score={0.45} text="lower confidence" />{' '}
            in some specific details.
          </p>
          
          <ConfidenceWarning
            type="uncertainty"
            severity="warning"
            message="Some information could not be verified"
          />
          
          <ConfidenceBreakdown metrics={sampleMetrics} />
          
          <ConfidenceFeedback
            feedbackId="combined-example"
            onSubmit={handleFeedback}
            compact
          />
        </div>
      </section>
    </div>
  );
};