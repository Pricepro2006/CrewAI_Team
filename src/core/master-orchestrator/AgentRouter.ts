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
    const intentLower = intent.toLowerCase();
    
    // Create a scoring system for each agent
    const agentScores: Record<string, number> = {
      ResearchAgent: 0,
      CodeAgent: 0,
      DataAnalysisAgent: 0,
      WriterAgent: 0,
      ToolExecutorAgent: 0
    };
    
    // Score based on domains (highest weight)
    domains.forEach(domain => {
      switch(domain.toLowerCase()) {
        case 'research':
        case 'information':
          agentScores.ResearchAgent = (agentScores.ResearchAgent || 0) + 3;
          break;
        case 'web':
          // Web domain could be for research OR scraping, check context
          if (domains.includes('scraping')) {
            agentScores.ToolExecutorAgent = (agentScores.ToolExecutorAgent || 0) + 3;
          } else {
            agentScores.ResearchAgent = (agentScores.ResearchAgent || 0) + 3;
          }
          break;
        case 'code':
        case 'programming':
        case 'development':
          agentScores.CodeAgent = (agentScores.CodeAgent || 0) + 3;
          break;
        case 'analysis':
        case 'data':
        case 'statistics':
          agentScores.DataAnalysisAgent = (agentScores.DataAnalysisAgent || 0) + 3;
          break;
        case 'writing':
        case 'documentation':
        case 'content':
          agentScores.WriterAgent = (agentScores.WriterAgent || 0) + 3;
          break;
        case 'automation':
        case 'tools':
        case 'execution':
        case 'scraping':
          agentScores.ToolExecutorAgent = (agentScores.ToolExecutorAgent || 0) + 3;
          break;
        case 'system':
        case 'capabilities':
        case 'system_info':
          // System questions should be handled by WriterAgent to compose informative responses
          agentScores.WriterAgent = (agentScores.WriterAgent || 0) + 5;
          break;
      }
    });
    
    // Score based on intent keywords (medium weight)
    const intentPatterns = {
      ResearchAgent: ['search', 'find', 'research', 'investigate', 'explore', 
                     'discover', 'lookup', 'query', 'information', 'latest', 
                     'trends', 'news', 'updates'],
      CodeAgent: ['code', 'implement', 'debug', 'fix', 'create function', 
                 'write function', 'program', 'script', 'develop', 'compile',
                 'syntax', 'algorithm', 'class', 'method'],
      DataAnalysisAgent: ['analyze', 'analysis', 'data', 'metrics', 'statistics',
                         'visualize', 'chart', 'graph', 'pattern', 'trend',
                         'correlation', 'insight', 'report data'],
      WriterAgent: ['write article', 'write blog', 'compose', 'draft', 'document',
                   'summarize', 'explain', 'describe', 'create content', 
                   'narrative', 'story', 'report writing'],
      ToolExecutorAgent: ['execute', 'run', 'automate', 'deploy', 'integrate',
                         'workflow', 'pipeline', 'orchestrate', 'coordinate',
                         'scrape', 'extract', 'crawl', 'fetch', 'pull data',
                         'get content', 'harvest', 'collect', 'grab',
                         'retrieve content', 'extract information', 'get data',
                         'download content']
    };
    
    Object.entries(intentPatterns).forEach(([agent, patterns]) => {
      patterns.forEach(pattern => {
        if (intentLower.includes(pattern)) {
          agentScores[agent] = (agentScores[agent] || 0) + 2;
        }
      });
    });
    
    // Score based on entities (lower weight)
    if (entities) {
      if (entities.code || entities.functions || entities.classes) {
        agentScores.CodeAgent = (agentScores.CodeAgent || 0) + 1;
      }
      if (entities.data || entities.metrics || entities.numbers) {
        agentScores.DataAnalysisAgent = (agentScores.DataAnalysisAgent || 0) + 1;
      }
      if (entities.topics || entities.concepts) {
        agentScores.ResearchAgent = (agentScores.ResearchAgent || 0) + 1;
      }
      if (entities.documents || entities.text) {
        agentScores.WriterAgent = (agentScores.WriterAgent || 0) + 1;
      }
      
      // Boost ToolExecutorAgent when URLs are detected with scraping keywords
      if (entities.url) {
        const scrapingKeywords = ['scrape', 'extract', 'crawl', 'fetch', 'pull', 
                                 'get content', 'harvest', 'collect', 'grab',
                                 'retrieve', 'download'];
        const hasScrapingIntent = scrapingKeywords.some(keyword => 
          intentLower.includes(keyword)
        );
        
        if (hasScrapingIntent) {
          agentScores.ToolExecutorAgent = (agentScores.ToolExecutorAgent || 0) + 5;
        }
      }
    }
    
    // Special case: prioritize CodeAgent for explicit code requests
    if (intentLower.includes('write') && intentLower.includes('function')) {
      agentScores.CodeAgent = (agentScores.CodeAgent || 0) + 5;
    }
    
    // Special case: prioritize ToolExecutorAgent for explicit scraping requests
    if ((intentLower.includes('scrape') || 
         intentLower.includes('extract') || 
         intentLower.includes('crawl')) && 
        (intentLower.includes('http') || 
         intentLower.includes('www') || 
         entities?.url)) {
      agentScores.ToolExecutorAgent = (agentScores.ToolExecutorAgent || 0) + 10;
    }
    
    // Find agent with highest score
    let selectedAgent = 'ResearchAgent'; // Default
    let highestScore = 0;
    
    Object.entries(agentScores).forEach(([agent, score]) => {
      if (score > highestScore) {
        highestScore = score;
        selectedAgent = agent;
      }
    });
    
    // Log scoring for debugging
    logger.debug("Agent scoring results", "ROUTER", { 
      scores: agentScores, 
      selected: selectedAgent,
      intent: intentLower
    });
    
    return selectedAgent;
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
