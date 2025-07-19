import { BaseAgent } from '../base/BaseAgent';
import { OllamaProvider } from '../../llm/OllamaProvider';
import { logger } from '../../../utils/logger';
// Re-export types for backward compatibility
export * from './EmailAnalysisTypes';
export class EmailAnalysisAgent extends BaseAgent {
    ollamaProvider;
    cache; // Will be initialized later to avoid circular import
    // TD SYNNEX specific categories
    categories = {
        workflow: [
            'Order Management',
            'Shipping/Logistics',
            'Quote Processing',
            'Customer Support',
            'Deal Registration',
            'Approval Workflows',
            'Renewal Processing',
            'Vendor Management'
        ],
        priority: ['Critical', 'High', 'Medium', 'Low'],
        intent: ['Action Required', 'FYI', 'Request', 'Update'],
        urgency: ['Immediate', '24 Hours', '72 Hours', 'No Rush']
    };
    // Entity extraction patterns
    patterns = {
        poNumber: /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{8,12})\b/gi,
        quoteNumber: /\b(?:CAS|TS|WQ|Quote)[\s#:-]*(\d{6,10})\b/gi,
        orderNumber: /\b(?:Order|ORD)[\s#:-]*([A-Z]{2,3}\d{6,10})\b/gi,
        trackingNumber: /\b(?:1Z|FEDEX|UPS)[\w\d]{10,35}\b/gi,
        caseNumber: /\b(?:Case|Ticket|INC)[\s#:-]*(\d{6,10})\b/gi,
        amount: /\$[\d,]+\.?\d{0,2}|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP)\b/gi,
        date: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4})\b/gi
    };
    // Workflow state machine
    workflowStates = {
        'New': {
            transitions: ['In Review', 'In Progress'],
            conditions: ['email.isRead', 'email.hasReply']
        },
        'In Review': {
            transitions: ['In Progress', 'Pending External'],
            conditions: ['categorization.complete', 'action.assigned']
        },
        'In Progress': {
            transitions: ['Pending External', 'Completed'],
            conditions: ['task.created', 'response.sent']
        },
        'Pending External': {
            transitions: ['In Progress', 'Completed'],
            conditions: ['external.response', 'timeout.reached']
        },
        'Completed': {
            transitions: [],
            conditions: []
        }
    };
    constructor() {
        super('EmailAnalysisAgent', 'Specializes in analyzing and categorizing TD SYNNEX email communications', 'qwen3:0.6b' // Start with lightweight model
        );
        this.ollamaProvider = new OllamaProvider({
            model: this.model,
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        });
        // Cache will be initialized lazily to avoid circular import
        this.cache = null;
        // Add capabilities
        this.addCapability('email-analysis');
        this.addCapability('entity-extraction');
        this.addCapability('workflow-management');
        this.addCapability('priority-assessment');
    }
    async initializeCache() {
        if (!this.cache) {
            const { EmailAnalysisCache } = await import('../../cache/EmailAnalysisCache');
            this.cache = new EmailAnalysisCache({
                maxSize: 500,
                ttl: 1000 * 60 * 30 // 30 minutes
            });
        }
    }
    async execute(task, context) {
        try {
            // Parse email data from task
            const email = context.metadata?.email;
            if (!email) {
                return {
                    success: false,
                    error: 'No email data provided in context',
                };
            }
            const analysis = await this.analyzeEmail(email);
            return {
                success: true,
                data: analysis,
                output: this.formatAnalysisOutput(analysis),
                metadata: {
                    agent: this.name,
                    timestamp: new Date().toISOString(),
                    confidence: analysis.confidence,
                    emailId: email.id
                }
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    async analyzeEmail(email) {
        logger.info(`Analyzing email: ${email.subject}`, 'EMAIL_AGENT');
        // Check cache first
        await this.initializeCache();
        const cached = this.cache.get(email.id);
        if (cached) {
            logger.debug(`Using cached analysis for email: ${email.id}`, 'EMAIL_AGENT');
            return cached;
        }
        // Stage 1: Quick categorization with lightweight model
        const quickAnalysis = await this.quickCategorize(email);
        // Stage 2: Deep analysis if confidence is low
        if (quickAnalysis.confidence < 0.8) {
            const deepAnalysis = await this.deepAnalyze(email);
            return this.mergeAnalyses(quickAnalysis, deepAnalysis);
        }
        // Stage 3: Entity extraction
        const entities = await this.extractEntities(email);
        // Stage 4: Workflow state determination
        const workflowState = await this.determineWorkflowState(email, entities);
        // Stage 5: Generate suggested actions
        const suggestedActions = await this.generateActions(email, workflowState);
        // Stage 6: Generate summary
        const summary = await this.generateSummary(email);
        const analysis = {
            categories: quickAnalysis.categories,
            priority: quickAnalysis.priority,
            entities,
            workflowState,
            suggestedActions,
            confidence: quickAnalysis.confidence,
            summary
        };
        // Cache the result
        await this.initializeCache();
        this.cache.set(email.id, analysis);
        return analysis;
    }
    async quickCategorize(email) {
        const prompt = `Analyze this email and categorize it. Respond ONLY with a JSON object.

Subject: ${email.subject}
From: ${email.from.emailAddress.address}
Preview: ${email.bodyPreview || email.body?.substring(0, 500)}

Categories to assign:
- workflow: ${this.categories.workflow.join(', ')}
- priority: ${this.categories.priority.join(', ')}
- intent: ${this.categories.intent.join(', ')}
- urgency: ${this.categories.urgency.join(', ')}

Response format:
{
  "categories": {
    "workflow": ["selected workflow categories"],
    "priority": "selected priority",
    "intent": "selected intent",
    "urgency": "selected urgency"
  },
  "priority": "Critical|High|Medium|Low",
  "confidence": 0.0-1.0
}`;
        try {
            const response = await this.ollamaProvider.generate(prompt, {
                temperature: 0.1,
                format: 'json'
            });
            return JSON.parse(response);
        }
        catch (error) {
            logger.error('Quick categorization failed', 'EMAIL_AGENT', { error });
            // Fallback to rule-based categorization
            return this.fallbackCategorization(email);
        }
    }
    async deepAnalyze(email) {
        // Switch to more capable model for deep analysis
        const prompt = `Perform deep analysis of this email for TD SYNNEX workflow.

Subject: ${email.subject}
From: ${email.from.emailAddress.address}
Body: ${email.body || email.bodyPreview}

Analyze:
1. True business intent and urgency
2. Hidden action items
3. Relationship to ongoing workflows
4. Priority based on sender and content
5. Required follow-up actions

Provide detailed categorization with high confidence.`;
        try {
            // Create a new provider instance with different model
            const deepProvider = new OllamaProvider({
                model: 'granite3.3:2b',
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
            });
            const response = await deepProvider.generate(prompt, {
                temperature: 0.2
            });
            // Parse and structure the response
            return this.parseDeepAnalysis(response);
        }
        catch (error) {
            logger.error('Deep analysis failed', 'EMAIL_AGENT', { error });
            return {};
        }
    }
    async extractEntities(email) {
        const text = `${email.subject} ${email.body || email.bodyPreview}`;
        const entities = {
            poNumbers: [],
            quoteNumbers: [],
            orderNumbers: [],
            trackingNumbers: [],
            caseNumbers: [],
            customers: [],
            products: [],
            amounts: [],
            dates: []
        };
        // Extract using regex patterns
        entities.poNumbers = this.extractMatches(text, this.patterns.poNumber);
        entities.quoteNumbers = this.extractMatches(text, this.patterns.quoteNumber);
        entities.orderNumbers = this.extractMatches(text, this.patterns.orderNumber);
        entities.trackingNumbers = this.extractMatches(text, this.patterns.trackingNumber);
        entities.caseNumbers = this.extractMatches(text, this.patterns.caseNumber);
        // Extract amounts
        const amountMatches = text.match(this.patterns.amount) || [];
        entities.amounts = amountMatches.map(match => {
            const value = parseFloat(match.replace(/[$,]/g, '').replace(/\s*[A-Z]{3}$/, ''));
            const currency = match.match(/[A-Z]{3}$/)?.[0] || 'USD';
            return { value, currency };
        });
        // Extract dates
        const dateMatches = text.match(this.patterns.date) || [];
        entities.dates = dateMatches.map(date => ({
            date,
            context: this.getDateContext(date, text)
        }));
        // Extract customers and products using NER
        const nerEntities = await this.extractNEREntities(text);
        entities.customers = nerEntities.customers;
        entities.products = nerEntities.products;
        return entities;
    }
    extractMatches(text, pattern) {
        const matches = [];
        let match;
        while ((match = pattern.exec(text)) !== null) {
            if (match[1]) {
                matches.push(match[1]);
            }
            else {
                matches.push(match[0]);
            }
        }
        return [...new Set(matches)]; // Remove duplicates
    }
    getDateContext(date, text) {
        const index = text.indexOf(date);
        const contextStart = Math.max(0, index - 30);
        const contextEnd = Math.min(text.length, index + date.length + 30);
        return text.substring(contextStart, contextEnd).trim();
    }
    async extractNEREntities(text) {
        // This would typically use a more sophisticated NER model
        // For now, using pattern matching for TD SYNNEX specific entities
        const customers = [];
        const products = [];
        // Common customer patterns
        const customerPatterns = [
            /(?:customer|client|partner|reseller):\s*([A-Z][A-Za-z\s&,.-]+)/gi,
            /(?:for|to|from)\s+([A-Z][A-Za-z\s&,.-]+(?:Inc|LLC|Corp|Ltd|Company))/gi
        ];
        // Product patterns (HP products, etc.)
        const productPatterns = [
            /\b([A-Z0-9]{5,12}(?:#[A-Z]{3})?)\b/g, // SKU patterns
            /\b(?:HP|HPE|Dell|Lenovo|Microsoft)\s+([A-Za-z0-9\s-]+)/gi
        ];
        customerPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            customers.push(...matches.map(m => m.replace(/^(customer|client|partner|reseller|for|to|from):\s*/i, '').trim()));
        });
        productPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            products.push(...matches);
        });
        return {
            customers: [...new Set(customers)],
            products: [...new Set(products)]
        };
    }
    async determineWorkflowState(email, entities) {
        // Determine initial state based on email properties
        if (!email.isRead) {
            return 'New';
        }
        // Check for specific entity patterns that indicate state
        if (entities.trackingNumbers.length > 0) {
            return 'Pending External'; // Waiting for delivery
        }
        if (entities.poNumbers.length > 0 || entities.orderNumbers.length > 0) {
            return 'In Progress'; // Active order processing
        }
        if (entities.quoteNumbers.length > 0) {
            return 'In Review'; // Quote needs review
        }
        // Default to In Review for read emails
        return 'In Review';
    }
    async generateActions(email, workflowState) {
        const actions = [];
        // State-based actions
        switch (workflowState) {
            case 'New':
                actions.push('Mark as read and categorize');
                actions.push('Assign to appropriate team member');
                break;
            case 'In Review':
                actions.push('Review content and determine next steps');
                actions.push('Check for related emails or cases');
                break;
            case 'In Progress':
                actions.push('Update case/order status');
                actions.push('Send progress update to customer');
                break;
            case 'Pending External':
                actions.push('Set follow-up reminder');
                actions.push('Monitor for external response');
                break;
        }
        // Entity-based actions
        if (email.categories.includes('Order Management')) {
            actions.push('Verify order details in system');
            actions.push('Check inventory availability');
        }
        if (email.categories.includes('Customer Support')) {
            actions.push('Create or update support ticket');
            actions.push('Check customer history');
        }
        return actions;
    }
    async generateSummary(email) {
        const prompt = `Generate a concise 1-2 sentence summary of this email:
Subject: ${email.subject}
From: ${email.from.emailAddress.name || email.from.emailAddress.address}
Preview: ${email.bodyPreview || email.body?.substring(0, 300)}

Summary:`;
        try {
            const summary = await this.ollamaProvider.generate(prompt, {
                temperature: 0.3,
                maxTokens: 100
            });
            return summary.trim();
        }
        catch (error) {
            // Fallback to subject-based summary
            return `Email from ${email.from.emailAddress.name || email.from.emailAddress.address} regarding: ${email.subject}`;
        }
    }
    mergeAnalyses(quick, deep) {
        // Merge analyses, preferring deep analysis when available
        return {
            categories: deep.categories || quick.categories || { workflow: [], priority: 'Medium', intent: 'FYI', urgency: 'No Rush' },
            priority: deep.priority || quick.priority || 'Medium',
            entities: deep.entities || quick.entities || this.emptyEntities(),
            workflowState: deep.workflowState || quick.workflowState || 'New',
            suggestedActions: [...(deep.suggestedActions || []), ...(quick.suggestedActions || [])],
            confidence: Math.max(quick.confidence || 0, deep.confidence || 0),
            summary: deep.summary || quick.summary || ''
        };
    }
    fallbackCategorization(email) {
        // Simple rule-based fallback
        const subject = email.subject.toLowerCase();
        const preview = (email.bodyPreview || '').toLowerCase();
        const content = subject + ' ' + preview;
        const categories = {
            workflow: [],
            priority: 'Medium',
            intent: 'FYI',
            urgency: 'No Rush'
        };
        // Workflow detection
        if (content.includes('order') || content.includes('po ')) {
            categories.workflow.push('Order Management');
        }
        if (content.includes('ship') || content.includes('tracking')) {
            categories.workflow.push('Shipping/Logistics');
        }
        if (content.includes('quote') || content.includes('pricing')) {
            categories.workflow.push('Quote Processing');
        }
        // Priority detection
        if (content.includes('urgent') || content.includes('critical') || content.includes('asap')) {
            categories.priority = 'Critical';
            categories.urgency = 'Immediate';
        }
        else if (content.includes('important') || content.includes('priority')) {
            categories.priority = 'High';
            categories.urgency = '24 Hours';
        }
        // Intent detection
        if (content.includes('please') || content.includes('request') || content.includes('need')) {
            categories.intent = 'Request';
        }
        else if (content.includes('action required') || content.includes('response needed')) {
            categories.intent = 'Action Required';
        }
        return {
            categories,
            priority: categories.priority,
            confidence: 0.6
        };
    }
    parseDeepAnalysis(response) {
        // Parse the unstructured response from deep analysis
        try {
            // Attempt to extract JSON if present
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // Otherwise parse text response
            const analysis = {
                confidence: 0.85
            };
            // Extract priority mentions
            if (/critical|urgent|immediate/i.test(response)) {
                analysis.priority = 'Critical';
            }
            else if (/high.*priority/i.test(response)) {
                analysis.priority = 'High';
            }
            return analysis;
        }
        catch (error) {
            logger.error('Failed to parse deep analysis', 'EMAIL_AGENT', { error });
            return { confidence: 0.5 };
        }
    }
    emptyEntities() {
        return {
            poNumbers: [],
            quoteNumbers: [],
            orderNumbers: [],
            trackingNumbers: [],
            caseNumbers: [],
            customers: [],
            products: [],
            amounts: [],
            dates: []
        };
    }
    formatAnalysisOutput(analysis) {
        return `Email Analysis Complete:
Priority: ${analysis.priority}
Workflow: ${analysis.categories.workflow.join(', ')}
Intent: ${analysis.categories.intent}
Urgency: ${analysis.categories.urgency}
State: ${analysis.workflowState}
Confidence: ${(analysis.confidence * 100).toFixed(1)}%

Summary: ${analysis.summary}

Suggested Actions:
${analysis.suggestedActions.map(action => `- ${action}`).join('\n')}

Extracted Entities:
- PO Numbers: ${analysis.entities.poNumbers.join(', ') || 'None'}
- Quote Numbers: ${analysis.entities.quoteNumbers.join(', ') || 'None'}
- Order Numbers: ${analysis.entities.orderNumbers.join(', ') || 'None'}
- Customers: ${analysis.entities.customers.join(', ') || 'None'}`;
    }
}
//# sourceMappingURL=EmailAnalysisAgent.js.map