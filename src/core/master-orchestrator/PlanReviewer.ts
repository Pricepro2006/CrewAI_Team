import { OllamaProvider } from '../llm/OllamaProvider';
import type { Query, Plan, ExecutionResult, ReviewResult } from './types';

export class PlanReviewer {
  constructor(private llm: OllamaProvider) {}

  async review(
    query: Query,
    plan: Plan,
    executionResult: ExecutionResult
  ): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(query, plan, executionResult);
    const response = await this.llm.generate(prompt, { format: 'json' });
    
    return this.parseReviewResult(response, executionResult);
  }

  private buildReviewPrompt(
    query: Query,
    plan: Plan,
    executionResult: ExecutionResult
  ): string {
    return `
      You are reviewing the execution results of a plan. Determine if the results satisfactorily address the original query.
      
      Original Query: "${query.text}"
      
      Plan Overview:
      ${plan.steps.map((step, i) => `
        ${i + 1}. ${step.description}
        - Agent: ${step.agentType}
        - Expected: ${step.expectedOutput}
      `).join('\n')}
      
      Execution Results:
      ${executionResult.results.map((result, i) => `
        Step ${i + 1} (${result.stepId}):
        - Success: ${result.success}
        - Output: ${result.output || 'No output'}
        - Error: ${result.error || 'None'}
      `).join('\n\n')}
      
      Summary: ${executionResult.summary}
      
      Review the results and determine:
      1. Does the execution satisfy the original query?
      2. Which steps failed or produced inadequate results?
      3. What specific improvements are needed?
      
      Respond with a JSON object:
      {
        "satisfactory": boolean,
        "feedback": "Detailed explanation of the review",
        "failedSteps": ["step-id-1", "step-id-2"],
        "suggestions": [
          "Specific suggestion 1",
          "Specific suggestion 2"
        ],
        "score": 0-100
      }
    `;
  }

  private parseReviewResult(
    response: string,
    executionResult: ExecutionResult
  ): ReviewResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        satisfactory: parsed.satisfactory || false,
        feedback: parsed.feedback || 'No feedback provided',
        failedSteps: parsed.failedSteps || this.identifyFailedSteps(executionResult),
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      console.error('Failed to parse review result:', error);
      
      // Fallback review based on execution results
      return this.generateFallbackReview(executionResult);
    }
  }

  private identifyFailedSteps(executionResult: ExecutionResult): string[] {
    return executionResult.results
      .filter(r => !r.success)
      .map(r => r.stepId);
  }

  private generateFallbackReview(executionResult: ExecutionResult): ReviewResult {
    const failedSteps = this.identifyFailedSteps(executionResult);
    const successRate = executionResult.results.filter(r => r.success).length / 
                       executionResult.results.length;

    return {
      satisfactory: successRate > 0.8 && failedSteps.length === 0,
      feedback: `Execution completed with ${Math.round(successRate * 100)}% success rate.`,
      failedSteps,
      suggestions: failedSteps.length > 0 
        ? ['Retry failed steps with adjusted parameters', 'Consider alternative agents or tools']
        : []
    };
  }
}
