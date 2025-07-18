/**
 * Example usage of the Confidence-Scored RAG System
 * Demonstrates the complete 4-step workflow
 */

import {
  QueryComplexityAnalyzer,
  ConfidenceRAGRetriever,
  ConfidenceContextBuilder,
  ConfidenceResponseGenerator,
  MultiModalEvaluator,
  ConfidenceCalibrator,
  AdaptiveDeliveryManager,
  CalibrationData
} from './index';
import { VectorStore } from '../VectorStore';
import { OllamaProvider } from '../../llm/OllamaProvider';

async function confidenceScoredRAGExample() {
  console.log('🚀 Confidence-Scored RAG System Example\n');

  // Initialize components
  const queryAnalyzer = new QueryComplexityAnalyzer();
  const vectorStore = new VectorStore();
  const retriever = new ConfidenceRAGRetriever(vectorStore);
  const contextBuilder = new ConfidenceContextBuilder();
  const llmProvider = new OllamaProvider({
    baseURL: 'http://localhost:11434',
    model: 'qwen3:8b',
    options: { temperature: 0.7 }
  });
  const responseGenerator = new ConfidenceResponseGenerator(llmProvider);
  const evaluator = new MultiModalEvaluator();
  const calibrator = new ConfidenceCalibrator();
  const deliveryManager = new AdaptiveDeliveryManager();

  // Example query
  const query = "How does transformer architecture work in LLMs, and what are the key differences between GPT and BERT models?";

  console.log('📝 Query:', query);
  console.log('');

  // Step 1: Query Processing & Retrieval
  console.log('🔍 Step 1: Query Processing & Retrieval');
  
  // Analyze query complexity
  const complexity = queryAnalyzer.assessComplexity(query);
  console.log(`  - Complexity Score: ${complexity.score}/10`);
  console.log(`  - Technical Depth: ${complexity.factors.technicalDepth}`);
  console.log(`  - Multi-Intent: ${complexity.factors.multiIntent}`);
  
  // Retrieve relevant documents
  const retrievalResult = await retriever.retrieve(query, {
    topK: 5,
    minConfidence: 0.6
  });
  
  console.log(`  - Documents Retrieved: ${retrievalResult.documents.length}`);
  console.log(`  - Average Confidence: ${(retrievalResult.averageConfidence * 100).toFixed(1)}%`);
  console.log('');

  // Step 2: Response Generation
  console.log('💬 Step 2: Response Generation with Confidence');
  
  // Build context
  const context = contextBuilder.buildContext(
    retrievalResult.documents,
    query,
    { mode: 'unified', includeConfidence: true }
  );
  
  // Generate response with confidence tracking
  const generationResult = await responseGenerator.generateWithConfidence({
    query,
    retrievedDocuments: retrievalResult.documents,
    complexity: complexity.score,
    context
  });
  
  console.log(`  - Response Length: ${generationResult.response.length} chars`);
  console.log(`  - Raw Confidence: ${(generationResult.rawConfidence * 100).toFixed(1)}%`);
  console.log(`  - Token Confidence Tracked: ${generationResult.tokenConfidence.length} tokens`);
  console.log('');

  // Step 3: Multi-Modal Evaluation & Calibration
  console.log('📊 Step 3: Multi-Modal Evaluation & Calibration');
  
  // Evaluate response
  const evaluationResult = await evaluator.evaluate(
    query,
    generationResult.response,
    retrievalResult.documents,
    generationResult.tokenConfidence
  );
  
  console.log(`  - Factuality Score: ${(evaluationResult.factualityScore * 100).toFixed(1)}%`);
  console.log(`  - Relevance Score: ${(evaluationResult.relevanceScore * 100).toFixed(1)}%`);
  console.log(`  - Coherence Score: ${(evaluationResult.coherenceScore * 100).toFixed(1)}%`);
  console.log(`  - Overall Confidence: ${(evaluationResult.overallConfidence * 100).toFixed(1)}%`);
  console.log(`  - Recommended Action: ${evaluationResult.recommendedAction}`);
  
  // Apply calibration (if trained)
  const calibratedResult = calibrator.calibrate(
    evaluationResult.overallConfidence,
    { method: 'temperature_scaling' }
  );
  
  console.log(`  - Calibrated Confidence: ${(calibratedResult.calibratedScore * 100).toFixed(1)}%`);
  console.log('');

  // Step 4: Adaptive Delivery
  console.log('📤 Step 4: Adaptive Response Delivery');
  
  const deliveredResponse = await deliveryManager.deliver(evaluationResult, {
    includeConfidenceScore: true,
    includeSourceAttribution: true,
    includeUncertaintyWarnings: true,
    includeEvidence: true,
    confidenceFormat: 'detailed'
  });
  
  console.log(`  - Delivery Action: ${deliveredResponse.metadata.action}`);
  console.log(`  - Human Review Needed: ${deliveredResponse.metadata.humanReviewNeeded ? 'Yes' : 'No'}`);
  console.log(`  - Warnings: ${deliveredResponse.warnings?.length || 0}`);
  console.log(`  - Evidence Items: ${deliveredResponse.evidence?.length || 0}`);
  console.log(`  - Feedback ID: ${deliveredResponse.feedbackId}`);
  console.log('');

  // Display final response
  console.log('📄 Final Delivered Response:');
  console.log('─'.repeat(60));
  console.log(deliveredResponse.content);
  console.log('─'.repeat(60));
  console.log('');

  // Simulate user feedback
  console.log('👤 Simulating User Feedback...');
  deliveryManager.captureFeedback(deliveredResponse.feedbackId, {
    helpful: true,
    accurate: true,
    comments: 'Great explanation of transformer architecture!'
  });

  // Train calibrator with feedback (simulated)
  const calibrationData: CalibrationData[] = [{
    predictedConfidence: evaluationResult.overallConfidence,
    actualAccuracy: 0.9 // Based on positive feedback
  }];
  
  calibrator.trainCalibration(calibrationData, 'temperature_scaling');
  
  console.log('  - Feedback captured successfully');
  console.log('  - Calibration data updated');
  console.log('');

  // Show performance stats
  const stats = deliveryManager.getDeliveryStats();
  console.log('📈 Performance Statistics:');
  console.log(`  - Total Deliveries: ${stats.total}`);
  console.log(`  - Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
  console.log(`  - Feedback Rate: ${(stats.feedbackRate * 100).toFixed(1)}%`);
}

// Error handling wrapper
async function runExample() {
  try {
    await confidenceScoredRAGExample();
  } catch (error) {
    console.error('❌ Error in confidence-scored RAG example:', error);
    console.error('Make sure Ollama is running and the required models are available.');
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}