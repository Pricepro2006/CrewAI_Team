import { logger } from "../../utils/logger";
/**
 * Enhanced parser for structured query analysis
 * Based on master_orchestrator_instructions.md patterns
 */
export class EnhancedParser {
    llm;
    entityPatterns = new Map();
    intentClassifier = new Map();
    constructor(llm) {
        this.llm = llm;
        this.initializePatterns();
    }
    initializePatterns() {
        // Common entity patterns for extraction
        this.entityPatterns = new Map([
            ["url", /https?:\/\/[^\s]+/gi],
            ["email", /[\w.-]+@[\w.-]+\.\w+/gi],
            ["date", /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/gi],
            ["number", /\b\d+(?:\.\d+)?\b/gi],
            ["code_block", /```[\s\S]*?```|`[^`]+`/gi],
            ["file_path", /(?:\/|\\|[a-zA-Z]:)[^\s]*?\.[a-zA-Z]{2,4}/gi],
            ["api_endpoint", /\/api\/[^\s]*/gi],
        ]);
        // Intent classification keywords
        this.intentClassifier = new Map([
            [
                "create",
                [
                    "create",
                    "make",
                    "build",
                    "generate",
                    "develop",
                    "implement",
                    "write",
                ],
            ],
            [
                "analyze",
                ["analyze", "examine", "investigate", "review", "assess", "evaluate"],
            ],
            [
                "research",
                ["research", "find", "search", "look up", "discover", "learn about"],
            ],
            ["debug", ["debug", "fix", "troubleshoot", "solve", "resolve", "repair"]],
            [
                "optimize",
                [
                    "optimize",
                    "improve",
                    "enhance",
                    "refactor",
                    "speed up",
                    "performance",
                ],
            ],
            [
                "explain",
                ["explain", "describe", "clarify", "detail", "elaborate", "document"],
            ],
            ["test", ["test", "verify", "validate", "check", "confirm", "ensure"]],
            [
                "deploy",
                ["deploy", "release", "publish", "launch", "ship", "distribute"],
            ],
        ]);
    }
    async parseQuery(query, context) {
        try {
            logger.debug("Starting enhanced query parsing", "PARSER", {
                queryLength: query.text.length,
                hasContext: !!context,
            });
            // Step 1: Extract basic entities using patterns
            const entities = this.extractEntities(query.text);
            // Step 2: Classify intent using LLM and patterns
            const intent = await this.classifyIntent(query.text, context);
            // Step 3: Assess complexity
            const complexity = this.assessComplexity(query.text, entities);
            // Step 4: Determine required domains
            const domains = await this.identifyRequiredDomains(query.text, intent, entities);
            // Step 5: Assess priority and duration
            const priority = this.assessPriority(query.text, intent, entities);
            const estimatedDuration = this.estimateDuration(complexity, domains.length);
            // Step 6: Determine resource requirements
            const resourceRequirements = this.analyzeResourceRequirements(query.text, intent, entities, domains);
            const analysis = {
                intent,
                entities,
                complexity,
                domains,
                priority,
                estimatedDuration,
                resourceRequirements,
            };
            logger.info("Query analysis completed", "PARSER", {
                intent,
                complexity,
                domains: domains.length,
                priority,
                estimatedDuration,
            });
            return analysis;
        }
        catch (error) {
            logger.error("Query parsing failed", "PARSER", { error });
            // Return fallback analysis
            return {
                intent: "unknown",
                entities: {},
                complexity: 5,
                domains: ["general"],
                priority: "medium",
                estimatedDuration: 60,
                resourceRequirements: {
                    requiresInternet: false,
                    requiresDatabase: false,
                    requiresLLM: true,
                    requiresVector: false,
                    computeIntensive: false,
                    memoryIntensive: false,
                },
            };
        }
    }
    extractEntities(text) {
        const entities = {};
        // Extract using regex patterns
        for (const [type, pattern] of this.entityPatterns.entries()) {
            const matches = Array.from(text.matchAll(pattern));
            if (matches.length > 0) {
                entities[type] = matches.map((match) => match[0]);
            }
        }
        // Extract technical terms
        entities.technical_terms = this.extractTechnicalTerms(text);
        // Extract programming languages
        entities.programming_languages = this.extractProgrammingLanguages(text);
        // Extract framework/library mentions
        entities.frameworks = this.extractFrameworks(text);
        return entities;
    }
    async classifyIntent(text, context) {
        // First try pattern-based classification
        const patternIntent = this.classifyIntentByPatterns(text);
        if (patternIntent !== "unknown") {
            return patternIntent;
        }
        // Use LLM for complex intent classification
        const prompt = `
Analyze this query and classify its primary intent. Choose from: create, analyze, research, debug, optimize, explain, test, deploy, integrate, configure, monitor, or other.

Query: "${text}"
${context ? `Context: ${JSON.stringify(context)}` : ""}

Respond with only the intent category (one word).`;
        try {
            const response = await this.llm.generate(prompt, { maxTokens: 10 });
            const intent = response.trim().toLowerCase();
            // Validate response
            const validIntents = [
                "create",
                "analyze",
                "research",
                "debug",
                "optimize",
                "explain",
                "test",
                "deploy",
                "integrate",
                "configure",
                "monitor",
                "other",
            ];
            return validIntents.includes(intent) ? intent : "other";
        }
        catch (error) {
            logger.warn("LLM intent classification failed, using pattern fallback", "PARSER", { error });
            return patternIntent;
        }
    }
    classifyIntentByPatterns(text) {
        const lowerText = text.toLowerCase();
        for (const [intent, keywords] of this.intentClassifier.entries()) {
            if (keywords.some((keyword) => lowerText.includes(keyword))) {
                return intent;
            }
        }
        return "unknown";
    }
    assessComplexity(text, entities) {
        let complexity = 1;
        // Length factor (1-3 points)
        if (text.length > 500)
            complexity += 3;
        else if (text.length > 200)
            complexity += 2;
        else if (text.length > 100)
            complexity += 1;
        // Entity count factor (1-2 points)
        const entityCount = Object.values(entities).flat().length;
        if (entityCount > 10)
            complexity += 2;
        else if (entityCount > 5)
            complexity += 1;
        // Technical complexity indicators (1-3 points)
        const technicalIndicators = [
            "integration",
            "architecture",
            "performance",
            "security",
            "scalability",
            "distributed",
            "microservices",
            "database",
            "algorithm",
            "optimization",
            "machine learning",
            "ai",
        ];
        const technicalMatches = technicalIndicators.filter((indicator) => text.toLowerCase().includes(indicator)).length;
        if (technicalMatches > 5)
            complexity += 3;
        else if (technicalMatches > 2)
            complexity += 2;
        else if (technicalMatches > 0)
            complexity += 1;
        // Multi-step indicators (1-2 points)
        const stepIndicators = [
            "then",
            "after",
            "next",
            "finally",
            "first",
            "second",
            "step",
        ];
        const stepMatches = stepIndicators.filter((indicator) => text.toLowerCase().includes(indicator)).length;
        if (stepMatches > 3)
            complexity += 2;
        else if (stepMatches > 1)
            complexity += 1;
        return Math.min(complexity, 10); // Cap at 10
    }
    async identifyRequiredDomains(text, intent, entities) {
        const domains = new Set();
        // Add domain based on intent
        switch (intent) {
            case "research":
                domains.add("research");
                break;
            case "create":
            case "debug":
                domains.add("development");
                break;
            case "analyze":
                domains.add("analysis");
                break;
            case "test":
                domains.add("testing");
                break;
            case "deploy":
                domains.add("deployment");
                break;
        }
        // Add domains based on entities and keywords
        const lowerText = text.toLowerCase();
        if (entities.programming_languages ||
            lowerText.includes("code") ||
            lowerText.includes("program")) {
            domains.add("development");
        }
        if (entities.url ||
            lowerText.includes("web") ||
            lowerText.includes("api")) {
            domains.add("web");
        }
        if (lowerText.includes("data") ||
            lowerText.includes("database") ||
            lowerText.includes("sql")) {
            domains.add("data");
        }
        if (lowerText.includes("security") ||
            lowerText.includes("authentication") ||
            lowerText.includes("authorization")) {
            domains.add("security");
        }
        if (lowerText.includes("performance") ||
            lowerText.includes("optimization") ||
            lowerText.includes("speed")) {
            domains.add("performance");
        }
        if (lowerText.includes("document") ||
            lowerText.includes("explain") ||
            lowerText.includes("guide")) {
            domains.add("documentation");
        }
        // Default domain if none identified
        if (domains.size === 0) {
            domains.add("general");
        }
        return Array.from(domains);
    }
    assessPriority(text, intent, entities) {
        const lowerText = text.toLowerCase();
        // Urgent indicators
        if (lowerText.includes("urgent") ||
            lowerText.includes("emergency") ||
            lowerText.includes("critical") ||
            lowerText.includes("asap")) {
            return "urgent";
        }
        // High priority indicators
        if (lowerText.includes("important") ||
            lowerText.includes("high priority") ||
            lowerText.includes("deadline") ||
            intent === "debug") {
            return "high";
        }
        // Low priority indicators
        if (lowerText.includes("when you have time") ||
            lowerText.includes("low priority") ||
            lowerText.includes("eventually")) {
            return "low";
        }
        // Default to medium
        return "medium";
    }
    estimateDuration(complexity, domainCount) {
        // Base duration based on complexity (10-300 seconds)
        let duration = complexity * 30;
        // Adjust for domain complexity
        duration += domainCount * 15;
        // Minimum 10 seconds, maximum 300 seconds (5 minutes)
        return Math.max(10, Math.min(duration, 300));
    }
    analyzeResourceRequirements(text, intent, entities, domains) {
        const lowerText = text.toLowerCase();
        return {
            requiresInternet: !!(entities.url ||
                lowerText.includes("web") ||
                lowerText.includes("search") ||
                lowerText.includes("api") ||
                intent === "research"),
            requiresDatabase: !!(lowerText.includes("database") ||
                lowerText.includes("sql") ||
                lowerText.includes("data") ||
                domains.includes("data")),
            requiresLLM: true, // Most queries will need LLM
            requiresVector: !!(lowerText.includes("similar") ||
                lowerText.includes("search") ||
                lowerText.includes("find") ||
                intent === "research"),
            computeIntensive: !!(lowerText.includes("analyze") ||
                lowerText.includes("process") ||
                lowerText.includes("calculate") ||
                domains.includes("analysis") ||
                domains.includes("performance")),
            memoryIntensive: !!(lowerText.includes("large") ||
                lowerText.includes("big data") ||
                lowerText.includes("process file") ||
                entities.file_path),
        };
    }
    extractTechnicalTerms(text) {
        const technicalTerms = [
            "api",
            "rest",
            "graphql",
            "webhook",
            "microservice",
            "container",
            "docker",
            "kubernetes",
            "cloud",
            "aws",
            "azure",
            "gcp",
            "database",
            "sql",
            "nosql",
            "redis",
            "mongodb",
            "postgresql",
            "mysql",
            "elasticsearch",
            "kafka",
            "ci/cd",
            "devops",
            "terraform",
            "ansible",
            "jenkins",
            "github",
            "git",
            "machine learning",
            "ai",
            "neural network",
            "deep learning",
            "nlp",
            "blockchain",
            "cryptocurrency",
            "oauth",
            "jwt",
            "authentication",
            "authorization",
        ];
        const lowerText = text.toLowerCase();
        return technicalTerms.filter((term) => lowerText.includes(term));
    }
    extractProgrammingLanguages(text) {
        const languages = [
            "javascript",
            "typescript",
            "python",
            "java",
            "c++",
            "c#",
            "go",
            "rust",
            "php",
            "ruby",
            "swift",
            "kotlin",
            "scala",
            "clojure",
            "haskell",
            "erlang",
            "sql",
            "html",
            "css",
            "bash",
            "shell",
            "powershell",
            "r",
            "matlab",
        ];
        const lowerText = text.toLowerCase();
        return languages.filter((lang) => lowerText.includes(lang));
    }
    extractFrameworks(text) {
        const frameworks = [
            "react",
            "angular",
            "vue",
            "svelte",
            "nextjs",
            "nuxt",
            "gatsby",
            "express",
            "fastify",
            "koa",
            "nest",
            "django",
            "flask",
            "spring",
            "laravel",
            "rails",
            "asp.net",
            "xamarin",
            "flutter",
            "react native",
            "tensorflow",
            "pytorch",
            "keras",
            "scikit-learn",
            "pandas",
            "numpy",
        ];
        const lowerText = text.toLowerCase();
        return frameworks.filter((framework) => lowerText.includes(framework));
    }
}
//# sourceMappingURL=EnhancedParser.js.map