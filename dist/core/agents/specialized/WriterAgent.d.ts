import { BaseAgent } from '../base/BaseAgent';
import type { AgentCapability, AgentContext, AgentResult } from '../base/AgentTypes';
export declare class WriterAgent extends BaseAgent {
    constructor();
    execute(task: string, context: AgentContext): Promise<AgentResult>;
    private analyzeWritingTask;
    private parseWritingTaskAnalysis;
    private writeArticle;
    private writeReport;
    private writeEmail;
    private writeCreative;
    private writeTechnical;
    private writeGeneral;
    private countWords;
    private extractSections;
    private estimateReadingTime;
    private extractEmailSubject;
    private checkForActionItems;
    private detectGenre;
    private analyzeMood;
    private assessTechnicalLevel;
    protected getAgentSpecificCapabilities(): AgentCapability[];
    protected registerDefaultTools(): void;
}
//# sourceMappingURL=WriterAgent.d.ts.map