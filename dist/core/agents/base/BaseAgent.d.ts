import type { BaseTool } from "../../tools/base/BaseTool";
import type { AgentContext, AgentResult, ToolExecutionParams } from "./AgentTypes";
import { OllamaProvider } from "../../llm/OllamaProvider";
export declare abstract class BaseAgent {
    readonly name: string;
    readonly description: string;
    protected readonly model: string;
    protected tools: Map<string, BaseTool>;
    protected capabilities: Set<string>;
    protected initialized: boolean;
    protected llm: OllamaProvider;
    protected timeout: number;
    constructor(name: string, description: string, model?: string);
    abstract execute(task: string, context: AgentContext): Promise<AgentResult>;
    executeWithTool(params: ToolExecutionParams): Promise<AgentResult>;
    registerTool(tool: BaseTool): void;
    getTools(): BaseTool[];
    getTool(name: string): BaseTool | undefined;
    hasTool(name: string): boolean;
    hasCapability(capability: string): boolean;
    initialize(): Promise<void>;
    protected handleError(error: Error): AgentResult;
    protected addCapability(capability: string): void;
}
//# sourceMappingURL=BaseAgent.d.ts.map