# Confidence Visualization Components

A comprehensive set of React components for visualizing and interacting with AI confidence scores in the UI.

## Components

### 1. ConfidenceScore
Displays a confidence score with an optional progress bar and percentage.

```tsx
<ConfidenceScore 
  score={0.75} 
  label="Query Confidence" 
  size="md"
  showBar={true}
  showPercentage={true}
/>
```

**Props:**
- `score` (number): Confidence value between 0 and 1
- `label` (string): Optional label text
- `size` ('sm' | 'md' | 'lg'): Size variant
- `showBar` (boolean): Show progress bar
- `showPercentage` (boolean): Show percentage value
- `animated` (boolean): Animate bar on mount

### 2. ConfidenceIndicator
Shows confidence level with appropriate icon and styling.

```tsx
<ConfidenceIndicator 
  level="medium" 
  score={0.65}
  message="Response verified"
  compact={false}
/>
```

**Props:**
- `level` ('high' | 'medium' | 'low' | 'very_low'): Confidence level
- `score` (number): Optional numeric score
- `message` (string): Optional custom message
- `compact` (boolean): Use compact display
- `showIcon` (boolean): Show level icon

### 3. ConfidenceBreakdown
Detailed breakdown of confidence metrics with expandable view.

```tsx
<ConfidenceBreakdown 
  metrics={{
    overall: 0.75,
    factuality: 0.82,
    relevance: 0.78,
    coherence: 0.85,
    retrieval: 0.72,
    generation: 0.68
  }}
  defaultExpanded={false}
/>
```

**Props:**
- `metrics` (ConfidenceMetrics): Confidence scores for different aspects
- `title` (string): Section title
- `defaultExpanded` (boolean): Initial expansion state
- `showDetails` (boolean): Allow expanding for details

### 4. ConfidenceWarning
Displays warnings related to confidence issues.

```tsx
<ConfidenceWarning
  type="uncertainty"
  message="Some information could not be verified"
  details={["Limited sources", "Recent data unavailable"]}
  severity="warning"
  dismissible={true}
/>
```

**Props:**
- `type` ('uncertainty' | 'source' | 'fallback' | 'review'): Warning type
- `message` (string): Main warning message
- `details` (string[]): Additional details
- `severity` ('info' | 'warning' | 'error'): Visual severity
- `dismissible` (boolean): Can be dismissed
- `onDismiss` (function): Dismiss callback

### 5. ConfidenceTooltip & InlineConfidence
Interactive tooltips for inline confidence display.

```tsx
// Tooltip wrapper
<ConfidenceTooltip score={0.85} position="top">
  <button>Hover me</button>
</ConfidenceTooltip>

// Inline text with confidence
<p>
  This contains <InlineConfidence score={0.92} text="high confidence info" />
</p>
```

### 6. ConfidenceFeedback
Collects user feedback on response quality.

```tsx
<ConfidenceFeedback
  feedbackId="response-123"
  onSubmit={(id, data) => console.log(data)}
  compact={false}
  showComment={true}
/>
```

**Props:**
- `feedbackId` (string): Unique ID for feedback
- `onSubmit` (function): Submission callback
- `compact` (boolean): Use compact layout
- `showComment` (boolean): Show comment field

## Usage in Chat Interface

### ConfidenceMessage Component
Enhanced message component with confidence visualization:

```tsx
<ConfidenceMessage
  message={{
    id: "1",
    role: "assistant",
    content: "Response with {{confidence markers|0.85}}",
    confidence: {
      score: 0.75,
      metrics: { ... },
      warnings: [ ... ],
      sources: [ ... ]
    },
    feedbackId: "feedback-123"
  }}
  onFeedback={handleFeedback}
/>
```

## Styling

Components use Tailwind CSS classes and can be customized via:
- `className` prop on all components
- CSS variables for animations
- Tailwind configuration

## Color Scheme

- **High (≥80%)**: Green (success)
- **Medium (60-79%)**: Blue/Yellow (info/warning)
- **Low (40-59%)**: Orange (warning)
- **Very Low (<40%)**: Red (error)

## Accessibility

- All components include proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- Color-blind safe indicators (icons + text)

## Best Practices

1. **Always show confidence** for AI-generated responses
2. **Use warnings** for low confidence or uncertainty
3. **Collect feedback** to improve calibration
4. **Provide context** via tooltips and breakdowns
5. **Be transparent** about limitations

## Examples

See `ConfidenceDemo.tsx` for comprehensive examples of all components.