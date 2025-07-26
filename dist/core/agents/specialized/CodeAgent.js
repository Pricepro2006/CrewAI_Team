import { BaseAgent } from '../base/BaseAgent';
export class CodeAgent extends BaseAgent {
    constructor() {
        super('CodeAgent', 'Specializes in code generation, analysis, refactoring, and debugging');
    }
    async execute(task, context) {
        try {
            // Analyze the coding task
            const taskAnalysis = await this.analyzeTask(task, context);
            // Execute based on task type
            let result;
            switch (taskAnalysis.type) {
                case 'generation':
                    result = await this.generateCode(taskAnalysis, context);
                    break;
                case 'analysis':
                    result = await this.analyzeCode(taskAnalysis, context);
                    break;
                case 'refactoring':
                    result = await this.refactorCode(taskAnalysis, context);
                    break;
                case 'debugging':
                    result = await this.debugCode(taskAnalysis, context);
                    break;
                default:
                    result = await this.generalCodeTask(task, context);
            }
            return {
                success: true,
                data: result,
                output: this.formatCodeOutput(result),
                metadata: {
                    agent: this.name,
                    taskType: taskAnalysis.type,
                    language: taskAnalysis.language,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    async analyzeTask(task, context) {
        const prompt = `
      Analyze this coding task: "${task}"
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Determine:
      1. Task type: generation, analysis, refactoring, or debugging
      2. Programming language
      3. Key requirements
      4. Potential challenges
      
      Respond in JSON format:
      {
        "type": "generation|analysis|refactoring|debugging",
        "language": "typescript|python|javascript|etc",
        "requirements": ["req1", "req2"],
        "challenges": ["challenge1", "challenge2"]
      }
    `;
        const response = await this.llm.generate(prompt, { format: 'json' });
        return this.parseTaskAnalysis(response);
    }
    parseTaskAnalysis(response) {
        try {
            const parsed = JSON.parse(response);
            return {
                type: parsed.type || 'generation',
                language: parsed.language || 'typescript',
                requirements: parsed.requirements || [],
                challenges: parsed.challenges || []
            };
        }
        catch {
            return {
                type: 'generation',
                language: 'typescript',
                requirements: [],
                challenges: []
            };
        }
    }
    async generateCode(analysis, context) {
        const prompt = `
      Generate ${analysis.language} code for the following requirements:
      ${analysis.requirements.join('\n')}
      
      Consider these challenges:
      ${analysis.challenges.join('\n')}
      
      ${context.ragDocuments ? `Reference context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Generate clean, well-documented code with:
      1. Proper error handling
      2. Type safety (if applicable)
      3. Comments explaining key logic
      4. Best practices for ${analysis.language}
    `;
        const code = await this.llm.generate(prompt);
        return {
            code,
            language: analysis.language,
            explanation: 'Generated code based on requirements',
            suggestions: []
        };
    }
    async analyzeCode(analysis, context) {
        const codeToAnalyze = context.ragDocuments?.[0]?.content || '';
        const prompt = `
      Analyze this ${analysis.language} code:
      
      \`\`\`${analysis.language}
      ${codeToAnalyze}
      \`\`\`
      
      Provide:
      1. Code quality assessment
      2. Potential bugs or issues
      3. Performance considerations
      4. Security concerns
      5. Improvement suggestions
    `;
        const analysisResult = await this.llm.generate(prompt);
        return {
            code: codeToAnalyze,
            language: analysis.language,
            explanation: analysisResult,
            suggestions: this.extractSuggestions(analysisResult)
        };
    }
    async refactorCode(analysis, context) {
        const codeToRefactor = context.ragDocuments?.[0]?.content || '';
        const prompt = `
      Refactor this ${analysis.language} code:
      
      \`\`\`${analysis.language}
      ${codeToRefactor}
      \`\`\`
      
      Apply these refactoring principles:
      1. Improve readability
      2. Reduce complexity
      3. Follow ${analysis.language} best practices
      4. Optimize performance where possible
      5. Maintain functionality
      
      Provide the refactored code with comments explaining changes.
    `;
        const refactoredCode = await this.llm.generate(prompt);
        return {
            code: refactoredCode,
            language: analysis.language,
            explanation: 'Code refactored for improved quality',
            suggestions: ['Review changes carefully', 'Run tests to ensure functionality']
        };
    }
    async debugCode(analysis, context) {
        const buggyCode = context.ragDocuments?.[0]?.content || '';
        const prompt = `
      Debug this ${analysis.language} code:
      
      \`\`\`${analysis.language}
      ${buggyCode}
      \`\`\`
      
      Identify and fix:
      1. Syntax errors
      2. Logic errors
      3. Runtime errors
      4. Edge cases
      5. Type issues (if applicable)
      
      Provide fixed code with comments explaining the bugs and fixes.
    `;
        const fixedCode = await this.llm.generate(prompt);
        return {
            code: fixedCode,
            language: analysis.language,
            explanation: 'Bugs identified and fixed',
            suggestions: ['Test thoroughly', 'Add error handling']
        };
    }
    async generalCodeTask(task, context) {
        const prompt = `
      Complete this coding task: ${task}
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map(d => d.content).join('\n')}` : ''}
      
      Provide a complete solution with explanation.
    `;
        const response = await this.llm.generate(prompt);
        return {
            code: this.extractCode(response),
            language: 'unknown',
            explanation: response,
            suggestions: []
        };
    }
    extractCode(response) {
        // Extract code blocks from the response
        const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
        const matches = response.match(codeBlockRegex);
        if (matches && matches.length > 0) {
            return matches[0].replace(/```[\w]*\n/, '').replace(/```$/, '');
        }
        return response;
    }
    extractSuggestions(analysis) {
        // Simple extraction of numbered suggestions
        const suggestions = [];
        const lines = analysis.split('\n');
        for (const line of lines) {
            if (/^\d+\./.test(line.trim())) {
                suggestions.push(line.trim());
            }
        }
        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }
    formatCodeOutput(result) {
        const parts = [];
        if (result.code) {
            parts.push(`\`\`\`${result.language}\n${result.code}\n\`\`\``);
        }
        if (result.explanation) {
            parts.push(`\n**Explanation:**\n${result.explanation}`);
        }
        if (result.suggestions && result.suggestions.length > 0) {
            parts.push(`\n**Suggestions:**\n${result.suggestions.map(s => `- ${s}`).join('\n')}`);
        }
        return parts.join('\n');
    }
    getAgentSpecificCapabilities() {
        return [
            {
                name: 'code_generation',
                description: 'Can generate code in multiple programming languages',
                type: 'generation'
            },
            {
                name: 'code_analysis',
                description: 'Can analyze code for quality, bugs, and improvements',
                type: 'analysis'
            },
            {
                name: 'code_refactoring',
                description: 'Can refactor code for better quality and maintainability',
                type: 'generation'
            },
            {
                name: 'debugging',
                description: 'Can identify and fix bugs in code',
                type: 'analysis'
            }
        ];
    }
    registerDefaultTools() {
        // Code-specific tools could be registered here
        // For now, the agent relies on LLM capabilities
    }
}
//# sourceMappingURL=CodeAgent.js.map