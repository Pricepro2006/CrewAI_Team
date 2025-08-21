/**
 * Simplified Qwen3:0.6b Processor for Walmart Grocery
 * Handles the model's actual output format with thinking tags
 */

import { logger } from "../../utils/logger.js";
import axios from "axios";
import type { AxiosInstance } from "axios";
import { walmartConfig } from "../../config/walmart.config.js";

export interface ProcessedIntent {
  intent: string;
  confidence: number;
  items: string[];
  quantities: string[];
  action: string;
}

export class SimplifiedQwenProcessor {
  private static instance: SimplifiedQwenProcessor;
  private ollamaClient: AxiosInstance;

  private constructor() {
    this.ollamaClient = axios.create({
      baseURL: `${walmartConfig?.nlp?.host || 'http://localhost'}:${walmartConfig?.nlp?.port || 8081}`,
      timeout: 30000, // Increased timeout for Qwen3:0.6b
    });
  }

  static getInstance(): SimplifiedQwenProcessor {
    if (!SimplifiedQwenProcessor.instance) {
      SimplifiedQwenProcessor.instance = new SimplifiedQwenProcessor();
    }
    return SimplifiedQwenProcessor.instance;
  }

  /**
   * Process user input with simplified approach
   */
  async processGroceryQuery(userInput: string): Promise<ProcessedIntent> {
    logger.info(`Processing query: "${userInput}"`, "QWEN_PROCESSOR");
    
    // First, try rule-based extraction for speed
    const ruleBasedResult = this.extractWithRules(userInput);
    
    // If rule-based gives good results, return immediately
    if (ruleBasedResult.confidence > 0.7) {
      logger.info("Using rule-based extraction (high confidence)", "QWEN_PROCESSOR");
      return ruleBasedResult;
    }
    
    // Otherwise, enhance with Qwen3:0.6b
    try {
      const enhancedResult = await this.enhanceWithQwen(userInput, ruleBasedResult);
      return enhancedResult;
    } catch (error) {
      logger.warn(`Qwen enhancement failed, using rule-based: ${error}`, "QWEN_PROCESSOR");
      return ruleBasedResult;
    }
  }

  /**
   * Rule-based extraction for common patterns
   */
  private extractWithRules(input: string): ProcessedIntent {
    const lowerInput = input.toLowerCase();
    const result: ProcessedIntent = {
      intent: "unknown",
      confidence: 0.5,
      items: [],
      quantities: [],
      action: "process"
    };

    // Detect intent with improved patterns
    if (/\b(checkout|pay|purchase|buy now|complete order)\b/i.test(lowerInput)) {
      result.intent = "checkout";
      result.action = "checkout";
      result.confidence = 0.9;
    } else if (/\b(clear|empty|reset|remove all|delete all)\b.*(cart|list|basket)/i.test(lowerInput)) {
      result.intent = "clear_cart";
      result.action = "clear";
      result.confidence = 0.9;
    } else if (/\b(show|view|what's in|check|see)\b.*(cart|basket|shopping)/i.test(lowerInput)) {
      result.intent = "view_cart";
      result.action = "view";
      result.confidence = 0.8;
    } else if (lowerInput.includes("add") || lowerInput.includes("put") || lowerInput.includes("need")) {
      result.intent = "add_items";
      result.action = "add";
      result.confidence = 0.9;
    } else if (lowerInput.includes("remove") || lowerInput.includes("delete") || lowerInput.includes("take out")) {
      result.intent = "remove_items";
      result.action = "remove";
      result.confidence = 0.9;
    } else if (lowerInput.includes("price") || lowerInput.includes("cost") || lowerInput.includes("how much")) {
      result.intent = "check_price";
      result.action = "price_check";
      result.confidence = 0.8;
    } else if (/\b(find|search|look for|show.*options|what.*have)\b/i.test(lowerInput)) {
      result.intent = "search_products";
      result.action = "search";
      result.confidence = 0.8;
    } else if (lowerInput.includes("list")) {
      result.intent = lowerInput.includes("create") || lowerInput.includes("new") ? "create_list" : "view_list";
      result.action = result.intent === "create_list" ? "create" : "view";
      result.confidence = 0.8;
    }

    // Extract common grocery items
    const commonItems = [
      "milk", "bread", "eggs", "butter", "cheese", "yogurt",
      "chicken", "beef", "pork", "fish", "turkey",
      "apples", "bananas", "oranges", "grapes", "strawberries",
      "lettuce", "tomatoes", "onions", "potatoes", "carrots",
      "rice", "pasta", "cereal", "flour", "sugar",
      "coffee", "tea", "juice", "soda", "water"
    ];

    commonItems.forEach(item => {
      if (lowerInput.includes(item)) {
        result.items.push(item);
      }
    });

    // Extract quantities
    const quantityPattern = /(\d+)\s*(gallons?|liters?|pounds?|lbs?|oz|ounces?|bottles?|cans?|boxes?|dozen|packs?|bags?|loaves?)/gi;
    const matches = input.match(quantityPattern);
    if (matches) {
      result.quantities = matches.map(m => m.trim());
    }

    // Extract standalone numbers
    const numberPattern = /\b(\d+)\b/g;
    const numbers = input.match(numberPattern);
    if (numbers && result.quantities.length === 0) {
      result.quantities = numbers;
    }

    // Adjust confidence based on extraction success
    if (result.items.length > 0) {
      result.confidence = Math.min(result.confidence + 0.1, 0.9);
    }

    return result;
  }

  /**
   * Enhance extraction with Qwen3:0.6b model
   */
  private async enhanceWithQwen(input: string, ruleBasedResult: ProcessedIntent): Promise<ProcessedIntent> {
    // Create a simple prompt that works well with Qwen3:0.6b
    const prompt = `Task: Extract grocery items from user input.
Input: "${input}"
List the grocery items mentioned:`;

    try {
      const response = await this.ollamaClient.post("/api/generate", {
        model: walmartConfig?.nlp?.model || 'qwen3:0.6b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 100,
          stop: ["<think>", "</think>", "\n\n"]
        }
      });

      const modelOutput = response?.data?.response || '';
      
      // Clean the output (remove thinking tags if present)
      const cleanOutput = modelOutput
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/<think>[\s\S]*/g, "")
        .trim();

      // Extract items from the cleaned output
      const lines = cleanOutput.split('\n').filter((line: string) => line.trim());
      const extractedItems: string[] = [];

      lines.forEach((line: string) => {
        // Remove bullets, numbers, dashes
        const cleanLine = line.replace(/^[-•*\d.)\s]+/, "").trim().toLowerCase();
        if (cleanLine && cleanLine.length > 1 && cleanLine.length < 50) {
          extractedItems.push(cleanLine);
        }
      });

      // Merge with rule-based results
      const mergedItems = [...new Set([...ruleBasedResult.items, ...extractedItems])];
      
      return {
        ...ruleBasedResult,
        items: mergedItems,
        confidence: Math.min(ruleBasedResult.confidence + 0.1, 0.95)
      };

    } catch (error) {
      logger.error(`Qwen processing error: ${error instanceof Error ? error.message : String(error)}`, "QWEN_PROCESSOR");
      throw error;
    }
  }

  /**
   * Process a list of queries in batch
   */
  async processBatch(queries: string[]): Promise<ProcessedIntent[]> {
    const results: ProcessedIntent[] = [];
    
    for (const query of queries) {
      const result = await this.processGroceryQuery(query);
      results.push(result);
    }
    
    return results;
  }
}

// Export singleton getter
export function getSimplifiedQwenProcessor(): SimplifiedQwenProcessor {
  return SimplifiedQwenProcessor.getInstance();
}