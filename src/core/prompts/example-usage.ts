/**
 * Example usage of BusinessSearchPromptEnhancer
 * Demonstrates integration with existing CrewAI system
 * Part of GROUP 2B WebSearch Enhancement
 */

import { businessSearchPromptEnhancer } from "./BusinessSearchPromptEnhancer.js";
import { LlamaCppProvider } from "../llm/LlamaCppProvider.js";
import { logger } from "../../utils/logger.js";

// Example 1: Basic Enhancement
export function basicEnhancementExample() {
  const userQuery = "Where can I find a good Italian restaurant?";

  // Enhance the prompt before sending to LLM
  const enhancedPrompt = businessSearchPromptEnhancer.enhance(userQuery);

  console.log("Original:", userQuery);
  console.log("Enhanced:", enhancedPrompt);
}

// Example 2: Integration with OllamaProvider
export async function ollamaIntegrationExample() {
  const ollama = new LlamaCppProvider({
      modelPath: process.env.LLAMA_MODEL_PATH || `./models/llama2.gguf`,
      contextSize: 8192,
      threads: 8,
      temperature: 0.7,
      gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0"),
    });

  const userQuery = "I need a 24-hour pharmacy near downtown";

  // Check if enhancement is needed
  if (businessSearchPromptEnhancer.needsEnhancement(userQuery)) {
    // Enhance with aggressive level for critical queries
    const enhancedPrompt = businessSearchPromptEnhancer.enhance(userQuery, {
      enhancementLevel: "aggressive",
      includeExamples: true,
      customInstructions: "Focus on pharmacies within 5 miles of downtown area",
    });

    try {
      const response = await ollama.generate(enhancedPrompt);
      console.log("LLM Response:", response);
    } catch (error) {
      logger.error(
        "Failed to get LLM response:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

// Example 3: Agent Integration Pattern
export class BusinessSearchAgent {
  private promptEnhancer = businessSearchPromptEnhancer;
  private ollama: LlamaCppProvider;

  constructor() {
    this.ollama = new LlamaCppProvider({
      modelPath: process.env.LLAMA_MODEL_PATH || `./models/llama2.gguf`,
      contextSize: 8192,
      threads: 8,
      temperature: 0.7,
      gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0"),
    });
  }

  async processBusinessQuery(query: string, context?: any) {
    // Determine enhancement level based on query urgency
    const enhancementLevel = this.determineEnhancementLevel(query);

    // Enhance the prompt
    const enhancedPrompt = this.promptEnhancer.enhance(query, {
      enhancementLevel,
      includeExamples: enhancementLevel === "aggressive",
      customInstructions: this.buildCustomInstructions(context),
    });

    // Generate response with enhanced prompt
    const response = await this.ollama.generate(enhancedPrompt, {
      temperature: 0.3, // Lower temperature for factual business info
      maxTokens: 1000,
    });

    return this.parseBusinessResponse(response);
  }

  private determineEnhancementLevel(
    query: string,
  ): "minimal" | "standard" | "aggressive" {
    const urgentKeywords = [
      "urgent",
      "emergency",
      "asap",
      "immediately",
      "24/7",
      "now",
    ];
    const lowerQuery = query.toLowerCase();

    if (urgentKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return "aggressive";
    }

    if (lowerQuery.includes("near") || lowerQuery.includes("closest")) {
      return "standard";
    }

    return "minimal";
  }

  private buildCustomInstructions(context?: any): string {
    let instructions = "";

    if (context?.location) {
      instructions += `User location: ${context.location}. `;
    }

    if (context?.preferences) {
      instructions += `User preferences: ${context.preferences.join(", ")}. `;
    }

    if (context?.radius) {
      instructions += `Search within ${context.radius} miles. `;
    }

    return instructions;
  }

  private parseBusinessResponse(response: string): any {
    // Extract business information from enhanced response
    // This would parse the structured response format
    return {
      businesses: [],
      searchPerformed: response.includes("WebSearch"),
      enhancementApplied:
        businessSearchPromptEnhancer.isAlreadyEnhanced(response),
    };
  }
}

// Example 4: Batch Processing with Different Enhancement Levels
export async function batchProcessingExample() {
  const queries = [
    { text: "Find a coffee shop", priority: "low" },
    { text: "Emergency plumber needed NOW", priority: "high" },
    { text: "Best sushi restaurant for dinner", priority: "medium" },
  ];

  const enhancedQueries = queries.map(({ text, priority }) => {
    const level =
      priority === "high"
        ? "aggressive"
        : priority === "medium"
          ? "standard"
          : "minimal";

    return {
      original: text,
      enhanced: businessSearchPromptEnhancer.enhance(text, {
        enhancementLevel: level,
        includeExamples: priority === "high",
      }),
      level,
    };
  });

  console.log("Batch Enhancement Results:", enhancedQueries);
}

// Example 5: Dynamic Enhancement with Fallback
export async function dynamicEnhancementExample(userQuery: string) {
  try {
    // First attempt with standard enhancement
    let enhancedPrompt = businessSearchPromptEnhancer.enhance(userQuery, {
      enhancementLevel: "standard",
    });

    // Simulate checking if model understood the enhancement
    const testResponse = await simulateLLMResponse(enhancedPrompt);

    if (!testResponse.includes("WebSearch")) {
      // Upgrade to aggressive enhancement
      logger.info("Upgrading to aggressive enhancement");
      enhancedPrompt = businessSearchPromptEnhancer.enhance(userQuery, {
        enhancementLevel: "aggressive",
        includeExamples: true,
      });
    }

    return enhancedPrompt;
  } catch (error) {
    // Fallback to default business prompt
    logger.error(
      "Enhancement failed, using default",
      error instanceof Error ? error.message : String(error),
    );
    return businessSearchPromptEnhancer.getDefaultBusinessPrompt();
  }
}

// Helper function to simulate LLM response
async function simulateLLMResponse(prompt: string): Promise<string> {
  // In real implementation, this would call the actual LLM
  return prompt.includes("aggressive")
    ? "I will use WebSearch to find..."
    : "Looking for businesses...";
}

// Example 6: Prompt Analysis and Metrics
export function promptAnalysisExample() {
  const testPrompts = [
    "Where's the nearest ATM?",
    "Tell me about quantum physics",
    "Find 24/7 emergency vet clinic",
    "What's the weather today?",
    "Best pizza delivery near me",
  ];

  const analysis = testPrompts.map((prompt) => ({
    prompt,
    needsEnhancement: businessSearchPromptEnhancer.needsEnhancement(prompt),
    currentlyEnhanced: businessSearchPromptEnhancer.isAlreadyEnhanced(prompt),
  }));

  console.log("Prompt Analysis:", analysis);

  // Calculate metrics
  const businessQueries = analysis.filter((a) => a.needsEnhancement).length;
  const percentage = (businessQueries / testPrompts.length) * 100;

  console.log(`${percentage}% of queries need business search enhancement`);
}

// Example 7: Enhancement Removal for Debugging
export function debugEnhancementExample() {
  const userQuery = "Find a hardware store";

  // Enhance the prompt
  const enhanced = businessSearchPromptEnhancer.enhance(userQuery, {
    enhancementLevel: "aggressive",
    includeExamples: true,
  });

  console.log("Enhanced prompt length:", enhanced.length);

  // Extract just the instructions for analysis
  const instructions =
    businessSearchPromptEnhancer.extractInstructions(enhanced);
  console.log("Extracted instructions:", instructions);

  // Remove enhancement for comparison
  const cleaned = businessSearchPromptEnhancer.removeEnhancement(enhanced);
  console.log("Cleaned prompt:", cleaned);
  console.log("Original query recovered:", cleaned.includes(userQuery));
}

// Example 8: Custom Business Categories
export function customBusinessCategoriesExample() {
  const customInstructions = `
  For TD SYNNEX specific queries, prioritize:
  1. Authorized dealers and partners
  2. Certified service providers
  3. Official distribution centers
  Include partner tier levels and certifications in results.
  `;

  const query = "Find authorized HP printer service center";
  const enhanced = businessSearchPromptEnhancer.enhance(query, {
    enhancementLevel: "standard",
    customInstructions,
    includeExamples: false, // Use custom examples instead
  });

  console.log("TD SYNNEX Enhanced Query:", enhanced);
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log("=== BusinessSearchPromptEnhancer Examples ===\n");

  console.log("1. Basic Enhancement:");
  basicEnhancementExample();

  console.log("\n2. Batch Processing:");
  batchProcessingExample();

  console.log("\n3. Prompt Analysis:");
  promptAnalysisExample();

  console.log("\n4. Debug Enhancement:");
  debugEnhancementExample();

  console.log("\n5. Custom Business Categories:");
  customBusinessCategoriesExample();
}
