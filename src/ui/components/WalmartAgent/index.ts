// Natural Language Input Components
export { default as NaturalLanguageInput } from './NaturalLanguageInput.js';
export type { NaturalLanguageInputProps } from './NaturalLanguageInput.js';

// Command History Components  
export { default as CommandHistory } from './CommandHistory.js';
export type { CommandHistoryProps, CommandHistoryItem } from './CommandHistory.js';

// Hooks
export { default as useVoiceRecognition } from '../../hooks/useVoiceRecognition.js';
export type { 
  VoiceRecognitionConfig, 
  VoiceRecognitionState, 
  VoiceRecognitionActions 
} from '../../hooks/useVoiceRecognition.js';

export { default as useAutoSuggestions } from '../../hooks/useAutoSuggestions.js';
export type { 
  Suggestion, 
  SuggestionContext, 
  AutoSuggestionsConfig,
  AutoSuggestionsState,
  AutoSuggestionsActions
} from '../../hooks/useAutoSuggestions.js';

// Demo Component
export { default as NaturalLanguageInputDemo } from './NaturalLanguageInputDemo.js';

// Existing Components
export { default as GroceryListEnhanced } from './GroceryListEnhanced.js';
export { default as WalmartGroceryAgent } from './WalmartGroceryAgent.js';
export { default as WalmartLivePricing } from './WalmartLivePricing.js';