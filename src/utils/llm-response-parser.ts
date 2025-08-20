/**
 * LLM Response Parser Utility
 * Handles parsing LLM responses that may not be valid JSON
 * 
 * @author Claude
 * @date 2025-08-17
 */

import { logger } from './logger.js';

/**
 * Attempts to extract JSON from an LLM response
 * Handles cases where the LLM includes explanatory text around the JSON
 */
export function extractJSON(response: string): any {
  if (!response || typeof response !== 'string') {
    logger.warn('Empty or invalid response for JSON extraction', 'LLM_PARSER');
    return null;
  }

  // First, try direct JSON parsing
  try {
    return JSON.parse(response);
  } catch {
    // Continue to extraction methods
  }

  // Try to find JSON blocks in markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {
      logger.debug('Failed to parse JSON from code block', 'LLM_PARSER', { error: e });
    }
  }

  // Try to find JSON object or array in the response
  const jsonMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      // Clean up common issues
      let cleaned = jsonMatch[1]
        .replace(/,\s*}/, '}')  // Remove trailing commas
        .replace(/,\s*\]/, ']')  // Remove trailing commas in arrays
        .replace(/'/g, '"')      // Replace single quotes with double quotes
        .replace(/(\w+):/g, '"$1":'); // Add quotes to unquoted keys
      
      return JSON.parse(cleaned);
    } catch (e) {
      logger.debug('Failed to parse extracted JSON', 'LLM_PARSER', { error: e });
    }
  }

  // If all else fails, try to build a structured response from the text
  return parseStructuredText(response);
}

/**
 * Attempts to parse structured information from plain text
 */
function parseStructuredText(text: string): any {
  const result: any = {};
  
  // Look for common patterns in LLM responses
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Pattern: "key: value" or "- key: value"
    const keyValueMatch = line.match(/^[-*]?\s*(\w+):\s*(.+)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;
      if (key && value) {
        result[key.toLowerCase()] = value.trim();
      }
    }
    
    // Pattern: numbered list items
    const numberedMatch = line.match(/^\d+\.\s*(\w+):\s*(.+)$/);
    if (numberedMatch) {
      const [, key, value] = numberedMatch;
      if (key && value) {
        result[key.toLowerCase()] = value.trim();
      }
    }
  }
  
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Safely parses LLM response with fallback to default value
 */
export function parseLLMResponse<T>(
  response: string,
  defaultValue: T,
  expectedFields?: string[]
): T {
  try {
    const parsed = extractJSON(response);
    
    if (!parsed) {
      logger.debug('Could not extract JSON, using default value', 'LLM_PARSER');
      return defaultValue;
    }
    
    // Validate expected fields if provided
    if (expectedFields && expectedFields.length > 0) {
      const hasAllFields = expectedFields.every(field => 
        parsed.hasOwnProperty(field) && parsed[field] !== undefined
      );
      
      if (!hasAllFields) {
        logger.debug('Parsed JSON missing expected fields, merging with defaults', 'LLM_PARSER', {
          expected: expectedFields,
          found: Object.keys(parsed)
        });
        
        // Merge with defaults to ensure all fields are present
        return { ...defaultValue, ...parsed };
      }
    }
    
    return parsed as T;
  } catch (error) {
    logger.error('Failed to parse LLM response', 'LLM_PARSER', { 
      error: error instanceof Error ? error.message : String(error),
      responsePreview: response?.substring(0, 100) || ''
    });
    return defaultValue;
  }
}

/**
 * Formats a prompt to encourage JSON output from the LLM
 */
export function formatJSONPrompt(prompt: string, exampleOutput?: any): string {
  let formattedPrompt = prompt;
  
  // Add JSON instruction if not already present
  if (!prompt.toLowerCase().includes('json')) {
    formattedPrompt += '\n\nRespond with valid JSON only, no explanatory text.';
  }
  
  // Add example if provided
  if (exampleOutput) {
    formattedPrompt += `\n\nExample format:\n${JSON.stringify(exampleOutput, null, 2)}`;
  }
  
  return formattedPrompt;
}

/**
 * Validates and cleans a JSON response
 */
export function validateJSON(obj: any, schema: Record<string, string>): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in obj)) {
      return false;
    }
    
    const actualType = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
    if (actualType !== type && type !== 'any') {
      return false;
    }
  }
  
  return true;
}