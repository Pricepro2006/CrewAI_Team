/**
 * Common Type Definitions for CrewAI Team
 * Replaces 'any' types with proper TypeScript interfaces
 */
// Type Guards
export function isEmailEntity(obj) {
    return typeof obj === 'object' && obj !== null &&
        'type' in obj && 'value' in obj && 'confidence' in obj;
}
export function isLLMResponse(obj) {
    return typeof obj === 'object' && obj !== null &&
        'success' in obj && 'data' in obj && 'model' in obj;
}
