import { OllamaProvider } from '../llm/OllamaProvider';
import { AgentRegistry } from '../agents/registry/AgentRegistry';
import { RAGSystem } from '../rag/RAGSystem';
import { PlanExecutor } from './PlanExecutor';
import { PlanReviewer } from './PlanReviewer';
import { Plan, ExecutionResult, Query, MasterOrchestratorConfig, ReviewResult } from './types';

export class MasterOrchestrator {
  private llm: OllamaProvider;
  private agentRegistry: AgentRegistry;
  private ragSystem: RAGSystem;
  private planExecutor: PlanExecutor;
  private planReviewer: PlanReviewer;

  constructor(config: MasterOrchestratorConfig) {
    this.llm = new OllamaProvider({
      model: 'qwen3:14b',
      baseUrl: config.ollamaUrl
    });
    
    this.agentRegistry = new AgentRegistry();
    this.ragSystem = new RAGSystem(config.rag);
    this.planExecutor = new PlanExecutor(this.agentRegistry, this.ragSystem);
    this.planReviewer = new PlanReviewer(this.llm);
  }

  async processQuery(query: Query): Promise<ExecutionResult> {
    // Step 1: Create initial plan
    const plan = await this.createPlan(query);
    
    // Step 2: Execute plan with replan loop
    let executionResult: ExecutionResult;
    let attempts = 0;
    const maxAttempts = 3;

    do {
      executionResult = await this.planExecutor.execute(plan);
      
      // Step 3: Review execution results
      const review = await this.planReviewer.review(
        query, 
        plan, 
        executionResult
      );

      if (!review.satisfactory && attempts < maxAttempts) {
        // Step 4: Replan if necessary
        plan = await this.replan(query, plan, review);
        attempts++;
      } else {
        break;
      }
    } while (attempts < maxAttempts);

    // Step 5: Format and return final response
    return this.formatResponse(executionResult);
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

    const response = await this.llm.generate(prompt);
    return this.parsePlan(response);
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

    const response = await this.llm.generate(prompt);
    return this.parsePlan(response);
  }

  private parsePlan(response: string): Plan {
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
          ragQuery: query.text,
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
