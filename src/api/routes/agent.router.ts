import { z } from "zod";
import { router, publicProcedure } from "../trpc/router";
import type { Router } from "@trpc/server";
import { getAgentModel } from "../../config/model-selection.config";

export const agentRouter: Router<any> = router({
  // List all registered agents
  list: publicProcedure.query(async ({ ctx }) => {
    const types = ctx.agentRegistry.getRegisteredTypes();

    return types.map((type: string) => {
      const modelConfig = getAgentModel(type, 'general');
      const toolSelectionModel = getAgentModel(type, 'tool_selection');
      
      return {
        type,
        available: true,
        description: getAgentDescription(type),
        capabilities: getAgentCapabilities(type),
        tools: getAgentTools(type),
        models: {
          general: modelConfig.model,
          toolSelection: toolSelectionModel.model
        },
        modelConfig: {
          general: modelConfig,
          toolSelection: toolSelectionModel
        }
      };
    });
  }),

  // Get agent status
  status: publicProcedure.query(async ({ ctx }) => {
    return ctx.agentRegistry.getActiveAgents();
  }),

  // Execute a task with a specific agent
  execute: publicProcedure
    .input(
      z.object({
        agentType: z.string(),
        task: z.string(),
        context: z
          .object({
            ragDocuments: z.array(z.any()).optional(),
            previousResults: z.array(z.any()).optional(),
            userPreferences: z.record(z.any()).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const agent = await ctx.agentRegistry.getAgent(input.agentType);

      const result = await agent.execute(input.task, {
        task: input.task,
        ...(input.context?.ragDocuments && {
          ragDocuments: input.context.ragDocuments,
        }),
        ...(input.context?.previousResults && {
          previousResults: input.context.previousResults,
        }),
        ...(input.context?.userPreferences && {
          userPreferences: input.context.userPreferences,
        }),
      });

      // Release agent back to pool
      ctx.agentRegistry.releaseAgent(input.agentType, agent);

      return result;
    }),

  // Get agent pool status
  poolStatus: publicProcedure.query(async ({ ctx }) => {
    return ctx.agentRegistry.getPoolStatus();
  }),

  // Get agent configuration
  getConfig: publicProcedure
    .input(
      z
        .object({
          agentType: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      // Get pool configuration
      const poolConfig = ctx.agentRegistry.getConfig();

      // Get agent-specific configurations
      const agentConfigs: Record<string, any> = {};
      const types = ctx.agentRegistry.getRegisteredTypes();

      for (const type of types) {
        const modelConfig = getAgentModel(type, 'general');
        agentConfigs[type] = {
          model: modelConfig.model,
          modelDescription: modelConfig.description,
          temperature: modelConfig.temperature,
          maxTokens: modelConfig.maxTokens,
          timeout: modelConfig.timeout,
          capabilities: getAgentCapabilities(type),
          tools: getAgentTools(type),
          description: getAgentDescription(type),
        };
      }

      // Return specific agent config or all configs
      if (input?.agentType) {
        return {
          pool: poolConfig,
          agent: agentConfigs[input.agentType] || null,
        };
      }

      return {
        pool: poolConfig,
        agents: agentConfigs,
      };
    }),

  // Update agent configuration
  updateConfig: publicProcedure
    .input(
      z.object({
        pool: z
          .object({
            maxAgents: z.number().min(1).max(100).optional(),
            idleTimeout: z.number().min(0).optional(),
            preloadAgents: z.array(z.string()).optional(),
          })
          .optional(),
        agent: z
          .object({
            type: z.string(),
            model: z.string().optional(),
            maxRetries: z.number().min(0).max(10).optional(),
            timeout: z.number().min(0).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updates: string[] = [];

      // Update pool configuration
      if (input.pool) {
        ctx.agentRegistry.updateConfig(input.pool);
        updates.push("Pool configuration updated");
      }

      // Update agent-specific configuration
      if (input.agent) {
        // This would need to be implemented in the registry
        // For now, we'll just log the intent
        updates.push(
          `Agent ${input.agent.type} configuration queued for update`,
        );
      }

      return {
        success: true,
        updates,
        message: updates.join(". "),
      };
    }),
});

function getAgentDescription(type: string): string {
  const descriptions: Record<string, string> = {
    ResearchAgent: "Specializes in web research and information gathering",
    CodeAgent: "Handles code generation, analysis, and debugging",
    DataAnalysisAgent: "Performs data analysis and visualization",
    WriterAgent: "Creates various types of written content",
    ToolExecutorAgent: "Executes and coordinates various tools",
  };

  return descriptions[type] || "Unknown agent type";
}

function getAgentCapabilities(type: string): string[] {
  const capabilities: Record<string, string[]> = {
    ResearchAgent: [
      "web_search",
      "information_synthesis",
      "fact_checking",
      "summarization",
    ],
    CodeAgent: [
      "code_generation",
      "debugging",
      "refactoring",
      "code_review",
      "testing",
    ],
    DataAnalysisAgent: [
      "data_processing",
      "statistical_analysis",
      "visualization",
      "pattern_recognition",
    ],
    WriterAgent: [
      "content_creation",
      "editing",
      "formatting",
      "style_adaptation",
    ],
    ToolExecutorAgent: [
      "tool_orchestration",
      "workflow_automation",
      "integration_management",
    ],
  };

  return capabilities[type] || [];
}

function getAgentTools(type: string): string[] {
  const tools: Record<string, string[]> = {
    ResearchAgent: ["WebSearchTool", "WebScraperTool"],
    CodeAgent: ["CodeExecutorTool", "FileSystemTool"],
    DataAnalysisAgent: ["DataProcessingTool", "VisualizationTool"],
    WriterAgent: ["MarkdownFormatterTool", "GrammarCheckTool"],
    ToolExecutorAgent: [
      "WebSearchTool",
      "WebScraperTool",
      "FileSystemTool",
      "CodeExecutorTool",
    ],
  };

  return tools[type] || [];
}
