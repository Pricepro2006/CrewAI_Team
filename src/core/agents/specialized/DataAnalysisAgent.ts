import { BaseAgent } from '../base/BaseAgent';
import type { AgentCapability, AgentContext, AgentResult } from '../base/AgentTypes';

export class DataAnalysisAgent extends BaseAgent {
  constructor() {
    super(
      'DataAnalysisAgent',
      'Specializes in data processing, analysis, visualization, and insights extraction'
    );
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Analyze the data analysis task
      const taskAnalysis = await this.analyzeDataTask(task, context);
      
      // Execute based on task type
      let result: any;
      switch (taskAnalysis.type) {
        case 'statistical':
          result = await this.performStatisticalAnalysis(taskAnalysis, context);
          break;
        case 'visualization':
          result = await this.createVisualization(taskAnalysis, context);
          break;
        case 'transformation':
          result = await this.transformData(taskAnalysis, context);
          break;
        case 'exploration':
          result = await this.exploreData(taskAnalysis, context);
          break;
        default:
          result = await this.generalDataAnalysis(task, context);
      }

      return {
        success: true,
        data: result,
        output: this.formatAnalysisOutput(result),
        metadata: {
          agent: this.name,
          taskType: taskAnalysis.type,
          dataSize: taskAnalysis.dataSize,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private async analyzeDataTask(task: string, context: AgentContext): Promise<DataTaskAnalysis> {
    const prompt = `
      Analyze this data analysis task: "${task}"
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Determine:
      1. Analysis type: statistical, visualization, transformation, or exploration
      2. Required techniques or methods
      3. Expected output format
      4. Data characteristics
      
      Respond in JSON format:
      {
        "type": "statistical|visualization|transformation|exploration",
        "techniques": ["technique1", "technique2"],
        "outputFormat": "table|chart|summary|report",
        "dataSize": "small|medium|large",
        "complexity": "simple|moderate|complex"
      }
    `;

    const response = await this.llm.generate(prompt, { format: 'json' });
    return this.parseDataTaskAnalysis(response);
  }

  private parseDataTaskAnalysis(response: string): DataTaskAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        type: parsed.type || 'exploration',
        techniques: parsed.techniques || [],
        outputFormat: parsed.outputFormat || 'summary',
        dataSize: parsed.dataSize || 'medium',
        complexity: parsed.complexity || 'moderate'
      };
    } catch {
      return {
        type: 'exploration',
        techniques: [],
        outputFormat: 'summary',
        dataSize: 'medium',
        complexity: 'moderate'
      };
    }
  }

  private async performStatisticalAnalysis(
    analysis: DataTaskAnalysis,
    context: AgentContext
  ): Promise<AnalysisResult> {
    const prompt = `
      Perform statistical analysis based on these requirements:
      Techniques: ${analysis.techniques.join(', ')}
      
      ${context.ragDocuments ? `Data context:\n${context.ragDocuments[0]?.content}` : ''}
      
      Provide:
      1. Descriptive statistics
      2. Key findings
      3. Statistical tests (if applicable)
      4. Confidence intervals
      5. Recommendations
      
      Format as a structured analysis report.
    `;

    const analysisReport = await this.llm.generate(prompt);
    
    return {
      type: 'statistical',
      report: analysisReport,
      visualizations: [],
      insights: this.extractInsights(analysisReport)
    };
  }

  private async createVisualization(
    analysis: DataTaskAnalysis,
    context: AgentContext
  ): Promise<AnalysisResult> {
    const prompt = `
      Create visualization specifications for this data:
      Output format: ${analysis.outputFormat}
      
      ${context.ragDocuments ? `Data:\n${context.ragDocuments[0]?.content}` : ''}
      
      Provide:
      1. Chart type recommendation
      2. Axis configurations
      3. Data series mapping
      4. Styling suggestions
      5. Interactive features
      
      Return as visualization configuration in JSON format.
    `;

    const vizConfig = await this.llm.generate(prompt);
    
    return {
      type: 'visualization',
      report: 'Visualization configuration generated',
      visualizations: [this.parseVisualizationConfig(vizConfig)],
      insights: []
    };
  }

  private async transformData(
    analysis: DataTaskAnalysis,
    context: AgentContext
  ): Promise<AnalysisResult> {
    const prompt = `
      Transform data according to these requirements:
      Techniques: ${analysis.techniques.join(', ')}
      
      ${context.ragDocuments ? `Input data:\n${context.ragDocuments[0]?.content}` : ''}
      
      Apply transformations:
      1. Data cleaning
      2. Normalization/standardization
      3. Feature engineering
      4. Aggregations
      5. Format conversions
      
      Provide transformed data and transformation steps.
    `;

    const transformation = await this.llm.generate(prompt);
    
    return {
      type: 'transformation',
      report: transformation,
      visualizations: [],
      insights: ['Data successfully transformed']
    };
  }

  private async exploreData(
    analysis: DataTaskAnalysis,
    context: AgentContext
  ): Promise<AnalysisResult> {
    const prompt = `
      Explore this dataset comprehensively:
      Analysis complexity: ${analysis.complexity}
      Expected techniques: ${analysis.techniques.join(', ')}
      
      ${context.ragDocuments ? `Data:\n${context.ragDocuments[0]?.content}` : ''}
      
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

    const exploration = await this.llm.generate(prompt);
    
    return {
      type: 'exploration',
      report: exploration,
      visualizations: [],
      insights: this.extractInsights(exploration)
    };
  }

  private async generalDataAnalysis(
    task: string,
    context: AgentContext
  ): Promise<AnalysisResult> {
    const prompt = `
      Perform data analysis for: ${task}
      
      ${context.ragDocuments ? `Data:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Provide comprehensive analysis including relevant statistics, 
      patterns, insights, and recommendations.
    `;

    const analysis = await this.llm.generate(prompt);
    
    return {
      type: 'general',
      report: analysis,
      visualizations: [],
      insights: this.extractInsights(analysis)
    };
  }

  private extractInsights(text: string): string[] {
    // Simple insight extraction based on patterns
    const insights: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (
        line.includes('insight') ||
        line.includes('finding') ||
        line.includes('discovered') ||
        line.includes('shows that') ||
        line.includes('indicates') ||
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
        type: 'bar',
        title: 'Data Visualization',
        data: [],
        options: {}
      };
    }
  }

  private formatAnalysisOutput(result: AnalysisResult): string {
    const parts: string[] = [];
    
    parts.push(`**Analysis Type:** ${result.type}`);
    
    if (result.report) {
      parts.push(`\n**Report:**\n${result.report}`);
    }
    
    if (result.insights && result.insights.length > 0) {
      parts.push(`\n**Key Insights:**`);
      result.insights.forEach((insight, i) => {
        parts.push(`${i + 1}. ${insight}`);
      });
    }
    
    if (result.visualizations && result.visualizations.length > 0) {
      parts.push(`\n**Visualizations:** ${result.visualizations.length} chart(s) configured`);
    }
    
    return parts.join('\n');
  }

  protected getAgentSpecificCapabilities(): AgentCapability[] {
    return [
      {
        name: 'statistical_analysis',
        description: 'Can perform statistical analysis on datasets',
        type: 'analysis'
      },
      {
        name: 'data_visualization',
        description: 'Can create data visualizations and charts',
        type: 'generation'
      },
      {
        name: 'data_transformation',
        description: 'Can clean and transform data',
        type: 'analysis'
      },
      {
        name: 'exploratory_analysis',
        description: 'Can perform exploratory data analysis',
        type: 'analysis'
      }
    ];
  }

  protected registerDefaultTools(): void {
    // Data analysis specific tools could be registered here
    // For now, relies on LLM capabilities
  }
}

interface DataTaskAnalysis {
  type: 'statistical' | 'visualization' | 'transformation' | 'exploration';
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
