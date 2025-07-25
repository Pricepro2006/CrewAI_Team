import { describe, it, expect, beforeEach } from "vitest";
import { RetrievalService } from "./RetrievalService";
describe("RetrievalService", () => {
    let service;
    let config;
    beforeEach(() => {
        config = {
            minScore: 0.5,
            topK: 10,
            reranking: true,
            diversityFactor: 0.3,
            boostRecent: true,
        };
        service = new RetrievalService(config);
    });
    describe("enhance", () => {
        it("should filter results by minimum score", async () => {
            const results = [
                {
                    id: "1",
                    content: "High score",
                    metadata: { sourceId: "test" },
                    score: 0.8,
                },
                {
                    id: "2",
                    content: "Low score",
                    metadata: { sourceId: "test" },
                    score: 0.3,
                },
                {
                    id: "3",
                    content: "Medium score",
                    metadata: { sourceId: "test" },
                    score: 0.6,
                },
            ];
            const enhanced = await service.enhance("query", results);
            expect(enhanced).toHaveLength(2);
            expect(enhanced.every((r) => r.score >= config.minScore)).toBe(true);
        });
        it("should rerank results when enabled", async () => {
            const results = [
                {
                    id: "1",
                    content: "Some content about cats",
                    metadata: { sourceId: "test" },
                    score: 0.7,
                },
                {
                    id: "2",
                    content: "query specific content with query terms",
                    metadata: { sourceId: "test" },
                    score: 0.6,
                },
                {
                    id: "3",
                    content: "Unrelated content",
                    metadata: { sourceId: "test" },
                    score: 0.65,
                },
            ];
            const enhanced = await service.enhance("query specific", results);
            // The document with more query terms should be boosted
            expect(enhanced[0]?.id).toBe("2");
            expect(enhanced[0]?.score).toBeGreaterThan(0.6);
        });
        it("should diversify results when diversity factor is set", async () => {
            const results = [
                {
                    id: "1",
                    content: "First document about AI",
                    metadata: { sourceId: "test" },
                    score: 0.9,
                },
                {
                    id: "2",
                    content: "Second document about AI",
                    metadata: { sourceId: "test" },
                    score: 0.85,
                },
                {
                    id: "3",
                    content: "Document about machine learning",
                    metadata: { sourceId: "test" },
                    score: 0.8,
                },
                {
                    id: "4",
                    content: "Another AI document",
                    metadata: { sourceId: "test" },
                    score: 0.75,
                },
            ];
            const enhanced = await service.enhance("AI", results);
            // Should maintain diversity - not all results should be about the same topic
            expect(enhanced).toHaveLength(4);
            expect(enhanced[0]?.id).toBe("1"); // Top result should remain first
        });
        it("should boost recent documents when enabled", async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const results = [
                {
                    id: "1",
                    content: "Old content",
                    metadata: { sourceId: "1", createdAt: lastWeek.toISOString() },
                    score: 0.7,
                },
                {
                    id: "2",
                    content: "Recent content",
                    metadata: { sourceId: "2", createdAt: yesterday.toISOString() },
                    score: 0.7,
                },
                {
                    id: "3",
                    content: "Very recent content",
                    metadata: { sourceId: "3", createdAt: now.toISOString() },
                    score: 0.7,
                },
            ];
            const enhanced = await service.enhance("content", results);
            // More recent documents should have higher scores
            expect(enhanced[0]?.score).toBeGreaterThan(enhanced[1]?.score || 0);
            expect(enhanced[1]?.score).toBeGreaterThan(enhanced[2]?.score || 0);
        });
        it("should handle empty results", async () => {
            const results = [];
            const enhanced = await service.enhance("query", results);
            expect(enhanced).toEqual([]);
        });
        it("should preserve results when no enhancements are configured", async () => {
            const noEnhanceConfig = {
                minScore: 0,
                topK: 10,
                reranking: false,
                diversityFactor: 0,
                boostRecent: false,
            };
            const noEnhanceService = new RetrievalService(noEnhanceConfig);
            const results = [
                {
                    id: "1",
                    content: "Content 1",
                    metadata: { sourceId: "test" },
                    score: 0.8,
                },
                {
                    id: "2",
                    content: "Content 2",
                    metadata: { sourceId: "test" },
                    score: 0.6,
                },
            ];
            const enhanced = await noEnhanceService.enhance("query", results);
            expect(enhanced).toEqual(results);
        });
    });
    describe("filterByMetadata", () => {
        it("should filter results by metadata fields", async () => {
            const results = [
                {
                    id: "1",
                    content: "Doc 1",
                    metadata: { sourceId: "1", category: "tech", author: "John" },
                    score: 0.8,
                },
                {
                    id: "2",
                    content: "Doc 2",
                    metadata: { sourceId: "2", category: "tech", author: "Jane" },
                    score: 0.7,
                },
                {
                    id: "3",
                    content: "Doc 3",
                    metadata: { sourceId: "3", category: "science", author: "John" },
                    score: 0.9,
                },
            ];
            const filtered = await service.filterByMetadata(results, {
                category: "tech",
            });
            expect(filtered).toHaveLength(2);
            expect(filtered.every((r) => r.metadata.category === "tech")).toBe(true);
        });
        it("should handle array values in filters", async () => {
            const results = [
                {
                    id: "1",
                    content: "Doc 1",
                    metadata: { sourceId: "1", tags: ["tech"], status: "published" },
                    score: 0.8,
                },
                {
                    id: "2",
                    content: "Doc 2",
                    metadata: { sourceId: "2", tags: ["science"], status: "draft" },
                    score: 0.7,
                },
                {
                    id: "3",
                    content: "Doc 3",
                    metadata: { sourceId: "3", tags: ["tech"], status: "published" },
                    score: 0.9,
                },
            ];
            const filtered = await service.filterByMetadata(results, {
                status: ["published", "reviewed"],
            });
            expect(filtered).toHaveLength(2);
            expect(filtered.every((r) => r.metadata.status === "published")).toBe(true);
        });
    });
    describe("highlightMatches", () => {
        it("should extract relevant sentences containing query terms", () => {
            const results = [
                {
                    id: "1",
                    content: "This is about machine learning. Machine learning is powerful. Other unrelated content here.",
                    metadata: { sourceId: "test" },
                    score: 0.8,
                },
            ];
            const highlighted = service.highlightMatches("machine learning", results);
            expect(highlighted[0]?.highlights).toBeDefined();
            expect(highlighted[0]?.highlights?.length).toBeGreaterThan(0);
            expect(highlighted[0]?.highlights?.every((h) => h.toLowerCase().includes("machine") ||
                h.toLowerCase().includes("learning"))).toBe(true);
        });
        it("should limit highlights to 3 per result", () => {
            const longContent = Array(10)
                .fill("This sentence contains the query term. ")
                .join("");
            const results = [
                {
                    id: "1",
                    content: longContent,
                    metadata: { sourceId: "test" },
                    score: 0.8,
                },
            ];
            const highlighted = service.highlightMatches("query", results);
            expect(highlighted[0]?.highlights?.length).toBeLessThanOrEqual(3);
        });
    });
    describe("extractTerms", () => {
        it("should extract and normalize terms from text", async () => {
            // This is a private method, but we can test it indirectly through enhance
            const results = [
                {
                    id: "1",
                    content: "Testing the TERM extraction!",
                    metadata: { sourceId: "1" },
                    score: 0.8,
                },
            ];
            // If reranking works, it means extractTerms is working
            const enhanced = await service.enhance("testing extraction", results);
            expect(enhanced[0]?.score).toBeGreaterThan(0.8); // Should be boosted due to term matches
        });
    });
});
//# sourceMappingURL=RetrievalService.test.js.map