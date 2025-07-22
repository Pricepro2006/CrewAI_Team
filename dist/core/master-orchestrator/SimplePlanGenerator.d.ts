import type { Plan, Query } from './types';
import type { AgentRoutingPlan } from './enhanced-types';
export declare class SimplePlanGenerator {
    static createSimplePlan(query: Query, routingPlan?: AgentRoutingPlan): Plan;
    private static selectAgentByPattern;
    private static doesRequireTool;
}
//# sourceMappingURL=SimplePlanGenerator.d.ts.map