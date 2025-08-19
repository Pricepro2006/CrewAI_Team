import { EmailAnalysisAgent } from "../agents/specialized/EmailAnalysisAgent.js";
import { logger } from "../../utils/logger.js";
import { metrics } from "../../api/monitoring/metrics.js";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../utils/timeout.js";
// Main pipeline class
export class EmailAnalysisPipeline {
    stages = [];
    analysisAgent;
    constructor() {
        try {
            this.analysisAgent = new EmailAnalysisAgent();
        }
        catch (error) {
            logger.error('Failed to initialize EmailAnalysisAgent in pipeline', 'PIPELINE', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Create a stub agent that will fail gracefully
            this.analysisAgent = {};
        }
        this.initializeStages();
    }
    initializeStages() {
        this.stages = [
            new ContentAnalysisStage(this.analysisAgent),
            new WorkflowDetectionStage(),
            new EntityExtractionStage(),
            new PriorityClassificationStage(),
            new CommunicationPatternStage(),
            new AgentAssignmentStage(),
        ];
    }
    async process(email) {
        let enrichedEmail = { ...email };
        const startTime = Date.now();
        logger.info("Starting email analysis pipeline", "PIPELINE", {
            emailId: email.id,
            subject: email?.subject?.substring(0, 50),
        });
        for (const stage of this.stages) {
            try {
                const stageStartTime = Date.now();
                enrichedEmail = await withTimeout(stage.process(enrichedEmail), this.getStageTimeout(stage.name), `Stage ${stage.name} timeout`);
                const stageDuration = Date.now() - stageStartTime;
                metrics.histogram("pipeline.stage.duration", stageDuration, {
                    stage: stage.name,
                });
                logger.debug(`Stage ${stage.name} completed`, "PIPELINE", {
                    emailId: email.id,
                    duration: stageDuration,
                });
            }
            catch (error) {
                logger.error(`Stage ${stage.name} failed`, "PIPELINE", {
                    emailId: email.id,
                    stage: stage.name,
                    error: error instanceof Error ? error.message : String(error),
                });
                metrics.increment("pipeline.stage.error", 1, {
                    stage: stage.name,
                });
                // Add error flag but continue processing
                enrichedEmail[`${stage?.name?.toLowerCase()}_error`] = true;
            }
        }
        const processingTime = Date.now() - startTime;
        logger.info("Pipeline processing complete", "PIPELINE", {
            emailId: email.id,
            duration: processingTime,
            workflowState: enrichedEmail.workflow?.state,
        });
        metrics.histogram("pipeline.total.duration", processingTime);
        metrics.increment("pipeline.emails.processed", 1);
        return enrichedEmail;
    }
    getStageTimeout(stageName) {
        const timeouts = {
            ContentAnalysis: 30000,
            WorkflowDetection: 5000,
            EntityExtraction: 10000,
            PriorityClassification: 5000,
            CommunicationPattern: 5000,
            AgentAssignment: 5000,
        };
        return timeouts[stageName] || DEFAULT_TIMEOUTS.TOOL_EXECUTION;
    }
}
// Stage implementations
class ContentAnalysisStage {
    analysisAgent;
    name = "ContentAnalysis";
    constructor(analysisAgent) {
        this.analysisAgent = analysisAgent;
    }
    async process(email) {
        // Convert EmailData format to Email format expected by EmailAnalysisAgent
        const emailForAnalysis = {
            id: email.id,
            subject: email.subject,
            body: email.body,
            from: {
                emailAddress: {
                    name: email.from || "",
                    address: email.from || "",
                },
            },
            to: email.to?.map((addr) => ({
                emailAddress: {
                    name: addr,
                    address: addr,
                },
            })),
            receivedDateTime: email.receivedDateTime,
            isRead: false,
            categories: [],
            hasAttachments: email.hasAttachments || false,
            importance: email.importance || "normal",
        };
        if (!this.analysisAgent || typeof this.analysisAgent.analyzeEmail !== 'function') {
            // Return minimal analysis if agent not available
            return {
                ...email,
                analysis: {
                    summary: email.subject || '',
                    sentiment: 'neutral',
                    intent: 'unknown',
                    topics: [],
                },
            };
        }
        const analysis = await this.analysisAgent.analyzeEmail(emailForAnalysis);
        return {
            ...email,
            analysis: {
                summary: analysis.summary || "",
                sentiment: analysis.sentiment || "neutral",
                intent: analysis.categories?.intent || "unknown",
                topics: analysis.topics || [],
            },
        };
    }
}
class WorkflowDetectionStage {
    name = "WorkflowDetection";
    // Patterns based on 97,900 email analysis
    workflowPatterns = {
        quoteToOrder: {
            start: [
                /quote request/i,
                /rfq/i,
                /request for quote/i,
                /pricing request/i,
                /please provide.*quote/i,
                /need.*pricing/i,
                /interested in.*pricing/i,
            ],
            middle: [
                /quote.*attached/i,
                /pricing.*below/i,
                /quote.*\d{6,}/i,
                /reviewing.*quote/i,
                /questions.*quote/i,
                /clarification.*pricing/i,
            ],
            end: [
                /po.*attached/i,
                /purchase order/i,
                /order.*confirmed/i,
                /approved.*purchase/i,
                /proceed.*order/i,
            ],
        },
        orderSupport: {
            start: [
                /order.*status/i,
                /tracking.*number/i,
                /where.*order/i,
                /shipment.*update/i,
                /delivery.*status/i,
            ],
            middle: [
                /investigating.*order/i,
                /checking.*status/i,
                /following up/i,
                /order.*processing/i,
                /shipment.*delayed/i,
            ],
            end: [
                /order.*delivered/i,
                /shipment.*received/i,
                /delivery.*complete/i,
                /package.*arrived/i,
                /successfully.*delivered/i,
            ],
        },
        technicalSupport: {
            start: [
                /issue with/i,
                /problem with/i,
                /error.*occurring/i,
                /not working/i,
                /help.*with/i,
                /support.*ticket/i,
            ],
            middle: [
                /troubleshooting/i,
                /investigating.*issue/i,
                /working on.*problem/i,
                /ticket.*\d{5,}/i,
                /case.*created/i,
            ],
            end: [
                /issue.*resolved/i,
                /problem.*fixed/i,
                /ticket.*closed/i,
                /resolution.*provided/i,
                /working.*now/i,
            ],
        },
    };
    async process(email) {
        const content = `${email.subject} ${email.body}`;
        const workflowType = this.detectWorkflowType(content);
        const chainPosition = this.detectChainPosition(content, workflowType);
        const confidence = this.calculateConfidence(content, workflowType, chainPosition);
        // Try to link to existing workflow chain
        const chainId = await this.findOrCreateWorkflowChain(email, workflowType);
        return {
            ...email,
            workflow: {
                state: this.mapChainPositionToState(chainPosition),
                type: workflowType,
                chainPosition,
                chainId,
                isComplete: chainPosition === "end",
                confidence,
            },
        };
    }
    detectWorkflowType(content) {
        for (const [type, patterns] of Object.entries(this.workflowPatterns)) {
            const allPatterns = [
                ...patterns.start,
                ...patterns.middle,
                ...patterns.end,
            ];
            if (allPatterns.some((pattern) => pattern.test(content))) {
                return type;
            }
        }
        return "general";
    }
    detectChainPosition(content, workflowType) {
        const patterns = this.workflowPatterns[workflowType];
        if (!patterns)
            return "middle";
        // Check end patterns first (most specific)
        if (patterns?.end?.some((pattern) => pattern.test(content))) {
            return "end";
        }
        // Check start patterns
        if (patterns?.start?.some((pattern) => pattern.test(content))) {
            return "start";
        }
        // Default to middle
        return "middle";
    }
    calculateConfidence(content, workflowType, position) {
        let confidence = 0.5; // Base confidence
        // Increase confidence if multiple patterns match
        const patterns = this.workflowPatterns[workflowType];
        if (patterns) {
            const positionPatterns = patterns[position];
            if (positionPatterns) {
                const matchCount = positionPatterns?.filter((pattern) => pattern.test(content)).length;
                confidence += matchCount * 0.1;
            }
        }
        // Cap at 0.95
        return Math.min(confidence, 0.95);
    }
    mapChainPositionToState(position) {
        const mapping = {
            start: "START_POINT",
            middle: "IN_PROGRESS",
            end: "COMPLETION",
        };
        return mapping[position];
    }
    async findOrCreateWorkflowChain(email, workflowType) {
        // In a real implementation, this would:
        // 1. Look for related emails using conversationId, references, subject similarity
        // 2. Create or update workflow chain in database
        // 3. Return the chain ID
        // For now, use conversation ID as a simple chain identifier
        return email.conversationId;
    }
}
class EntityExtractionStage {
    name = "EntityExtraction";
    patterns = {
        orderNumbers: [
            /\b\d{8,10}\b/g, // 8-10 digit numbers
            /PO[#\s]*\d{6,}/gi, // PO numbers
            /SO[#\s]*\d{6,}/gi, // Sales orders
            /order[#\s]*\d{6,}/gi, // Order numbers
        ],
        trackingNumbers: [
            /\b1Z[A-Z0-9]{16}\b/g, // UPS
            /\b\d{20,22}\b/g, // FedEx
            /\b\d{10,14}\b/g, // Generic tracking
        ],
        people: [
            /(?:from:|to:|cc:)\s*([^<\n]+)</gi,
            /(?:dear|hi|hello)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi,
        ],
        amounts: [/\$[\d,]+\.?\d*/g, /USD\s*[\d,]+\.?\d*/gi],
    };
    async process(email) {
        const content = `${email.subject} ${email.body}`;
        const entities = {
            people: this.extractPeople(email),
            organizations: this.extractOrganizations(content),
            products: this.extractProducts(content),
            orderNumbers: this.extractWithPatterns(content, this?.patterns?.orderNumbers),
            trackingNumbers: this.extractWithPatterns(content, this?.patterns?.trackingNumbers),
            dates: this.extractDates(content),
            amounts: this.extractWithPatterns(content, this?.patterns?.amounts),
        };
        return {
            ...email,
            entities,
        };
    }
    extractPeople(email) {
        const people = new Set();
        // Extract from email addresses
        if (email.from) {
            const fromMatch = email?.from?.match(/^([^<]+)/);
            if (fromMatch && fromMatch[1])
                people.add(fromMatch[1].trim());
        }
        // Add more extraction logic as needed
        return Array.from(people);
    }
    extractOrganizations(content) {
        // Simple implementation - would use NER in production
        const orgs = new Set();
        const orgPatterns = [
            /TD SYNNEX/gi,
            /Insight/gi,
            /CompuCom/gi,
            /Microsoft/gi,
            /HP\b/gi,
            /Dell/gi,
        ];
        orgPatterns.forEach((pattern) => {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach((match) => orgs.add(match));
            }
        });
        return Array.from(orgs);
    }
    extractProducts(content) {
        // Extract product SKUs and names
        const products = new Set();
        const productPatterns = [
            /\b[A-Z0-9]{6,}(?:#[A-Z]{3})?\b/g, // SKUs like 9VD15AA#ABA
            /Surface\s+\w+/gi,
            /ThinkPad\s+\w+/gi,
        ];
        productPatterns.forEach((pattern) => {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach((match) => products.add(match));
            }
        });
        return Array.from(products);
    }
    extractWithPatterns(content, patterns) {
        const results = new Set();
        patterns.forEach((pattern) => {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach((match) => results.add(match));
            }
        });
        return Array.from(results);
    }
    extractDates(content) {
        // Simple date extraction - would use more sophisticated parsing in production
        const dates = new Set();
        const datePatterns = [
            /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
            /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
            /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
        ];
        datePatterns.forEach((pattern) => {
            const matches = content.match(pattern);
            if (matches) {
                matches.forEach((match) => dates.add(match));
            }
        });
        return Array.from(dates);
    }
}
class PriorityClassificationStage {
    name = "PriorityClassification";
    priorityIndicators = {
        critical: [
            /urgent/i,
            /asap/i,
            /critical/i,
            /emergency/i,
            /immediately/i,
            /high priority/i,
            /expedite/i,
        ],
        high: [
            /important/i,
            /priority/i,
            /soon/i,
            /quickly/i,
            /by end of day/i,
            /eod/i,
            /today/i,
        ],
        medium: [/when possible/i, /at your convenience/i, /this week/i],
        low: [/no rush/i, /whenever/i, /low priority/i, /fyi/i],
    };
    async process(email) {
        const content = `${email.subject} ${email.body}`;
        const priority = this.determinePriority(content, email);
        return {
            ...email,
            priority,
        };
    }
    determinePriority(content, email) {
        // Check explicit priority indicators
        for (const [level, patterns] of Object.entries(this.priorityIndicators)) {
            if (patterns.some((pattern) => pattern.test(content))) {
                return level;
            }
        }
        // Consider workflow state
        if (email.workflow?.state === "START_POINT" &&
            email.workflow?.type === "orderSupport") {
            return "high";
        }
        // Consider entities (orders, tracking numbers often indicate higher priority)
        if (email.entities?.orderNumbers?.length ||
            email.entities?.trackingNumbers?.length) {
            return "medium";
        }
        // Default
        return "medium";
    }
}
class CommunicationPatternStage {
    name = "CommunicationPattern";
    async process(email) {
        const isFirstContact = this.detectFirstContact(email);
        const responseRequired = this.detectResponseRequired(email);
        const estimatedResponseTime = this.estimateResponseTime(email);
        return {
            ...email,
            communicationPattern: {
                isFirstContact,
                responseRequired,
                estimatedResponseTime,
            },
        };
    }
    detectFirstContact(email) {
        // Check if this is start of workflow
        if (email.workflow?.chainPosition === "start") {
            return true;
        }
        // Check for first contact indicators
        const content = `${email.subject} ${email.body}`.toLowerCase();
        const firstContactPhrases = [
            "first time",
            "new customer",
            "introducing",
            "initial inquiry",
        ];
        return firstContactPhrases.some((phrase) => content.includes(phrase));
    }
    detectResponseRequired(email) {
        const content = `${email.subject} ${email.body}`.toLowerCase();
        // Questions typically require responses
        const hasQuestions = content.includes("?") ||
            /\b(what|when|where|how|why|can you|could you|would you)\b/i.test(content);
        // Certain intents require response
        const requiresResponse = email.analysis?.intent === "request" ||
            email.analysis?.intent === "inquiry";
        return hasQuestions || requiresResponse || false;
    }
    estimateResponseTime(email) {
        // Base on priority and type
        const priorityTimes = {
            critical: 1, // 1 hour
            high: 4, // 4 hours
            medium: 24, // 24 hours
            low: 48, // 48 hours
        };
        return priorityTimes[email.priority || "medium"];
    }
}
class AgentAssignmentStage {
    name = "AgentAssignment";
    agentCapabilities = {
        "sales-agent": ["quote", "pricing", "product", "rfq"],
        "support-agent": ["issue", "problem", "error", "help", "support"],
        "order-agent": ["order", "shipment", "tracking", "delivery", "po"],
        "general-agent": ["general", "inquiry", "information"],
    };
    async process(email) {
        const { agentId, confidence, reason } = await this.determineAgentAssignment(email);
        if (agentId) {
            return {
                ...email,
                agentAssignment: {
                    agentId,
                    confidence,
                    reason,
                },
            };
        }
        return email;
    }
    async determineAgentAssignment(email) {
        const content = `${email.subject} ${email.body} ${email.analysis?.topics?.join(" ")}`.toLowerCase();
        // Score each agent based on keyword matches
        const scores = {};
        for (const [agentId, keywords] of Object.entries(this.agentCapabilities)) {
            scores[agentId] = keywords?.filter((keyword) => content.includes(keyword)).length;
        }
        // Find best match
        const bestAgent = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
        if (bestAgent && bestAgent[1] > 0) {
            return {
                agentId: bestAgent[0],
                confidence: Math.min(bestAgent[1] / 5, 0.9), // Normalize confidence
                reason: `Matched ${bestAgent[1]} relevant keywords`,
            };
        }
        return {
            confidence: 0,
            reason: "No suitable agent found",
        };
    }
}
