import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlanExecutor } from './PlanExecutor';
import { AgentRegistry } from '../agents/registry/AgentRegistry';
import { BaseAgent } from '../agents/base/BaseAgent';
import type { Plan, PlanStep, ExecutionResult, StepResult } from './types';
import type { AgentResult } from '../agents/types';

// Mock agent
class MockAgent extends BaseAgent {
  constructor(id: string) {
    super({
      id,
      name: `Mock Agent ${id}`,
      description: 'A mock agent for testing',
      capabilities: ['test'],
      model: 'mock-model',
    });
  }

  async execute(task: string, context?: any): Promise<AgentResult> {
    return {
      success: true,
      output: `Executed: ${task}`,
      data: { task, context },
      metadata: { agentId: this.config.id },
    };
  }
}

describe('PlanExecutor', () => {
  let executor: PlanExecutor;
  let mockRegistry: AgentRegistry;
  let mockAgent1: MockAgent;
  let mockAgent2: MockAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAgent1 = new MockAgent('agent-1');
    mockAgent2 = new MockAgent('agent-2');
    
    mockRegistry = new AgentRegistry();
    vi.spyOn(mockRegistry, 'getAgent').mockImplementation((id: string) => {
      if (id === 'agent-1') return mockAgent1;
      if (id === 'agent-2') return mockAgent2;
      return null;
    });

    executor = new PlanExecutor(mockRegistry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should execute a simple plan successfully', async () => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'First task',
            toolName: 'test-tool',
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Second task',
            order: 2,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.failedSteps).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output).toBe('Executed: First task');
    });

    it('should handle step failures gracefully', async () => {
      const failingAgent = new MockAgent('failing-agent');
      vi.spyOn(failingAgent, 'execute').mockResolvedValueOnce({
        success: false,
        output: 'Task failed',
        error: 'Test error',
        metadata: {},
      });

      vi.spyOn(mockRegistry, 'getAgent').mockImplementation((id: string) => {
        if (id === 'failing-agent') return failingAgent;
        if (id === 'agent-1') return mockAgent1;
        return null;
      });

      const plan: Plan = {
        id: 'plan-2',
        goal: 'Test with failure',
        steps: [
          {
            id: 'step-1',
            agentId: 'failing-agent',
            task: 'Failing task',
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'agent-1',
            task: 'Should still execute',
            order: 2,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.completedSteps).toBe(1);
      expect(result.failedSteps).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Test error');
      expect(result.results[1].success).toBe(true);
    });

    it('should handle missing agents', async () => {
      const plan: Plan = {
        id: 'plan-3',
        goal: 'Test missing agent',
        steps: [
          {
            id: 'step-1',
            agentId: 'non-existent-agent',
            task: 'Task for missing agent',
            order: 1,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.failedSteps).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Agent not found');
    });

    it('should respect step dependencies', async () => {
      const executionOrder: string[] = [];
      
      const trackingAgent1 = new MockAgent('dep-agent-1');
      const trackingAgent2 = new MockAgent('dep-agent-2');
      
      vi.spyOn(trackingAgent1, 'execute').mockImplementation(async (task) => {
        executionOrder.push('agent-1');
        return {
          success: true,
          output: `Agent 1: ${task}`,
          data: { result: 'data-from-1' },
          metadata: {},
        };
      });
      
      vi.spyOn(trackingAgent2, 'execute').mockImplementation(async (task) => {
        executionOrder.push('agent-2');
        return {
          success: true,
          output: `Agent 2: ${task}`,
          metadata: {},
        };
      });

      vi.spyOn(mockRegistry, 'getAgent').mockImplementation((id: string) => {
        if (id === 'dep-agent-1') return trackingAgent1;
        if (id === 'dep-agent-2') return trackingAgent2;
        return null;
      });

      const plan: Plan = {
        id: 'plan-4',
        goal: 'Test dependencies',
        steps: [
          {
            id: 'step-1',
            agentId: 'dep-agent-1',
            task: 'First task',
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'dep-agent-2',
            task: 'Depends on step-1',
            dependencies: ['step-1'],
            order: 2,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['agent-1', 'agent-2']);
      expect(result.results[1].stepId).toBe('step-2');
    });

    it('should handle circular dependencies', async () => {
      const plan: Plan = {
        id: 'plan-5',
        goal: 'Test circular dependencies',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
            dependencies: ['step-2'],
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['step-1'],
            order: 2,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('circular dependency');
    });
  });

  describe('executeWithProgress', () => {
    it('should report progress during execution', async () => {
      const progressUpdates: Array<{ completedSteps: number; totalSteps: number }> = [];
      
      const plan: Plan = {
        id: 'plan-6',
        goal: 'Test progress tracking',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            order: 2,
          },
          {
            id: 'step-3',
            agentId: 'agent-1',
            task: 'Task 3',
            order: 3,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await executor.executeWithProgress(plan, (progress) => {
        progressUpdates.push({
          completedSteps: progress.completedSteps,
          totalSteps: progress.totalSteps,
        });
      });

      expect(result.success).toBe(true);
      expect(progressUpdates).toHaveLength(3);
      expect(progressUpdates[0]).toEqual({ completedSteps: 1, totalSteps: 3 });
      expect(progressUpdates[1]).toEqual({ completedSteps: 2, totalSteps: 3 });
      expect(progressUpdates[2]).toEqual({ completedSteps: 3, totalSteps: 3 });
    });

    it('should report failures in progress', async () => {
      const progressUpdates: any[] = [];
      
      const failingAgent = new MockAgent('failing-agent');
      vi.spyOn(failingAgent, 'execute').mockResolvedValueOnce({
        success: false,
        output: 'Failed',
        error: 'Test failure',
        metadata: {},
      });

      vi.spyOn(mockRegistry, 'getAgent').mockImplementation((id: string) => {
        if (id === 'failing-agent') return failingAgent;
        return null;
      });

      const plan: Plan = {
        id: 'plan-7',
        goal: 'Test failure progress',
        steps: [
          {
            id: 'step-1',
            agentId: 'failing-agent',
            task: 'Will fail',
            order: 1,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await executor.executeWithProgress(plan, (progress) => {
        progressUpdates.push(progress);
      });

      expect(progressUpdates[0].currentStep).toBe('step-1');
      expect(progressUpdates[0].status).toBe('failed');
    });
  });

  describe('parallel execution', () => {
    it('should execute independent steps in parallel', async () => {
      const executionTimes: Record<string, number> = {};
      
      const slowAgent1 = new MockAgent('slow-1');
      const slowAgent2 = new MockAgent('slow-2');
      
      vi.spyOn(slowAgent1, 'execute').mockImplementation(async (task) => {
        executionTimes['start-1'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        executionTimes['end-1'] = Date.now();
        return { success: true, output: 'Done 1', metadata: {} };
      });
      
      vi.spyOn(slowAgent2, 'execute').mockImplementation(async (task) => {
        executionTimes['start-2'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        executionTimes['end-2'] = Date.now();
        return { success: true, output: 'Done 2', metadata: {} };
      });

      vi.spyOn(mockRegistry, 'getAgent').mockImplementation((id: string) => {
        if (id === 'slow-1') return slowAgent1;
        if (id === 'slow-2') return slowAgent2;
        return null;
      });

      const plan: Plan = {
        id: 'plan-8',
        goal: 'Test parallel execution',
        steps: [
          {
            id: 'step-1',
            agentId: 'slow-1',
            task: 'Parallel task 1',
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'slow-2',
            task: 'Parallel task 2',
            order: 1, // Same order = parallel
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const start = Date.now();
      const result = await executor.execute(plan);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      // Should take ~100ms, not ~200ms if sequential
      expect(duration).toBeLessThan(150);
      
      // Verify overlap in execution
      expect(executionTimes['start-2']).toBeLessThan(executionTimes['end-1']);
    });
  });

  describe('context passing', () => {
    it('should pass context between dependent steps', async () => {
      const contextAgent1 = new MockAgent('context-1');
      const contextAgent2 = new MockAgent('context-2');
      
      let receivedContext: any;
      
      vi.spyOn(contextAgent1, 'execute').mockResolvedValueOnce({
        success: true,
        output: 'Step 1 done',
        data: { sharedData: 'important-value' },
        metadata: {},
      });
      
      vi.spyOn(contextAgent2, 'execute').mockImplementation(async (task, context) => {
        receivedContext = context;
        return {
          success: true,
          output: 'Step 2 done',
          metadata: {},
        };
      });

      vi.spyOn(mockRegistry, 'getAgent').mockImplementation((id: string) => {
        if (id === 'context-1') return contextAgent1;
        if (id === 'context-2') return contextAgent2;
        return null;
      });

      const plan: Plan = {
        id: 'plan-9',
        goal: 'Test context passing',
        steps: [
          {
            id: 'step-1',
            agentId: 'context-1',
            task: 'Generate context',
            order: 1,
          },
          {
            id: 'step-2',
            agentId: 'context-2',
            task: 'Use context',
            dependencies: ['step-1'],
            order: 2,
          },
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await executor.execute(plan, { initialContext: 'test' });

      expect(receivedContext).toBeDefined();
      expect(receivedContext.previousResults).toBeDefined();
      expect(receivedContext.previousResults['step-1'].data.sharedData).toBe('important-value');
    });
  });
});