/**
 * Output sanitization utilities to clean up LLM responses
 * Removes internal processing artifacts like thinking tags
 */

/**
 * Remove thinking tags and other internal processing artifacts from LLM output
 * Some models (like granite) may include <think> tags for their internal reasoning
 */
export function sanitizeLLMOutput(output: string): string {
  if (!output || typeof output !== 'string') {
    return output || '';
  }
  
  // Remove thinking tags and their content
  let sanitized = output.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Remove any standalone closing tags that might be left
  sanitized = sanitized.replace(/<\/think>/gi, '');
  
  // Remove multiple consecutive newlines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Clean up JSON responses by removing thinking tags before parsing
 */
export function sanitizeJSONResponse(response: string): string {
  // First remove thinking tags
  const cleaned = sanitizeLLMOutput(response);
  
  // Try to extract JSON from the response
  // Look for JSON between triple backticks
  const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  
  // Look for JSON between single backticks
  const singleBacktickMatch = cleaned.match(/`([\s\S]*?)`/);
  if (singleBacktickMatch) {
    const potential = singleBacktickMatch[1].trim();
    if (potential.startsWith('{') || potential.startsWith('[')) {
      return potential;
    }
  }
  
  // Look for raw JSON
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart !== -1) {
    return cleaned.substring(jsonStart).trim();
  }
  
  return cleaned;
}

/**
 * Sanitize agent output to ensure clean responses
 */
export function sanitizeAgentOutput(output: unknown): string {
  if (typeof output === 'string') {
    return sanitizeLLMOutput(output);
  }
  
  if (typeof output === 'object' && output !== null) {
    // If it's an object with a content property
    if ('content' in output && typeof (output as any).content === 'string') {
      return sanitizeLLMOutput((output as any).content);
    }
    
    // If it's an object with an output property
    if ('output' in output && typeof (output as any).output === 'string') {
      return sanitizeLLMOutput((output as any).output);
    }
    
    // Otherwise convert to JSON string and sanitize
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }
  
  return String(output);
}