import { Router } from "express";
import { EmailAnalysisAgent } from "../../core/agents/specialized/EmailAnalysisAgent";
import { logger } from "../../utils/logger";
const emailAnalysisRouter = Router();
// Initialize the Email Analysis Agent
let emailAgent = null;
const getEmailAgent = async () => {
    if (!emailAgent) {
        emailAgent = new EmailAnalysisAgent();
        await emailAgent.initialize();
        logger.info("Email Analysis Agent initialized", "API");
    }
    return emailAgent;
};
// POST /api/email-analysis/analyze
// Analyze a single email
emailAnalysisRouter.post("/analyze", async (req, res) => {
    try {
        const email = req.body;
        // Validate email data
        if (!email || !email.id || !email.subject || !email.from) {
            return res.status(400).json({
                error: "Invalid email data. Required fields: id, subject, from",
            });
        }
        const agent = await getEmailAgent();
        const analysis = await agent.analyzeEmail(email);
        logger.info("Email analyzed successfully", "API", {
            emailId: email.id,
            priority: analysis.priority,
            confidence: analysis.confidence,
        });
        return res.json({
            success: true,
            emailId: email.id,
            analysis,
        });
    }
    catch (error) {
        logger.error("Email analysis failed", "API", { error });
        return res.status(500).json({
            error: "Email analysis failed",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// POST /api/email-analysis/batch
// Analyze multiple emails
emailAnalysisRouter.post("/batch", async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({
                error: "Invalid request. Expected array of emails",
            });
        }
        const agent = await getEmailAgent();
        const results = [];
        for (const email of emails) {
            try {
                const analysis = await agent.analyzeEmail(email);
                results.push({
                    emailId: email.id,
                    success: true,
                    analysis,
                });
            }
            catch (error) {
                results.push({
                    emailId: email.id,
                    success: false,
                    error: error instanceof Error ? error.message : "Analysis failed",
                });
            }
        }
        const successCount = results.filter((r) => r.success).length;
        logger.info("Batch email analysis completed", "API", {
            total: emails.length,
            successful: successCount,
            failed: emails.length - successCount,
        });
        return res.json({
            success: true,
            total: emails.length,
            successful: successCount,
            results,
        });
    }
    catch (error) {
        logger.error("Batch email analysis failed", "API", { error });
        return res.status(500).json({
            error: "Batch analysis failed",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// GET /api/email-analysis/status
// Get agent status
emailAnalysisRouter.get("/status", async (req, res) => {
    try {
        const isInitialized = emailAgent !== null;
        const capabilities = isInitialized
            ? [
                "email-analysis",
                "entity-extraction",
                "workflow-management",
                "priority-assessment",
            ]
            : [];
        res.json({
            status: isInitialized ? "ready" : "not-initialized",
            agent: "EmailAnalysisAgent",
            capabilities,
            models: {
                primary: "qwen3:0.6b",
                secondary: "granite3.3:2b",
            },
        });
    }
    catch (error) {
        logger.error("Status check failed", "API", { error });
        res.status(500).json({
            error: "Status check failed",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
// POST /api/email-analysis/extract-entities
// Extract entities from text
emailAnalysisRouter.post("/extract-entities", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== "string") {
            return res.status(400).json({
                error: "Invalid request. Expected text field",
            });
        }
        const agent = await getEmailAgent();
        // Create a minimal email object for entity extraction
        const mockEmail = {
            id: "entity-extraction",
            subject: "",
            body: text,
            bodyPreview: text.substring(0, 500),
            from: {
                emailAddress: {
                    name: "Entity Extraction",
                    address: "extract@system",
                },
            },
            receivedDateTime: new Date().toISOString(),
            isRead: true,
            categories: [],
        };
        const analysis = await agent.analyzeEmail(mockEmail);
        return res.json({
            success: true,
            entities: analysis.entities,
        });
    }
    catch (error) {
        logger.error("Entity extraction failed", "API", { error });
        return res.status(500).json({
            error: "Entity extraction failed",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
export { emailAnalysisRouter };
//# sourceMappingURL=email-analysis.router.js.map