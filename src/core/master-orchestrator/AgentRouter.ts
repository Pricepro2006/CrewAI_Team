import type { QueryAnalysis, AgentRoutingPlan } from "./enhanced-types.js";
import type { AgentType } from "../shared/types.js";
import { logger } from "../../utils/logger.js";

export class AgentRouter {
  constructor() {
    logger.info("AgentRouter initialized", "ROUTER");
  }

  async routeQuery(analysis: QueryAnalysis): Promise<AgentRoutingPlan> {
    logger.debug("Routing query", "ROUTER", { analysis });

    // Determine which agent type to use based on query analysis
    const agentType = this.determineAgentType(analysis);

    // Create routing plan
    const routingPlan: AgentRoutingPlan = {
      selectedAgents: [
        {
          agentType: agentType as AgentType,
          priority: 1,
          confidence: 0.8,
          rationale: `Selected ${agentType} based on query analysis`,
          expectedDuration: 30,
          requiredCapabilities: this.getRequiredCapabilities(
            agentType,
            analysis,
          ),
        },
      ],
      fallbackAgents: this.getFallbackAgents(agentType) as AgentType[],
      confidence: 0.8,
      executionStrategy: "sequential",
      estimatedCost: 0.1,
      riskAssessment: {
        level: "low",
        factors: [],
        mitigations: [],
      },
    };

    logger.debug("Query routed", "ROUTER", { plan: routingPlan });
    return routingPlan;
  }

  private determineAgentType(analysis: QueryAnalysis): string {
    const { intent, entities, domains } = analysis;

    // Research-related queries
    if (
      domains.includes("research") ||
      intent.includes("search") ||
      intent.includes("find")
    ) {
      return "ResearchAgent";
    }

    // Code-related queries
    if (
      domains.includes("code") ||
      intent.includes("code") ||
      intent.includes("debug")
    ) {
      return "CodeAgent";
    }

    // Data analysis queries
    if (
      domains.includes("analysis") ||
      intent.includes("analyze") ||
      intent.includes("data")
    ) {
      return "DataAnalysisAgent";
    }

    // Writing-related queries
    if (
      domains.includes("writing") ||
      intent.includes("write") ||
      intent.includes("content")
    ) {
      return "WriterAgent";
    }

    // Default to ResearchAgent for general queries
    return "ResearchAgent";
  }

  private getFallbackAgents(primaryAgent: string): string[] {
    const fallbackMap: Record<string, string[]> = {
      ResearchAgent: ["ToolExecutorAgent"],
      CodeAgent: ["ToolExecutorAgent", "ResearchAgent"],
      DataAnalysisAgent: ["ResearchAgent", "ToolExecutorAgent"],
      WriterAgent: ["ResearchAgent"],
      ToolExecutorAgent: ["ResearchAgent"],
    };

    return fallbackMap[primaryAgent] || ["ResearchAgent"];
  }

  private getRequiredCapabilities(
    agentType: string,
    analysis: QueryAnalysis,
  ): string[] {
    const baseCapabilities: Record<string, string[]> = {
      ResearchAgent: ["research", "web_search", "information_gathering"],
      CodeAgent: ["code_generation", "debugging", "syntax_analysis"],
      DataAnalysisAgent: [
        "data_processing",
        "statistical_analysis",
        "visualization",
      ],
      WriterAgent: ["content_creation", "grammar_check", "style_analysis"],
      ToolExecutorAgent: ["tool_execution", "api_integration", "automation"],
    };

    const capabilities = baseCapabilities[agentType] || ["general_processing"];

    // Add domain-specific capabilities based on analysis
    if (analysis?.resourceRequirements?.requiresInternet) {
      capabilities.push("internet_access");
    }
    if (analysis?.resourceRequirements?.requiresDatabase) {
      capabilities.push("database_access");
    }
    if (analysis?.resourceRequirements?.requiresVector) {
      capabilities.push("vector_search");
    }

    return capabilities;
  }
}
