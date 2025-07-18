import { AgentRegistry } from "../agents/registry/AgentRegistry";
import { RAGSystem } from "../rag/RAGSystem";
import { wsService } from "../../api/services/WebSocketService";
import { withTimeout, DEFAULT_TIMEOUTS, TimeoutError } from "../../utils/timeout";
export class PlanExecutor {
    agentRegistry;
    ragSystem;
    constructor(agentRegistry, ragSystem) {
        this.agentRegistry = agentRegistry;
        this.ragSystem = ragSystem;
    }
    async execute(plan) {
        const results = [];
        const executedSteps = new Set();
        // Execute steps in dependency order
        const sortedSteps = this.topologicalSort(plan.steps);
        // Broadcast plan execution start
        wsService.broadcastPlanUpdate(plan.id, "executing", {
            completed: 0,
            total: sortedSteps.length,
        });
        for (const step of sortedSteps) {
            // Check if dependencies are satisfied
            if (!this.areDependenciesSatisfied(step, executedSteps)) {
                results.push({
                    stepId: step.id,
                    success: false,
                    error: "Dependencies not satisfied",
                    metadata: { skipped: true },
                });
                continue;
            }
            try {
                // Broadcast step start
                wsService.broadcastPlanUpdate(plan.id, "executing", {
                    completed: executedSteps.size,
                    total: sortedSteps.length,
                    currentStep: step.task,
                });
                // Step 1: Gather context from RAG
                const context = await this.gatherContext(step);
                // Step 2: Execute based on whether tool is required
                const result = step.requiresTool
                    ? await this.executeWithTool(step, context)
                    : await this.executeInformationQuery(step, context);
                results.push(result);
                executedSteps.add(step.id);
                // Step 3: Check if we should continue
                if (!this.shouldContinue(results)) {
                    break;
                }
            }
            catch (error) {
                results.push({
                    stepId: step.id,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    metadata: {
                        errorType: error instanceof Error ? error.name : "UnknownError",
                        isTimeout: error instanceof TimeoutError,
                        ...(error instanceof TimeoutError && { timeoutDuration: error.duration }),
                    },
                });
                // Log timeout errors specifically
                if (error instanceof TimeoutError) {
                    console.error(`Step ${step.id} timed out after ${error.duration}ms: ${error.message}`);
                }
            }
        }
        // Broadcast plan completion
        const success = results.every((r) => r.success);
        wsService.broadcastPlanUpdate(plan.id, success ? "completed" : "failed", {
            completed: executedSteps.size,
            total: sortedSteps.length,
        });
        return {
            success,
            results,
            summary: this.summarizeResults(results),
            completedSteps: results.filter((r) => r.success).length,
            failedSteps: results.filter((r) => !r.success).length,
            error: !success ? results.find((r) => !r.success)?.error : undefined,
        };
    }
    async executeWithProgress(plan, progressCallback) {
        const sortedSteps = this.topologicalSort(plan.steps);
        const results = [];
        const executedSteps = new Set();
        for (const step of sortedSteps) {
            progressCallback({
                completedSteps: executedSteps.size,
                totalSteps: sortedSteps.length,
                currentStep: step.id,
            });
            try {
                // Step 1: Gather context from RAG
                const context = await this.gatherContext(step);
                // Step 2: Execute based on whether tool is required
                const result = step.requiresTool
                    ? await this.executeWithTool(step, context)
                    : await this.executeInformationQuery(step, context);
                results.push(result);
                executedSteps.add(step.id);
                // Step 3: Check if we should continue
                if (!this.shouldContinue(results)) {
                    break;
                }
            }
            catch (error) {
                const errorResult = {
                    stepId: step.id,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                    metadata: {
                        errorType: error instanceof Error ? error.name : "UnknownError",
                    },
                };
                results.push(errorResult);
                progressCallback({
                    completedSteps: executedSteps.size,
                    totalSteps: sortedSteps.length,
                    currentStep: step.id,
                });
            }
        }
        // Final progress callback
        progressCallback({
            completedSteps: executedSteps.size,
            totalSteps: sortedSteps.length,
        });
        // Broadcast plan completion
        const success = results.every((r) => r.success);
        wsService.broadcastPlanUpdate(plan.id, success ? "completed" : "failed", {
            completed: executedSteps.size,
            total: sortedSteps.length,
        });
        return {
            success,
            results,
            summary: this.summarizeResults(results),
            completedSteps: results.filter((r) => r.success).length,
            failedSteps: results.filter((r) => !r.success).length,
            error: !success ? results.find((r) => !r.success)?.error : undefined,
        };
    }
    async gatherContext(step) {
        let documents = [];
        let relevance = 0;
        try {
            // Attempt to search RAG system with timeout
            const searchPromise = this.ragSystem.search(step.ragQuery, 5);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('RAG search timeout')), 5000));
            documents = await Promise.race([searchPromise, timeoutPromise]);
            relevance = this.calculateRelevance(documents, step);
        }
        catch (error) {
            // Log the error but don't fail the step
            console.warn(`RAG search failed for step ${step.id}:`, error instanceof Error ? error.message : 'Unknown error');
            console.warn('Continuing without RAG context');
            // Return empty context rather than throwing
            documents = [];
            relevance = 0;
        }
        return {
            documents: documents,
            relevance: relevance,
            metadata: {
                stepId: step.id,
                query: step.ragQuery,
                ragAvailable: documents.length > 0,
            },
        };
    }
    async executeWithTool(step, context) {
        if (!step.toolName) {
            throw new Error(`Step ${step.id} requires tool but no tool name specified`);
        }
        const agent = await this.agentRegistry.getAgent(step.agentType);
        const tool = agent.getTool(step.toolName);
        if (!tool) {
            throw new Error(`Tool ${step.toolName} not found for agent ${step.agentType}`);
        }
        const result = await withTimeout(agent.executeWithTool({
            tool,
            context: {
                task: step.description,
                ragDocuments: context.documents,
                tool: step.toolName,
            },
            parameters: step.parameters || {},
        }), DEFAULT_TIMEOUTS.TOOL_EXECUTION, `Tool execution timed out for ${step.toolName}`);
        return {
            stepId: step.id,
            success: result.success,
            ...(result.output && { output: result.output }),
            ...(result.data && { data: result.data }),
            ...(result.error && { error: result.error }),
            metadata: {
                ...result.metadata,
                toolUsed: step.toolName,
                contextRelevance: context.relevance,
            },
        };
    }
    async executeInformationQuery(step, context) {
        const agent = await this.agentRegistry.getAgent(step.agentType);
        const result = await withTimeout(agent.execute(step.description, {
            task: step.description,
            ragDocuments: context.documents,
        }), DEFAULT_TIMEOUTS.AGENT_EXECUTION, `Agent execution timed out for ${step.agentType}`);
        return {
            stepId: step.id,
            success: result.success,
            ...(result.output && { output: result.output }),
            ...(result.data && { data: result.data }),
            ...(result.error && { error: result.error }),
            metadata: {
                ...result.metadata,
                contextRelevance: context.relevance,
            },
        };
    }
    calculateRelevance(documents, _step) {
        if (documents.length === 0)
            return 0;
        // Average relevance score of top documents
        const scores = documents.slice(0, 3).map((doc) => doc.score || 0);
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    shouldContinue(results) {
        // Stop if too many failures
        const failures = results.filter((r) => !r.success).length;
        const total = results.length;
        if (total > 0 && failures / total > 0.5) {
            return false;
        }
        // Stop if critical error
        const hasCriticalError = results.some((r) => r.metadata?.["errorType"] === "CriticalError");
        return !hasCriticalError;
    }
    summarizeResults(results) {
        const successful = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);
        const parts = [];
        if (successful.length > 0) {
            parts.push("Completed Steps:");
            successful.forEach((r) => {
                if (r.output) {
                    parts.push(r.output);
                }
            });
        }
        if (failed.length > 0) {
            parts.push("\nFailed Steps:");
            failed.forEach((r) => {
                parts.push(`- ${r.stepId}: ${r.error || "Unknown error"}`);
            });
        }
        return parts.join("\n");
    }
    topologicalSort(steps) {
        const graph = new Map();
        const inDegree = new Map();
        const adjList = new Map();
        // Build graph
        steps.forEach((step) => {
            graph.set(step.id, step);
            inDegree.set(step.id, 0);
            adjList.set(step.id, []);
        });
        // Calculate in-degrees and adjacency list
        steps.forEach((step) => {
            const dependencies = step.dependencies || [];
            dependencies.forEach((dep) => {
                if (graph.has(dep)) {
                    inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
                    adjList.get(dep)?.push(step.id);
                }
            });
        });
        // Find nodes with no dependencies
        const queue = [];
        inDegree.forEach((degree, id) => {
            if (degree === 0) {
                queue.push(id);
            }
        });
        const sorted = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const step = graph.get(current);
            sorted.push(step);
            // Update neighbors
            adjList.get(current)?.forEach((neighbor) => {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            });
        }
        // Check for cycles
        if (sorted.length !== steps.length) {
            console.warn("Circular dependencies detected in plan");
            // Return original order as fallback
            return steps;
        }
        return sorted;
    }
    areDependenciesSatisfied(step, executedSteps) {
        return (step.dependencies || []).every((dep) => executedSteps.has(dep));
    }
    buildRAGQuery(step) {
        // Enhance the RAG query with context
        const parts = [step.ragQuery];
        if (step.expectedOutput) {
            parts.push(`Expected output: ${step.expectedOutput}`);
        }
        if (step.toolName) {
            parts.push(`Tool context: ${step.toolName}`);
        }
        return parts.join(" ");
    }
}
//# sourceMappingURL=PlanExecutor.js.map