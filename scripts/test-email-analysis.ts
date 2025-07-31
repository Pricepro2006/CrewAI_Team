import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent.js';
import { EmailStorageService } from '../src/api/services/EmailStorageService.js';
import fs from 'fs';
import path from 'path';

async function testEmailAnalysis() {
  console.log('🔬 Testing Email Analysis Pipeline\n');
  
  // Initialize services
  const storageService = new EmailStorageService();
  await storageService.initialize();
  
  const analysisAgent = new EmailAnalysisAgent();
  
  // Load test batch
  const batchPath = './test-email-batches/test_emails_batch_1.json';
  const emails = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
  
  console.log(`📧 Analyzing ${emails.length} emails from test batch...\n`);
  
  for (const [index, email] of emails.entries()) {
    console.log(`\n[${index + 1}/${emails.length}] Analyzing: "${email.Subject}"`);
    
    try {
      // Phase 1: Quick Classification
      console.log('  Phase 1: Quick Classification...');
      const quickAnalysis = await analysisAgent.analyzeEmail({
        subject: email.Subject,
        from: email.SenderEmail,
        body: email.BodyText?.substring(0, 1000) || '',
        receivedAt: new Date(email.ReceivedTime)
      });
      
      console.log(`  - Workflow: ${quickAnalysis.workflow || 'unknown'}`);
      console.log(`  - Priority: ${quickAnalysis.priority || 'medium'}`);
      console.log(`  - Sentiment: ${quickAnalysis.sentiment || 'neutral'}`);
      
      // Phase 2: Deep Analysis (if high priority)
      if (quickAnalysis.priority === 'high' || quickAnalysis.priority === 'critical') {
        console.log('  Phase 2: Deep Analysis...');
        // Simulate entity extraction
        const entities = {
          orderNumbers: extractOrderNumbers(email.BodyText || ''),
          trackingNumbers: extractTrackingNumbers(email.BodyText || ''),
          customerNames: [email.SenderName],
          productMentions: extractProducts(email.Subject + ' ' + (email.BodyText || ''))
        };
        console.log(`  - Entities found:`, JSON.stringify(entities, null, 2));
      }
      
      // Save analysis to database
      const analysisData = {
        email_id: email.MessageID,
        workflow_classification: quickAnalysis.workflow || 'general',
        priority: quickAnalysis.priority || 'medium',
        sentiment_score: quickAnalysis.sentimentScore || 0.5,
        intent: quickAnalysis.intent || 'information',
        entities: JSON.stringify({
          people: [email.SenderName],
          organizations: [],
          locations: [],
          dates: [email.ReceivedTime],
          amounts: []
        }),
        key_phrases: JSON.stringify(quickAnalysis.keyPhrases || []),
        action_required: quickAnalysis.actionRequired || false,
        suggested_response: quickAnalysis.suggestedResponse || null,
        confidence_score: quickAnalysis.confidence || 0.8,
        analysis_version: '1.0'
      };
      
      // Save to email_analysis table
      await storageService.saveEmailAnalysis(analysisData);
      console.log('  ✅ Analysis saved to database');
      
    } catch (error) {
      console.error(`  ❌ Error analyzing email:`, error.message);
    }
  }
  
  console.log('\n📊 Analysis Summary:');
  const stats = await storageService.getAnalysisStats();
  console.log(`- Total analyzed: ${stats.totalAnalyzed}`);
  console.log(`- By workflow: ${JSON.stringify(stats.byWorkflow)}`);
  console.log(`- By priority: ${JSON.stringify(stats.byPriority)}`);
  
  await storageService.close();
  console.log('\n✅ Email analysis test completed!');
}

// Helper functions
function extractOrderNumbers(text: string): string[] {
  const orderPattern = /\b\d{8,10}\b/g;
  return [...new Set(text.match(orderPattern) || [])];
}

function extractTrackingNumbers(text: string): string[] {
  const trackingPattern = /\b[A-Z0-9]{10,30}\b/g;
  return [...new Set(text.match(trackingPattern) || [])].slice(0, 3);
}

function extractProducts(text: string): string[] {
  const productPattern = /\b[A-Z0-9]{5,10}[#-]?[A-Z0-9]{0,5}\b/g;
  return [...new Set(text.match(productPattern) || [])].slice(0, 5);
}

// Run the test
testEmailAnalysis().catch(console.error);