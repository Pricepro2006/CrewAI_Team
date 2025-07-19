// Main exports from validators module
export { BusinessResponseValidator } from './BusinessResponseValidator.js';
export type {
  ContactInfo,
  PhoneInfo,
  AddressInfo,
  BusinessNameInfo,
  HoursInfo,
  EmailInfo,
  WebsiteInfo,
  ValidationResult
} from './BusinessResponseValidator.js';

// Pattern exports
export { ContactPatterns, PatternHelpers, ValidationRules } from './patterns/contactPatterns.js';

// Fallback system exports
export { FallbackSearchManager } from './fallback/FallbackSearchManager.js';
export type { 
  FallbackSearchOptions, 
  FallbackSearchResult, 
  DataSource 
} from './fallback/FallbackSearchManager.js';

export { UserFeedbackCollector } from './fallback/UserFeedbackCollector.js';
export type { 
  UserFeedback, 
  FeedbackStats 
} from './fallback/UserFeedbackCollector.js';

export { IntegratedValidationService } from './fallback/IntegratedValidationService.js';
export type { 
  IntegratedValidationOptions, 
  IntegratedValidationResult 
} from './fallback/IntegratedValidationService.js';