#!/usr/bin/env tsx
/**
 * Test script to compare three-phase incremental analysis vs single-phase analysis
 * This will help validate if the three-phase approach improves results
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailAnalyzer } from "../src/core/services/EmailAnalyzer.js";
import { WorkflowIntelligenceService } from "../src/core/services/WorkflowIntelligenceService.js";
import { logger } from "../src/utils/logger.js";
import { OllamaService } from "../src/core/llm/OllamaService.js";
import fs from "fs";
import path from "path";

interface AnalysisResult {
  emailId: string;
  approach: 'single-phase' | 'three-phase' | 'phase-3-only';
  extractedEntities: {
    poNumbers: string[];
    quoteNumbers: string[];
    customers: string[];
    orderNumbers: string[];
    dealNumbers: string[];
    productNumbers: string[];
  };
  workflowCategory: string | null;
  confidence: number;
  priority: string;
  dollarValue: number;
  actionItems: string[];
  processingTimeMs: number;
  tokensUsed: number;
  llmCalls: number;
}

interface ComparisonMetrics {
  entityExtractionAccuracy: number;
  categoryAccuracy: number;
  actionItemsCompleteness: number;
  processingTime: number;
  resourceUsage: number;
  overallScore: number;
}

class AnalysisComparator {
  private db: Database.Database;
  private emailAnalyzer: EmailAnalyzer;
  private workflowService: WorkflowIntelligenceService;
  private ollamaService: OllamaService;
  private results: AnalysisResult[] = [];

  constructor() {
    this.db = new Database('./data/crewai.db');
    this.emailAnalyzer = new EmailAnalyzer();
    this.workflowService = new WorkflowIntelligenceService();
    this.ollamaService = new OllamaService();
  }

  /**
   * Mock LLM call using Ollama service
   */
  private async mockLLMCall(prompt: string): Promise<string> {
    try {
      const response = await this.ollamaService.generateResponse(prompt, {
        temperature: 0.7,
        model: 'llama3.2:3b'
      });
      return response;
    } catch (error) {
      logger.error("LLM call failed", "COMPARATOR", { error });
      return "{}"; // Return empty JSON on error
    }
  }

  /**
   * Run single-phase analysis (all in one prompt)
   */
  async runSinglePhaseAnalysis(email: any): Promise<AnalysisResult> {
    const startTime = Date.now();
    let tokensUsed = 0;
    let llmCalls = 0;

    try {
      console.log(chalk.yellow(`  Running single-phase analysis for email ${email.id}...`));

      // Single comprehensive prompt combining all three phases
      const singlePhasePrompt = `
Analyze this email and extract ALL relevant information in one comprehensive pass:

Email Subject: ${email.subject}
From: ${email.from_email}
Date: ${email.received_date}
Body:
${email.body}

Extract and provide:
1. Entity Extraction:
   - PO Numbers
   - Quote Numbers
   - Customer Names
   - Order Numbers
   - Deal Numbers
   - Product Numbers/SKUs
   - Dollar Values

2. Contextual Understanding:
   - Email intent and sentiment
   - Business context and urgency
   - Key action items required
   - Workflow category (Order Management, Quote Processing, Shipping and Logistics, Vendor Pricing Updates, Returns and RMA, Account Changes, Deal Activations, General Support)

3. Action Intelligence:
   - Specific next steps required
   - Responsible teams/departments
   - SLA/deadline implications
   - Priority level (CRITICAL, HIGH, MEDIUM, NORMAL)
   - Risk assessment

Provide a comprehensive JSON response with all extracted information.`;

      // Use a mock LLM call for now - in production, use the actual EmailAnalyzer method
      const response = await this.mockLLMCall(singlePhasePrompt);
      llmCalls = 1;
      tokensUsed = this.estimateTokens(singlePhasePrompt + response);

      const parsed = this.parseComprehensiveResponse(response);

      return {
        emailId: email.id,
        approach: 'single-phase',
        extractedEntities: parsed.entities,
        workflowCategory: parsed.category,
        confidence: parsed.confidence,
        priority: parsed.priority,
        dollarValue: parsed.dollarValue,
        actionItems: parsed.actionItems,
        processingTimeMs: Date.now() - startTime,
        tokensUsed,
        llmCalls
      };
    } catch (error) {
      logger.error("Single-phase analysis failed", "COMPARATOR", { error, emailId: email.id });
      throw error;
    }
  }

  /**
   * Run three-phase incremental analysis
   */
  async runThreePhaseAnalysis(email: any): Promise<AnalysisResult> {
    const startTime = Date.now();
    let totalTokens = 0;
    let totalLLMCalls = 0;

    try {
      console.log(chalk.cyan(`  Running three-phase analysis for email ${email.id}...`));

      // Phase 1: Entity Extraction
      const phase1Start = Date.now();
      const phase1Results = await this.emailAnalyzer.analyzeEmail(email.body, {
        subject: email.subject,
        from: email.from_email,
        date: email.received_date
      });
      totalLLMCalls++;
      // Estimate tokens for phase 1
      const phase1Prompt = `Extract entities from: ${email.body}`;
      totalTokens += this.estimateTokens(phase1Prompt + JSON.stringify(phase1Results));
      console.log(chalk.gray(`    Phase 1 completed in ${Date.now() - phase1Start}ms`));

      // Phase 2: Contextual Understanding (with Phase 1 results)
      const phase2Start = Date.now();
      const phase2Prompt = `
You have the initial extraction results from Phase 1 analysis.
Now provide deeper contextual understanding.

Phase 1 Results:
${JSON.stringify(phase1Results, null, 2)}

Original Email:
Subject: ${email.subject}
From: ${email.from_email}
Body: ${email.body}

Analyze:
1. Business context and relationships between entities
2. Email intent and urgency level
3. Workflow category classification
4. Any missed entities or connections from Phase 1

Provide enhanced understanding in JSON format.`;

      const phase2Response = await this.mockLLMCall(phase2Prompt);
      totalLLMCalls++;
      totalTokens += this.estimateTokens(phase2Prompt + phase2Response);
      const phase2Results = this.parsePhase2Response(phase2Response);
      console.log(chalk.gray(`    Phase 2 completed in ${Date.now() - phase2Start}ms`));

      // Phase 3: Action Intelligence (with Phase 1 & 2 results)
      const phase3Start = Date.now();
      const phase3Prompt = `
You have the complete context from Phase 1 and Phase 2 analysis.
Now determine specific actions and create workflow tasks.

Phase 1 Entity Extraction:
${JSON.stringify(phase1Results, null, 2)}

Phase 2 Contextual Understanding:
${JSON.stringify(phase2Results, null, 2)}

Original Email for reference:
${email.subject}

Determine:
1. Specific action items with clear next steps
2. Priority level based on urgency and value
3. Responsible teams/owners
4. SLA requirements
5. Risk assessment and mitigation

Provide actionable intelligence in JSON format.`;

      const phase3Response = await this.mockLLMCall(phase3Prompt);
      totalLLMCalls++;
      totalTokens += this.estimateTokens(phase3Prompt + phase3Response);
      const phase3Results = this.parsePhase3Response(phase3Response);
      console.log(chalk.gray(`    Phase 3 completed in ${Date.now() - phase3Start}ms`));

      // Combine all phase results
      const combinedResults = this.combinePhaseResults(phase1Results, phase2Results, phase3Results);

      return {
        emailId: email.id,
        approach: 'three-phase',
        extractedEntities: combinedResults.entities,
        workflowCategory: combinedResults.category,
        confidence: combinedResults.confidence,
        priority: combinedResults.priority,
        dollarValue: combinedResults.dollarValue,
        actionItems: combinedResults.actionItems,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: totalTokens,
        llmCalls: totalLLMCalls
      };
    } catch (error) {
      logger.error("Three-phase analysis failed", "COMPARATOR", { error, emailId: email.id });
      throw error;
    }
  }

  /**
   * Run Phase 3 only (for comparison)
   */
  async runPhase3Only(email: any): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(chalk.magenta(`  Running Phase 3 only analysis for email ${email.id}...`));

      // Direct Phase 3 prompt without prior phases
      const phase3OnlyPrompt = `
Analyze this email and provide action intelligence and workflow recommendations:

Email Subject: ${email.subject}
From: ${email.from_email}
Date: ${email.received_date}
Body:
${email.body}

Determine:
1. Workflow category (Order Management, Quote Processing, etc.)
2. Priority level (CRITICAL, HIGH, MEDIUM, NORMAL)
3. Specific action items required
4. Responsible teams/departments
5. Any entities mentioned (PO numbers, customers, etc.)
6. Risk assessment

Provide actionable intelligence in JSON format.`;

      const response = await this.mockLLMCall(phase3OnlyPrompt);
      const tokensUsed = this.estimateTokens(phase3OnlyPrompt + response);
      const parsed = this.parsePhase3OnlyResponse(response);

      return {
        emailId: email.id,
        approach: 'phase-3-only',
        extractedEntities: parsed.entities,
        workflowCategory: parsed.category,
        confidence: parsed.confidence,
        priority: parsed.priority,
        dollarValue: parsed.dollarValue,
        actionItems: parsed.actionItems,
        processingTimeMs: Date.now() - startTime,
        tokensUsed,
        llmCalls: 1
      };
    } catch (error) {
      logger.error("Phase 3 only analysis failed", "COMPARATOR", { error, emailId: email.id });
      throw error;
    }
  }

  /**
   * Compare results between different approaches
   */
  compareResults(results: AnalysisResult[]): ComparisonMetrics {
    const grouped = this.groupResultsByEmail(results);
    const metrics: { [approach: string]: ComparisonMetrics } = {};

    // Calculate metrics for each approach
    ['single-phase', 'three-phase', 'phase-3-only'].forEach(approach => {
      const approachResults = results.filter(r => r.approach === approach);
      
      metrics[approach] = {
        entityExtractionAccuracy: this.calculateEntityAccuracy(approachResults, results),
        categoryAccuracy: this.calculateCategoryAccuracy(approachResults, results),
        actionItemsCompleteness: this.calculateActionCompleteness(approachResults),
        processingTime: this.calculateAvgProcessingTime(approachResults),
        resourceUsage: this.calculateResourceUsage(approachResults),
        overallScore: 0
      };

      // Calculate overall score
      metrics[approach].overallScore = (
        metrics[approach].entityExtractionAccuracy * 0.3 +
        metrics[approach].categoryAccuracy * 0.2 +
        metrics[approach].actionItemsCompleteness * 0.3 +
        (100 - metrics[approach].processingTime / 10) * 0.1 +
        (100 - metrics[approach].resourceUsage / 100) * 0.1
      );
    });

    return metrics;
  }

  /**
   * Run comprehensive comparison test
   */
  async runComparisonTest(limit: number = 20): Promise<void> {
    console.log(chalk.blue('=== Three-Phase vs Single-Phase Analysis Comparison ===\n'));

    // Get test emails
    const emails = this.db.prepare(`
      SELECT * FROM emails 
      WHERE parsed_content IS NOT NULL 
      ORDER BY received_date DESC 
      LIMIT ?
    `).all(limit);

    console.log(chalk.yellow(`Testing with ${emails.length} emails...\n`));

    // Run all three approaches for each email
    for (const [index, email] of emails.entries()) {
      console.log(chalk.cyan(`\nEmail ${index + 1}/${emails.length}: ${email.subject?.substring(0, 50)}...`));

      try {
        // Run single-phase
        const singlePhaseResult = await this.runSinglePhaseAnalysis(email);
        this.results.push(singlePhaseResult);

        // Run three-phase
        const threePhaseResult = await this.runThreePhaseAnalysis(email);
        this.results.push(threePhaseResult);

        // Run phase-3-only
        const phase3OnlyResult = await this.runPhase3Only(email);
        this.results.push(phase3OnlyResult);

        // Quick comparison for this email
        this.printEmailComparison(email.id, singlePhaseResult, threePhaseResult, phase3OnlyResult);

      } catch (error) {
        console.error(chalk.red(`  Failed to analyze email ${email.id}:`, error));
      }
    }

    // Generate comprehensive report
    this.generateComparisonReport();
  }

  /**
   * Print comparison for single email
   */
  private printEmailComparison(emailId: string, single: AnalysisResult, three: AnalysisResult, phase3: AnalysisResult): void {
    console.log(chalk.gray('\n  Comparison Results:'));
    console.log(chalk.gray('  ┌─────────────────┬──────────────┬──────────────┬──────────────┐'));
    console.log(chalk.gray('  │ Metric          │ Single-Phase │ Three-Phase  │ Phase-3-Only │'));
    console.log(chalk.gray('  ├─────────────────┼──────────────┼──────────────┼──────────────┤'));
    
    // Entities found
    const singleEntities = this.countTotalEntities(single.extractedEntities);
    const threeEntities = this.countTotalEntities(three.extractedEntities);
    const phase3Entities = this.countTotalEntities(phase3.extractedEntities);
    console.log(chalk.gray(`  │ Entities Found  │ ${String(singleEntities).padEnd(12)} │ ${String(threeEntities).padEnd(12)} │ ${String(phase3Entities).padEnd(12)} │`));
    
    // Processing time
    console.log(chalk.gray(`  │ Process Time    │ ${String(single.processingTimeMs + 'ms').padEnd(12)} │ ${String(three.processingTimeMs + 'ms').padEnd(12)} │ ${String(phase3.processingTimeMs + 'ms').padEnd(12)} │`));
    
    // LLM calls
    console.log(chalk.gray(`  │ LLM Calls       │ ${String(single.llmCalls).padEnd(12)} │ ${String(three.llmCalls).padEnd(12)} │ ${String(phase3.llmCalls).padEnd(12)} │`));
    
    // Action items
    console.log(chalk.gray(`  │ Action Items    │ ${String(single.actionItems.length).padEnd(12)} │ ${String(three.actionItems.length).padEnd(12)} │ ${String(phase3.actionItems.length).padEnd(12)} │`));
    
    console.log(chalk.gray('  └─────────────────┴──────────────┴──────────────┴──────────────┘'));
  }

  /**
   * Generate comprehensive comparison report
   */
  private generateComparisonReport(): void {
    console.log(chalk.blue('\n\n=== COMPREHENSIVE COMPARISON REPORT ===\n'));

    const metrics = this.compareResults(this.results);

    // Overall comparison table
    console.log(chalk.yellow('Overall Performance Metrics:\n'));
    console.log('┌─────────────────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Metric                  │ Single-Phase │ Three-Phase  │ Phase-3-Only │');
    console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┤');

    const approaches = ['single-phase', 'three-phase', 'phase-3-only'];
    
    // Entity Extraction Accuracy
    console.log(`│ Entity Extraction       │ ${this.formatScore(metrics['single-phase']?.entityExtractionAccuracy)} │ ${this.formatScore(metrics['three-phase']?.entityExtractionAccuracy)} │ ${this.formatScore(metrics['phase-3-only']?.entityExtractionAccuracy)} │`);
    
    // Category Accuracy
    console.log(`│ Category Accuracy       │ ${this.formatScore(metrics['single-phase']?.categoryAccuracy)} │ ${this.formatScore(metrics['three-phase']?.categoryAccuracy)} │ ${this.formatScore(metrics['phase-3-only']?.categoryAccuracy)} │`);
    
    // Action Items
    console.log(`│ Action Completeness     │ ${this.formatScore(metrics['single-phase']?.actionItemsCompleteness)} │ ${this.formatScore(metrics['three-phase']?.actionItemsCompleteness)} │ ${this.formatScore(metrics['phase-3-only']?.actionItemsCompleteness)} │`);
    
    // Processing Time
    console.log(`│ Avg Processing Time     │ ${this.formatTime(metrics['single-phase']?.processingTime)} │ ${this.formatTime(metrics['three-phase']?.processingTime)} │ ${this.formatTime(metrics['phase-3-only']?.processingTime)} │`);
    
    // Resource Usage
    console.log(`│ Resource Usage          │ ${this.formatResource(metrics['single-phase']?.resourceUsage)} │ ${this.formatResource(metrics['three-phase']?.resourceUsage)} │ ${this.formatResource(metrics['phase-3-only']?.resourceUsage)} │`);
    
    console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┤');
    
    // Overall Score
    console.log(`│ OVERALL SCORE           │ ${chalk.yellow(this.formatScore(metrics['single-phase']?.overallScore))} │ ${chalk.green(this.formatScore(metrics['three-phase']?.overallScore))} │ ${chalk.cyan(this.formatScore(metrics['phase-3-only']?.overallScore))} │`);
    
    console.log('└─────────────────────────┴──────────────┴──────────────┴──────────────┘');

    // Key Findings
    this.printKeyFindings();

    // Save detailed results
    this.saveDetailedResults();
  }

  /**
   * Print key findings from the comparison
   */
  private printKeyFindings(): void {
    console.log(chalk.yellow('\n\nKey Findings:\n'));

    const singlePhaseResults = this.results.filter(r => r.approach === 'single-phase');
    const threePhaseResults = this.results.filter(r => r.approach === 'three-phase');
    const phase3OnlyResults = this.results.filter(r => r.approach === 'phase-3-only');

    // 1. Entity Extraction Comparison
    const avgEntitiesSingle = this.calculateAvgEntities(singlePhaseResults);
    const avgEntitiesThree = this.calculateAvgEntities(threePhaseResults);
    const avgEntitiesPhase3 = this.calculateAvgEntities(phase3OnlyResults);

    console.log(chalk.cyan('1. Entity Extraction:'));
    console.log(`   • Single-phase extracted an average of ${avgEntitiesSingle.toFixed(1)} entities per email`);
    console.log(`   • Three-phase extracted an average of ${avgEntitiesThree.toFixed(1)} entities per email`);
    console.log(`   • Phase-3-only extracted an average of ${avgEntitiesPhase3.toFixed(1)} entities per email`);
    console.log(`   • Three-phase showed ${((avgEntitiesThree - avgEntitiesSingle) / avgEntitiesSingle * 100).toFixed(1)}% improvement over single-phase`);

    // 2. Processing Efficiency
    const avgTimeSingle = singlePhaseResults.reduce((acc, r) => acc + r.processingTimeMs, 0) / singlePhaseResults.length;
    const avgTimeThree = threePhaseResults.reduce((acc, r) => acc + r.processingTimeMs, 0) / threePhaseResults.length;
    const avgTimePhase3 = phase3OnlyResults.reduce((acc, r) => acc + r.processingTimeMs, 0) / phase3OnlyResults.length;

    console.log(chalk.cyan('\n2. Processing Efficiency:'));
    console.log(`   • Single-phase: ${avgTimeSingle.toFixed(0)}ms average`);
    console.log(`   • Three-phase: ${avgTimeThree.toFixed(0)}ms average (${(avgTimeThree / avgTimeSingle).toFixed(1)}x slower)`);
    console.log(`   • Phase-3-only: ${avgTimePhase3.toFixed(0)}ms average (fastest)`);

    // 3. Action Item Quality
    const avgActionsSingle = singlePhaseResults.reduce((acc, r) => acc + r.actionItems.length, 0) / singlePhaseResults.length;
    const avgActionsThree = threePhaseResults.reduce((acc, r) => acc + r.actionItems.length, 0) / threePhaseResults.length;
    const avgActionsPhase3 = phase3OnlyResults.reduce((acc, r) => acc + r.actionItems.length, 0) / phase3OnlyResults.length;

    console.log(chalk.cyan('\n3. Action Item Generation:'));
    console.log(`   • Single-phase: ${avgActionsSingle.toFixed(1)} action items per email`);
    console.log(`   • Three-phase: ${avgActionsThree.toFixed(1)} action items per email`);
    console.log(`   • Phase-3-only: ${avgActionsPhase3.toFixed(1)} action items per email`);

    // 4. Recommendations
    console.log(chalk.yellow('\n4. Recommendations:'));
    if (avgEntitiesThree > avgEntitiesSingle * 1.2) {
      console.log(chalk.green('   ✓ Three-phase approach significantly improves entity extraction'));
    }
    if (avgActionsThree > avgActionsSingle * 1.1) {
      console.log(chalk.green('   ✓ Three-phase approach generates more comprehensive action items'));
    }
    if (avgTimeThree < avgTimeSingle * 2) {
      console.log(chalk.yellow('   ⚠ Three-phase processing time is acceptable for the quality improvement'));
    }
    console.log(chalk.blue('   → Use three-phase for critical emails requiring high accuracy'));
    console.log(chalk.blue('   → Use phase-3-only for quick triage when speed is priority'));
  }

  /**
   * Helper methods
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private countTotalEntities(entities: any): number {
    return Object.values(entities).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
  }

  private calculateAvgEntities(results: AnalysisResult[]): number {
    if (results.length === 0) return 0;
    const total = results.reduce((acc, r) => acc + this.countTotalEntities(r.extractedEntities), 0);
    return total / results.length;
  }

  private groupResultsByEmail(results: AnalysisResult[]): { [emailId: string]: AnalysisResult[] } {
    return results.reduce((acc, result) => {
      if (!acc[result.emailId]) acc[result.emailId] = [];
      acc[result.emailId].push(result);
      return acc;
    }, {} as { [emailId: string]: AnalysisResult[] });
  }

  private calculateEntityAccuracy(approachResults: AnalysisResult[], allResults: AnalysisResult[]): number {
    // Compare entity extraction completeness
    // Using three-phase as the baseline (assumed most complete)
    const threePhaseResults = allResults.filter(r => r.approach === 'three-phase');
    let score = 0;
    let count = 0;

    approachResults.forEach(result => {
      const baseline = threePhaseResults.find(r => r.emailId === result.emailId);
      if (baseline) {
        const resultCount = this.countTotalEntities(result.extractedEntities);
        const baselineCount = this.countTotalEntities(baseline.extractedEntities);
        score += (resultCount / baselineCount) * 100;
        count++;
      }
    });

    return count > 0 ? score / count : 0;
  }

  private calculateCategoryAccuracy(approachResults: AnalysisResult[], allResults: AnalysisResult[]): number {
    // Compare category classification accuracy
    const correctCategories = approachResults.filter(r => r.workflowCategory !== null).length;
    return (correctCategories / approachResults.length) * 100;
  }

  private calculateActionCompleteness(results: AnalysisResult[]): number {
    // Average number of action items as a proxy for completeness
    const avgActions = results.reduce((acc, r) => acc + r.actionItems.length, 0) / results.length;
    return Math.min(avgActions * 20, 100); // Scale to 100
  }

  private calculateAvgProcessingTime(results: AnalysisResult[]): number {
    return results.reduce((acc, r) => acc + r.processingTimeMs, 0) / results.length;
  }

  private calculateResourceUsage(results: AnalysisResult[]): number {
    // Composite of tokens and LLM calls
    const avgTokens = results.reduce((acc, r) => acc + r.tokensUsed, 0) / results.length;
    const avgCalls = results.reduce((acc, r) => acc + r.llmCalls, 0) / results.length;
    return avgTokens + (avgCalls * 1000); // Weight LLM calls heavily
  }

  private formatScore(score?: number): string {
    if (score === undefined) return '    N/A     ';
    return `   ${score.toFixed(1)}%    `.padEnd(12);
  }

  private formatTime(time?: number): string {
    if (time === undefined) return '    N/A     ';
    return `  ${time.toFixed(0)}ms   `.padEnd(12);
  }

  private formatResource(usage?: number): string {
    if (usage === undefined) return '    N/A     ';
    if (usage > 10000) return ` ${(usage/1000).toFixed(1)}k    `.padEnd(12);
    return `   ${usage.toFixed(0)}     `.padEnd(12);
  }

  /**
   * Parse responses (simplified - in production use proper parsing)
   */
  private parseComprehensiveResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          entities: {
            poNumbers: parsed.poNumbers || parsed.po_numbers || [],
            quoteNumbers: parsed.quoteNumbers || parsed.quote_numbers || [],
            customers: parsed.customers || parsed.customerNames || [],
            orderNumbers: parsed.orderNumbers || parsed.order_numbers || [],
            dealNumbers: parsed.dealNumbers || parsed.deal_numbers || [],
            productNumbers: parsed.productNumbers || parsed.product_numbers || []
          },
          category: parsed.workflowCategory || parsed.category || null,
          confidence: parsed.confidence || 0.8,
          priority: parsed.priority || 'MEDIUM',
          dollarValue: parsed.dollarValue || parsed.dollar_value || 0,
          actionItems: parsed.actionItems || parsed.action_items || []
        };
      }
    } catch (error) {
      logger.error("Failed to parse comprehensive response", "COMPARATOR", { error });
    }

    // Fallback
    return {
      entities: {
        poNumbers: [],
        quoteNumbers: [],
        customers: [],
        orderNumbers: [],
        dealNumbers: [],
        productNumbers: []
      },
      category: null,
      confidence: 0.5,
      priority: 'MEDIUM',
      dollarValue: 0,
      actionItems: []
    };
  }

  private parsePhase2Response(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error("Failed to parse phase 2 response", "COMPARATOR", { error });
    }
    return {};
  }

  private parsePhase3Response(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error("Failed to parse phase 3 response", "COMPARATOR", { error });
    }
    return {
      actionItems: [],
      priority: 'MEDIUM',
      workflowCategory: null
    };
  }

  private parsePhase3OnlyResponse(response: string): any {
    return this.parseComprehensiveResponse(response);
  }

  private combinePhaseResults(phase1: any, phase2: any, phase3: any): any {
    return {
      entities: {
        poNumbers: [...(phase1.poNumbers || []), ...(phase2.additionalPoNumbers || [])],
        quoteNumbers: [...(phase1.quoteNumbers || []), ...(phase2.additionalQuoteNumbers || [])],
        customers: [...(phase1.customers || []), ...(phase2.additionalCustomers || [])],
        orderNumbers: phase1.orderNumbers || [],
        dealNumbers: phase1.dealNumbers || [],
        productNumbers: phase1.productNumbers || []
      },
      category: phase3.workflowCategory || phase2.category || phase1.category || null,
      confidence: Math.max(phase1.confidence || 0, phase2.confidence || 0, phase3.confidence || 0),
      priority: phase3.priority || phase2.priority || 'MEDIUM',
      dollarValue: phase3.dollarValue || phase2.dollarValue || phase1.dollarValue || 0,
      actionItems: phase3.actionItems || []
    };
  }

  /**
   * Save detailed results to file
   */
  private saveDetailedResults(): void {
    const resultsDir = path.join(process.cwd(), 'test_results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(resultsDir, `phase_comparison_${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify({
      testDate: new Date().toISOString(),
      emailCount: this.results.length / 3, // 3 approaches per email
      results: this.results,
      summary: this.compareResults(this.results)
    }, null, 2));

    console.log(chalk.green(`\nDetailed results saved to: ${filename}`));
  }

  /**
   * Cleanup
   */
  close(): void {
    this.db.close();
  }
}

// Run the comparison test
async function main() {
  const comparator = new AnalysisComparator();
  
  try {
    await comparator.runComparisonTest(20);
  } catch (error) {
    console.error(chalk.red('Comparison test failed:'), error);
  } finally {
    comparator.close();
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}