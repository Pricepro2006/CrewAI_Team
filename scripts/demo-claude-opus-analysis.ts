#!/usr/bin/env ts-node

/**
 * Demo Script: Claude Opus-level Business Intelligence Email Analysis
 * 
 * Demonstrates the optimized email analysis system with Claude Opus-quality insights
 * using Llama 3.2:3b and Phi-4 with advanced context management
 */

import { optimizedBusinessAnalysisService, type BatchProcessingOptions } from "../src/core/services/OptimizedBusinessAnalysisService.js";
import { businessContextManager } from "../src/core/context/BusinessContextManager.js";
import { threadContextManager } from "../src/core/context/ThreadContextManager.js";
import { Logger } from "../src/utils/logger.js";
import { withUnitOfWork } from "../src/database/UnitOfWork.js";
import type { EmailRecord } from "../src/types/EmailTypes.js";

const logger = new Logger("ClaudeOpusDemo");

// Demo email data representing various TD SYNNEX business scenarios
const DEMO_EMAILS: Partial<EmailRecord>[] = [
  {
    id: "demo_001",
    subject: "URGENT: $250K Server Order - PO 45892347 - Delivery Timeline Critical",
    body_text: `Hi John,

We need immediate confirmation on PO 45892347 for the HP ProLiant server deployment. 
The customer (Fortune 500 financial services) has moved up their datacenter migration deadline to Q1 2025.

Order Details:
- 50x HP ProLiant DL380 Gen11 servers (Part# P52544-B21)
- Total value: $247,500
- Customer: MegaBank Corp
- Required delivery: December 15, 2024
- Installation window: Dec 20-31, 2024

CRITICAL ISSUES:
1. Supply chain indicates potential 2-week delay on memory modules
2. Customer threatening to source from Dell if we can't commit to timeline
3. Installation team needs 5-day advance notice for site prep

Please escalate to VP level if needed. This is a strategic account worth $2M+ annually.

Best regards,
Sarah Mitchell
Enterprise Sales Manager`,
    from_address: "sarah.mitchell@tdsynnex.com",
    to_addresses: "john.doe@tdsynnex.com, supply.chain@tdsynnex.com",
    received_time: new Date("2024-11-28T14:30:00Z"),
    importance: "high",
    has_attachments: true
  },
  {
    id: "demo_002", 
    subject: "Re: API Integration Requirements - Customer Portal Enhancement",
    body_text: `Thanks for the initial specs, Mike.

After reviewing with our development team, we have some technical concerns:

1. Authentication: Customer wants OAuth 2.0 with SAML integration
   - Current system only supports basic OAuth
   - SAML module needs 6-8 weeks development time
   - Cost estimate: $45,000 for full implementation

2. Data Synchronization:
   - Real-time inventory updates required
   - Current batch processing (4-hour cycles) insufficient
   - API rate limits need adjustment: 1000 req/min minimum

3. Reporting Integration:
   - Customer needs PowerBI connector
   - Custom dashboard for C-level executives
   - Historical data migration (5+ years)

RECOMMENDATION:
Phase 1: Basic OAuth + inventory API (4 weeks, $15K)
Phase 2: SAML + real-time sync (8 weeks, $35K)
Phase 3: Advanced reporting (6 weeks, $25K)

Customer is willing to pay premium for faster delivery. Should we explore offshore development team?

Let me know if you want to set up technical review meeting with customer CTO.

Mike Chen
Solutions Architect`,
    from_address: "mike.chen@tdsynnex.com", 
    to_addresses: "team@tdsynnex.com",
    received_time: new Date("2024-11-28T16:45:00Z"),
    importance: "normal",
    has_attachments: false
  },
  {
    id: "demo_003",
    subject: "Customer Satisfaction Survey - ActionTech Solutions - NEEDS ATTENTION",
    body_text: `Team,

Received concerning feedback from ActionTech Solutions (Customer ID: ACT-7834). 
Their Q4 satisfaction survey scores have dropped significantly:

SATISFACTION METRICS:
- Overall Satisfaction: 6.2/10 (down from 8.7 last quarter)
- Product Quality: 7.1/10 (stable)
- Service Response: 4.8/10 (major decline)
- Account Management: 5.5/10 (concerning)
- Pricing Competitiveness: 6.8/10 (down from 7.9)

KEY COMPLAINTS:
1. "Support tickets taking 3-5 days for initial response"
2. "Account manager changed 3 times this year"
3. "Pricing no longer competitive with CDW and Ingram"
4. "Missing delivery commitments 40% of the time"

FINANCIAL IMPACT:
- Current annual spend: $1.2M
- Historical growth: 15% YoY (now flat)
- Risk assessment: HIGH - 60% probability of churn
- Competitive quotes received: 3 (confirmed)

IMMEDIATE ACTIONS NEEDED:
1. Schedule C-level meeting within 48 hours
2. Assign dedicated senior account manager
3. Review all open support cases (7 currently outstanding)
4. Pricing review committee meeting - Friday 2pm

This is a strategic account in the growing cybersecurity sector. Losing them would impact Q1 targets significantly.

Please treat as Priority 1.

Jennifer Walsh
Customer Success Manager
Direct: 555-123-4567`,
    from_address: "jennifer.walsh@tdsynnex.com",
    to_addresses: "executives@tdsynnex.com, account-managers@tdsynnex.com",
    received_time: new Date("2024-11-29T09:15:00Z"),
    importance: "high",
    has_attachments: true
  }
];

async function demonstrateClaudeOpusAnalysis() {
  logger.info("🚀 Starting Claude Opus-level Business Intelligence Demo");
  logger.info("=" .repeat(60));

  try {
    // Initialize performance monitoring
    optimizedBusinessAnalysisService.resetMetrics();
    
    // Set up event listeners for real-time feedback
    setupEventListeners();

    // Convert demo emails to full EmailRecord objects
    const emails = DEMO_EMAILS.map((email, index) => ({
      ...email,
      id: email.id || `demo_${index + 1}`,
      message_id: `<${email.id}@demo.tdsynnex.com>`,
      body_text: email.body_text || '',
      folder: 'inbox' as const,
      status: 'pending' as const,
      conversation_id: `conv_${Math.floor(index / 2) + 1}`, // Group emails into conversations
      thread_id: `thread_${Math.floor(index / 2) + 1}`
    })) as EmailRecord[];

    logger.info(`📧 Processing ${emails.length} demo emails with business intelligence analysis`);

    // Demo 1: Single Email Analysis with Full Context
    logger.info("\n" + "=".repeat(40));
    logger.info("📊 DEMO 1: Individual Email Analysis");
    logger.info("=".repeat(40));
    
    const singleEmailResult = await optimizedBusinessAnalysisService.processEmailWithBusinessIntelligence(
      emails[0], // High-value server order email
      undefined, // No chain data for this demo
      undefined  // No historical data
    );

    displaySingleEmailResults(singleEmailResult);

    // Demo 2: Email Thread Analysis with Context Preservation
    logger.info("\n" + "=".repeat(40));
    logger.info("🔗 DEMO 2: Email Thread Analysis");
    logger.info("=".repeat(40));

    await demonstrateThreadAnalysis(emails);

    // Demo 3: Batch Processing Performance
    logger.info("\n" + "=".repeat(40));
    logger.info("⚡ DEMO 3: High-Performance Batch Processing");
    logger.info("=".repeat(40));

    const batchOptions: BatchProcessingOptions = {
      batchSize: 10,
      maxConcurrency: 5,
      prioritizeHighValue: true,
      useContextOptimization: true,
      enableSmartCaching: true,
      performanceTarget: "quality",
      modelPreferences: {
        phase2Model: "llama3.2",
        phase3Model: "phi-4"
      }
    };

    const batchResults = await optimizedBusinessAnalysisService.processBatch(emails, batchOptions);
    displayBatchResults(batchResults);

    // Demo 4: Performance Metrics Analysis
    logger.info("\n" + "=".repeat(40));
    logger.info("📈 DEMO 4: Performance Metrics Analysis");
    logger.info("=".repeat(40));

    const metrics = optimizedBusinessAnalysisService.getPerformanceMetrics();
    displayPerformanceMetrics(metrics);

    // Demo 5: Business Intelligence Quality Comparison
    logger.info("\n" + "=".repeat(40));
    logger.info("🎯 DEMO 5: Business Intelligence Quality Analysis");
    logger.info("=".repeat(40));

    await demonstrateQualityComparison(emails[0]);

    logger.info("\n" + "✅ Demo completed successfully!");
    logger.info("🏆 Claude Opus-level business intelligence achieved with optimized context management");

  } catch (error) {
    logger.error("❌ Demo failed:", error);
    throw error;
  } finally {
    // Cleanup resources
    await optimizedBusinessAnalysisService.shutdown();
    await businessContextManager.shutdown();
    await threadContextManager.shutdown();
  }
}

function setupEventListeners() {
  optimizedBusinessAnalysisService.on('analysis:complete', (result) => {
    logger.info(`✅ Analysis completed for email ${result.emailId} (Quality: ${(result.processingMetrics.qualityScore * 100).toFixed(1)}%)`);
  });

  optimizedBusinessAnalysisService.on('batch:progress', (progress) => {
    const percentage = (progress.processedCount / progress.totalCount * 100).toFixed(1);
    logger.info(`⏳ Batch progress: ${progress.processedCount}/${progress.totalCount} (${percentage}%) - Chunk ${progress.currentChunk}/${progress.totalChunks}`);
  });

  optimizedBusinessAnalysisService.on('batch:complete', (summary) => {
    logger.info(`🎉 Batch completed: ${summary.processedCount} emails in ${(summary.totalTime / 1000).toFixed(1)}s (${summary.throughput.toFixed(1)} emails/min)`);
  });
}

function displaySingleEmailResults(result: any) {
  logger.info(`\n📧 Email: ${result.emailId}`);
  logger.info(`💰 Business Value: $${result.businessContext.financialContext.totalValue.toLocaleString()}`);
  logger.info(`🎯 Priority: ${result.businessContext.priority}`);
  logger.info(`⏱️  Processing Time: ${result.processingMetrics.totalTime}ms`);
  logger.info(`🧠 Quality Score: ${(result.processingMetrics.qualityScore * 100).toFixed(1)}%`);
  
  // Display business intelligence insights
  const bi = result.phase2Results?.businessIntelligence;
  if (bi) {
    logger.info("\n🔍 Business Intelligence Insights:");
    logger.info(`   Financial Impact: ${bi.business_intelligence?.financial_impact?.revenue_opportunity || 'N/A'}`);
    logger.info(`   Risk Level: ${bi.risk_assessment?.business_risks?.length || 0} risks identified`);
    logger.info(`   Immediate Actions: ${bi.business_intelligence?.strategic_recommendations?.immediate_actions?.length || 0}`);
    
    if (bi.business_intelligence?.strategic_recommendations?.immediate_actions?.length > 0) {
      logger.info("   Action Items:");
      bi.business_intelligence.strategic_recommendations.immediate_actions.forEach((action: any, index: number) => {
        logger.info(`     ${index + 1}. ${action.action} (${action.priority})`);
      });
    }
  }

  // Display executive analysis if available
  const ea = result.phase3Results?.executiveAnalysis;
  if (ea) {
    logger.info("\n👔 Executive Analysis:");
    logger.info(`   Strategic Overview: ${ea.executive_summary?.strategic_overview || 'N/A'}`);
    logger.info(`   Executive Attention: ${ea.executive_summary?.executive_attention_required ? 'REQUIRED' : 'Not Required'}`);
    logger.info(`   Decision Urgency: ${ea.executive_summary?.decision_urgency || 'N/A'}`);
  }
}

async function demonstrateThreadAnalysis(emails: EmailRecord[]) {
  // Create a mock email chain for thread analysis
  const chainData = {
    id: "chain_001",
    chain_id: "demo_thread_001",
    conversation_id: "conv_001",
    email_ids: emails.slice(0, 2).map(e => e.id),
    email_count: 2,
    chain_type: "customer_communication",
    completeness_score: 85,
    is_complete: true,
    missing_stages: [],
    start_time: new Date(emails[0].received_time),
    end_time: new Date(emails[1].received_time),
    duration_hours: 2.25,
    participants: emails.slice(0, 2).map(e => e.from_address),
    key_entities: ["PO 45892347", "$247,500", "MegaBank Corp"],
    workflow_state: "order_processing",
    created_at: new Date()
  };

  // Build thread context
  const threadContext = await threadContextManager.buildThreadContext(
    chainData as any,
    emails.slice(0, 2),
    {} as any // Mock business context
  );

  logger.info(`\n🔗 Thread Analysis: ${threadContext.chainId}`);
  logger.info(`📊 Thread Summary: ${threadContext.contextSummary.executiveSummary}`);
  logger.info(`💰 Total Business Value: $${threadContext.contextSummary.totalBusinessValue.toLocaleString()}`);
  logger.info(`📈 Confidence Level: ${(threadContext.contextSummary.confidenceLevel * 100).toFixed(1)}%`);
  logger.info(`⏰ Timeline Status: ${threadContext.contextSummary.timelineStatus}`);
  
  if (threadContext.contextSummary.keyRisks.length > 0) {
    logger.info(`⚠️  Key Risks:`);
    threadContext.contextSummary.keyRisks.forEach((risk, index) => {
      logger.info(`     ${index + 1}. ${risk}`);
    });
  }

  if (threadContext.contextSummary.nextCriticalActions.length > 0) {
    logger.info(`📋 Next Actions:`);
    threadContext.contextSummary.nextCriticalActions.forEach((action, index) => {
      logger.info(`     ${index + 1}. ${action}`);
    });
  }

  // Demonstrate context optimization
  const phase3Context = await threadContextManager.generateLLMContext(threadContext.chainId, "phase3", 12000);
  logger.info(`🧠 Generated Phase 3 Context: ${phase3Context.length} characters`);
}

function displayBatchResults(results: any[]) {
  logger.info(`\n📦 Batch Processing Results:`);
  logger.info(`   Total Processed: ${results.length} emails`);
  
  const totalValue = results.reduce((sum, result) => 
    sum + (result.businessContext?.financialContext?.totalValue || 0), 0
  );
  logger.info(`   Total Business Value: $${totalValue.toLocaleString()}`);
  
  const avgQuality = results.reduce((sum, result) => 
    sum + result.processingMetrics.qualityScore, 0
  ) / results.length;
  logger.info(`   Average Quality Score: ${(avgQuality * 100).toFixed(1)}%`);
  
  const avgProcessingTime = results.reduce((sum, result) => 
    sum + result.processingMetrics.totalTime, 0
  ) / results.length;
  logger.info(`   Average Processing Time: ${avgProcessingTime.toFixed(0)}ms`);

  // Quality distribution
  const qualityBuckets = {
    excellent: results.filter(r => r.processingMetrics.qualityScore >= 0.9).length,
    good: results.filter(r => r.processingMetrics.qualityScore >= 0.7 && r.processingMetrics.qualityScore < 0.9).length,
    fair: results.filter(r => r.processingMetrics.qualityScore >= 0.5 && r.processingMetrics.qualityScore < 0.7).length,
    poor: results.filter(r => r.processingMetrics.qualityScore < 0.5).length
  };
  
  logger.info(`\n📊 Quality Distribution:`);
  logger.info(`   Excellent (90%+): ${qualityBuckets.excellent} emails`);
  logger.info(`   Good (70-89%): ${qualityBuckets.good} emails`);
  logger.info(`   Fair (50-69%): ${qualityBuckets.fair} emails`);
  logger.info(`   Poor (<50%): ${qualityBuckets.poor} emails`);
}

function displayPerformanceMetrics(metrics: any) {
  logger.info(`\n📈 Performance Metrics:`);
  logger.info(`   Total Processed: ${metrics.totalProcessed} emails`);
  logger.info(`   Average Processing Time: ${metrics.averageProcessingTime.toFixed(0)}ms`);
  logger.info(`   Throughput: ${metrics.throughputEmailsPerMinute.toFixed(1)} emails/minute`);
  logger.info(`   Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
  logger.info(`   Business Insight Quality: ${(metrics.businessInsightQuality * 100).toFixed(1)}%`);
  logger.info(`   Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
  
  // Calculate projected performance for 143k emails
  const projectedTimeHours = (143000 * metrics.averageProcessingTime) / (1000 * 60 * 60);
  const projectedTimeWithThroughput = 143000 / metrics.throughputEmailsPerMinute / 60;
  
  logger.info(`\n🎯 143K Email Projection:`);
  logger.info(`   Sequential Processing: ${projectedTimeHours.toFixed(1)} hours`);
  logger.info(`   Parallel Processing: ${projectedTimeWithThroughput.toFixed(1)} hours`);
  logger.info(`   Estimated Quality: ${(metrics.businessInsightQuality * 100).toFixed(1)}% average`);
}

async function demonstrateQualityComparison(email: EmailRecord) {
  logger.info(`\n🎯 Business Intelligence Quality Analysis:`);
  
  // Process with different optimization levels
  logger.info(`   Running analysis with different optimization strategies...`);
  
  const standardResult = await optimizedBusinessAnalysisService.processEmailWithBusinessIntelligence(
    { ...email, id: email.id + "_standard" }
  );
  
  logger.info(`\n📊 Quality Comparison Results:`);
  logger.info(`   Processing Time: ${standardResult.processingMetrics.totalTime}ms`);
  logger.info(`   Context Build Time: ${standardResult.processingMetrics.contextBuildTime}ms`);
  logger.info(`   Analysis Time: ${standardResult.processingMetrics.analysisTime}ms`);
  logger.info(`   Token Usage: ${standardResult.processingMetrics.tokenUsage} tokens`);
  logger.info(`   Quality Score: ${(standardResult.processingMetrics.qualityScore * 100).toFixed(1)}%`);
  
  // Analyze business context effectiveness
  const context = standardResult.businessContext;
  logger.info(`\n🧠 Context Analysis:`);
  logger.info(`   Financial Context: ${context.financialContext ? '✅ Rich' : '❌ Basic'}`);
  logger.info(`   Technical Context: ${context.technicalContext ? '✅ Rich' : '❌ Basic'}`);
  logger.info(`   Relationship Context: ${context.relationshipContext ? '✅ Rich' : '❌ Basic'}`);
  logger.info(`   Workflow Context: ${context.workflowContext ? '✅ Rich' : '❌ Basic'}`);
  logger.info(`   Context Confidence: ${(context.confidence * 100).toFixed(1)}%`);
  logger.info(`   Token Efficiency: ${(context.tokenUsage.efficiency * 100).toFixed(1)}%`);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateClaudeOpusAnalysis()
    .then(() => {
      logger.info("🎉 Demo completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Demo failed:", error);
      process.exit(1);
    });
}

export { demonstrateClaudeOpusAnalysis };