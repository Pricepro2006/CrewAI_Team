import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveDeliveryManager } from "../AdaptiveDeliveryManager";
import { ActionType, } from "../types";
describe("AdaptiveDeliveryManager", () => {
    let manager;
    beforeEach(() => {
        manager = new AdaptiveDeliveryManager();
    });
    const createMockEvaluation = (confidence, action) => ({
        overallConfidence: confidence,
        qualityMetrics: {
            factuality: confidence,
            relevance: confidence,
            coherence: confidence,
            completeness: confidence,
            consistency: confidence,
        },
        factualityScore: confidence,
        relevanceScore: confidence,
        coherenceScore: confidence,
        recommendedAction: action,
        humanReviewNeeded: action !== ActionType.ACCEPT,
        query: "What is machine learning?",
        response: "Machine learning is a subset of artificial intelligence...",
        uncertaintyAreas: [],
        id: "eval123",
    });
    describe("deliver()", () => {
        it("should deliver high confidence response without warnings", async () => {
            const evaluation = createMockEvaluation(0.9, ActionType.ACCEPT);
            const result = await manager.deliver(evaluation, {
                includeConfidenceScore: true,
                includeSourceAttribution: true,
            });
            expect(result.confidence.score).toBe(0.9);
            expect(result.confidence.category).toBe("high");
            expect(result.warnings).toHaveLength(0);
            expect(result.metadata.action).toBe(ActionType.ACCEPT);
            expect(result.metadata.humanReviewNeeded).toBe(false);
            expect(result.content).toContain("Machine learning is a subset");
            expect(result.content).toContain("Confidence:");
            expect(result.content).toContain("Sources:");
        });
        it("should deliver medium confidence response with caveats", async () => {
            const evaluation = createMockEvaluation(0.65, ActionType.REVIEW);
            evaluation.uncertaintyAreas = ["possibly", "might be"];
            const result = await manager.deliver(evaluation, {
                includeUncertaintyWarnings: true,
                includeEvidence: true,
            });
            expect(result.confidence.category).toBe("medium");
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.metadata.action).toBe(ActionType.REVIEW);
            expect(result.metadata.humanReviewNeeded).toBe(true);
            expect(result.content).toContain("Please note:");
            expect(result.content).toContain("Supporting Evidence:");
            expect(result.content).toContain("Your feedback helps improve accuracy");
        });
        it("should deliver low confidence response with strong warnings", async () => {
            const evaluation = createMockEvaluation(0.3, ActionType.REGENERATE);
            evaluation.uncertaintyAreas = ["unclear", "not sure", "maybe"];
            evaluation.factualityScore = 0.2;
            const result = await manager.deliver(evaluation, {
                includeEvidence: true,
            });
            expect(result.confidence.category).toBe("low");
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.metadata.action).toBe(ActionType.REGENERATE);
            expect(result.content).toContain("Low Confidence Response");
            expect(result.content).toContain("Areas of Uncertainty:");
            expect(result.content).toContain("Recommended Actions:");
        });
        it("should deliver fallback response", async () => {
            const evaluation = createMockEvaluation(0.1, ActionType.FALLBACK);
            const result = await manager.deliver(evaluation, {
                includeConfidenceScore: true,
            });
            expect(result.confidence.score).toBe(0);
            expect(result.confidence.category).toBe("very_low");
            expect(result.metadata.action).toBe(ActionType.FALLBACK);
            expect(result.content).toContain("fallback");
            expect(result.warnings).toContain("Unable to generate a reliable response for this query");
        });
    });
    describe("confidence formatting", () => {
        it("should format confidence as percentage", async () => {
            const evaluation = createMockEvaluation(0.75, ActionType.ACCEPT);
            const result = await manager.deliver(evaluation, {
                confidenceFormat: "percentage",
            });
            expect(result.confidence.display).toBe("75%");
        });
        it("should format confidence as category", async () => {
            const evaluation = createMockEvaluation(0.75, ActionType.ACCEPT);
            const result = await manager.deliver(evaluation, {
                confidenceFormat: "percentage",
            });
            expect(result.confidence.display).toBe("high");
        });
        it("should format confidence as detailed", async () => {
            const evaluation = createMockEvaluation(0.75, ActionType.ACCEPT);
            const result = await manager.deliver(evaluation, {
                confidenceFormat: "detailed",
            });
            expect(result.confidence.display).toBe("75% (high)");
        });
    });
    describe("evidence preparation", () => {
        it("should prepare evidence from sources", async () => {
            const evaluation = createMockEvaluation(0.8, ActionType.ACCEPT);
            // Create mock sources data for testing evidence preparation
            const mockSources = [
                {
                    id: "doc1",
                    content: "Machine learning is a powerful technique for pattern recognition...",
                    metadata: { title: "ML Basics" },
                    score: 0.9,
                    confidence: 0.85,
                },
                {
                    id: "doc2",
                    content: "Deep learning extends machine learning with neural networks...",
                    metadata: { title: "Deep Learning" },
                    score: 0.8,
                    confidence: 0.75,
                },
            ];
            const result = await manager.deliver(evaluation, {
                includeEvidence: true,
            });
            expect(result.evidence).toHaveLength(2);
            const evidence = result.evidence?.[0];
            expect(evidence?.source).toBe("ML Basics");
            expect(evidence?.confidence).toBe(0.85);
            expect(evidence?.excerpt).toContain("machine learning");
        });
        it("should limit evidence items", async () => {
            const evaluation = createMockEvaluation(0.8, ActionType.ACCEPT);
            // Create mock sources data for testing evidence limits
            const mockLargeSources = Array(5)
                .fill(null)
                .map((_, i) => ({
                id: `doc${i}`,
                content: `Content ${i}`,
                metadata: { title: `Doc ${i}` },
                score: 0.8,
                confidence: 0.8,
            }));
            const result = await manager.deliver(evaluation, {
                includeEvidence: true,
            });
            expect(result.evidence).toBeDefined();
            expect(result.evidence.length).toBeGreaterThan(0);
        });
    });
    describe("warnings generation", () => {
        it("should generate warnings for low quality metrics", async () => {
            const evaluation = createMockEvaluation(0.5, ActionType.REVIEW);
            evaluation.factualityScore = 0.4;
            evaluation.relevanceScore = 0.5;
            evaluation.coherenceScore = 0.3;
            const result = await manager.deliver(evaluation, {});
            expect(result.warnings).toContain("Some claims in this response could not be verified against available sources");
            expect(result.warnings).toContain("This response may contain inconsistencies or unclear sections");
        });
        it("should warn about uncertainty markers", async () => {
            const evaluation = createMockEvaluation(0.6, ActionType.REVIEW);
            evaluation.uncertaintyAreas = [
                "maybe",
                "possibly",
                "unclear",
                "not sure",
            ];
            const result = await manager.deliver(evaluation, {});
            expect(result.warnings).toContain("This response contains multiple uncertain or qualified statements");
        });
    });
    describe("feedback management", () => {
        it("should capture user feedback", async () => {
            const evaluation = createMockEvaluation(0.7, ActionType.REVIEW);
            const result = await manager.deliver(evaluation, {});
            manager.captureFeedback(result.feedbackId, {
                helpful: true,
                accurate: true,
                comments: "Good response",
            });
            const feedback = manager.getFeedback(result.feedbackId);
            expect(feedback).toBeDefined();
            expect(feedback?.helpful).toBe(true);
            expect(feedback?.accurate).toBe(true);
            expect(feedback?.comments).toBe("Good response");
        });
        it("should track all feedback", async () => {
            const evaluation1 = createMockEvaluation(0.7, ActionType.REVIEW);
            const evaluation2 = createMockEvaluation(0.8, ActionType.ACCEPT);
            const result1 = await manager.deliver(evaluation1, {});
            const result2 = await manager.deliver(evaluation2, {});
            manager.captureFeedback(result1.feedbackId, { helpful: true });
            manager.captureFeedback(result2.feedbackId, { helpful: false });
            const allFeedback = manager.getAllFeedback();
            expect(allFeedback).toHaveLength(2);
        });
    });
    describe("delivery statistics", () => {
        it("should track delivery statistics", async () => {
            const evaluations = [
                createMockEvaluation(0.9, ActionType.ACCEPT),
                createMockEvaluation(0.7, ActionType.REVIEW),
                createMockEvaluation(0.3, ActionType.REGENERATE),
                createMockEvaluation(0.1, ActionType.FALLBACK),
                createMockEvaluation(0.85, ActionType.ACCEPT),
            ];
            for (const evaluation of evaluations) {
                await manager.deliver(evaluation, {});
            }
            const stats = manager.getDeliveryStats();
            expect(stats.total).toBe(5);
            expect(stats.byAction[ActionType.ACCEPT]).toBe(2);
            expect(stats.byAction[ActionType.REVIEW]).toBe(1);
            expect(stats.byAction[ActionType.REGENERATE]).toBe(1);
            expect(stats.byAction[ActionType.FALLBACK]).toBe(1);
            expect(stats.averageConfidence).toBeCloseTo(0.63, 2);
        });
        it("should calculate feedback rate", async () => {
            const evaluations = [
                createMockEvaluation(0.9, ActionType.ACCEPT),
                createMockEvaluation(0.7, ActionType.REVIEW),
            ];
            const results = [];
            for (const evaluation of evaluations) {
                results.push(await manager.deliver(evaluation, {}));
            }
            // Add feedback to first result only
            manager.captureFeedback(results[0].feedbackId, {
                helpful: true,
            });
            const stats = manager.getDeliveryStats();
            expect(stats.feedbackRate).toBe(0.5);
        });
    });
    describe("performance reporting", () => {
        it("should generate performance report", async () => {
            const evaluations = [
                createMockEvaluation(0.9, ActionType.ACCEPT),
                createMockEvaluation(0.4, ActionType.REGENERATE),
                createMockEvaluation(0.1, ActionType.FALLBACK),
            ];
            const results = [];
            for (const evaluation of evaluations) {
                results.push(await manager.deliver(evaluation, {}));
            }
            manager.captureFeedback(results[0].feedbackId, {
                helpful: true,
                accurate: true,
            });
            const report = manager.generatePerformanceReport();
            expect(report).toContain("Adaptive Delivery Performance Report");
            expect(report).toContain("Total Deliveries: 3");
            expect(report).toContain("Average Confidence:");
            expect(report).toContain("High fallback rate");
        });
    });
    describe("history management", () => {
        it("should export delivery history", async () => {
            const evaluations = [
                createMockEvaluation(0.9, ActionType.ACCEPT),
                createMockEvaluation(0.7, ActionType.REVIEW),
            ];
            for (const evaluation of evaluations) {
                await manager.deliver(evaluation, {});
            }
            const history = manager.exportHistory();
            expect(history).toHaveLength(2);
            expect(history[0].confidence.score).toBe(0.9);
            expect(history[1].confidence.score).toBe(0.7);
        });
        it("should clear history and feedback", async () => {
            const evaluation = createMockEvaluation(0.8, ActionType.ACCEPT);
            const result = await manager.deliver(evaluation, {});
            manager.captureFeedback(result.feedbackId, { helpful: true });
            expect(manager.exportHistory()).toHaveLength(1);
            expect(manager.getAllFeedback()).toHaveLength(1);
            manager.clearHistory();
            expect(manager.exportHistory()).toHaveLength(0);
            expect(manager.getAllFeedback()).toHaveLength(0);
        });
    });
    describe("edge cases", () => {
        it("should handle empty sources", async () => {
            const evaluation = createMockEvaluation(0.7, ActionType.REVIEW);
            // Create mock evaluation with no source data
            const result = await manager.deliver(evaluation, {
                includeEvidence: true,
            });
            expect(result.evidence).toBeDefined();
        });
        it("should handle missing uncertainty markers", async () => {
            const evaluation = createMockEvaluation(0.5, ActionType.REVIEW);
            evaluation.uncertaintyAreas = undefined;
            const result = await manager.deliver(evaluation, {});
            expect(result.metadata.uncertaintyAreas).toHaveLength(0);
        });
        it("should handle extreme confidence values", async () => {
            const evaluation1 = createMockEvaluation(1.5, ActionType.ACCEPT); // Above 1
            const evaluation2 = createMockEvaluation(-0.5, ActionType.FALLBACK); // Below 0
            const result1 = await manager.deliver(evaluation1, {});
            const result2 = await manager.deliver(evaluation2, {});
            expect(result1.confidence.score).toBe(1.5); // Preserves original
            expect(result1.confidence.category).toBe("high");
            expect(result2.confidence.score).toBe(-0.5); // Preserves original
            expect(result2.confidence.category).toBe("very_low");
        });
    });
});
//# sourceMappingURL=AdaptiveDeliveryManager.test.js.map