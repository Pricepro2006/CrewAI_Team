import type { Meta, StoryObj } from '@storybook/react';
import { 
  ConfidenceScore,
  ConfidenceIndicator,
  ConfidenceBreakdown,
  ConfidenceWarning,
  ConfidenceFeedback,
  InlineConfidence,
} from './index';

// ConfidenceScore Stories
export default {
  title: 'Confidence/ConfidenceScore',
  component: ConfidenceScore,
} as Meta<typeof ConfidenceScore>;

type Story = StoryObj<typeof ConfidenceScore>;

export const Default: Story = {
  args: {
    score: 0.75,
    label: 'Confidence Score',
  },
};

export const HighConfidence: Story = {
  args: {
    score: 0.92,
    label: 'High Confidence',
    size: 'lg',
  },
};

export const LowConfidence: Story = {
  args: {
    score: 0.35,
    label: 'Low Confidence',
    size: 'sm',
  },
};

export const NoBar: Story = {
  args: {
    score: 0.65,
    label: 'Percentage Only',
    showBar: false,
  },
};

// ConfidenceIndicator Stories
export const IndicatorStories: Meta<typeof ConfidenceIndicator> = {
  title: 'Confidence/ConfidenceIndicator',
  component: ConfidenceIndicator,
};

export const HighIndicator: StoryObj<typeof ConfidenceIndicator> = {
  args: {
    level: 'high',
    score: 0.85,
  },
};

export const MediumIndicator: StoryObj<typeof ConfidenceIndicator> = {
  args: {
    level: 'medium',
    score: 0.65,
    message: 'Response verified against multiple sources',
  },
};

export const CompactIndicator: StoryObj<typeof ConfidenceIndicator> = {
  args: {
    level: 'low',
    score: 0.45,
    compact: true,
  },
};

// ConfidenceBreakdown Stories
export const BreakdownStories: Meta<typeof ConfidenceBreakdown> = {
  title: 'Confidence/ConfidenceBreakdown',
  component: ConfidenceBreakdown,
};

export const FullBreakdown: StoryObj<typeof ConfidenceBreakdown> = {
  args: {
    metrics: {
      overall: 0.75,
      factuality: 0.82,
      relevance: 0.78,
      coherence: 0.85,
      retrieval: 0.72,
      generation: 0.68,
    },
    defaultExpanded: true,
  },
};

// ConfidenceWarning Stories
export const WarningStories: Meta<typeof ConfidenceWarning> = {
  title: 'Confidence/ConfidenceWarning',
  component: ConfidenceWarning,
};

export const UncertaintyWarning: StoryObj<typeof ConfidenceWarning> = {
  args: {
    type: 'uncertainty',
    message: 'This response contains uncertain information',
    details: [
      'Limited sources available',
      'Some claims could not be verified',
    ],
    dismissible: true,
  },
};

export const FallbackWarning: StoryObj<typeof ConfidenceWarning> = {
  args: {
    type: 'fallback',
    message: 'Unable to generate confident response',
    severity: 'error',
  },
};

// ConfidenceFeedback Stories
export const FeedbackStories: Meta<typeof ConfidenceFeedback> = {
  title: 'Confidence/ConfidenceFeedback',
  component: ConfidenceFeedback,
};

export const FullFeedback: StoryObj<typeof ConfidenceFeedback> = {
  args: {
    feedbackId: 'test-feedback',
    onSubmit: (id, data) => console.log('Feedback:', { id, data }),
  },
};

export const CompactFeedback: StoryObj<typeof ConfidenceFeedback> = {
  args: {
    feedbackId: 'test-feedback-compact',
    onSubmit: (id, data) => console.log('Feedback:', { id, data }),
    compact: true,
  },
};

// InlineConfidence Example
export const InlineExample = () => (
  <p className="text-gray-700 p-4">
    This response contains <InlineConfidence score={0.92} text="high confidence facts" />{' '}
    mixed with <InlineConfidence score={0.65} text="medium confidence claims" />{' '}
    and some <InlineConfidence score={0.35} text="uncertain information" />.
  </p>
);