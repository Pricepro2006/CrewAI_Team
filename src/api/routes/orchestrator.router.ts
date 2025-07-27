import { Router } from "express";
import { TRPCError } from "@trpc/server";
import type { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator";
import type { ConfidenceMasterOrchestrator } from "../../core/master-orchestrator/ConfidenceMasterOrchestrator";
import { isConfidenceOrchestrator } from "../utils/type-guards";

const router = Router();

// Example of proper type narrowing for union types
export function handleOrchestratorRoute(
  orchestrator: MasterOrchestrator | ConfidenceMasterOrchestrator,
) {
  // Both MasterOrchestrator and ConfidenceMasterOrchestrator have these properties
  // so they can be accessed directly on the union type
  const registry = orchestrator.agentRegistry;
  const rag = orchestrator.ragSystem;

  // If you need ConfidenceMasterOrchestrator-specific features
  if (isConfidenceOrchestrator(orchestrator)) {
    // Now TypeScript knows this is ConfidenceMasterOrchestrator
    const stats = orchestrator.getPerformanceStats();
    orchestrator.captureFeedback("feedback-123", { helpful: true });
  }

  return { registry, rag };
}

export default router;
