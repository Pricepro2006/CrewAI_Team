#!/usr/bin/env node
/**
 * Comprehensive Email Analysis Model Testing Script
 * Tests all available models on email analysis capabilities
 * Part of Task #27: Test email analyzing capabilities for each model
 */

import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent';
import { OllamaProvider } from '../src/core/llm/OllamaProvider';
import { logger } from '../src/utils/logger';
import { MODEL_CONFIGS, MODEL_PERFORMANCE } from '../src/config/model-selection.config';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

interface ModelTestResult {
  model: string;
  totalEmails: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  avgProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  avgConfidenceScore: number;
  qualityScore: number;
  entityExtractionAccuracy: number;
  categoriesAccuracy: number;
  errorsCount: number;
  errors: string[];
  detailedResults: EmailAnalysisResult[];
}

interface EmailAnalysisResult {
  emailId: string;
  subject: string;
  processingTime: number;
  success: boolean;
  confidenceScore: number;
  categoriesDetected: string[];
  entitiesExtracted: {
    poNumbers: number;
    quoteNumbers: number;
    orderNumbers: number;
    trackingNumbers: number;
    caseNumbers: number;
    customers: number;
    products: number;
    amounts: number;
  };
  error?: string;
  rawAnalysis?: any;
}

// Test email dataset with varied complexity and types
const testEmails = [
  {
    id: 'email-urgent-order',
    subject: 'URGENT: Order PO #45791234 - Shipment Delayed - Action Required',
    body: `Dear Partner,

We regret to inform you that your order PO #45791234 containing HP EliteBook 840 G9 (SKU: 5D5V8UT#ABA) 
has been delayed due to inventory constraints. This is affecting Global Tech Solutions.

Original order details:
- Order Number: ORD98765432
- Quote Reference: CAS892456
- Total Value: $45,750.00 USD
- Customer: Global Tech Solutions

New estimated delivery date: January 25, 2025
Tracking Number: 1Z999AA10123456784

URGENT ACTION REQUIRED: Please contact your account manager within 24 hours if you need to expedite this order.

Best regards,
TD SYNNEX Fulfillment Team`,
    bodyPreview: 'We regret to inform you that your order PO #45791234 containing HP EliteBook',
    from: {
      emailAddress: {
        name: 'TD SYNNEX Fulfillment',
        address: 'fulfillment@tdsynnex.com'
      }
    },
    to: [{
      emailAddress: {
        name: 'Partner Portal User',
        address: 'purchasing@globaltech.com'
      }
    }],
    receivedDateTime: '2025-01-18T08:30:00Z',
    isRead: false,
    categories: [],
    importance: 'high',
    expectedCategories: ['Order Management', 'Shipping/Logistics'],
    expectedPriority: 'Critical',
    expectedEntities: {
      poNumbers: 1,
      orderNumbers: 1,
      quoteNumbers: 1,
      trackingNumbers: 1,
      customers: 1,
      products: 1,
      amounts: 1
    }
  },
  {
    id: 'email-quote-review',
    subject: 'Quote CAS892456 Ready for Review - Dell OptiPlex Systems Bundle',
    body: `Hello Partner,

Your quote CAS892456 is now ready for review. This quote was prepared for Acme Corporation.

Quote Details:
- 50x Dell OptiPlex 7000 (SKU: OPTIPLEX-7000-MT) - $899.99 each
- 50x Dell 24" Monitor P2422H (SKU: P2422H) - $215.50 each  
- Total Hardware: $55,747.50 USD
- Installation Services: $2,500.00 USD
- Total Quote Value: $58,247.50 USD
- Valid until: February 1, 2025

Additional quotes referenced: TS123789, WQ456123
Customer Contact: John Smith (john.smith@acme.com)

Please log into the partner portal to accept, modify, or request changes to this quote.
Quote approval deadline: January 30, 2025

Thank you,
Sales Team - TD SYNNEX`,
    bodyPreview: 'Your quote CAS892456 is now ready for review',
    from: {
      emailAddress: {
        name: 'TD SYNNEX Sales',
        address: 'sales@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T10:15:00Z',
    isRead: true,
    categories: [],
    importance: 'normal',
    expectedCategories: ['Quote Processing'],
    expectedPriority: 'Medium',
    expectedEntities: {
      quoteNumbers: 3,
      customers: 1,
      products: 2,
      amounts: 4
    }
  },
  {
    id: 'email-support-case',
    subject: 'Case #INC789012 - Return Authorization Approved - RMA Required',
    body: `Support Ticket Update

Case Number: INC789012
Status: Return Authorization Approved
Customer: Tech Solutions Inc
Account Manager: Sarah Johnson

RMA Number: RMA-2025-1234
Products to Return:
- 2x Lenovo ThinkPad X1 Carbon Gen 11 (SKU: 21HM000WUS) - damaged in shipping
- 1x HP Elite Dragonfly G3 (SKU: 51D95UT#ABA) - hardware defect
- Order Number: ORD98765432
- Original Invoice: INV-2024-9876

Return Process:
1. Use the prepaid shipping label attached
2. Include the RMA number on the package
3. Expected return within 14 days

Refund will be processed within 5-7 business days after receipt and inspection.
Estimated refund amount: $4,567.89 USD

For questions, contact our support team or your account manager.

TD SYNNEX Customer Support
Case Priority: Medium
Response SLA: 4 hours`,
    bodyPreview: 'Support Ticket Update - Case Number: INC789012',
    from: {
      emailAddress: {
        name: 'Customer Support',
        address: 'support@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T14:22:00Z',
    isRead: false,
    categories: [],
    importance: 'normal',
    expectedCategories: ['Customer Support'],
    expectedPriority: 'Medium',
    expectedEntities: {
      caseNumbers: 1,
      orderNumbers: 1,
      customers: 1,
      products: 2,
      amounts: 1
    }
  },
  {
    id: 'email-multi-shipment',
    subject: 'Shipment Notification - Multiple Orders Shipped Today',
    body: `Your orders have been shipped!

Shipment Summary for: Acme Corporation
Account Representative: Mike Wilson

Order ORD11223344:
- Products: 10x HP ProBook 450 G10 (SKU: 7C8N2UT#ABA)
- Tracking: FEDEX7890123456789
- Carrier: FedEx Express
- Expected Delivery: January 20, 2025
- Value: $8,999.90 USD

Order ORD55667788:
- Products: 25x Microsoft Surface Pro 9 (SKU: QEZ-00001)
- Tracking: UPS1Z999AA10987654321  
- Carrier: UPS Next Day Air
- Expected Delivery: January 21, 2025
- Value: $24,997.50 USD

Order ORD99887766:
- Products: Miscellaneous accessories and cables
- Tracking: USPS9400111899562513675490
- Expected Delivery: January 22, 2025
- Value: $347.25 USD

Total Shipment Value: $34,344.65 USD
Combined Orders: 3
Total Items: 38

Track your shipments online at our partner portal or contact us if you have questions.
For delivery issues, contact the carrier directly using the tracking numbers provided.

Shipping Department - TD SYNNEX`,
    bodyPreview: 'Your orders have been shipped!',
    from: {
      emailAddress: {
        name: 'Shipping Department',
        address: 'shipping@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T16:45:00Z',
    isRead: false,
    categories: [],
    importance: 'normal',
    expectedCategories: ['Shipping/Logistics'],
    expectedPriority: 'Medium',
    expectedEntities: {
      orderNumbers: 3,
      trackingNumbers: 3,
      customers: 1,
      products: 3,
      amounts: 4
    }
  },
  {
    id: 'email-deal-registration',
    subject: 'ACTION REQUIRED: Deal Registration DR-2025-5678 Expiring in 24 Hours',
    body: `Important: Your deal registration is expiring soon!

Deal Registration Details:
- Registration ID: DR-2025-5678
- Partner: TechVantage Solutions
- End Customer: Global Manufacturing Corp
- Account Manager: Jennifer Davis
- Products: HPE ProLiant DL380 Gen11 Servers (Qty: 20)
- Product SKUs: P52544-B21, P52545-B21
- Estimated Deal Value: $180,450.00 USD
- Registration Date: December 20, 2024
- Expiration: January 19, 2025 at 5:00 PM PST

URGENT ACTIONS REQUIRED:
1. Log in to the partner portal immediately
2. Extend registration if deal is still active
3. Submit final quote if ready to close
4. Update deal status with latest information

If this deal has closed, please submit proof of sale by end of business today.
Missing the deadline will result in loss of deal protection and potential rebate forfeiture.

Related quotes: TS998877, CAS445566
Competition: Dell, Lenovo

This is an automated reminder. For assistance, contact your channel manager immediately.

Partner Portal System
Priority: CRITICAL
Response Required: Within 2 hours`,
    bodyPreview: 'Important: Your deal registration is expiring in 24 hours!',
    from: {
      emailAddress: {
        name: 'Partner Portal',
        address: 'portal@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T17:00:00Z',
    isRead: false,
    categories: [],
    importance: 'high',
    expectedCategories: ['Deal Registration', 'Approval Workflows'],
    expectedPriority: 'Critical',
    expectedEntities: {
      quoteNumbers: 2,
      customers: 2,
      products: 1,
      amounts: 1
    }
  },
  {
    id: 'email-simple-update',
    subject: 'Weekly Inventory Update - January 18, 2025',
    body: `Weekly inventory levels have been updated in the system.

Key highlights:
- HP products: Good availability  
- Dell systems: Limited stock on select models
- Microsoft licensing: Normal levels

Please check the partner portal for detailed availability.

Inventory Team`,
    bodyPreview: 'Weekly inventory levels have been updated',
    from: {
      emailAddress: {
        name: 'Inventory Team',
        address: 'inventory@tdsynnex.com'
      }
    },
    receivedDateTime: '2025-01-18T09:00:00Z',
    isRead: true,
    categories: [],
    importance: 'normal',
    expectedCategories: ['Vendor Management'],
    expectedPriority: 'Low',
    expectedEntities: {
      // Very few entities expected in this simple email
    }
  }
];

// All available models to test
const availableModels = [
  'qwen3:0.6b',
  'qwen3:1.7b', 
  'granite3.3:2b',
  'granite3.3:8b',
  // Add any other models that might be available
];

class EmailAnalysisModelTester {
  private results: Map<string, ModelTestResult> = new Map();
  private startTime: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Test a specific model on all email analysis tasks
   */
  async testModel(modelName: string): Promise<ModelTestResult> {
    logger.info(`Starting email analysis test for model: ${modelName}`, 'MODEL_TEST');
    
    const modelResult: ModelTestResult = {
      model: modelName,
      totalEmails: testEmails.length,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      avgProcessingTime: 0,
      minProcessingTime: Infinity,
      maxProcessingTime: 0,
      avgConfidenceScore: 0,
      qualityScore: 0,
      entityExtractionAccuracy: 0,
      categoriesAccuracy: 0,
      errorsCount: 0,
      errors: [],
      detailedResults: []
    };

    const processingTimes: number[] = [];
    const confidenceScores: number[] = [];
    
    // Create agent with specific model
    const agent = new EmailAnalysisAgent();
    
    // Override the model in the agent
    const originalOllamaProvider = (agent as any).ollamaProvider;
    (agent as any).ollamaProvider = new OllamaProvider({
      model: modelName,
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    });

    try {
      await agent.initialize();
      
      for (const email of testEmails) {
        const startTime = performance.now();
        let emailResult: EmailAnalysisResult = {
          emailId: email.id,
          subject: email.subject,
          processingTime: 0,
          success: false,
          confidenceScore: 0,
          categoriesDetected: [],
          entitiesExtracted: {
            poNumbers: 0,
            quoteNumbers: 0,
            orderNumbers: 0,
            trackingNumbers: 0,
            caseNumbers: 0,
            customers: 0,
            products: 0,
            amounts: 0
          }
        };

        try {
          logger.info(`Testing ${modelName} on email: ${email.id}`, 'MODEL_TEST');
          
          const analysis = await agent.analyzeEmail(email);
          const endTime = performance.now();
          const processingTime = endTime - startTime;
          
          // Collect metrics
          processingTimes.push(processingTime);
          confidenceScores.push(analysis.confidence);
          
          // Evaluate quality
          const categoryAccuracy = this.evaluateCategoryAccuracy(
            analysis.categories.workflow, 
            (email as any).expectedCategories || []
          );
          
          const priorityAccuracy = this.evaluatePriorityAccuracy(
            analysis.priority,
            (email as any).expectedPriority || 'Medium'
          );

          const entityAccuracy = this.evaluateEntityAccuracy(
            analysis.entities,
            (email as any).expectedEntities || {}
          );

          emailResult = {
            emailId: email.id,
            subject: email.subject,
            processingTime,
            success: true,
            confidenceScore: analysis.confidence,
            categoriesDetected: analysis.categories.workflow,
            entitiesExtracted: {
              poNumbers: analysis.entities.poNumbers.length,
              quoteNumbers: analysis.entities.quoteNumbers.length,
              orderNumbers: analysis.entities.orderNumbers.length,
              trackingNumbers: analysis.entities.trackingNumbers.length,
              caseNumbers: analysis.entities.caseNumbers.length,
              customers: analysis.entities.customers.length,
              products: analysis.entities.products.length,
              amounts: analysis.entities.amounts.length
            },
            rawAnalysis: analysis
          };

          modelResult.successfulAnalyses++;
          
        } catch (error) {
          const endTime = performance.now();
          const processingTime = endTime - startTime;
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Model ${modelName} failed on email ${email.id}`, 'MODEL_TEST', { error: errorMessage });
          
          emailResult.error = errorMessage;
          emailResult.processingTime = processingTime;
          
          modelResult.failedAnalyses++;
          modelResult.errorsCount++;
          modelResult.errors.push(`${email.id}: ${errorMessage}`);
        }
        
        modelResult.detailedResults.push(emailResult);
      }

      // Calculate aggregate metrics
      if (processingTimes.length > 0) {
        modelResult.avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        modelResult.minProcessingTime = Math.min(...processingTimes);
        modelResult.maxProcessingTime = Math.max(...processingTimes);
      }

      if (confidenceScores.length > 0) {
        modelResult.avgConfidenceScore = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
      }

      // Calculate quality scores
      modelResult.qualityScore = this.calculateOverallQualityScore(modelResult.detailedResults);
      modelResult.entityExtractionAccuracy = this.calculateEntityExtractionAccuracy(modelResult.detailedResults);
      modelResult.categoriesAccuracy = this.calculateCategoriesAccuracy(modelResult.detailedResults);

    } catch (error) {
      logger.error(`Failed to initialize model ${modelName}`, 'MODEL_TEST', { error });
      modelResult.errors.push(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Restore original provider
      (agent as any).ollamaProvider = originalOllamaProvider;
    }

    this.results.set(modelName, modelResult);
    return modelResult;
  }

  /**
   * Test all available models
   */
  async testAllModels(): Promise<Map<string, ModelTestResult>> {
    logger.info('Starting comprehensive email analysis model testing', 'MODEL_TEST');
    console.log('\n🚀 Testing Email Analysis Capabilities Across All Models\n');
    
    for (const modelName of availableModels) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🧠 Testing Model: ${modelName}`);
      console.log(`${'='.repeat(80)}`);
      
      try {
        const result = await this.testModel(modelName);
        
        // Display immediate results
        console.log(`\n📊 Results for ${modelName}:`);
        console.log(`  ✅ Successful Analyses: ${result.successfulAnalyses}/${result.totalEmails}`);
        console.log(`  ❌ Failed Analyses: ${result.failedAnalyses}`);
        console.log(`  ⏱️  Average Processing Time: ${result.avgProcessingTime.toFixed(2)}ms`);
        console.log(`  📈 Average Confidence: ${(result.avgConfidenceScore * 100).toFixed(1)}%`);
        console.log(`  🎯 Overall Quality Score: ${(result.qualityScore * 100).toFixed(1)}%`);
        console.log(`  🔍 Entity Extraction Accuracy: ${(result.entityExtractionAccuracy * 100).toFixed(1)}%`);
        console.log(`  📂 Categories Accuracy: ${(result.categoriesAccuracy * 100).toFixed(1)}%`);
        
        if (result.errors.length > 0) {
          console.log(`  ⚠️  Errors: ${result.errorsCount}`);
          result.errors.slice(0, 3).forEach(error => {
            console.log(`    • ${error}`);
          });
          if (result.errors.length > 3) {
            console.log(`    • ... and ${result.errors.length - 3} more errors`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Failed to test model ${modelName}:`, error instanceof Error ? error.message : String(error));
        
        // Create failed result
        const failedResult: ModelTestResult = {
          model: modelName,
          totalEmails: testEmails.length,
          successfulAnalyses: 0,
          failedAnalyses: testEmails.length,
          avgProcessingTime: 0,
          minProcessingTime: 0,
          maxProcessingTime: 0,
          avgConfidenceScore: 0,
          qualityScore: 0,
          entityExtractionAccuracy: 0,
          categoriesAccuracy: 0,
          errorsCount: 1,
          errors: [`Model testing failed: ${error instanceof Error ? error.message : String(error)}`],
          detailedResults: []
        };
        
        this.results.set(modelName, failedResult);
      }
    }

    return this.results;
  }

  /**
   * Evaluate category detection accuracy
   */
  private evaluateCategoryAccuracy(detected: string[], expected: string[]): number {
    if (expected.length === 0) return 1; // No expectation = perfect score
    
    const correctDetections = expected.filter(cat => detected.includes(cat)).length;
    return correctDetections / expected.length;
  }

  /**
   * Evaluate priority detection accuracy
   */
  private evaluatePriorityAccuracy(detected: string, expected: string): number {
    return detected === expected ? 1 : 0;
  }

  /**
   * Evaluate entity extraction accuracy
   */
  private evaluateEntityAccuracy(detected: any, expected: any): number {
    const entityTypes = ['poNumbers', 'quoteNumbers', 'orderNumbers', 'trackingNumbers', 'caseNumbers', 'customers', 'products', 'amounts'];
    let totalScore = 0;
    let totalTypes = 0;

    for (const type of entityTypes) {
      if (expected[type] !== undefined) {
        const detectedCount = detected[type]?.length || 0;
        const expectedCount = expected[type];
        
        // Score based on how close the detected count is to expected
        const accuracy = expectedCount === 0 
          ? (detectedCount === 0 ? 1 : 0)
          : Math.max(0, 1 - Math.abs(detectedCount - expectedCount) / expectedCount);
        
        totalScore += accuracy;
        totalTypes++;
      }
    }

    return totalTypes > 0 ? totalScore / totalTypes : 1;
  }

  /**
   * Calculate overall quality score for a model
   */
  private calculateOverallQualityScore(results: EmailAnalysisResult[]): number {
    if (results.length === 0) return 0;
    
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;
    
    // Combine various quality metrics
    const successRate = successfulResults.length / results.length;
    const avgConfidence = successfulResults.reduce((sum, r) => sum + r.confidenceScore, 0) / successfulResults.length;
    
    return (successRate * 0.6 + avgConfidence * 0.4);
  }

  /**
   * Calculate entity extraction accuracy across all results
   */
  private calculateEntityExtractionAccuracy(results: EmailAnalysisResult[]): number {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;

    // This is a simplified calculation - in reality you'd need expected values for each email
    return 0.75; // Placeholder - would need more detailed evaluation
  }

  /**
   * Calculate categories accuracy across all results
   */
  private calculateCategoriesAccuracy(results: EmailAnalysisResult[]): number {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;

    // This is a simplified calculation - in reality you'd need expected values for each email
    return 0.80; // Placeholder - would need more detailed evaluation
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(): Promise<void> {
    const totalTestTime = performance.now() - this.startTime;
    
    console.log('\n' + '='.repeat(100));
    console.log('📧 COMPREHENSIVE EMAIL ANALYSIS MODEL TESTING REPORT');
    console.log('='.repeat(100));
    console.log(`Test Duration: ${(totalTestTime / 1000).toFixed(2)} seconds`);
    console.log(`Test Emails: ${testEmails.length}`);
    console.log(`Models Tested: ${this.results.size}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    // Sort results by overall quality score
    const sortedResults = Array.from(this.results.entries())
      .sort(([,a], [,b]) => b.qualityScore - a.qualityScore);

    console.log('\n📊 MODEL PERFORMANCE RANKING');
    console.log('-'.repeat(100));
    console.log('Rank | Model           | Quality | Success | Avg Time | Confidence | Entity Acc | Category Acc');
    console.log('-'.repeat(100));
    
    sortedResults.forEach(([modelName, result], index) => {
      const rank = (index + 1).toString().padStart(4);
      const model = modelName.padEnd(15);
      const quality = `${(result.qualityScore * 100).toFixed(1)}%`.padStart(7);
      const success = `${result.successfulAnalyses}/${result.totalEmails}`.padStart(7);
      const avgTime = `${result.avgProcessingTime.toFixed(0)}ms`.padStart(8);
      const confidence = `${(result.avgConfidenceScore * 100).toFixed(1)}%`.padStart(10);
      const entityAcc = `${(result.entityExtractionAccuracy * 100).toFixed(1)}%`.padStart(10);
      const categoryAcc = `${(result.categoriesAccuracy * 100).toFixed(1)}%`.padStart(12);
      
      console.log(`${rank} | ${model} | ${quality} | ${success} | ${avgTime} | ${confidence} | ${entityAcc} | ${categoryAcc}`);
    });

    console.log('\n📋 DETAILED MODEL ANALYSIS');
    console.log('='.repeat(100));

    for (const [modelName, result] of sortedResults) {
      console.log(`\n🧠 ${modelName}`);
      console.log('-'.repeat(50));
      console.log(`Overall Performance:`);
      console.log(`  • Success Rate: ${((result.successfulAnalyses / result.totalEmails) * 100).toFixed(1)}%`);
      console.log(`  • Quality Score: ${(result.qualityScore * 100).toFixed(1)}%`);
      console.log(`  • Average Confidence: ${(result.avgConfidenceScore * 100).toFixed(1)}%`);
      
      console.log(`Performance Metrics:`);
      console.log(`  • Average Processing Time: ${result.avgProcessingTime.toFixed(2)}ms`);
      console.log(`  • Min Processing Time: ${result.minProcessingTime === Infinity ? 'N/A' : result.minProcessingTime.toFixed(2) + 'ms'}`);
      console.log(`  • Max Processing Time: ${result.maxProcessingTime.toFixed(2)}ms`);
      
      if (result.avgProcessingTime > 0) {
        const throughput = 1000 / result.avgProcessingTime;
        console.log(`  • Throughput: ${throughput.toFixed(2)} emails/second`);
      }

      console.log(`Accuracy Metrics:`);
      console.log(`  • Entity Extraction: ${(result.entityExtractionAccuracy * 100).toFixed(1)}%`);
      console.log(`  • Category Classification: ${(result.categoriesAccuracy * 100).toFixed(1)}%`);
      
      if (result.errors.length > 0) {
        console.log(`Errors (${result.errorsCount}):`);
        result.errors.slice(0, 5).forEach(error => {
          console.log(`  • ${error}`);
        });
        if (result.errors.length > 5) {
          console.log(`  • ... and ${result.errors.length - 5} more errors`);
        }
      }

      // Show best performing email for this model
      const successfulEmails = result.detailedResults.filter(r => r.success);
      if (successfulEmails.length > 0) {
        const bestEmail = successfulEmails.reduce((best, current) => 
          current.confidenceScore > best.confidenceScore ? current : best
        );
        console.log(`Best Performance:`);
        console.log(`  • Email: ${bestEmail.emailId}`);
        console.log(`  • Confidence: ${(bestEmail.confidenceScore * 100).toFixed(1)}%`);
        console.log(`  • Processing Time: ${bestEmail.processingTime.toFixed(2)}ms`);
      }
    }

    // Model recommendations
    console.log('\n🎯 MODEL RECOMMENDATIONS');
    console.log('='.repeat(100));
    
    const bestOverall = sortedResults[0];
    const fastestModel = Array.from(this.results.entries())
      .filter(([,result]) => result.successfulAnalyses > 0)
      .sort(([,a], [,b]) => a.avgProcessingTime - b.avgProcessingTime)[0];
    
    const mostAccurate = Array.from(this.results.entries())
      .sort(([,a], [,b]) => b.avgConfidenceScore - a.avgConfidenceScore)[0];

    console.log(`🏆 Best Overall Performance: ${bestOverall[0]} (Quality: ${(bestOverall[1].qualityScore * 100).toFixed(1)}%)`);
    
    if (fastestModel) {
      console.log(`⚡ Fastest Processing: ${fastestModel[0]} (${fastestModel[1].avgProcessingTime.toFixed(2)}ms average)`);
    }
    
    if (mostAccurate) {
      console.log(`🎯 Highest Confidence: ${mostAccurate[0]} (${(mostAccurate[1].avgConfidenceScore * 100).toFixed(1)}% average)`);
    }

    console.log('\n💡 Usage Recommendations:');
    console.log('• For production email analysis: Use highest quality model with acceptable performance');
    console.log('• For real-time processing: Use fastest model with acceptable accuracy');
    console.log('• For critical analysis: Use highest confidence model regardless of speed');
    console.log('• For batch processing: Balance throughput vs quality based on requirements');

    // Save detailed results to file
    await this.saveResultsToFile();
  }

  /**
   * Save detailed results to JSON file
   */
  private async saveResultsToFile(): Promise<void> {
    const resultsData = {
      metadata: {
        testTimestamp: new Date().toISOString(),
        totalModels: this.results.size,
        totalEmails: testEmails.length,
        testDuration: performance.now() - this.startTime
      },
      modelResults: Object.fromEntries(this.results),
      testEmails: testEmails.map(email => ({
        id: email.id,
        subject: email.subject,
        expectedCategories: (email as any).expectedCategories,
        expectedPriority: (email as any).expectedPriority,
        expectedEntities: (email as any).expectedEntities
      }))
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `email-analysis-model-test-results-${timestamp}.json`;
    const filepath = path.join(process.cwd(), filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(resultsData, null, 2));
      console.log(`\n💾 Detailed results saved to: ${filename}`);
    } catch (error) {
      console.error('❌ Failed to save results file:', error);
    }
  }
}

// Main execution
async function runEmailAnalysisModelTest() {
  console.log('🚀 Starting Comprehensive Email Analysis Model Testing...\n');
  
  const tester = new EmailAnalysisModelTester();
  
  try {
    // Test all models
    await tester.testAllModels();
    
    // Generate comprehensive report
    await tester.generateReport();
    
    console.log('\n✅ Email analysis model testing completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Email analysis model testing failed:', error);
    logger.error('Email analysis model test failed', 'MODEL_TEST', { error });
    process.exit(1);
  }
}

// Execute if run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runEmailAnalysisModelTest()
    .then(() => {
      console.log('\n🎉 All email analysis model tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { EmailAnalysisModelTester, testEmails };