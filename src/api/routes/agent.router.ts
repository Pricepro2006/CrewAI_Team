import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';
import type { Router } from '@trpc/server';

export const agentRouter: Router<any> = router({
  // List all registered agents
  list: publicProcedure.query(async ({ ctx }) => {
    const types = ctx.agentRegistry.getRegisteredTypes();
    
    return types.map(type => ({
      type,
      available: true,
      description: getAgentDescription(type)
    }));
  }),

  // Get agent status
  status: publicProcedure.query(async ({ ctx }) => {
    return ctx.agentRegistry.getActiveAgents();
  }),

  // Execute a task with a specific agent
  execute: publicProcedure
    .input(z.object({
      agentType: z.string(),
      task: z.string(),
      context: z.object({
        ragDocuments: z.array(z.any()).optional(),
        previousResults: z.array(z.any()).optional(),
        userPreferences: z.record(z.any()).optional()
      }).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const agent = await ctx.agentRegistry.getAgent(input.agentType);
      
      const result = await agent.execute(input.task, {
        task: input.task,
        ...(input.context?.ragDocuments && { ragDocuments: input.context.ragDocuments }),
        ...(input.context?.previousResults && { previousResults: input.context.previousResults }),
        ...(input.context?.userPreferences && { userPreferences: input.context.userPreferences })
      });

      // Release agent back to pool
      ctx.agentRegistry.releaseAgent(input.agentType, agent);

      return result;
    }),

  // Get agent pool status
  poolStatus: publicProcedure.query(async ({ ctx }) => {
    return ctx.agentRegistry.getPoolStatus();
  })
});

function getAgentDescription(type: string): string {
  const descriptions: Record<string, string> = {
    ResearchAgent: 'Specializes in web research and information gathering',
    CodeAgent: 'Handles code generation, analysis, and debugging',
    DataAnalysisAgent: 'Performs data analysis and visualization',
    WriterAgent: 'Creates various types of written content',
    ToolExecutorAgent: 'Executes and coordinates various tools'
  };
  
  return descriptions[type] || 'Unknown agent type';
}
