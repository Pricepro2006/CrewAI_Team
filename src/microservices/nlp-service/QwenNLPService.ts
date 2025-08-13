/**
 * Qwen NLP Service - Natural Language Processing using Qwen3:0.6b model
 * Lightweight NLP for grocery intent detection and entity extraction
 */

import { logger } from "../../utils/logger.js";
import { walmartConfig } from "../../config/walmart.config.js";
import axios, { AxiosInstance } from "axios";

export interface NLPIntent {
  intent: string;
  confidence: number;
  entities: NLPEntity[];
  context?: any;
}

export interface NLPEntity {
  type: string;
  value: string;
  position?: [number, number];
  confidence?: number;
}

export interface NLPRequest {
  text: string;
  context?: any;
  userId?: string;
  sessionId?: string;
}

export interface NLPResponse {
  success: boolean;
  intent?: NLPIntent;
  error?: string;
  processingTime?: number;
}

export class QwenNLPService {
  private static instance: QwenNLPService;
  private ollamaClient: AxiosInstance;
  private modelName: string;
  private isModelReady: boolean = false;

  private constructor() {
    this.modelName = walmartConfig.nlp.model;
    this.ollamaClient = axios.create({
      baseURL: `${walmartConfig.nlp.host}:${walmartConfig.nlp.port}`,
      timeout: walmartConfig.nlp.timeout,
    });

    // Initialize model on startup
    this.initializeModel();
  }

  static getInstance(): QwenNLPService {
    if (!QwenNLPService.instance) {
      QwenNLPService.instance = new QwenNLPService();
    }
    return QwenNLPService.instance;
  }

  /**
   * Initialize and pull the Qwen model if needed
   */
  private async initializeModel(): Promise<void> {
    try {
      logger.info(`Checking if ${this.modelName} model is available...`, "QWEN_NLP");

      // Check if model exists
      const response = await this.ollamaClient.get("/api/tags");
      const models = response.data.models || [];
      const modelExists = models.some((m: any) => m.name === this.modelName);

      if (!modelExists) {
        logger.info(`Pulling ${this.modelName} model...`, "QWEN_NLP");
        await this.ollamaClient.post("/api/pull", { name: this.modelName });
        logger.info(`${this.modelName} model pulled successfully`, "QWEN_NLP");
      }

      this.isModelReady = true;
      logger.info(`${this.modelName} model is ready`, "QWEN_NLP");
    } catch (error) {
      logger.error(`Failed to initialize ${this.modelName} model: ${error}`, "QWEN_NLP");
      this.isModelReady = false;
    }
  }

  /**
   * Process natural language input for grocery operations
   */
  async processInput(request: NLPRequest): Promise<NLPResponse> {
    const startTime = Date.now();

    try {
      if (!this.isModelReady) {
        await this.initializeModel();
        if (!this.isModelReady) {
          throw new Error("Model not available");
        }
      }

      // Create a focused prompt for grocery intent detection
      const prompt = this.createGroceryPrompt(request.text);

      // Call Ollama API with Qwen model
      const response = await this.ollamaClient.post("/api/generate", {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent results
          top_p: 0.9,
          num_predict: 150, // Limit response length for efficiency
        },
      });

      // Parse the model response
      const intent = this.parseModelResponse(response.data.response, request.text);

      const processingTime = Date.now() - startTime;
      logger.info(`NLP processing completed in ${processingTime}ms`, "QWEN_NLP", { intent });

      return {
        success: true,
        intent,
        processingTime,
      };
    } catch (error) {
      logger.error(`NLP processing failed: ${error}`, "QWEN_NLP");
      
      // Fallback to rule-based extraction
      const fallbackIntent = this.fallbackIntentExtraction(request.text);
      
      return {
        success: false,
        intent: fallbackIntent,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a focused prompt for grocery intent detection
   */
  private createGroceryPrompt(text: string): string {
    return `You are a grocery shopping assistant. Analyze this user input and extract the intent and entities.

User Input: "${text}"

Identify:
1. Intent (one of: add_item, remove_item, search_product, check_price, create_list, view_list, checkout, find_substitute, ask_help)
2. Product names mentioned
3. Quantities mentioned
4. Brand names mentioned
5. Any other relevant entities

Respond in this exact JSON format:
{
  "intent": "intent_name",
  "products": ["product1", "product2"],
  "quantities": ["2", "1 gallon"],
  "brands": ["brand1"],
  "other": []
}

Response:`;
  }

  /**
   * Parse model response into structured intent
   */
  private parseModelResponse(response: string, originalText: string): NLPIntent {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const entities: NLPEntity[] = [];

      // Extract products
      if (parsed.products && Array.isArray(parsed.products)) {
        parsed.products.forEach((product: string) => {
          entities.push({
            type: "product",
            value: product,
            confidence: 0.8,
          });
        });
      }

      // Extract quantities
      if (parsed.quantities && Array.isArray(parsed.quantities)) {
        parsed.quantities.forEach((quantity: string) => {
          entities.push({
            type: "quantity",
            value: quantity,
            confidence: 0.9,
          });
        });
      }

      // Extract brands
      if (parsed.brands && Array.isArray(parsed.brands)) {
        parsed.brands.forEach((brand: string) => {
          entities.push({
            type: "brand",
            value: brand,
            confidence: 0.7,
          });
        });
      }

      return {
        intent: parsed.intent || "unknown",
        confidence: 0.75,
        entities,
      };
    } catch (error) {
      logger.warn(`Failed to parse model response, using fallback: ${error}`, "QWEN_NLP");
      return this.fallbackIntentExtraction(originalText);
    }
  }

  /**
   * Fallback rule-based intent extraction
   */
  private fallbackIntentExtraction(text: string): NLPIntent {
    const lowerText = text.toLowerCase();
    const entities: NLPEntity[] = [];

    // Detect intent
    let intent = "unknown";
    let confidence = 0.5;

    if (lowerText.includes("add") || lowerText.includes("put")) {
      intent = "add_item";
      confidence = 0.7;
    } else if (lowerText.includes("remove") || lowerText.includes("delete")) {
      intent = "remove_item";
      confidence = 0.7;
    } else if (lowerText.includes("search") || lowerText.includes("find")) {
      intent = "search_product";
      confidence = 0.7;
    } else if (lowerText.includes("price") || lowerText.includes("cost")) {
      intent = "check_price";
      confidence = 0.7;
    } else if (lowerText.includes("list")) {
      intent = lowerText.includes("create") ? "create_list" : "view_list";
      confidence = 0.6;
    } else if (lowerText.includes("checkout") || lowerText.includes("buy")) {
      intent = "checkout";
      confidence = 0.8;
    }

    // Extract quantities (simple regex)
    const quantityRegex = /(\d+)\s*(gallons?|liters?|pounds?|lbs?|oz|ounces?|items?|packs?|bottles?|cans?|boxes?)?/gi;
    const quantities = text.match(quantityRegex);
    if (quantities) {
      quantities.forEach(q => {
        entities.push({
          type: "quantity",
          value: q.trim(),
          confidence: 0.8,
        });
      });
    }

    // Extract common grocery items
    const commonItems = ["milk", "bread", "eggs", "butter", "cheese", "yogurt", "chicken", "beef", "rice", "pasta"];
    commonItems.forEach(item => {
      if (lowerText.includes(item)) {
        entities.push({
          type: "product",
          value: item,
          confidence: 0.6,
        });
      }
    });

    return {
      intent,
      confidence,
      entities,
    };
  }

  /**
   * Train the model with user feedback (for future implementation)
   */
  async trainWithFeedback(
    originalInput: string,
    detectedIntent: NLPIntent,
    correctIntent: NLPIntent,
    rating: number
  ): Promise<void> {
    // Store feedback for future model fine-tuning
    logger.info("Storing NLP feedback for future training", "QWEN_NLP", {
      originalInput,
      detectedIntent,
      correctIntent,
      rating,
    });
    
    // In a production system, this would:
    // 1. Store feedback in database
    // 2. Periodically retrain or fine-tune the model
    // 3. Update prompt templates based on patterns
  }

  /**
   * Get model status
   */
  getStatus(): { ready: boolean; model: string } {
    return {
      ready: this.isModelReady,
      model: this.modelName,
    };
  }
}

// Export singleton instance getter
export function getQwenNLPService(): QwenNLPService {
  return QwenNLPService.getInstance();
}