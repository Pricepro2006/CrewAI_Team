import type { Plan, Query } from "./types.js";
import type { AgentRoutingPlan } from "./enhanced-types.js";
import type { AgentType } from "../shared/types.js";
import { logger } from "../../utils/logger.js";

export class SimplePlanGenerator {
  static createSimplePlan(query: Query, routingPlan?: AgentRoutingPlan): Plan {
    // For CPU performance, bypass complex LLM plan generation
    // but still use intelligent agent routing

    // Determine the best agent based on query patterns
    const agentType: AgentType =
      routingPlan?.selectedAgents?.[0]?.agentType ||
      this.selectAgentByPattern(query.text) ||
      "ResearchAgent"; // Default to ResearchAgent instead of WriterAgent

    logger.debug("SimplePlanGenerator selecting agent", "PLAN_GENERATOR", {
      query: query.text.substring(0, 100),
      selectedAgent: agentType,
      hasRoutingPlan: !!routingPlan,
    });

    const requiresTool = this.doesRequireTool(query.text, agentType);
    const toolName = requiresTool
      ? this.selectTool(query.text, agentType)
      : undefined;

    return {
      id: `plan-${Date.now()}`,
      steps: [
        {
          id: "step-1",
          task: "Answer user query",
          description: `Process and respond to: ${query.text}`,
          agentType,
          requiresTool: requiresTool,
          toolName: toolName,
          ragQuery: query.text,
          expectedOutput: "Comprehensive answer to user query",
          dependencies: [],
          parameters: {},
        },
      ],
    };
  }

  private static selectAgentByPattern(queryText: string): AgentType | null {
    const lowerQuery = queryText.toLowerCase();

    // Pattern-based agent selection with priority order
    const agentPatterns: Array<[RegExp | string[], AgentType]> = [
      // CodeAgent patterns - highest priority for code-related queries
      [
        [
          "function",
          "implement",
          "debug",
          "fix",
          "error",
          "program",
          "script",
          "class",
          "method",
          "api",
          "bug",
          "syntax",
          "compile",
          "runtime",
          "exception",
          "typescript",
          "javascript",
          "python",
          "java",
          "code",
          "coding",
          "programming",
          "develop",
          "fix the",
          "write a function",
          "create a function",
          "implement a",
        ],
        "CodeAgent",
      ],

      // DataAnalysisAgent patterns
      [
        [
          "analyze",
          "data",
          "statistics",
          "metrics",
          "report",
          "chart",
          "graph",
          "trend",
          "pattern",
          "insight",
          "correlation",
          "dataset",
          "analytics",
          "analysis",
        ],
        "DataAnalysisAgent",
      ],

      // ResearchAgent patterns
      [
        [
          "research",
          "find",
          "search",
          "investigate",
          "explore",
          "discover",
          "learn about",
          "what is",
          "how does",
          "why",
          "when",
          "where",
          "explain the",
          "tell me about",
          "information about",
          "latest",
          "current",
          "recent",
          "what are the",
          "developments",
          "best practices",
          "trends",
          "news about",
        ],
        "ResearchAgent",
      ],

      // WriterAgent patterns - lower priority, only for pure writing tasks
      [
        [
          "write an article",
          "write a blog",
          "write a story",
          "compose",
          "draft",
          "create content",
          "documentation",
          "summarize",
          "rewrite",
          "edit text",
          "proofread",
          "blog post",
          "newsletter",
          "article about",
        ],
        "WriterAgent",
      ],

      // ToolExecutorAgent patterns
      [
        [
          "execute",
          "run",
          "deploy",
          "install",
          "configure",
          "setup",
          "automate",
          "workflow",
          "pipeline",
          "integrate",
        ],
        "ToolExecutorAgent",
      ],
    ];

    // Special case checks for specific phrases
    if (
      lowerQuery.includes("write a blog") ||
      lowerQuery.includes("blog post")
    ) {
      return "WriterAgent";
    }
    if (
      lowerQuery.includes("create a visualization") ||
      lowerQuery.includes("visualization")
    ) {
      return "DataAnalysisAgent";
    }
    if (
      lowerQuery.includes("what are the") &&
      lowerQuery.includes("developments")
    ) {
      return "ResearchAgent";
    }
    if (lowerQuery.includes("best practices") && !lowerQuery.includes("code")) {
      return "ResearchAgent";
    }

    // Check patterns in priority order
    for (const [patterns, agent] of agentPatterns) {
      if (Array.isArray(patterns)) {
        if (patterns.some((pattern) => lowerQuery.includes(pattern))) {
          return agent;
        }
      }
    }

    return null;
  }

  private static doesRequireTool(
    queryText: string,
    agentType: string,
  ): boolean {
    const lowerQuery = queryText.toLowerCase();

    // Tool indicators
    const toolIndicators = [
      "search the web",
      "look up",
      "find online",
      "browse",
      "create file",
      "write file",
      "read file",
      "execute",
      "run command",
      "fetch data",
      "scrape",
      "download",
    ];

    // Agent-specific tool requirements
    if (
      agentType === "ResearchAgent" &&
      (lowerQuery.includes("latest") ||
        lowerQuery.includes("current") ||
        lowerQuery.includes("recent") ||
        lowerQuery.includes("search") ||
        lowerQuery.includes("find"))
    ) {
      return true;
    }

    if (
      agentType === "CodeAgent" &&
      (lowerQuery.includes("create") ||
        lowerQuery.includes("write") ||
        lowerQuery.includes("implement"))
    ) {
      return true;
    }

    return toolIndicators.some((indicator) => lowerQuery.includes(indicator));
  }

  private static selectTool(queryText: string, agentType: string): string {
    const lowerQuery = queryText.toLowerCase();

    // Agent-specific tool selection
    if (agentType === "ResearchAgent") {
      // For research tasks, prefer web search
      if (
        lowerQuery.includes("latest") ||
        lowerQuery.includes("current") ||
        lowerQuery.includes("recent") ||
        lowerQuery.includes("find") ||
        lowerQuery.includes("search") ||
        lowerQuery.includes("specialists")
      ) {
        return "web_search";
      }
      return "web_search"; // Default for research
    }

    if (agentType === "CodeAgent") {
      return "code_executor"; // Default tool for code agent
    }

    if (agentType === "DataAnalysisAgent") {
      return "data_analyzer"; // Default tool for data analysis
    }

    // Fallback
    return "web_search";
  }
}
