import { BaseAgent } from "../base/BaseAgent.js";
export class CodeAgent extends BaseAgent {
    constructor() {
        super("CodeAgent", "Specializes in code generation, analysis, refactoring, and debugging");
    }
    async execute(task, context) {
        try {
            // Query RAG for relevant code examples and documentation
            let ragContext = "";
            let codeExamples = [];
            if (this.ragSystem && this.ragEnabled) {
                // Search for code patterns and examples
                ragContext = await this.queryRAG(task, {
                    limit: 5,
                    filter: {
                        agentType: 'CodeAgent',
                        category: 'code_examples'
                    }
                });
                // Also search for relevant documentation
                const docContext = await this.queryRAG(task, {
                    limit: 3,
                    filter: {
                        category: 'documentation'
                    }
                });
                if (ragContext || docContext) {
                    console.log(`[CodeAgent] Retrieved RAG context: ${(ragContext + docContext).length} characters`);
                    ragContext = ragContext + "\n" + docContext;
                }
                // Search for specific code examples
                const searchResults = await this.searchRAG(task, 3);
                codeExamples = searchResults.filter(r => r.metadata?.type === 'code');
            }
            // Analyze the coding task with RAG context
            const taskAnalysis = await this.analyzeTask(task, context, ragContext);
            // Execute based on task type
            let result;
            switch (taskAnalysis.type) {
                case "generation":
                    result = await this.generateCode(taskAnalysis, context, codeExamples);
                    break;
                case "analysis":
                    result = await this.analyzeCode(taskAnalysis, context);
                    break;
                case "refactoring":
                    result = await this.refactorCode(taskAnalysis, context);
                    break;
                case "debugging":
                    result = await this.debugCode(taskAnalysis, context);
                    break;
                default:
                    result = await this.generalCodeTask(task, context);
            }
            // Index successful code generation back into RAG
            if (this.ragSystem && this.ragEnabled && taskAnalysis.type === "generation" && result) {
                const codeResult = result;
                if (codeResult.code) {
                    await this.indexAgentKnowledge([{
                            content: codeResult.code,
                            metadata: {
                                type: 'code',
                                language: taskAnalysis.language,
                                task: task,
                                taskType: taskAnalysis.type,
                                timestamp: new Date().toISOString()
                            }
                        }]);
                }
            }
            return {
                success: true,
                data: result,
                output: this.formatCodeOutput(result),
                metadata: {
                    agent: this.name,
                    taskType: taskAnalysis.type,
                    language: taskAnalysis.language,
                    ragEnhanced: !!ragContext,
                    codeExamplesUsed: codeExamples.length,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    async analyzeTask(task, context, ragContext = "") {
        const prompt = `
      Analyze this coding task: "${task}"
      
      ${ragContext ? `RAG Context:\n${ragContext}\n` : ""}
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d) => d.content || '').join("\n")}` : ""}
      
      Provide a detailed analysis of:
      1. Task type: generation, analysis, refactoring, or debugging
      2. Programming language
      3. Key requirements
      4. Potential challenges
    `;
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const response = await this.generateLLMResponse(prompt);
        return this.parseTaskAnalysis(response.response);
    }
    parseTaskAnalysis(response) {
        // Don't require JSON - parse the text response intelligently
        const lowerResponse = response.toLowerCase();
        // Determine task type from response
        let type = "generation";
        if (lowerResponse.includes("analyz") || lowerResponse.includes("review")) {
            type = "analysis";
        }
        else if (lowerResponse.includes("refactor") || lowerResponse.includes("improve")) {
            type = "refactoring";
        }
        else if (lowerResponse.includes("debug") || lowerResponse.includes("fix") || lowerResponse.includes("error")) {
            type = "debugging";
        }
        // Detect language mentioned
        let language = "typescript";
        if (lowerResponse.includes("javascript"))
            language = "javascript";
        else if (lowerResponse.includes("python"))
            language = "python";
        else if (lowerResponse.includes("java"))
            language = "java";
        else if (lowerResponse.includes("rust"))
            language = "rust";
        else if (lowerResponse.includes("go"))
            language = "go";
        return {
            type,
            language,
            requirements: [],
            challenges: [],
        };
    }
    async generateCode(analysis, context, codeExamples = []) {
        const examplesText = codeExamples.length > 0
            ? `\nRelevant code examples:\n${codeExamples.map(e => e.content || '').join("\n\n")}\n`
            : "";
        const prompt = `
      Generate ${analysis.language} code for the following requirements:
      ${(analysis.requirements || []).join("\n")}
      
      Consider these challenges:
      ${(analysis.challenges || []).join("\n")}
      
      ${examplesText}
      ${context.ragDocuments ? `Reference context:\n${context.ragDocuments.map((d) => d.content || '').join("\n")}` : ""}
      
      Generate clean, well-documented code with:
      1. Proper error handling
      2. Type safety (if applicable)
      3. Comments explaining key logic
      4. Best practices for ${analysis.language}
    `;
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const response = await this.generateLLMResponse(prompt);
        return {
            code: response.response,
            language: analysis.language,
            explanation: "Generated code based on requirements",
            suggestions: [],
        };
    }
    async analyzeCode(analysis, context) {
        const codeToAnalyze = context.ragDocuments?.[0]?.content || "";
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
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const analysisResult = await this.generateLLMResponse(prompt);
        return {
            code: codeToAnalyze,
            language: analysis.language,
            explanation: analysisResult.response,
            suggestions: this.extractSuggestions(analysisResult.response),
        };
    }
    async refactorCode(analysis, context) {
        const codeToRefactor = context.ragDocuments?.[0]?.content || "";
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
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const response = await this.generateLLMResponse(prompt);
        return {
            code: response.response,
            language: analysis.language,
            explanation: "Code refactored for improved quality",
            suggestions: [
                "Review changes carefully",
                "Run tests to ensure functionality",
            ],
        };
    }
    async debugCode(analysis, context) {
        const buggyCode = context.ragDocuments?.[0]?.content || "";
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
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const response = await this.generateLLMResponse(prompt);
        return {
            code: response.response,
            language: analysis.language,
            explanation: "Bugs identified and fixed",
            suggestions: ["Test thoroughly", "Add error handling"],
        };
    }
    async generalCodeTask(task, context) {
        const prompt = `
      Complete this coding task: ${task}
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d) => d.content || '').join("\n")}` : ""}
      
      Provide a complete solution with explanation.
    `;
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const llmResponse = await this.generateLLMResponse(prompt);
        return {
            code: this.extractCode(llmResponse.response),
            language: "unknown",
            explanation: llmResponse.response,
            suggestions: [],
        };
    }
    extractCode(response) {
        // Extract code blocks from the response
        const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
        const matches = response.match(codeBlockRegex);
        if (matches && matches.length > 0) {
            return matches[0].replace(/```[\w]*\n/, "").replace(/```$/, "");
        }
        return response;
    }
    extractSuggestions(analysis) {
        // Simple extraction of numbered suggestions
        const suggestions = [];
        const lines = analysis.split("\n");
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
            parts.push(`\n**Suggestions:**\n${result.suggestions.map((s) => `- ${s || ''}`).join("\n")}`);
        }
        return parts.join("\n");
    }
    getAgentSpecificCapabilities() {
        return [
            {
                name: "code_generation",
                description: "Can generate code in multiple programming languages",
                type: "generation",
            },
            {
                name: "code_analysis",
                description: "Can analyze code for quality, bugs, and improvements",
                type: "analysis",
            },
            {
                name: "code_refactoring",
                description: "Can refactor code for better quality and maintainability",
                type: "generation",
            },
            {
                name: "debugging",
                description: "Can identify and fix bugs in code",
                type: "analysis",
            },
        ];
    }
    registerDefaultTools() {
        // Code-specific tools could be registered here
        // For now, the agent relies on LLM capabilities
        // Add capabilities for this agent
        this.addCapability("code_generation");
        this.addCapability("code_analysis");
        this.addCapability("code_refactoring");
        this.addCapability("debugging");
    }
}
