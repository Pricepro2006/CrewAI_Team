export interface OrchestrationPlan {
  id: string;
  steps: OrchestrationStep[];
  status: "pending" | "running" | "completed" | "failed";
}

export interface OrchestrationStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  dependencies?: string[];
}
