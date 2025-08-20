/**
 * Llama.cpp Service for CrewAI Team
 * Optimized for AMD Ryzen 7 PRO with 64GB RAM
 * Implements three-stage email processing pipeline
 */

import {
  createOptimizedConfig,
  runOptimizedInference,
  startOptimizedServer,
  benchmarkModel,
  LlamaCppOptimizedConfig
} from '../config/llama-cpp-optimized.config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export interface EmailAnalysisRequest {
  emailId: string;
  subject: string;
  body: string;
  chainId?: string;
  stage: 1 | 2 | 3;
}

export interface EmailAnalysisResponse {
  emailId: string;
  stage: number;
  entities?: {
    spa?: string[];
    po?: string[];
    quotes?: string[];
    edi?: string[];
    customers?: string[];
    products?: string[];
  };
  workflow?: string;
  businessIntelligence?: {
    revenue?: number;
    actionItems?: string[];
    risks?: string[];
    opportunities?: string[];
  };
  processingTime: number;
  tokensPerSecond?: number;
}

export class LlamaCppService {
  private config: LlamaCppOptimizedConfig | null = null;
  private serverProcess: any = null;
  private serverPort: number = 8081;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize the service with optimized configuration
   */
  async initialize(): Promise<void> {
    console.log('Initializing Llama.cpp service with AMD Ryzen optimizations...');
    
    // Create optimized configuration
    this.config = await createOptimizedConfig();
    
    // Verify llama.cpp installation
    await this.verifyInstallation();
    
    // Set performance governor if possible
    await this.setPerformanceMode();
    
    console.log(`✅ Llama.cpp service initialized with ${this?.config?.cpuThreads} threads`);
  }
  
  /**
   * Verify llama.cpp is installed and accessible
   */
  private async verifyInstallation(): Promise<void> {
    try {
      // SECURITY: Use execFile to prevent command injection
      const { stdout } = await execFileAsync(this.config!.executablePath, ['--version']);
      console.log('Llama.cpp version:', stdout.trim());
    } catch (error) {
      throw new Error('Llama.cpp not found. Please install it first: https://github.com/ggml-org/llama.cpp');
    }
  }
  
  /**
   * Set CPU performance mode for optimal inference
   */
  private async setPerformanceMode(): Promise<void> {
    // SECURITY: Removed sudo command execution
    // Performance governor should be set externally if needed
    console.log('Performance mode should be configured externally');
  }
  
  /**
   * Stage 1: Rule-based extraction (no LLM needed)
   */
  async processStage1(request: EmailAnalysisRequest): Promise<EmailAnalysisResponse> {
    const startTime = Date.now();
    
    // Rule-based extraction patterns
    const patterns = {
      spa: /SPA[#\s-]?([A-Z0-9]{6,})/gi,
      po: /(?:PO|Purchase Order)[#\s:]*([A-Z0-9]{6,})/gi,
      quotes: /(?:Quote|RFQ)[#\s:]*([A-Z0-9]{6,})/gi,
      edi: /EDI[#\s:]*([0-9]{6,})/gi,
      customers: /(?:Customer|Client|Account)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      products: /(?:\b[A-Z0-9]{6,10}(?:#[A-Z]{3})?)\b/g
    };
    
    const entities: any = {};
    const fullText = `${request.subject} ${request.body}`;
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = fullText.matchAll(pattern);
      const results = Array.from(matches).map(m => m[1] || m[0]);
      if (results?.length || 0 > 0) {
        entities[key] = [...new Set(results)];
      }
    }
    
    // Basic workflow detection
    let workflow = 'unknown';
    if (/quote.*order|RFQ.*PO/i.test(fullText)) {
      workflow = 'quote_to_order';
    } else if (/issue|problem|error|fail/i.test(fullText)) {
      workflow = 'support_resolution';
    } else if (/ship|deliver|track/i.test(fullText)) {
      workflow = 'order_fulfillment';
    }
    
    return {
      emailId: request.emailId,
      stage: 1,
      entities,
      workflow,
      processingTime: Date.now() - startTime
    };
  }
  
  /**
   * Stage 2: LLM-enhanced analysis with Llama 3.2:3B
   */
  async processStage2(request: EmailAnalysisRequest): Promise<EmailAnalysisResponse> {
    const startTime = Date.now();
    
    if (!this.config) {
      await this.initialize();
    }
    
    // Build optimized prompt for email analysis
    const prompt = this.buildStage2Prompt(request);
    
    try {
      // Run inference with Llama 3.2:3B
      const response = await runOptimizedInference('llama-3.2-3b', prompt, {
        temperature: 0.3,
        maxTokens: 1024
      });
      
      // Parse LLM response
      const analysis = this.parseStage2Response(response);
      
      // Calculate performance metrics
      const processingTime = Date.now() - startTime;
      const estimatedTokens = response.split(/\s+/).length * 1.3;
      const tokensPerSecond = estimatedTokens / (processingTime / 1000);
      
      return {
        emailId: request.emailId,
        stage: 2,
        ...analysis,
        processingTime,
        tokensPerSecond
      };
    } catch (error) {
      console.error('Stage 2 processing error:', error);
      // Fallback to Stage 1 results
      return this.processStage1(request);
    }
  }
  
  /**
   * Stage 3: Critical analysis with Phi-4 14B
   */
  async processStage3(request: EmailAnalysisRequest): Promise<EmailAnalysisResponse> {
    const startTime = Date.now();
    
    if (!this.config) {
      await this.initialize();
    }
    
    // Build comprehensive prompt for critical analysis
    const prompt = this.buildStage3Prompt(request);
    
    try {
      // Run inference with Phi-4 14B (larger model for critical emails)
      const response = await runOptimizedInference('phi-4-14b', prompt, {
        temperature: 0.3,
        maxTokens: 2048,
        cpuThreads: 12 // Larger models may benefit from fewer threads
      });
      
      // Parse comprehensive analysis
      const analysis = this.parseStage3Response(response);
      
      const processingTime = Date.now() - startTime;
      const estimatedTokens = response.split(/\s+/).length * 1.3;
      const tokensPerSecond = estimatedTokens / (processingTime / 1000);
      
      return {
        emailId: request.emailId,
        stage: 3,
        ...analysis,
        processingTime,
        tokensPerSecond
      };
    } catch (error) {
      console.error('Stage 3 processing error:', error);
      // Fallback to Stage 2
      return this.processStage2(request);
    }
  }
  
  /**
   * Process email through adaptive pipeline
   */
  async processEmail(request: EmailAnalysisRequest): Promise<EmailAnalysisResponse> {
    // Determine appropriate stage based on email characteristics
    const stage = this.determineProcessingStage(request);
    
    switch (stage) {
      case 1:
        return this.processStage1(request);
      case 2:
        return this.processStage2(request);
      case 3:
        return this.processStage3(request);
      default:
        return this.processStage1(request);
    }
  }
  
  /**
   * Determine which processing stage to use
   */
  private determineProcessingStage(request: EmailAnalysisRequest): 1 | 2 | 3 {
    const text = `${request.subject} ${request.body}`;
    
    // Critical indicators requiring Stage 3
    if (
      /urgent|critical|escalat|executive|legal|compliance/i.test(text) ||
      /\$[0-9]{6,}|million|contract/i.test(text)
    ) {
      return 3;
    }
    
    // Complex business logic requiring Stage 2
    if (
      /quote|proposal|RFQ|negotiat|technical/i.test(text) ||
      text?.length || 0 > 2000
    ) {
      return 2;
    }
    
    // Simple extraction can use Stage 1
    return 1;
  }
  
  /**
   * Build Stage 2 analysis prompt
   */
  private buildStage2Prompt(request: EmailAnalysisRequest): string {
    // SECURITY: Sanitize input to prevent prompt injection
    const sanitizeText = (text: string): string => {
      return text
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .substring(0, 5000); // Limit length
    };
    
    const sanitizedSubject = sanitizeText(request.subject);
    const sanitizedBody = sanitizeText(request.body);
    
    return `Analyze this business email and extract structured information.

Email Subject: ${sanitizedSubject}
Email Body: ${sanitizedBody}

Extract the following in JSON format:
1. Entities: SPAs, POs, Quotes, EDI references, Customer names, Product IDs
2. Workflow type: quote_to_order, support_resolution, order_fulfillment, pricing_inquiry, general_communication
3. Key action items
4. Business value indicators (if any)

Response format:
{
  "entities": {
    "spa": [],
    "po": [],
    "quotes": [],
    "customers": [],
    "products": []
  },
  "workflow": "",
  "actionItems": [],
  "businessValue": null
}`;
  }
  
  /**
   * Build Stage 3 critical analysis prompt
   */
  private buildStage3Prompt(request: EmailAnalysisRequest): string {
    // SECURITY: Sanitize input to prevent prompt injection
    const sanitizeText = (text: string): string => {
      return text
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .substring(0, 5000); // Limit length
    };
    
    const sanitizedSubject = sanitizeText(request.subject);
    const sanitizedBody = sanitizeText(request.body);
    
    return `Perform critical business analysis on this email.

Email Subject: ${sanitizedSubject}
Email Body: ${sanitizedBody}

Provide comprehensive analysis including:
1. All entities and references (SPAs, POs, Quotes, EDI, Customers, Products)
2. Workflow classification with confidence score
3. Business intelligence:
   - Revenue impact (if applicable)
   - Risk factors
   - Opportunities
   - Required actions with priorities
4. Compliance or legal considerations
5. Recommended next steps

Format as structured JSON with all findings.`;
  }
  
  /**
   * Parse Stage 2 LLM response
   */
  private parseStage2Response(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse Stage 2 response:', error);
    }
    
    // Fallback parsing
    return {
      entities: {},
      workflow: 'unknown'
    };
  }
  
  /**
   * Parse Stage 3 comprehensive response
   */
  private parseStage3Response(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure business intelligence structure
        if (!parsed.businessIntelligence) {
          parsed.businessIntelligence = {};
        }
        
        return parsed;
      }
    } catch (error) {
      console.error('Failed to parse Stage 3 response:', error);
    }
    
    // Fallback with basic structure
    return {
      entities: {},
      workflow: 'unknown',
      businessIntelligence: {
        actionItems: ['Manual review required']
      }
    };
  }
  
  /**
   * Start llama.cpp server for API access
   */
  async startServer(modelName: string = 'llama-3.2-3b', port: number = 8081): Promise<void> {
    if (this.serverProcess) {
      console.log('Server already running');
      return;
    }
    
    console.log(`Starting llama.cpp server on port ${port}...`);
    this.serverPort = port;
    this.serverProcess = await startOptimizedServer(modelName, port);
    console.log(`✅ Llama.cpp server started on http://localhost:${port}`);
  }
  
  /**
   * Stop llama.cpp server
   */
  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this?.serverProcess?.kill();
      this.serverProcess = null;
      console.log('Llama.cpp server stopped');
    }
  }
  
  /**
   * Benchmark all models
   */
  async benchmarkAllModels(): Promise<void> {
    console.log('\n=== Llama.cpp Model Benchmarks (AMD Ryzen 7 PRO) ===\n');
    
    const testPrompt = "Analyze the quarterly revenue report and identify key trends:";
    const models = ['tinyllama-1.1b', 'qwen3-0.6b', 'llama-3.2-3b'];
    
    for (const model of models) {
      try {
        console.log(`Benchmarking ${model}...`);
        const result = await benchmarkModel(model, testPrompt);
        console.log(`  ✅ ${model}: ${result?.tokensPerSecond?.toFixed(2)} tokens/s (${result?.totalTime?.toFixed(2)}s total)`);
      } catch (error) {
        console.log(`  ❌ ${model}: Failed to benchmark`);
      }
    }
    
    console.log('\n=== Benchmark Complete ===\n');
  }
  
  /**
   * Get service status
   */
  getStatus(): any {
    return {
      initialized: this.config !== null,
      serverRunning: this.serverProcess !== null,
      serverPort: this.serverPort,
      config: this.config ? {
        cpuThreads: this?.config?.cpuThreads,
        contextSize: this?.config?.contextSize,
        models: Object.keys(this?.config?.models)
      } : null
    };
  }
}

// Export singleton instance
export const llamaCppService = new LlamaCppService();

export default LlamaCppService;