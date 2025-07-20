import { BaseAgent } from '../base/BaseAgent';
import { sanitizeLLMOutput } from '../../../utils/output-sanitizer';
export class WriterAgent extends BaseAgent {
    constructor() {
        super('WriterAgent', 'Specializes in content creation, editing, formatting, and various writing styles');
    }
    async execute(task, context) {
        try {
            // Analyze the writing task
            const taskAnalysis = await this.analyzeWritingTask(task, context);
            // Execute based on content type
            let result;
            switch (taskAnalysis.contentType) {
                case 'article':
                    result = await this.writeArticle(taskAnalysis, context);
                    break;
                case 'report':
                    result = await this.writeReport(taskAnalysis, context);
                    break;
                case 'email':
                    result = await this.writeEmail(taskAnalysis, context);
                    break;
                case 'creative':
                    result = await this.writeCreative(taskAnalysis, context);
                    break;
                case 'technical':
                    result = await this.writeTechnical(taskAnalysis, context);
                    break;
                default:
                    result = await this.writeGeneral(task, context);
            }
            return {
                success: true,
                data: result,
                output: sanitizeLLMOutput(result.content).content,
                metadata: {
                    agent: this.name,
                    contentType: taskAnalysis.contentType,
                    wordCount: this.countWords(result.content),
                    style: taskAnalysis.style,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    async analyzeWritingTask(task, context) {
        const prompt = `
      Analyze this writing task: "${task}"
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Determine:
      1. Content type: article, report, email, creative, technical, or general
      2. Writing style: formal, casual, persuasive, informative, narrative
      3. Target audience
      4. Key requirements
      5. Desired length
      
      Respond in JSON format:
      {
        "contentType": "article|report|email|creative|technical|general",
        "style": "formal|casual|persuasive|informative|narrative",
        "audience": "description of target audience",
        "requirements": ["req1", "req2"],
        "length": "short|medium|long"
      }
    `;
        const response = await this.llm.generate(prompt, { format: 'json' });
        return this.parseWritingTaskAnalysis(response);
    }
    parseWritingTaskAnalysis(response) {
        try {
            const parsed = JSON.parse(response);
            return {
                contentType: parsed.contentType || 'general',
                style: parsed.style || 'informative',
                audience: parsed.audience || 'general audience',
                requirements: parsed.requirements || [],
                length: parsed.length || 'medium'
            };
        }
        catch {
            return {
                contentType: 'general',
                style: 'informative',
                audience: 'general audience',
                requirements: [],
                length: 'medium'
            };
        }
    }
    async writeArticle(analysis, context) {
        const prompt = `
      Write an article with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Length: ${analysis.length}
      Requirements: ${analysis.requirements.join(', ')}
      
      ${context.ragDocuments ? `Reference material:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Create a well-structured article with:
      1. Engaging headline
      2. Compelling introduction
      3. Clear sections with subheadings
      4. Supporting evidence or examples
      5. Strong conclusion
      
      Use appropriate tone and style for the target audience.
    `;
        const content = await this.llm.generate(prompt);
        return {
            content: sanitizeLLMOutput(content).content,
            contentType: 'article',
            metadata: {
                sections: this.extractSections(content),
                readingTime: this.estimateReadingTime(content)
            }
        };
    }
    async writeReport(analysis, context) {
        const prompt = `
      Write a professional report with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Requirements: ${analysis.requirements.join(', ')}
      
      ${context.ragDocuments ? `Data/Research:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Structure the report with:
      1. Executive Summary
      2. Introduction
      3. Methodology (if applicable)
      4. Findings/Analysis
      5. Recommendations
      6. Conclusion
      
      Use clear, professional language with proper formatting.
    `;
        const content = await this.llm.generate(prompt);
        return {
            content: sanitizeLLMOutput(content).content,
            contentType: 'report',
            metadata: {
                sections: this.extractSections(content),
                hasExecutiveSummary: content.toLowerCase().includes('executive summary')
            }
        };
    }
    async writeEmail(analysis, context) {
        const prompt = `
      Write an email with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Purpose: ${analysis.requirements.join(', ')}
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Create a professional email with:
      1. Appropriate subject line
      2. Proper greeting
      3. Clear purpose statement
      4. Well-organized body
      5. Call to action (if needed)
      6. Professional closing
      
      Keep it concise and action-oriented.
    `;
        const content = await this.llm.generate(prompt);
        return {
            content: sanitizeLLMOutput(content).content,
            contentType: 'email',
            metadata: {
                subject: this.extractEmailSubject(content),
                isActionRequired: this.checkForActionItems(content)
            }
        };
    }
    async writeCreative(analysis, context) {
        const prompt = `
      Write creative content with these specifications:
      Style: ${analysis.style}
      Audience: ${analysis.audience}
      Requirements: ${analysis.requirements.join(', ')}
      
      ${context.ragDocuments ? `Inspiration/Context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Create engaging creative content with:
      1. Vivid descriptions
      2. Compelling narrative
      3. Character development (if applicable)
      4. Emotional resonance
      5. Original voice
      
      Be imaginative and captivating.
    `;
        const content = await this.llm.generate(prompt);
        return {
            content: sanitizeLLMOutput(content).content,
            contentType: 'creative',
            metadata: {
                genre: this.detectGenre(content),
                mood: this.analyzeMood(content)
            }
        };
    }
    async writeTechnical(analysis, context) {
        const prompt = `
      Write technical documentation with these specifications:
      Audience: ${analysis.audience}
      Requirements: ${analysis.requirements.join(', ')}
      
      ${context.ragDocuments ? `Technical details:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Create clear technical content with:
      1. Precise terminology
      2. Step-by-step instructions (if applicable)
      3. Code examples (if relevant)
      4. Diagrams or flowchart descriptions
      5. Troubleshooting section
      
      Be accurate and comprehensive.
    `;
        const content = await this.llm.generate(prompt);
        return {
            content: sanitizeLLMOutput(content).content,
            contentType: 'technical',
            metadata: {
                hasCodeExamples: content.includes('```'),
                technicalLevel: this.assessTechnicalLevel(content)
            }
        };
    }
    async writeGeneral(task, context) {
        const prompt = `
      Complete this writing task: ${task}
      
      ${context.ragDocuments ? `Reference material:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Create well-written content that addresses all requirements.
    `;
        const content = await this.llm.generate(prompt);
        return {
            content: sanitizeLLMOutput(content).content,
            contentType: 'general',
            metadata: {}
        };
    }
    countWords(text) {
        return text.trim().split(/\s+/).length;
    }
    extractSections(content) {
        const sections = [];
        const lines = content.split('\n');
        for (const line of lines) {
            if (/^#+\s/.test(line) || /^\d+\./.test(line) || /^[A-Z][^.!?]*:$/.test(line)) {
                sections.push(line.trim());
            }
        }
        return sections;
    }
    estimateReadingTime(content) {
        const wordsPerMinute = 200;
        const wordCount = this.countWords(content);
        return Math.ceil(wordCount / wordsPerMinute);
    }
    extractEmailSubject(content) {
        const subjectMatch = content.match(/Subject:\s*(.+)/i);
        return subjectMatch?.[1] ?? 'No subject';
    }
    checkForActionItems(content) {
        const actionKeywords = ['please', 'action required', 'by', 'deadline', 'asap', 'urgent'];
        const lowerContent = content.toLowerCase();
        return actionKeywords.some(keyword => lowerContent.includes(keyword));
    }
    detectGenre(content) {
        // Simple genre detection
        if (content.includes('once upon a time'))
            return 'fairy tale';
        if (/chapter \d+/i.test(content))
            return 'novel';
        if (content.includes('dear diary'))
            return 'diary';
        return 'general fiction';
    }
    analyzeMood(content) {
        // Simple mood analysis
        const positiveWords = ['happy', 'joy', 'love', 'beautiful', 'wonderful'];
        const negativeWords = ['sad', 'dark', 'fear', 'angry', 'terrible'];
        const lowerContent = content.toLowerCase();
        const positiveCount = positiveWords.filter(w => lowerContent.includes(w)).length;
        const negativeCount = negativeWords.filter(w => lowerContent.includes(w)).length;
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    assessTechnicalLevel(content) {
        const advancedTerms = ['algorithm', 'architecture', 'implementation', 'optimization', 'complexity'];
        const count = advancedTerms.filter(term => content.toLowerCase().includes(term)).length;
        if (count >= 3)
            return 'advanced';
        if (count >= 1)
            return 'intermediate';
        return 'beginner';
    }
    getAgentSpecificCapabilities() {
        return [
            {
                name: 'article_writing',
                description: 'Can write articles and blog posts',
                type: 'generation'
            },
            {
                name: 'report_writing',
                description: 'Can create professional reports',
                type: 'generation'
            },
            {
                name: 'email_drafting',
                description: 'Can draft professional emails',
                type: 'generation'
            },
            {
                name: 'creative_writing',
                description: 'Can write creative content and stories',
                type: 'generation'
            },
            {
                name: 'technical_writing',
                description: 'Can create technical documentation',
                type: 'generation'
            }
        ];
    }
    registerDefaultTools() {
        // Writing-specific tools could be registered here
        // For now, relies on LLM capabilities
    }
}
//# sourceMappingURL=WriterAgent.js.map