/**
 * Example: Creating an AI Agent with Knowledge-Backed LLM
 * This demonstrates how to integrate the Knowledge-Backed LLM with CrewAI agents
 */

import { KnowledgeBackedLLM } from '../core/llm/KnowledgeBackedLLM.js';
import { RAGSystem } from '../core/rag/RAGSystem.js';
import { BaseAgent } from '../core/agents/base/BaseAgent.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';

// Email interface for type safety
interface EmailData {
  id: string;
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

// Analysis response interface
interface AnalysisResponse {
  emailId: string;
  analysis: any;
  contextUsed?: number;
  metadata?: any;
  rawResponse?: any;
}

/**
 * Knowledge-Enhanced Email Analysis Agent
 * Uses RAG to provide context-aware email analysis
 */
class KnowledgeEnhancedEmailAgent extends BaseAgent {
  private knowledgeLLM: KnowledgeBackedLLM | null = null;
  private ragSystem: RAGSystem | null = null;

  constructor() {
    super({
      name: 'KnowledgeEnhancedEmailAgent',
      description: 'Analyzes emails with context from knowledge base',
      capabilities: ['email-analysis', 'entity-extraction', 'business-intelligence'],
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Initialize RAG system
    this.ragSystem = new RAGSystem({
      vectorStore: {
        type: 'adaptive',
        baseUrl: process.env.CHROMADB_URL || 'http://localhost:8001',
        collectionName: 'email-knowledge-base',
      },
      chunking: {
        chunkSize: 500,
        chunkOverlap: 50,
      },
      retrieval: {
        topK: 5,
        minScore: 0.5,
      },
    });

    await this.ragSystem.initialize();
    logger.info('RAG system initialized', 'KNOWLEDGE_AGENT');

    // Initialize Knowledge-Backed LLM
    const modelPath = process.env.MISTRAL_MODEL_PATH || 
      '/home/pricepro2006/CrewAI_Team/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf';
    const fallbackPath = process.env.LLAMA_MODEL_PATH || 
      '/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf';

    this.knowledgeLLM = new KnowledgeBackedLLM(
      {
        modelPath: modelPath,
        fallbackModelPath: fallbackPath,
        contextSize: 8192,
        threads: 8,
        temperature: 0.7,
        gpuLayers: parseInt(process.env.LLM_GPU_LAYERS || '0'),
        ragConfig: {
          enabled: true,
          topK: 5,
          minScore: 0.5,
          maxContextDocs: 3,
        },
      },
      this.ragSystem
    );

    await this.knowledgeLLM.initialize();
    logger.info('Knowledge-Backed LLM initialized', 'KNOWLEDGE_AGENT');
  }

  async analyzeEmail(email: EmailData): Promise<AnalysisResponse> {
    if (!this.knowledgeLLM) {
      throw new Error('Agent not initialized');
    }

    // First, add email to knowledge base for future reference
    await this.knowledgeLLM.addToKnowledgeBase(
      `Subject: ${email.subject}\n\nBody: ${email.body}`,
      {
        id: email.id,
        type: 'email',
        timestamp: new Date().toISOString(),
        ...email.metadata,
      }
    );

    // Build analysis prompt
    const analysisPrompt = `Analyze the following business email and extract key information.

Email Subject: ${email.subject}
Email Body: ${email.body}

Please provide:
1. Entity Extraction: Identify all business entities (companies, people, products, order numbers, etc.)
2. Workflow Classification: Determine the type of business workflow (quote-to-order, support, fulfillment, etc.)
3. Business Intelligence: Extract any financial data, deadlines, action items, or strategic insights
4. Sentiment Analysis: Determine the overall sentiment and urgency level
5. Recommended Actions: Suggest next steps based on the email content

Format your response as a structured JSON object.`;

    // Generate response with RAG context
    const response = await this.knowledgeLLM.generateWithContext(analysisPrompt, {
      temperature: 0.3, // Lower temperature for more structured output
      maxTokens: 1024,
      useRAG: true,
      format: 'json',
      jsonSchema: {
        type: 'object',
        properties: {
          entities: {
            type: 'object',
            properties: {
              companies: { type: 'array', items: { type: 'string' } },
              people: { type: 'array', items: { type: 'string' } },
              products: { type: 'array', items: { type: 'string' } },
              orderNumbers: { type: 'array', items: { type: 'string' } },
              dates: { type: 'array', items: { type: 'string' } },
            },
          },
          workflow: { type: 'string' },
          businessIntelligence: {
            type: 'object',
            properties: {
              financialData: { type: 'array', items: { type: 'object' } },
              actionItems: { type: 'array', items: { type: 'string' } },
              deadlines: { type: 'array', items: { type: 'string' } },
              insights: { type: 'array', items: { type: 'string' } },
            },
          },
          sentiment: {
            type: 'object',
            properties: {
              overall: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
              urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            },
          },
          recommendedActions: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    // Parse and return the analysis
    try {
      const analysis = typeof response.response === 'string' 
        ? JSON.parse(response.response) 
        : response.response;

      return {
        emailId: email.id,
        analysis,
        contextUsed: response.context?.length || 0,
        metadata: response.metadata,
      };
    } catch (error) {
      logger.error('Failed to parse analysis response', 'KNOWLEDGE_AGENT', { error });
      return {
        emailId: email.id,
        analysis: { error: 'Failed to parse response' },
        rawResponse: response.response,
      };
    }
  }

  async processEmailChain(emails: EmailData[]): Promise<{
    individualAnalyses: AnalysisResponse[];
    chainInsights: string;
    totalEmailsProcessed: number;
  }> {
    const chainAnalyses = [];

    for (const email of emails) {
      const analysis = await this.analyzeEmail(email);
      chainAnalyses.push(analysis);
    }

    // Generate chain-level insights using accumulated context
    const chainPrompt = `Based on the email chain analysis, provide high-level insights about:
1. The overall business transaction or workflow
2. Key stakeholders and their roles
3. Timeline and critical milestones
4. Potential risks or opportunities
5. Recommended strategic actions`;

    const chainInsights = await this.knowledgeLLM!.generateWithContext(chainPrompt, {
      temperature: 0.5,
      maxTokens: 512,
      useRAG: true,
    });

    return {
      individualAnalyses: chainAnalyses,
      chainInsights: chainInsights.response as string,
      totalEmailsProcessed: emails.length,
    };
  }

  async cleanup(): Promise<void> {
    if (this.knowledgeLLM) {
      await this.knowledgeLLM.cleanup();
    }
    await super.cleanup();
  }
}

/**
 * Example usage
 */
async function demonstrateKnowledgeBackedAgent() {
  console.log('🚀 Knowledge-Backed Agent Demonstration\n');
  
  // Check if models exist
  const modelPath = '/home/pricepro2006/CrewAI_Team/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf';
  const fallbackPath = '/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf';
  
  if (!fs.existsSync(modelPath) && !fs.existsSync(fallbackPath)) {
    console.log('⚠️ Models not found. Please run: ./scripts/download-models.sh');
    return;
  }

  try {
    // Initialize agent
    const agent = new KnowledgeEnhancedEmailAgent();
    await agent.initialize();
    console.log('✅ Agent initialized with Knowledge-Backed LLM\n');

    // Sample emails for analysis
    const sampleEmails = [
      {
        id: 'email-001',
        subject: 'RE: Quote Request for HP ProBook 450 G10 - Urgent',
        body: `Hi Sarah,

Following up on our conversation yesterday, I'd like to request a formal quote for:
- 50x HP ProBook 450 G10 (Part: 7W8Q4EA#ABA)
- 50x HP USB-C Dock G5 (Part: 5TW10AA#ABA)

We need delivery by March 15th, 2025 to our Dallas facility. 
Our purchase order number will be PO-2025-03847.

Please include any volume discounts available and confirm the warranty terms.

Best regards,
John Martinez
Procurement Manager
TechCorp Solutions`,
        metadata: {
          sender: 'john.martinez@techcorp.com',
          recipient: 'sarah.wilson@supplier.com',
          timestamp: '2025-02-10T14:30:00Z',
        },
      },
      {
        id: 'email-002',
        subject: 'RE: Quote Request for HP ProBook 450 G10 - Urgent',
        body: `Hi John,

Thank you for your inquiry. I'm pleased to provide the following quote:

HP ProBook 450 G10 (7W8Q4EA#ABA):
- Unit Price: $899.00
- Quantity: 50
- Volume Discount: 8%
- Subtotal: $41,354.00

HP USB-C Dock G5 (5TW10AA#ABA):
- Unit Price: $189.00
- Quantity: 50
- Volume Discount: 5%
- Subtotal: $8,977.50

Total: $50,331.50
Delivery: Confirmed for March 15th, 2025
Warranty: 3-year manufacturer warranty included
Payment Terms: Net 30

This quote is valid until February 28th, 2025.
Quote Reference: QT-2025-0847

Best regards,
Sarah Wilson
Senior Account Manager`,
        metadata: {
          sender: 'sarah.wilson@supplier.com',
          recipient: 'john.martinez@techcorp.com',
          timestamp: '2025-02-10T16:45:00Z',
        },
      },
    ];

    // Analyze individual emails
    console.log('📧 Analyzing individual emails...\n');
    for (const email of sampleEmails) {
      const analysis = await agent.analyzeEmail(email);
      console.log(`Email: ${email.subject}`);
      console.log('Analysis:', JSON.stringify(analysis.analysis, null, 2));
      console.log(`Context documents used: ${analysis.contextUsed}`);
      console.log('-'.repeat(50) + '\n');
    }

    // Analyze email chain
    console.log('🔗 Analyzing email chain...\n');
    const chainAnalysis = await agent.processEmailChain(sampleEmails);
    console.log('Chain Insights:', chainAnalysis.chainInsights);
    console.log(`Total emails processed: ${chainAnalysis.totalEmailsProcessed}`);

    // Cleanup
    await agent.cleanup();
    console.log('\n✅ Demonstration completed successfully');
  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  }
}

// Export for use in other modules
export { KnowledgeEnhancedEmailAgent, demonstrateKnowledgeBackedAgent };

// Run demonstration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateKnowledgeBackedAgent().catch(console.error);
}