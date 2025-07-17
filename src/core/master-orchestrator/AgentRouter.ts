import { OllamaProvider } from "../llm/OllamaProvider";
import type {
  QueryAnalysis,
  AgentRoutingPlan,
  AgentSelection,
  RiskAssessment,
} from "./enhanced-types";
import { logger } from "../../utils/logger";

/**
 * Intelligent agent router for optimal agent selection
 * Based on agent template patterns for sophisticated routing
 */
export class AgentRouter {
  private llm: OllamaProvider;
  private agentCapabilities: Map<string, string[]> = new Map();
  private performanceHistory: Map<string, number> = new Map();

  constructor(llm: OllamaProvider) {
    this.llm = llm;
    this.initializeCapabilities();
  }

  private initializeCapabilities(): void {
    this.agentCapabilities = new Map([
      [
        "ResearchAgent",
        [
          "web_search",
          "information_gathering",
          "data_collection",
          "fact_checking",
          "literature_review",
          "market_research",
        ],
      ],
      [
        "CodeAgent",
        [
          "programming",
          "debugging",
          "code_review",
          "refactoring",
          "testing",
          "documentation",
          "architecture_design",
        ],
      ],
      [
        "DataAnalysisAgent",
        [
          "data_processing",
          "statistical_analysis",
          "visualization",
          "pattern_recognition",
          "machine_learning",
          "reporting",
        ],
      ],
      [
        "WriterAgent",
        [
          "content_creation",
          "documentation",
          "summarization",
          "translation",
          "editing",
          "technical_writing",
        ],
      ],
      [
        "ToolExecutorAgent",
        [
          "tool_coordination",
          "workflow_automation",
          "integration",
          "process_management",
          "system_administration",
        ],
      ],
    ]);
  }

  async createRoutingPlan(analysis: QueryAnalysis): Promise<AgentRoutingPlan> {
    logger.debug("Creating agent routing plan", "ROUTER", {
      intent: analysis.intent,
      domains: analysis.domains,
      complexity: analysis.complexity,
    });

    // Step 1: Select optimal agents based on analysis
    const selectedAgents = await this.selectAgents(analysis);

    // Step 2: Determine execution strategy
    const executionStrategy = this.determineExecutionStrategy(
      analysis,
      selectedAgents,
    );

    // Step 3: Calculate confidence and risk
    const confidence = this.calculateConfidence(analysis, selectedAgents);
    const riskAssessment = this.assessRisk(analysis, selectedAgents);

    // Step 4: Identify fallback agents
    const fallbackAgents = this.identifyFallbackAgents(selectedAgents);

    // Step 5: Estimate cost
    const estimatedCost = this.estimateCost(analysis, selectedAgents);

    const routingPlan: AgentRoutingPlan = {
      selectedAgents,
      executionStrategy,
      confidence,
      fallbackAgents,
      estimatedCost,
      riskAssessment,
    };

    logger.info("Agent routing plan created", "ROUTER", {
      agentCount: selectedAgents.length,
      strategy: executionStrategy,
      confidence,
      risk: riskAssessment.level,
    });

    return routingPlan;
  }

  private async selectAgents(
    analysis: QueryAnalysis,
  ): Promise<AgentSelection[]> {
    const selections: AgentSelection[] = [];

    // Intent-based primary agent selection
    const primaryAgent = this.getPrimaryAgentForIntent(analysis.intent);
    if (primaryAgent) {
      selections.push({
        agentType: primaryAgent,
        priority: 1,
        confidence: 0.9,
        rationale: `Primary agent for ${analysis.intent} intent`,
        expectedDuration: Math.ceil(analysis.estimatedDuration * 0.6),
        requiredCapabilities: this.getRequiredCapabilities(analysis.intent),
      });
    }

    // Domain-based secondary agent selection
    for (const domain of analysis.domains) {
      const domainAgent = this.getAgentForDomain(domain);
      if (domainAgent && !selections.find((s) => s.agentType === domainAgent)) {
        selections.push({
          agentType: domainAgent,
          priority: 2,
          confidence: 0.7,
          rationale: `Domain expert for ${domain}`,
          expectedDuration: Math.ceil(analysis.estimatedDuration * 0.3),
          requiredCapabilities: this.agentCapabilities.get(domainAgent) || [],
        });
      }
    }

    // Complexity-based additional agents
    if (analysis.complexity > 7) {
      // High complexity might need tool coordination
      if (!selections.find((s) => s.agentType === "ToolExecutorAgent")) {
        selections.push({
          agentType: "ToolExecutorAgent",
          priority: 3,
          confidence: 0.6,
          rationale: "High complexity requires tool coordination",
          expectedDuration: Math.ceil(analysis.estimatedDuration * 0.2),
          requiredCapabilities: ["tool_coordination", "workflow_automation"],
        });
      }
    }

    // Ensure at least one agent is selected
    if (selections.length === 0) {
      selections.push({
        agentType: "ResearchAgent",
        priority: 1,
        confidence: 0.5,
        rationale: "Fallback general-purpose agent",
        expectedDuration: analysis.estimatedDuration,
        requiredCapabilities: ["information_gathering"],
      });
    }

    return selections.sort((a, b) => a.priority - b.priority);
  }

  private getPrimaryAgentForIntent(intent: string): string | null {
    const intentMapping: Record<string, string> = {
      research: "ResearchAgent",
      analyze: "DataAnalysisAgent",
      create: "CodeAgent",
      debug: "CodeAgent",
      optimize: "CodeAgent",
      explain: "WriterAgent",
      test: "CodeAgent",
      deploy: "ToolExecutorAgent",
      integrate: "ToolExecutorAgent",
      configure: "ToolExecutorAgent",
      monitor: "DataAnalysisAgent",
    };

    return intentMapping[intent] || null;
  }

  private getAgentForDomain(domain: string): string | null {
    const domainMapping: Record<string, string> = {
      development: "CodeAgent",
      web: "CodeAgent",
      data: "DataAnalysisAgent",
      research: "ResearchAgent",
      documentation: "WriterAgent",
      testing: "CodeAgent",
      deployment: "ToolExecutorAgent",
      security: "CodeAgent",
      performance: "DataAnalysisAgent",
      general: "ResearchAgent",
    };

    return domainMapping[domain] || null;
  }

  private getRequiredCapabilities(intent: string): string[] {
    const capabilityMapping: Record<string, string[]> = {
      research: ["web_search", "information_gathering"],
      analyze: ["data_processing", "pattern_recognition"],
      create: ["programming", "architecture_design"],
      debug: ["debugging", "code_review"],
      optimize: ["performance_tuning", "refactoring"],
      explain: ["documentation", "technical_writing"],
      test: ["testing", "validation"],
      deploy: ["deployment", "system_administration"],
    };

    return capabilityMapping[intent] || ["general_purpose"];
  }

  private determineExecutionStrategy(
    analysis: QueryAnalysis,
    agents: AgentSelection[],
  ): "sequential" | "parallel" | "hybrid" {
    // Single agent = sequential
    if (agents.length === 1) {
      return "sequential";
    }

    // High complexity with multiple domains = hybrid
    if (analysis.complexity > 6 && analysis.domains.length > 2) {
      return "hybrid";
    }

    // Independent tasks = parallel
    if (analysis.domains.length > 1 && analysis.complexity < 7) {
      return "parallel";
    }

    // Default to sequential for safety
    return "sequential";
  }

  private calculateConfidence(
    analysis: QueryAnalysis,
    agents: AgentSelection[],
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for clear intent mapping
    if (analysis.intent !== "unknown") {
      confidence += 0.2;
    }

    // Boost confidence for appropriate agent selection
    const hasSpecializedAgent = agents.some((agent) =>
      this.agentCapabilities.has(agent.agentType),
    );
    if (hasSpecializedAgent) {
      confidence += 0.2;
    }

    // Reduce confidence for high complexity
    if (analysis.complexity > 8) {
      confidence -= 0.1;
    }

    // Consider historical performance
    const avgPerformance = this.getAveragePerformance(
      agents.map((a) => a.agentType),
    );
    confidence = (confidence + avgPerformance) / 2;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private assessRisk(
    analysis: QueryAnalysis,
    agents: AgentSelection[],
  ): RiskAssessment {
    const factors: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    // Complexity-based risk
    if (analysis.complexity > 8) {
      factors.push("High complexity query");
      riskLevel = "high";
    } else if (analysis.complexity > 5) {
      factors.push("Medium complexity query");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // Resource requirements risk
    if (analysis.resourceRequirements.requiresInternet) {
      factors.push("Requires external internet access");
    }
    if (analysis.resourceRequirements.computeIntensive) {
      factors.push("Computationally intensive task");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // Agent coordination risk
    if (agents.length > 2) {
      factors.push("Multiple agent coordination required");
      if (riskLevel === "low") riskLevel = "medium";
    }

    const mitigations = this.generateMitigations(factors, riskLevel);

    return {
      level: riskLevel,
      factors,
      mitigations,
    };
  }

  private generateMitigations(factors: string[], riskLevel: string): string[] {
    const mitigations: string[] = [];

    if (factors.includes("High complexity query")) {
      mitigations.push("Break down into smaller sub-tasks");
      mitigations.push("Implement checkpoint validation");
    }

    if (factors.includes("Requires external internet access")) {
      mitigations.push("Implement timeout and retry mechanisms");
      mitigations.push("Have offline fallback options");
    }

    if (factors.includes("Multiple agent coordination required")) {
      mitigations.push("Use sequential execution for safety");
      mitigations.push("Implement inter-agent communication protocols");
    }

    if (riskLevel === "high") {
      mitigations.push("Enable enhanced monitoring and logging");
      mitigations.push("Prepare rollback mechanisms");
    }

    return mitigations;
  }

  private identifyFallbackAgents(selectedAgents: AgentSelection[]): string[] {
    const fallbacks: string[] = [];
    const selectedTypes = selectedAgents.map((a) => a.agentType);

    // Always have ResearchAgent as a fallback if not selected
    if (!selectedTypes.includes("ResearchAgent")) {
      fallbacks.push("ResearchAgent");
    }

    // Add complementary agents based on what's selected
    for (const agent of selectedAgents) {
      switch (agent.agentType) {
        case "CodeAgent":
          if (!selectedTypes.includes("WriterAgent")) {
            fallbacks.push("WriterAgent"); // For documentation
          }
          break;
        case "DataAnalysisAgent":
          if (!selectedTypes.includes("ResearchAgent")) {
            fallbacks.push("ResearchAgent"); // For data gathering
          }
          break;
        case "WriterAgent":
          if (!selectedTypes.includes("ResearchAgent")) {
            fallbacks.push("ResearchAgent"); // For information
          }
          break;
      }
    }

    return [...new Set(fallbacks)]; // Remove duplicates
  }

  private estimateCost(
    analysis: QueryAnalysis,
    agents: AgentSelection[],
  ): number {
    let cost = 10; // Base cost

    // Complexity cost
    cost += analysis.complexity * 5;

    // Agent count cost
    cost += agents.length * 15;

    // Resource requirement costs
    if (analysis.resourceRequirements.requiresInternet) cost += 20;
    if (analysis.resourceRequirements.requiresDatabase) cost += 15;
    if (analysis.resourceRequirements.requiresLLM) cost += 25;
    if (analysis.resourceRequirements.computeIntensive) cost += 30;

    // Duration cost
    cost += analysis.estimatedDuration * 0.1;

    return Math.round(cost);
  }

  private getAveragePerformance(agentTypes: string[]): number {
    if (agentTypes.length === 0) return 0.5;

    const performances = agentTypes.map(
      (type) => this.performanceHistory.get(type) || 0.7, // Default performance
    );

    return (
      performances.reduce((sum, perf) => sum + perf, 0) / performances.length
    );
  }

  updatePerformance(
    agentType: string,
    success: boolean,
    duration: number,
  ): void {
    const currentPerf = this.performanceHistory.get(agentType) || 0.7;
    const newPerf = success
      ? Math.min(1.0, currentPerf + 0.1)
      : Math.max(0.1, currentPerf - 0.1);

    this.performanceHistory.set(agentType, newPerf);

    logger.debug("Updated agent performance", "ROUTER", {
      agentType,
      success,
      duration,
      newPerformance: newPerf,
    });
  }
}
