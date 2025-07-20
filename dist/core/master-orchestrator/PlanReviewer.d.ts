import type { Plan, ExecutionResult, ReviewResult } from "./types";
export declare class PlanReviewer {
    constructor();
    reviewPlan(plan: Plan): Promise<ReviewResult>;
    reviewExecution(plan: Plan, executionResult: ExecutionResult): Promise<ReviewResult>;
}
//# sourceMappingURL=PlanReviewer.d.ts.map