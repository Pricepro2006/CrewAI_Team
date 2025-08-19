import { BaseAgent } from "../base/BaseAgent.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
} from "../base/AgentTypes.js";
import { sanitizeLLMOutput } from "../../../utils/output-sanitizer.js";

export class WriterAgent extends BaseAgent {
  constructor() {
    super(
      "WriterAgent",
      "Specializes in content creation, editing, formatting, and various writing styles",
    );
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Query RAG for writing examples and style guides
      let ragContext = "";
      let writingExamples: any[] = [];
      
      if (this.ragSystem && this.ragEnabled) {
        // Search for relevant writing samples
        ragContext = await this.queryRAG(task, {
          limit: 5,
          filter: { 
            agentType: 'WriterAgent',
            category: 'writing_samples'
          }
        });
        
        // Search for style guides and templates
        const styleContext = await this.queryRAG(task, {
          limit: 3,
          filter: {
            category: 'style_guides'
          }
        });
        
        if (ragContext || styleContext) {
          console.log(`[WriterAgent] Retrieved RAG context: ${(ragContext + styleContext).length} characters`);
          ragContext = ragContext + "\n" + styleContext;
        }
        
        // Search for similar writing examples
        const searchResults = await this.searchRAG(task, 3);
        writingExamples = searchResults.filter(r => 
          r.metadata?.type === 'writing' || r.metadata?.type === 'content'
        );
      }

      // Analyze the writing task with context
      const taskAnalysis = await this.analyzeWritingTask(task, context, ragContext);

      // Execute based on content type
      let result: unknown;
      switch (taskAnalysis.contentType) {
        case "article":
          result = await this.writeArticle(taskAnalysis, context, writingExamples);
          break;
        case "report":
          result = await this.writeReport(taskAnalysis, context, writingExamples);
          break;
        case "email":
          result = await this.writeEmail(taskAnalysis, context, writingExamples);
          break;
        case "creative":
          result = await this.writeCreative(taskAnalysis, context, writingExamples);
          break;
        case "technical":
          result = await this.writeTechnical(taskAnalysis, context, writingExamples);
          break;
        default:
          result = await this.writeGeneral(task, context);
      }

      const writingResult = result as WritingResult;
      
      // Index high-quality writing samples back into RAG
      if (this.ragSystem && this.ragEnabled && writingResult.content) {
        await this.indexAgentKnowledge([{
          content: writingResult.content,
          metadata: {
            type: 'writing',
            contentType: taskAnalysis.contentType,
            style: taskAnalysis.style,
            task: task,
            wordCount: writingResult.content.split(' ').length,
            timestamp: new Date().toISOString()
          }
        }]);
      }
      
      return {
        success: true,
        data: writingResult,
        output: sanitizeLLMOutput(writingResult.content).content,
        metadata: {
          agent: this.name,
          ragEnhanced: !!ragContext,
          examplesUsed: writingExamples.length,
          contentType: taskAnalysis.contentType,
          wordCount: this.countWords(writingResult.content),
          style: taskAnalysis.style,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private async analyzeWritingTask(
    task: string,
    context: AgentContext,
    ragContext: string = ""
  ): Promise<WritingTaskAnalysis> {
    const prompt = `
      Analyze this writing task: "${task}"
      
      ${ragContext ? `RAG Context:\n${ragContext}\n` : ""}
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Provide a detailed analysis including:
      1. Content type: article, report, email, creative, technical, or general
      2. Writing style: formal, casual, persuasive, informative, narrative
      3. Target audience
      4. Key requirements
      5. Desired length
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    return this.parseWritingTaskAnalysis(response.response);
  }

  private parseWritingTaskAnalysis(response: string): WritingTaskAnalysis {
    // Parse natural language response
    const lowerResponse = response.toLowerCase();
    
    // Determine content type
    let contentType: "article" | "report" | "email" | "creative" | "technical" | "general" = "general";
    if (lowerResponse.includes("article") || lowerResponse.includes("blog")) {
      contentType = "article";
    } else if (lowerResponse.includes("report")) {
      contentType = "report";
    } else if (lowerResponse.includes("email")) {
      contentType = "email";
    } else if (lowerResponse.includes("creative") || lowerResponse.includes("story")) {
      contentType = "creative";
    } else if (lowerResponse.includes("technical") || lowerResponse.includes("documentation")) {
      contentType = "technical";
    }
    
    // Determine style
    let style = "informative";
    if (lowerResponse.includes("formal")) style = "formal";
    else if (lowerResponse.includes("casual")) style = "casual";
    else if (lowerResponse.includes("persuasive")) style = "persuasive";
    else if (lowerResponse.includes("narrative")) style = "narrative";
    
    // Extract audience (look for patterns like "audience: X" or "for X")
    let audience = "general audience";
    const audienceMatch = response.match(/audience[:\s]+([^.\n]+)/i) || 
                         response.match(/for\s+([^.\n]+audience[^.\n]*)/i);
    if (audienceMatch && audienceMatch[1]) {
      audience = audienceMatch[1].trim();
    }
    
    // Extract requirements (look for numbered lists or bullet points)
    const requirements: string[] = [];
    const lines = response.split('\n');
    for (const line of lines) {
      if (/^\d+\./.test(line.trim()) || /^[-•]/.test(line.trim())) {
        const req = line.replace(/^[\d.-•]\s*/, '').trim();
        if (req.length > 0 && req.length < 100) {
          requirements.push(req);
        }
      }
    }
    
    // Determine length
    let length = "medium";
    if (lowerResponse.includes("short") || lowerResponse.includes("brief")) length = "short";
    else if (lowerResponse.includes("long") || lowerResponse.includes("detailed")) length = "long";
    
    return {
      contentType,
      style,
      audience,
      requirements: requirements.slice(0, 5) || [], // Limit to 5 requirements
      length,
    };
  }

  private async writeArticle(
    analysis: WritingTaskAnalysis,
    context: AgentContext,
    writingExamples: any[] = []
  ): Promise<WritingResult> {
    const prompt = `
      Write an article with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Length: ${analysis.length}
      Requirements: ${(analysis.requirements || []).join(", ")}
      
      ${context.ragDocuments ? `Reference material:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Create a well-structured article with:
      1. Engaging headline
      2. Compelling introduction
      3. Clear sections with subheadings
      4. Supporting evidence or examples
      5. Strong conclusion
      
      Use appropriate tone and style for the target audience.
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    const content = response.response;

    return {
      content: sanitizeLLMOutput(content).content,
      contentType: "article",
      metadata: {
        sections: this.extractSections(content),
        readingTime: this.estimateReadingTime(content),
      },
    };
  }

  private async writeReport(
    analysis: WritingTaskAnalysis,
    context: AgentContext,
    writingExamples: any[] = []
  ): Promise<WritingResult> {
    const prompt = `
      Write a professional report with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Requirements: ${(analysis.requirements || []).join(", ")}
      
      ${context.ragDocuments ? `Data/Research:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Structure the report with:
      1. Executive Summary
      2. Introduction
      3. Methodology (if applicable)
      4. Findings/Analysis
      5. Recommendations
      6. Conclusion
      
      Use clear, professional language with proper formatting.
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    const content = response.response;

    return {
      content: sanitizeLLMOutput(content).content,
      contentType: "report",
      metadata: {
        sections: this.extractSections(content),
        hasExecutiveSummary: content
          .toLowerCase()
          .includes("executive summary"),
      },
    };
  }

  private async writeEmail(
    analysis: WritingTaskAnalysis,
    context: AgentContext,
    writingExamples: any[] = []
  ): Promise<WritingResult> {
    const prompt = `
      Write an email with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Purpose: ${(analysis.requirements || []).join(", ")}
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Create a professional email with:
      1. Appropriate subject line
      2. Proper greeting
      3. Clear purpose statement
      4. Well-organized body
      5. Call to action (if needed)
      6. Professional closing
      
      Keep it concise and action-oriented.
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    const content = response.response;

    return {
      content: sanitizeLLMOutput(content).content,
      contentType: "email",
      metadata: {
        subject: this.extractEmailSubject(content),
        isActionRequired: this.checkForActionItems(content),
      },
    };
  }

  private async writeCreative(
    analysis: WritingTaskAnalysis,
    context: AgentContext,
    writingExamples: any[] = []
  ): Promise<WritingResult> {
    const prompt = `
      Write creative content with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Requirements: ${(analysis.requirements || []).join(", ")}
      
      ${context.ragDocuments ? `Inspiration/Context:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Create engaging creative content with:
      1. Vivid descriptions
      2. Compelling narrative
      3. Character development (if applicable)
      4. Emotional resonance
      5. Original voice
      
      Be imaginative and captivating.
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    const content = response.response;

    return {
      content: sanitizeLLMOutput(content).content,
      contentType: "creative",
      metadata: {
        genre: this.detectGenre(content),
        mood: this.analyzeMood(content),
      },
    };
  }

  private async writeTechnical(
    analysis: WritingTaskAnalysis,
    context: AgentContext,
    writingExamples: any[] = []
  ): Promise<WritingResult> {
    const prompt = `
      Write technical documentation with these specifications:
      Audience: ${analysis.audience}
      Requirements: ${(analysis.requirements || []).join(", ")}
      
      ${context.ragDocuments ? `Technical details:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Create clear technical content with:
      1. Precise terminology
      2. Step-by-step instructions (if applicable)
      3. Code examples (if relevant)
      4. Diagrams or flowchart descriptions
      5. Troubleshooting section
      
      Be accurate and comprehensive.
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    const content = response.response;

    return {
      content: sanitizeLLMOutput(content).content,
      contentType: "technical",
      metadata: {
        hasCodeExamples: content.includes("```"),
        technicalLevel: this.assessTechnicalLevel(content),
      },
    };
  }

  private async writeGeneral(
    task: string,
    context: AgentContext,
  ): Promise<WritingResult> {
    const prompt = `
      Complete this writing task: ${task}
      
      ${context.ragDocuments ? `Reference material:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      
      Create well-written content that addresses all requirements.
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const contentResponse = await this.generateLLMResponse(prompt);
    const content = contentResponse.response;

    return {
      content: sanitizeLLMOutput(content).content,
      contentType: "general",
      metadata: {},
    };
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private extractSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      if (
        /^#+\s/.test(line) ||
        /^\d+\./.test(line) ||
        /^[A-Z][^.!?]*:$/.test(line)
      ) {
        sections.push(line.trim());
      }
    }

    return sections;
  }

  private estimateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  private extractEmailSubject(content: string): string {
    const subjectMatch = content.match(/Subject:\s*(.+)/i);
    return subjectMatch?.[1] ?? "No subject";
  }

  private checkForActionItems(content: string): boolean {
    const actionKeywords = [
      "please",
      "action required",
      "by",
      "deadline",
      "asap",
      "urgent",
    ];
    const lowerContent = content.toLowerCase();
    return actionKeywords.some((keyword: any) => lowerContent.includes(keyword));
  }

  private detectGenre(content: string): string {
    // Simple genre detection
    if (content.includes("once upon a time")) return "fairy tale";
    if (/chapter \d+/i.test(content)) return "novel";
    if (content.includes("dear diary")) return "diary";
    return "general fiction";
  }

  private analyzeMood(content: string): string {
    // Simple mood analysis
    const positiveWords = ["happy", "joy", "love", "beautiful", "wonderful"];
    const negativeWords = ["sad", "dark", "fear", "angry", "terrible"];

    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter((w: any) =>
      lowerContent.includes(w),
    ).length;
    const negativeCount = negativeWords.filter((w: any) =>
      lowerContent.includes(w),
    ).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  private assessTechnicalLevel(content: string): string {
    const advancedTerms = [
      "algorithm",
      "architecture",
      "implementation",
      "optimization",
      "complexity",
    ];
    const count = advancedTerms.filter((term: any) =>
      content.toLowerCase().includes(term),
    ).length;

    if (count >= 3) return "advanced";
    if (count >= 1) return "intermediate";
    return "beginner";
  }

  protected getAgentSpecificCapabilities(): AgentCapability[] {
    return [
      {
        name: "article_writing",
        description: "Can write articles and blog posts",
        type: "generation",
      },
      {
        name: "report_writing",
        description: "Can create professional reports",
        type: "generation",
      },
      {
        name: "email_drafting",
        description: "Can draft professional emails",
        type: "generation",
      },
      {
        name: "creative_writing",
        description: "Can write creative content and stories",
        type: "generation",
      },
      {
        name: "technical_writing",
        description: "Can create technical documentation",
        type: "generation",
      },
    ];
  }

  protected registerDefaultTools(): void {
    // Writing-specific tools could be registered here
    // For now, relies on LLM capabilities
  }
}

interface WritingTaskAnalysis {
  contentType:
    | "article"
    | "report"
    | "email"
    | "creative"
    | "technical"
    | "general";
  style: string;
  audience: string;
  requirements: string[];
  length: string;
}

interface WritingResult {
  content: string;
  contentType: string;
  metadata: Record<string, any>;
}
