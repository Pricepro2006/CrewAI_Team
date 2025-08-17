import { BaseAgent } from "../base/BaseAgent.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
} from "../base/AgentTypes.js";


export class DataAnalysisAgent extends BaseAgent {
  constructor() {
    super(
      "DataAnalysisAgent",
      "Specializes in data processing, analysis, visualization, and insights extraction",
    );
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Query RAG for historical data patterns and insights
      let ragContext = "";
      let historicalPatterns: any[] = [];
      
      if (this.ragSystem && this.ragEnabled) {
        // Search for similar data analysis patterns
        ragContext = await this.queryRAG(task, {
          limit: 5,
          filter: { 
            agentType: 'DataAnalysisAgent',
            category: 'data_patterns'
          }
        });
        
        // Search for historical insights
        const insightsContext = await this.queryRAG(task, {
          limit: 3,
          filter: {
            category: 'business_insights'
          }
        });
        
        if (ragContext || insightsContext) {
          console.log(`[DataAnalysisAgent] Retrieved RAG context: ${(ragContext + insightsContext).length} characters`);
          ragContext = ragContext + "\n" + insightsContext;
        }
        
        // Search for similar analysis results
        const searchResults = await this.searchRAG(task, 5);
        historicalPatterns = searchResults.filter(r => 
          r.metadata?.type === 'analysis' || r.metadata?.type === 'pattern'
        );
      }

      // Analyze the data analysis task with historical context
      const taskAnalysis = await this.analyzeDataTask(task, context, ragContext);

      // Execute based on task type
      let result: AnalysisResult;
      switch (taskAnalysis.type) {
        case "statistical":
          result = await this.performStatisticalAnalysis(taskAnalysis, context, historicalPatterns);
          break;
        case "visualization":
          result = await this.createVisualization(taskAnalysis, context);
          break;
        case "transformation":
          result = await this.transformData(taskAnalysis, context);
          break;
        case "exploration":
          result = await this.exploreData(taskAnalysis, context, historicalPatterns);
          break;
        default:
          result = await this.generalDataAnalysis(task, context);
      }

      // Index valuable analysis results and patterns back into RAG
      if (this.ragSystem && this.ragEnabled && result) {
        const valuableInsights = this.extractValuableInsights(result);
        if (valuableInsights && valuableInsights.length > 0) {
          await this.indexAgentKnowledge(valuableInsights.map(insight => ({
            content: JSON.stringify(insight),
            metadata: {
              type: 'analysis',
              category: insight.category || 'data_patterns',
              task: task,
              taskType: taskAnalysis.type,
              confidence: insight.confidence || 0.7,
              timestamp: new Date().toISOString()
            }
          })));
        }
      }

      return {
        success: true,
        data: result,
        output: this.formatAnalysisOutput(result),
        metadata: {
          agent: this.name,
          taskType: taskAnalysis.type,
          dataSize: taskAnalysis.dataSize,
          ragEnhanced: !!ragContext,
          historicalPatternsUsed: historicalPatterns.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private async analyzeDataTask(
    task: string,
    context: AgentContext,
    ragContext?: string
  ): Promise<DataTaskAnalysis> {
    const prompt = `
      Analyze this data analysis task: "${task}"
      
      ${context.ragDocuments ? `Context:\n${context?.ragDocuments?.map((d: any) => d.content).join("\n")}` : ""}
      ${ragContext ? `Additional Context:\n${ragContext}` : ""}
      
      Provide a comprehensive analysis including:
      1. Analysis type: statistical, visualization, transformation, or exploration
      2. Required techniques or methods
      3. Expected output format
      4. Data characteristics
    `;

    const llmResponse = await this.generateLLMResponse(prompt);
    const response = llmResponse?.response;
    if (!response) {
      // Return default analysis if LLM response fails
      return {
        type: "exploration",
        techniques: [],
        outputFormat: "summary",
        dataSize: "medium",
        complexity: "moderate",
      };
    }
    return this.parseDataTaskAnalysis(response);
  }

  private parseDataTaskAnalysis(response: string): DataTaskAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        type: parsed.type || "exploration",
        techniques: parsed.techniques || [],
        outputFormat: parsed.outputFormat || "summary",
        dataSize: parsed.dataSize || "medium",
        complexity: parsed.complexity || "moderate",
      };
    } catch {
      return {
        type: "exploration",
        techniques: [],
        outputFormat: "summary",
        dataSize: "medium",
        complexity: "moderate",
      };
    }
  }

  private async performStatisticalAnalysis(
    analysis: DataTaskAnalysis,
    context: AgentContext,
    historicalPatterns: any[] = []
  ): Promise<AnalysisResult> {
    const prompt = `
      Perform statistical analysis based on these requirements:
      Techniques: ${analysis?.techniques?.join(", ")}
      
      ${context.ragDocuments && context.ragDocuments.length > 0 ? `Data context:\n${context.ragDocuments[0]?.content}` : ""}
      
      Provide:
      1. Descriptive statistics
      2. Key findings
      3. Statistical tests (if applicable)
      4. Confidence intervals
      5. Recommendations
      
      Format as a structured analysis report.
    `;

    const llmResponse = await this.generateLLMResponse(prompt);
    const analysisReport = llmResponse?.response;

    return {
      type: "statistical",
      report: analysisReport,
      visualizations: [],
      insights: this.extractInsights(analysisReport),
    };
  }

  private async createVisualization(
    analysis: DataTaskAnalysis,
    context: AgentContext,
  ): Promise<AnalysisResult> {
    const prompt = `
      Create visualization specifications for this data:
      Output format: ${analysis.outputFormat}
      
      ${context.ragDocuments && context.ragDocuments.length > 0 ? `Data:\n${context.ragDocuments[0]?.content}` : ""}
      
      Provide:
      1. Chart type recommendation
      2. Axis configurations
      3. Data series mapping
      4. Styling suggestions
      5. Interactive features
      
      Return as visualization configuration in JSON format.
    `;

    const llmResponse = await this.generateLLMResponse(prompt);
    const vizConfig = llmResponse?.response;

    return {
      type: "visualization",
      report: "Visualization configuration generated",
      visualizations: [this.parseVisualizationConfig(vizConfig)],
      insights: [],
    };
  }

  private async transformData(
    analysis: DataTaskAnalysis,
    context: AgentContext,
  ): Promise<AnalysisResult> {
    const prompt = `
      Transform data according to these requirements:
      Techniques: ${analysis?.techniques?.join(", ")}
      
      ${context.ragDocuments && context.ragDocuments.length > 0 ? `Input data:\n${context.ragDocuments[0]?.content}` : ""}
      
      Apply transformations:
      1. Data cleaning
      2. Normalization/standardization
      3. Feature engineering
      4. Aggregations
      5. Format conversions
      
      Provide transformed data and transformation steps.
    `;

    const llmResponse = await this.generateLLMResponse(prompt);
    const transformation = llmResponse?.response;

    return {
      type: "transformation",
      report: transformation,
      visualizations: [],
      insights: ["Data successfully transformed"],
    };
  }

  private async exploreData(
    analysis: DataTaskAnalysis,
    context: AgentContext,
    historicalPatterns: any[] = []
  ): Promise<AnalysisResult> {
    const prompt = `
      Explore this dataset comprehensively:
      Analysis complexity: ${analysis.complexity}
      Expected techniques: ${analysis?.techniques?.join(", ")}
      
      ${context.ragDocuments && context.ragDocuments.length > 0 ? `Data:\n${context.ragDocuments[0]?.content}` : ""}
      
      Provide:
      1. Data structure overview
      2. Summary statistics
      3. Data quality assessment
      4. Interesting patterns
      5. Anomalies or outliers
      6. Relationships between variables
      7. Initial insights
      
      Format as an exploratory data analysis report.
    `;

    const llmResponse = await this.generateLLMResponse(prompt);
    const exploration = llmResponse?.response;

    return {
      type: "exploration",
      report: exploration,
      visualizations: [],
      insights: this.extractInsights(exploration),
    };
  }

  private async generalDataAnalysis(
    task: string,
    context: AgentContext,
  ): Promise<AnalysisResult> {
    const prompt = `
      Perform data analysis for: ${task}
      
      ${context.ragDocuments ? `Data:\n${context?.ragDocuments?.map((d: any) => d.content).join("\n")}` : ""}
      
      Provide comprehensive analysis including relevant statistics, 
      patterns, insights, and recommendations.
    `;

    const llmResponse = await this.generateLLMResponse(prompt);
    const analysis = llmResponse?.response;

    return {
      type: "general",
      report: analysis,
      visualizations: [],
      insights: this.extractInsights(analysis),
    };
  }

  private extractInsights(text: string): string[] {
    // Simple insight extraction based on patterns
    const insights: string[] = [];
    const lines = text.split("\n");

    for (const line of lines) {
      if (
        line.includes("insight") ||
        line.includes("finding") ||
        line.includes("discovered") ||
        line.includes("shows that") ||
        line.includes("indicates") ||
        /^\d+\./.test(line.trim())
      ) {
        insights.push(line.trim());
      }
    }

    return insights.slice(0, 5); // Limit to top 5 insights
  }

  private parseVisualizationConfig(config: string): any {
    try {
      return JSON.parse(config);
    } catch {
      return {
        type: "bar",
        title: "Data Visualization",
        data: [],
        options: {},
      };
    }
  }

  private extractValuableInsights(result: AnalysisResult): Array<{category: string, confidence: number, content: string}> {
    const insights: Array<{category: string, confidence: number, content: string}> = [];
    
    // Extract insights from the analysis result
    if (result.insights && result.insights.length > 0) {
      result.insights.forEach(insight => {
        insights.push({
          category: result.type === 'statistical' ? 'statistical_patterns' : 'data_patterns',
          confidence: 0.8,
          content: insight
        });
      });
    }
    
    // Extract valuable patterns from the report
    if (result.report) {
      const reportInsights = this.extractInsights(result.report);
      reportInsights.forEach(insight => {
        insights.push({
          category: 'analysis_findings',
          confidence: 0.7,
          content: insight
        });
      });
    }
    
    return insights.filter(insight => insight.content.length > 20); // Only meaningful insights
  }

  private formatAnalysisOutput(result: AnalysisResult): string {
    const parts: string[] = [];

    parts.push(`**Analysis Type:** ${result.type}`);

    if (result.report) {
      parts.push(`\n**Report:**\n${result.report}`);
    }

    if (result.insights && result?.insights?.length > 0) {
      parts.push(`\n**Key Insights:**`);
      result?.insights?.forEach((insight, i) => {
        parts.push(`${i + 1}. ${insight}`);
      });
    }

    if (result.visualizations && result?.visualizations?.length > 0) {
      parts.push(
        `\n**Visualizations:** ${result?.visualizations?.length} chart(s) configured`,
      );
    }

    return parts.join("\n");
  }

  protected getAgentSpecificCapabilities(): AgentCapability[] {
    return [
      {
        name: "statistical_analysis",
        description: "Can perform statistical analysis on datasets",
        type: "analysis",
      },
      {
        name: "data_visualization",
        description: "Can create data visualizations and charts",
        type: "generation",
      },
      {
        name: "data_transformation",
        description: "Can clean and transform data",
        type: "analysis",
      },
      {
        name: "exploratory_analysis",
        description: "Can perform exploratory data analysis",
        type: "analysis",
      },
    ];
  }

  protected registerDefaultTools(): void {
    // Data analysis specific tools could be registered here
    // For now, relies on LLM capabilities
  }
}

interface DataTaskAnalysis {
  type: "statistical" | "visualization" | "transformation" | "exploration";
  techniques: string[];
  outputFormat: string;
  dataSize: string;
  complexity: string;
}

interface AnalysisResult {
  type: string;
  report: string;
  visualizations: any[];
  insights: string[];
}