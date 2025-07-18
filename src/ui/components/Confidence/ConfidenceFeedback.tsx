import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { 
  HandThumbUpIcon, 
  HandThumbDownIcon,
  CheckIcon 
} from '@heroicons/react/24/outline';
import { 
  HandThumbUpIcon as HandThumbUpSolidIcon,
  HandThumbDownIcon as HandThumbDownSolidIcon 
} from '@heroicons/react/24/solid';

export interface FeedbackData {
  helpful: boolean | null;
  accurate: boolean | null;
  comment?: string;
}

export interface ConfidenceFeedbackProps {
  feedbackId: string;
  onSubmit: (feedbackId: string, data: FeedbackData) => void;
  initialData?: Partial<FeedbackData>;
  compact?: boolean;
  showComment?: boolean;
  className?: string;
}

export const ConfidenceFeedback: React.FC<ConfidenceFeedbackProps> = ({
  feedbackId,
  onSubmit,
  initialData,
  compact = false,
  showComment = true,
  className,
}) => {
  const [feedback, setFeedback] = useState<FeedbackData>({
    helpful: initialData?.helpful ?? null,
    accurate: initialData?.accurate ?? null,
    comment: initialData?.comment ?? '',
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = () => {
    onSubmit(feedbackId, feedback);
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  const handleThumbClick = (type: 'helpful' | 'accurate', value: boolean) => {
    setFeedback(prev => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
    
    // Auto-expand if giving negative feedback
    if (!value && showComment && !isExpanded) {
      setIsExpanded(true);
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <span className="text-sm text-gray-600">Was this helpful?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleThumbClick('helpful', true)}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              feedback.helpful === true
                ? 'text-green-600 bg-green-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
            aria-label="Helpful"
          >
            {feedback.helpful === true ? (
              <HandThumbUpSolidIcon className="w-4 h-4" />
            ) : (
              <HandThumbUpIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => handleThumbClick('helpful', false)}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              feedback.helpful === false
                ? 'text-red-600 bg-red-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
            aria-label="Not helpful"
          >
            {feedback.helpful === false ? (
              <HandThumbDownSolidIcon className="w-4 h-4" />
            ) : (
              <HandThumbDownIcon className="w-4 h-4" />
            )}
          </button>
        </div>
        {isSubmitted && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckIcon className="w-4 h-4" />
            Thanks!
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-50 rounded-lg p-4', className)}>
      <h4 className="font-medium text-gray-900 mb-3">Help us improve</h4>
      
      {/* Helpfulness */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-700">Was this response helpful?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleThumbClick('helpful', true)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm',
              feedback.helpful === true
                ? 'text-green-700 bg-green-100 border border-green-300'
                : 'text-gray-600 hover:bg-gray-100 border border-gray-300'
            )}
          >
            {feedback.helpful === true ? (
              <HandThumbUpSolidIcon className="w-4 h-4" />
            ) : (
              <HandThumbUpIcon className="w-4 h-4" />
            )}
            <span>Yes</span>
          </button>
          <button
            onClick={() => handleThumbClick('helpful', false)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm',
              feedback.helpful === false
                ? 'text-red-700 bg-red-100 border border-red-300'
                : 'text-gray-600 hover:bg-gray-100 border border-gray-300'
            )}
          >
            {feedback.helpful === false ? (
              <HandThumbDownSolidIcon className="w-4 h-4" />
            ) : (
              <HandThumbDownIcon className="w-4 h-4" />
            )}
            <span>No</span>
          </button>
        </div>
      </div>

      {/* Accuracy */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-700">Was the information accurate?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleThumbClick('accurate', true)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm',
              feedback.accurate === true
                ? 'text-green-700 bg-green-100 border border-green-300'
                : 'text-gray-600 hover:bg-gray-100 border border-gray-300'
            )}
          >
            {feedback.accurate === true ? (
              <HandThumbUpSolidIcon className="w-4 h-4" />
            ) : (
              <HandThumbUpIcon className="w-4 h-4" />
            )}
            <span>Yes</span>
          </button>
          <button
            onClick={() => handleThumbClick('accurate', false)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm',
              feedback.accurate === false
                ? 'text-red-700 bg-red-100 border border-red-300'
                : 'text-gray-600 hover:bg-gray-100 border border-gray-300'
            )}
          >
            {feedback.accurate === false ? (
              <HandThumbDownSolidIcon className="w-4 h-4" />
            ) : (
              <HandThumbDownIcon className="w-4 h-4" />
            )}
            <span>No</span>
          </button>
        </div>
      </div>

      {/* Comment Section */}
      {showComment && (isExpanded || feedback.helpful === false || feedback.accurate === false) && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <label htmlFor="feedback-comment" className="block text-sm text-gray-700 mb-2">
            Additional feedback (optional)
          </label>
          <textarea
            id="feedback-comment"
            value={feedback.comment}
            onChange={(e) => setFeedback(prev => ({ ...prev, comment: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Tell us more about your experience..."
          />
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-between mt-4">
        {showComment && !isExpanded && feedback.helpful !== false && feedback.accurate !== false && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Add comment
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={feedback.helpful === null && feedback.accurate === null && !feedback.comment}
          className={cn(
            'ml-auto px-4 py-2 text-sm font-medium rounded-md transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isSubmitted
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isSubmitted ? (
            <span className="flex items-center gap-1">
              <CheckIcon className="w-4 h-4" />
              Submitted
            </span>
          ) : (
            'Submit Feedback'
          )}
        </button>
      </div>
    </div>
  );
};