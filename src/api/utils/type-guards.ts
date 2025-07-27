/**
 * Type guards for runtime type checking
 */

import type { ConfidenceMasterOrchestrator } from "../../core/master-orchestrator/ConfidenceMasterOrchestrator";
import type { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator";

/**
 * Check if an orchestrator is a ConfidenceMasterOrchestrator
 * This is needed because the context type can have either MasterOrchestrator or ConfidenceMasterOrchestrator
 * but some endpoints require ConfidenceMasterOrchestrator specifically
 */
export function isConfidenceOrchestrator(
  orchestrator: MasterOrchestrator | ConfidenceMasterOrchestrator,
): orchestrator is ConfidenceMasterOrchestrator {
  // Check for constructor name as a more reliable indicator
  if (orchestrator.constructor.name === "ConfidenceMasterOrchestrator") {
    return true;
  }

  // Fallback: Check for methods that only exist on ConfidenceMasterOrchestrator
  // Note: These properties might not exist, so we check safely
  return (
    "confidenceRAG" in orchestrator ||
    "performanceOptimizer" in orchestrator ||
    ("captureFeedback" in orchestrator &&
      typeof (orchestrator as any).captureFeedback === "function") ||
    ("getPerformanceStats" in orchestrator &&
      typeof (orchestrator as any).getPerformanceStats === "function")
  );
}

/**
 * Assert that an orchestrator is a ConfidenceMasterOrchestrator
 * Throws if not
 */
export function assertConfidenceOrchestrator(
  orchestrator: MasterOrchestrator | ConfidenceMasterOrchestrator,
  message = "This endpoint requires ConfidenceMasterOrchestrator",
): asserts orchestrator is ConfidenceMasterOrchestrator {
  if (!isConfidenceOrchestrator(orchestrator)) {
    throw new Error(message);
  }
}
