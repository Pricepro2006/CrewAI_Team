import type { QueryAnalysis, AgentRoutingPlan } from "./enhanced-types";
export declare class AgentRouter {
    constructor();
    routeQuery(analysis: QueryAnalysis): Promise<AgentRoutingPlan>;
    private determineAgentType;
    private getFallbackAgents;
    private getRequiredCapabilities;
}
//# sourceMappingURL=AgentRouter.d.ts.map