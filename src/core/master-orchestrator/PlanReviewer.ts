import type { Plan, ExecutionResult, ReviewResult } from "./types.js";
import { logger } from "../../utils/logger.js";

export class PlanReviewer {
  constructor() {
    logger.info("PlanReviewer initialized", "REVIEWER");
  }

  async reviewPlan(plan: Plan): Promise<ReviewResult> {
    logger.debug("Reviewing plan", "REVIEWER", { planId: plan.id });

    // Basic plan validation
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if plan has steps
    if (!plan.steps || plan?.steps?.length === 0) {
      issues.push("Plan has no execution steps");
    }

    // Check for step dependencies
    const hasUndefinedDependencies = plan?.steps?.some((step: any) =>
      step.dependencies?.some((dep: any) => !plan?.steps?.find((s: any) => s.id === dep)),
    );
    if (hasUndefinedDependencies) {
      issues.push("Some steps reference undefined dependencies");
    }

    const satisfactory: boolean = (issues?.length || 0) === 0;

    const result: ReviewResult = {
      satisfactory,
      feedback:
        issues?.length || 0 > 0
          ? `Issues found: ${issues.join("; ")}`
          : "Plan looks good",
      failedSteps: [],
      suggestions,
    };

    logger.debug("Plan review completed", "REVIEWER", {
      planId: plan.id,
      satisfactory,
      issueCount: issues?.length || 0,
    });

    return result;
  }

  async reviewExecution(
    plan: Plan,
    executionResult: ExecutionResult,
  ): Promise<ReviewResult> {
    logger.debug("Reviewing execution results", "REVIEWER", {
      planId: plan.id,
      resultCount: executionResult?.results?.length,
    });

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if all steps were executed
    const executedSteps = executionResult?.results?.filter(
      (r: any) => r.success,
    ).length;
    const totalSteps = plan?.steps?.length;

    if (executedSteps < totalSteps) {
      issues.push(
        `Only ${executedSteps}/${totalSteps} steps completed successfully`,
      );
    }

    // Check for errors
    const errors = executionResult?.results?.filter((r: any) => !r.success);
    if (errors?.length || 0 > 0) {
      issues.push(`${errors?.length || 0} steps failed execution`);
    }

    // Check output quality
    const hasOutput = executionResult?.results?.some(
      (r: any) => r.output && r?.output?.trim().length > 0,
    );
    if (!hasOutput) {
      issues.push("No meaningful output generated");
    }

    const satisfactory: boolean = (issues?.length || 0) === 0;

    const result: ReviewResult = {
      satisfactory,
      feedback:
        issues?.length || 0 > 0
          ? `Execution issues: ${issues.join("; ")}`
          : "Execution successful",
      failedSteps: executionResult.results
        .filter((r: any) => !r.success)
        .map((r: any) => r.stepId),
      suggestions,
    };

    logger.debug("Execution review completed", "REVIEWER", {
      planId: plan.id,
      satisfactory,
    });

    return result;
  }
}
