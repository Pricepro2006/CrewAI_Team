/**
 * ConfidenceResponseGenerator - Generates responses with confidence tracking
 * Integrates with OllamaProvider to extract token-level confidence
 */

import { OllamaProvider } from '../../llm/OllamaProvider';
import { ConfidenceExtractor } from './ConfidenceExtractor';
import { ConfidenceContextBuilder } from './ConfidenceContextBuilder';
import { 
  ResponseGenerationResult,
  ConfidenceContext,
  TokenConfidence,
  GenerationMetrics,
  ConfidenceConfig,
  ScoredDocument
} from './types';
import { getConfidenceConfig } from '../../../config/confidence.config';

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseType?: 'factual' | 'explanatory' | 'creative' | 'analytical';
  extractConfidence?: boolean;
  confidenceConfig?: Partial<ConfidenceConfig>;
}

export class ConfidenceResponseGenerator {
  private ollamaProvider: OllamaProvider;
  private confidenceExtractor: ConfidenceExtractor;
  private contextBuilder: ConfidenceContextBuilder;
  private config: ConfidenceConfig;

  constructor(
    ollamaProvider: OllamaProvider,
    config?: Partial<ConfidenceConfig>
  ) {
    this.ollamaProvider = ollamaProvider;
    this.confidenceExtractor = new ConfidenceExtractor();
    this.contextBuilder = new ConfidenceContextBuilder(config);
    this.config = getConfidenceConfig(undefined, config);
  }

  /**
   * Generate a response with confidence tracking
   * @param context Confidence context from retrieval
   * @param options Generation options
   * @returns Response with confidence metrics
   */
  async generateWithConfidence(
    context: ConfidenceContext,
    options: GenerationOptions = {}
  ): Promise<ResponseGenerationResult> {
    // Build confidence-aware prompt
    const prompt = this.buildConfidenceAwarePrompt(context, options);

    // Adjust temperature based on confidence and complexity
    const adjustedTemp = this.adjustTemperature(
      options.temperature || 0.7,
      context.retrievalConfidence,
      context.queryComplexity
    );

    try {
      // Generate with log probabilities if possible
      if (options.extractConfidence !== false) {
        return await this.generateWithLogProbs(prompt, {
          ...options,
          temperature: adjustedTemp
        });
      } else {
        // Standard generation without log probs
        return await this.generateStandard(prompt, {
          ...options,
          temperature: adjustedTemp
        });
      }
    } catch (error) {
      console.error('Response generation failed:', error);
      return this.generateFallbackResponse(context, error);
    }
  }

  /**
   * Generate with log probability extraction
   */
  private async generateWithLogProbs(
    prompt: string,
    options: GenerationOptions
  ): Promise<ResponseGenerationResult> {
    const result = await this.ollamaProvider.generateWithLogProbs(prompt, {
      temperature: options.temperature,
      maxTokens: options.maxTokens || 1000,
      systemPrompt: options.systemPrompt
    });

    let tokenConfidence: TokenConfidence[] = [];
    let aggregatedConfidence = 0.7; // Default

    if (result.tokens && result.logProbs) {
      // Extract token-level confidence
      tokenConfidence = this.confidenceExtractor.extractTokenConfidence(
        result.tokens,
        result.logProbs
      );

      // Calculate aggregated confidence
      aggregatedConfidence = this.confidenceExtractor.aggregateConfidence(tokenConfidence);
    } else {
      // Estimate confidence from text
      aggregatedConfidence = this.confidenceExtractor.estimateConfidenceFromText(result.text);
    }

    // Detect uncertainty markers
    const uncertaintyMarkers = this.confidenceExtractor.detectUncertaintyMarkers(
      result.text,
      tokenConfidence
    );

    // Calculate generation metrics
    const generationMetrics = this.confidenceExtractor.calculateGenerationMetrics(tokenConfidence);

    return {
      response: result.text,
      tokenLevelConfidence: tokenConfidence,
      aggregatedConfidence,
      uncertaintyMarkers,
      generationMetrics
    };
  }

  /**
   * Standard generation without log probs
   */
  private async generateStandard(
    prompt: string,
    options: GenerationOptions
  ): Promise<ResponseGenerationResult> {
    const response = await this.ollamaProvider.generate(prompt, {
      temperature: options.temperature,
      maxTokens: options.maxTokens || 1000,
      systemPrompt: options.systemPrompt
    });

    // Estimate confidence from text
    const estimatedConfidence = this.confidenceExtractor.estimateConfidenceFromText(response);
    const uncertaintyMarkers = this.confidenceExtractor.detectUncertaintyMarkers(response);

    return {
      response,
      tokenLevelConfidence: [],
      aggregatedConfidence: estimatedConfidence,
      uncertaintyMarkers,
      generationMetrics: {
        tokensGenerated: response.split(/\s+/).length, // Rough estimate
        averageConfidence: estimatedConfidence,
        minConfidence: estimatedConfidence,
        maxConfidence: estimatedConfidence,
        uncertaintyRatio: uncertaintyMarkers.length > 0 ? 0.3 : 0.1
      }
    };
  }

  /**
   * Build confidence-aware prompt
   */
  private buildConfidenceAwarePrompt(
    context: ConfidenceContext,
    options: GenerationOptions
  ): string {
    // Build context with confidence indicators
    const formattedContext = this.contextBuilder.buildSpecializedContext(
      context.documents,
      context.query,
      options.responseType || 'explanatory'
    );

    // Add response instructions based on confidence level
    const instructions = this.getResponseInstructions(
      context.retrievalConfidence,
      context.queryComplexity,
      options.responseType
    );

    return `${formattedContext}

${instructions}

Please provide a response to the query based on the sources above.`;
  }

  /**
   * Get response instructions based on confidence
   */
  private getResponseInstructions(
    retrievalConfidence: number,
    queryComplexity: number,
    responseType?: string
  ): string {
    const parts: string[] = ['## RESPONSE INSTRUCTIONS'];

    // Confidence-based instructions
    if (retrievalConfidence >= this.config.overall.high) {
      parts.push('- You have highly relevant sources. Provide a confident, detailed response.');
      parts.push('- Cite specific sources when making claims.');
    } else if (retrievalConfidence >= this.config.overall.medium) {
      parts.push('- Sources are moderately relevant. Provide a balanced response.');
      parts.push('- Acknowledge any gaps in the available information.');
      parts.push('- Use phrases like "based on available information" when appropriate.');
    } else {
      parts.push('- Sources have limited relevance. Be cautious in your response.');
      parts.push('- Clearly indicate uncertainty with phrases like "it appears", "possibly", "may".');
      parts.push('- Suggest what additional information would be helpful.');
    }

    // Complexity-based instructions
    if (queryComplexity > 7) {
      parts.push('- This is a complex query. Break down your response into clear sections.');
      parts.push('- Address each aspect of the query systematically.');
    }

    // Response type instructions
    switch (responseType) {
      case 'factual':
        parts.push('- Focus on facts and specific information from the sources.');
        parts.push('- Avoid speculation or interpretation.');
        break;
      case 'explanatory':
        parts.push('- Provide clear explanations with examples where possible.');
        parts.push('- Structure your response logically.');
        break;
      case 'creative':
        parts.push('- You can be creative while staying grounded in the source material.');
        parts.push('- Clearly distinguish between source information and creative additions.');
        break;
      case 'analytical':
        parts.push('- Analyze the information critically.');
        parts.push('- Consider multiple perspectives if present in the sources.');
        break;
    }

    return parts.join('\n');
  }

  /**
   * Adjust temperature based on confidence
   */
  private adjustTemperature(
    baseTemp: number,
    retrievalConfidence: number,
    queryComplexity: number
  ): number {
    // Lower temperature for low confidence (more conservative)
    if (retrievalConfidence < this.config.overall.medium) {
      baseTemp *= 0.7;
    }
    
    // Lower temperature for high complexity (more focused)
    if (queryComplexity > 7) {
      baseTemp *= 0.8;
    }

    // Ensure temperature is in valid range
    return Math.max(0.1, Math.min(1.0, baseTemp));
  }

  /**
   * Generate fallback response when generation fails
   */
  private generateFallbackResponse(
    context: ConfidenceContext,
    error: any
  ): ResponseGenerationResult {
    const fallbackResponse = this.createFallbackMessage(context, error);

    return {
      response: fallbackResponse,
      tokenLevelConfidence: [],
      aggregatedConfidence: 0.3, // Low confidence for fallback
      uncertaintyMarkers: ['generation_failed', 'fallback_response'],
      generationMetrics: {
        tokensGenerated: fallbackResponse.split(/\s+/).length,
        averageConfidence: 0.3,
        minConfidence: 0.3,
        maxConfidence: 0.3,
        uncertaintyRatio: 1.0
      }
    };
  }

  /**
   * Create fallback message
   */
  private createFallbackMessage(context: ConfidenceContext, error: any): string {
    if (context.documents.length === 0) {
      return `I apologize, but I couldn't find relevant information to answer your query: "${context.query}". 
The search didn't return any matching documents. Please try rephrasing your question or providing more context.`;
    }

    if (context.retrievalConfidence < this.config.overall.low) {
      return `I found some information related to your query: "${context.query}", but the relevance is quite low. 
Based on the limited information available, I cannot provide a confident answer. 
You might want to try a more specific query or check if the topic exists in the knowledge base.`;
    }

    return `I encountered an issue while generating a response to your query: "${context.query}". 
I have found relevant information, but I'm unable to process it properly at the moment. 
Please try again, or rephrase your question for better results.`;
  }

  /**
   * Post-process response to add confidence indicators
   */
  postProcessResponse(
    result: ResponseGenerationResult,
    includeConfidenceIndicators: boolean = false
  ): string {
    if (!includeConfidenceIndicators) {
      return result.response;
    }

    const confidenceLevel = this.getConfidenceLevel(result.aggregatedConfidence);
    const prefix = this.getConfidencePrefix(confidenceLevel);
    
    // Add uncertainty warnings if needed
    if (result.uncertaintyMarkers.length > 0 && result.aggregatedConfidence < this.config.overall.medium) {
      return `${prefix}\n\n${result.response}\n\n⚠️ Note: This response contains some uncertainty. ${result.uncertaintyMarkers.length} uncertainty markers were detected.`;
    }

    return `${prefix}\n\n${result.response}`;
  }

  /**
   * Get confidence level category
   */
  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'very_low' {
    if (score >= this.config.overall.high) return 'high';
    if (score >= this.config.overall.medium) return 'medium';
    if (score >= this.config.overall.low) return 'low';
    return 'very_low';
  }

  /**
   * Get confidence prefix for response
   */
  private getConfidencePrefix(level: 'high' | 'medium' | 'low' | 'very_low'): string {
    switch (level) {
      case 'high':
        return '✅ High Confidence Response:';
      case 'medium':
        return 'ℹ️ Moderate Confidence Response:';
      case 'low':
        return '⚠️ Low Confidence Response:';
      case 'very_low':
        return '❗ Very Low Confidence Response:';
    }
  }

  /**
   * Analyze response quality
   */
  analyzeResponseQuality(result: ResponseGenerationResult): {
    hasUncertainty: boolean;
    uncertaintyLevel: 'none' | 'low' | 'medium' | 'high';
    suggestsHumanReview: boolean;
    qualityScore: number;
  } {
    const uncertaintyCount = result.uncertaintyMarkers.length;
    const uncertaintyRatio = result.generationMetrics.uncertaintyRatio;

    let uncertaintyLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (uncertaintyCount === 0) {
      uncertaintyLevel = 'none';
    } else if (uncertaintyCount <= 2 && uncertaintyRatio < 0.2) {
      uncertaintyLevel = 'low';
    } else if (uncertaintyCount <= 5 && uncertaintyRatio < 0.4) {
      uncertaintyLevel = 'medium';
    } else {
      uncertaintyLevel = 'high';
    }

    const suggestsHumanReview = 
      result.aggregatedConfidence < this.config.generation.review ||
      uncertaintyLevel === 'high';

    // Calculate quality score (0-1)
    const qualityScore = (
      result.aggregatedConfidence * 0.6 +
      (1 - uncertaintyRatio) * 0.4
    );

    return {
      hasUncertainty: uncertaintyCount > 0,
      uncertaintyLevel,
      suggestsHumanReview,
      qualityScore
    };
  }
}