// Natural Language Input Components
export { default as NaturalLanguageInput } from './NaturalLanguageInput';
export type { NaturalLanguageInputProps } from './NaturalLanguageInput';

// Command History Components  
export { default as CommandHistory } from './CommandHistory';
export type { CommandHistoryProps, CommandHistoryItem } from './CommandHistory';

// Hooks
export { default as useVoiceRecognition } from '../../hooks/useVoiceRecognition';
export type { 
  VoiceRecognitionConfig, 
  VoiceRecognitionState, 
  VoiceRecognitionActions 
} from '../../hooks/useVoiceRecognition';

export { default as useAutoSuggestions } from '../../hooks/useAutoSuggestions';
export type { 
  Suggestion, 
  SuggestionContext, 
  AutoSuggestionsConfig,
  AutoSuggestionsState,
  AutoSuggestionsActions
} from '../../hooks/useAutoSuggestions';

// Main Components
export { GroceryListEnhanced } from './GroceryListEnhanced';
export { default as WalmartLivePricing } from './WalmartLivePricing';

// Lazy Component Loaders
export {
  LazyWalmartLivePricing,
  LazyGroceryListAndTracker,
  LazyWalmartHybridSearch
} from './LazyComponentLoader';