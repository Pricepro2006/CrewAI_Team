#!/usr/bin/env tsx

/**
 * Test JSON Parsing Fix for Phase 2 Analysis
 * 
 * Tests the improved JSON extraction logic with various LLM response formats
 */

import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("JSONParsingTest");

// Test cases with different response formats
const testResponses = [
  {
    name: "Clean JSON",
    response: `{
      "workflow_validation": "Quote request workflow",
      "missed_entities": {
        "project_names": ["Project Alpha"],
        "company_names": ["Acme Corp"],
        "people": ["John Doe"],
        "products": ["HP Laptop"],
        "technical_specs": ["16GB RAM"],
        "locations": ["New York"],
        "other_references": ["REF-123"]
      },
      "action_items": [],
      "extracted_requirements": ["Need quote by Friday"],
      "risk_assessment": "Low risk",
      "initial_response": "Will provide quote",
      "confidence": 0.85,
      "business_process": "Quote Generation"
    }`
  },
  {
    name: "JSON with prefix",
    response: `Based on the analysis of the email:
    
    {
      "workflow_validation": "Quote request workflow",
      "missed_entities": {
        "project_names": ["Project Alpha"],
        "company_names": ["Acme Corp"],
        "people": ["John Doe"],
        "products": ["HP Laptop"],
        "technical_specs": ["16GB RAM"],
        "locations": ["New York"],
        "other_references": ["REF-123"]
      },
      "action_items": [],
      "extracted_requirements": ["Need quote by Friday"],
      "risk_assessment": "Low risk",
      "initial_response": "Will provide quote",
      "confidence": 0.85,
      "business_process": "Quote Generation"
    }`
  },
  {
    name: "JSON in markdown",
    response: `Here's the JSON response:

    \`\`\`json
    {
      "workflow_validation": "Quote request workflow",
      "missed_entities": {
        "project_names": ["Project Alpha"],
        "company_names": ["Acme Corp"],
        "people": ["John Doe"],
        "products": ["HP Laptop"],
        "technical_specs": ["16GB RAM"],
        "locations": ["New York"],
        "other_references": ["REF-123"]
      },
      "action_items": [],
      "extracted_requirements": ["Need quote by Friday"],
      "risk_assessment": "Low risk",
      "initial_response": "Will provide quote",
      "confidence": 0.85,
      "business_process": "Quote Generation"
    }
    \`\`\`
    
    This analysis shows...`
  },
  {
    name: "JSON with trailing text",
    response: `{
      "workflow_validation": "Quote request workflow",
      "missed_entities": {
        "project_names": ["Project Alpha"],
        "company_names": ["Acme Corp"],
        "people": ["John Doe"],
        "products": ["HP Laptop"],
        "technical_specs": ["16GB RAM"],
        "locations": ["New York"],
        "other_references": ["REF-123"]
      },
      "action_items": [],
      "extracted_requirements": ["Need quote by Friday"],
      "risk_assessment": "Low risk",
      "initial_response": "Will provide quote",
      "confidence": 0.85,
      "business_process": "Quote Generation"
    }
    
    Note: This email appears to be a standard quote request.`
  },
  {
    name: "Malformed JSON with unquoted keys",
    response: `{
      workflow_validation: "Quote request workflow",
      missed_entities: {
        project_names: ["Project Alpha"],
        company_names: ["Acme Corp"],
        people: ["John Doe"],
        products: ["HP Laptop"],
        technical_specs: ["16GB RAM"],
        locations: ["New York"],
        other_references: ["REF-123"]
      },
      action_items: [],
      extracted_requirements: ["Need quote by Friday"],
      risk_assessment: "Low risk",
      initial_response: "Will provide quote",
      confidence: 0.85,
      business_process: "Quote Generation"
    }`
  }
];

async function testJsonParsing() {
  logger.info("Testing JSON Parsing Improvements");
  logger.info("================================");
  
  // Create a minimal service instance just for testing the parsing
  const service = new EmailThreePhaseAnalysisService();
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testResponses) {
    logger.info(`\nTesting: ${test.name}`);
    
    try {
      // Access the private method via prototype
      const extractMethod = (service as any).extractJsonFromResponse.bind(service);
      const result = extractMethod(test.response);
      
      if (result) {
        // Try to parse the extracted JSON
        const parsed = JSON.parse(result);
        
        // Validate it has expected structure
        if (parsed.workflow_validation && parsed.missed_entities && parsed.confidence) {
          logger.info(`✅ PASSED - Successfully extracted and parsed JSON`);
          passed++;
        } else {
          logger.error(`❌ FAILED - JSON missing required fields`);
          failed++;
        }
      } else {
        logger.error(`❌ FAILED - No JSON extracted from response`);
        failed++;
      }
    } catch (error) {
      logger.error(`❌ FAILED - ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }
  
  logger.info("\n================================");
  logger.info("Test Summary");
  logger.info("================================");
  logger.info(`Total Tests: ${testResponses.length}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);
  logger.info(`Success Rate: ${((passed / testResponses.length) * 100).toFixed(1)}%`);
  
  // Test with actual email processing
  logger.info("\n================================");
  logger.info("Testing with Real Email");
  logger.info("================================");
  
  const testEmail = {
    id: "test-email-1",
    subject: "Quote Request for HP Laptops",
    body: "Hi, we need a quote for 10 HP laptops with 16GB RAM for our new office in New York. Project Alpha needs these by Friday. Please send quote to john.doe@acme.com",
    sender_email: "john.doe@acme.com",
    received_at: new Date().toISOString()
  };
  
  try {
    logger.info("Analyzing test email...");
    const result = await service.analyzeEmail(testEmail, {
      skipCache: true,
      skipPhases: ["phase3"], // Only test Phase 1 and 2
      timeout: 30000
    });
    
    logger.info("✅ Email analysis completed successfully");
    logger.info(`Workflow: ${result.workflow_validation}`);
    logger.info(`Entities found: ${JSON.stringify(result.missed_entities)}`);
    logger.info(`Confidence: ${result.confidence}`);
  } catch (error) {
    logger.error(`❌ Email analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the test
testJsonParsing().catch((error) => {
  logger.error("Test runner error:", error);
  process.exit(1);
});