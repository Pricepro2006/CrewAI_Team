import { OllamaProvider } from '../llm/OllamaProvider';
import { AgentRegistry } from '../agents/registry/AgentRegistry';
import { RAGSystem } from '../rag/RAGSystem';
import { PlanExecutor } from './PlanExecutor';
import { PlanReviewer } from './PlanReviewer';
import type { Plan, ExecutionResult, Query, MasterOrchestratorConfig, ReviewResult } from './types';
import { logger, createPerformanceMonitor } from '../../utils/logger';

export class MasterOrchestrator {
  private llm: OllamaProvider;
  public agentRegistry: AgentRegistry;
  public ragSystem: RAGSystem;
  private planExecutor: PlanExecutor;
  private planReviewer: PlanReviewer;
  private perfMonitor = createPerformanceMonitor('MasterOrchestrator');

  constructor(config: MasterOrchestratorConfig) {
    logger.info('Initializing MasterOrchestrator', 'ORCHESTRATOR', { config });
    
    this.llm = new OllamaProvider({
      model: 'qwen3:14b',
      baseUrl: config.ollamaUrl
    });
    
    this.agentRegistry = new AgentRegistry();
    this.ragSystem = new RAGSystem(config.rag);
    this.planExecutor = new PlanExecutor(this.agentRegistry, this.ragSystem);
    this.planReviewer = new PlanReviewer(this.llm);
    
    logger.info('MasterOrchestrator initialized successfully', 'ORCHESTRATOR');
  }

  async processQuery(query: Query): Promise<ExecutionResult> {
    const perf = this.perfMonitor.start('processQuery');
    
    logger.info('Processing query', 'ORCHESTRATOR', { 
      query: query.text.substring(0, 100),
      conversationId: query.conversationId 
    });

    try {
      // Step 1: Create initial plan
      let plan = await this.createPlan(query);
      
      // Step 2: Execute plan with replan loop
      let executionResult: ExecutionResult;
      let attempts = 0;
      const maxAttempts = 3;

      do {
        logger.debug(`Executing plan (attempt ${attempts + 1}/${maxAttempts})`, 'ORCHESTRATOR', {
          stepsCount: plan.steps.length
        });
        
        executionResult = await this.planExecutor.execute(plan);
        
        // Step 3: Review execution results
        const review = await this.planReviewer.review(
          query, 
          plan, 
          executionResult
        );

        logger.debug('Plan review completed', 'ORCHESTRATOR', {
          satisfactory: review.satisfactory,
          attempts: attempts + 1
        });

        if (!review.satisfactory && attempts < maxAttempts) {
          // Step 4: Replan if necessary
          logger.info('Replanning due to unsatisfactory results', 'ORCHESTRATOR', {
            feedback: review.feedback,
            failedSteps: review.failedSteps
          });
          
          plan = await this.replan(query, plan, review);
          attempts++;
        } else {
          break;
        }
      } while (attempts < maxAttempts);

      // Step 5: Format and return final response
      const result = this.formatResponse(executionResult);
      
      logger.info('Query processing completed', 'ORCHESTRATOR', {
        success: result.metadata?.['successfulSteps'] === result.metadata?.['totalSteps'],
        attempts: attempts + 1,
        totalSteps: result.metadata?.['totalSteps']
      });
      
      perf.end({ success: true });
      return result;
    } catch (error) {
      logger.error('Query processing failed', 'ORCHESTRATOR', { query: query.text }, error as Error);
      perf.end({ success: false });
      throw error;
    }
  }

  private async createPlan(query: Query): Promise<Plan> {
    const prompt = `
      You are the Master Orchestrator. Create a detailed plan to address this query:
      "${query.text}"
      
      Break down the task into clear, actionable steps.
      For each step, determine:
      1. What information is needed (RAG query)
      2. Which agent should handle it
      3. What tools might be required
      4. Expected output
      
      Return a structured plan in JSON format with the following structure:
      {
        "steps": [
          {
            "id": "step-1",
            "description": "Description of the step",
            "agentType": "ResearchAgent|CodeAgent|DataAnalysisAgent|WriterAgent|ToolExecutorAgent",
            "requiresTool": boolean,
            "toolName": "tool_name" (if requiresTool is true),
            "ragQuery": "Query for RAG system",
            "expectedOutput": "Description of expected output",
            "dependencies": ["step-ids"] (optional)
          }
        ]
      }
    `;

    const response = await this.llm.generate(prompt, {
      format: 'json',
      temperature: 0.3,
      maxTokens: 2000
    });
    return this.parsePlan(response, query);
  }

  private async replan(
    query: Query, 
    originalPlan: Plan, 
    review: ReviewResult
  ): Promise<Plan> {
    const prompt = `
      The original plan did not satisfy the requirements.
      
      Original Query: "${query.text}"
      Original Plan: ${JSON.stringify(originalPlan)}
      Review Feedback: ${review.feedback}
      Failed Steps: ${JSON.stringify(review.failedSteps)}
      
      Create a revised plan that addresses the issues.
      Focus on:
      1. Fixing the failed steps
      2. Adding missing information gathering steps
      3. Ensuring proper agent and tool selection
      
      Return the revised plan in the same JSON format.
    `;

    const response = await this.llm.generate(prompt, {
      format: 'json',
      temperature: 0.3,
      maxTokens: 2000
    });
    return this.parsePlan(response, query);
  }

  private parsePlan(response: string, query?: Query): Plan {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the plan structure
      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error('Invalid plan structure: missing steps array');
      }
      
      return {
        steps: parsed.steps.map((step: any) => ({
          id: step.id || `step-${Date.now()}-${Math.random()}`,
          description: step.description,
          agentType: step.agentType,
          requiresTool: step.requiresTool || false,
          toolName: step.toolName,
          ragQuery: step.ragQuery,
          expectedOutput: step.expectedOutput,
          dependencies: step.dependencies || [],
          parameters: step.parameters || {}
        }))
      };
    } catch (error) {
      console.error('Failed to parse plan:', error);
      // Return a fallback plan
      return {
        steps: [{
          id: 'fallback-1',
          description: 'Process query with general approach',
          agentType: 'ResearchAgent',
          requiresTool: false,
          ragQuery: query?.text || 'General query processing',
          expectedOutput: 'General response to query',
          dependencies: []
        }]
      };
    }
  }

  private formatResponse(executionResult: ExecutionResult): ExecutionResult {
    // Consolidate results into a coherent response
    const summary = executionResult.results
      .map(result => result.output)
      .filter(output => output)
      .join('\n\n');

    return {
      ...executionResult,
      summary,
      metadata: {
        totalSteps: executionResult.results.length,
        successfulSteps: executionResult.results.filter(r => r.success).length,
        timestamp: new Date().toISOString()
      }
    };
  }

  async initialize(): Promise<void> {
    // Initialize all components
    await Promise.all([
      this.agentRegistry.initialize(),
      this.ragSystem.initialize(),
      this.llm.initialize()
    ]);
  }
}
