import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EmbeddingService } from "./EmbeddingService";
import axios from "axios";
// Mock axios
vi.mock("axios");
const mockedAxios = vi.mocked(axios);
describe("EmbeddingService", () => {
    let service;
    let mockAxiosInstance;
    beforeEach(() => {
        // Create mock axios instance
        mockAxiosInstance = {
            get: vi.fn(),
            post: vi.fn(),
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance);
        service = new EmbeddingService({
            model: "nomic-embed-text",
            baseUrl: "http://localhost:11434",
            dimensions: 768,
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe("initialize", () => {
        it("should initialize successfully when Ollama is available", async () => {
            mockAxiosInstance.get.mockResolvedValue({
                data: {
                    models: [{ name: "nomic-embed-text" }],
                },
            });
            await expect(service.initialize()).resolves.not.toThrow();
            expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags");
        });
        it("should warn when embedding model is not found", async () => {
            const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
            mockAxiosInstance.get.mockResolvedValue({
                data: {
                    models: [{ name: "other-model" }],
                },
            });
            await service.initialize();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Embedding model nomic-embed-text not found"));
            consoleSpy.mockRestore();
        });
        it("should throw error when connection fails", async () => {
            mockAxiosInstance.get.mockRejectedValue(new Error("Connection failed"));
            await expect(service.initialize()).rejects.toThrow("Failed to initialize embedding service");
        });
    });
    describe("embed", () => {
        beforeEach(() => {
            // Mock successful initialization
            mockAxiosInstance.get.mockResolvedValue({
                data: { models: [{ name: "nomic-embed-text" }] },
            });
        });
        it("should generate embeddings for text", async () => {
            const mockEmbedding = new Array(768).fill(0).map((_, i) => i / 768);
            mockAxiosInstance.post.mockResolvedValue({
                data: { embedding: mockEmbedding },
            });
            const result = await service.embed("Hello world");
            expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/embeddings", {
                model: "nomic-embed-text",
                prompt: "Hello world",
            });
            expect(result).toEqual(mockEmbedding);
            expect(result).toHaveLength(768);
        });
        it("should handle empty text", async () => {
            const mockEmbedding = new Array(768).fill(0);
            mockAxiosInstance.post.mockResolvedValue({
                data: { embedding: mockEmbedding },
            });
            const result = await service.embed("");
            expect(result).toEqual(mockEmbedding);
        });
        it("should return zero vector on error", async () => {
            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => { });
            mockAxiosInstance.post.mockRejectedValue(new Error("API error"));
            const result = await service.embed("test");
            expect(result).toEqual(new Array(768).fill(0));
            expect(result).toHaveLength(768);
            consoleSpy.mockRestore();
        });
    });
    describe("embedBatch", () => {
        beforeEach(() => {
            // Mock successful initialization
            mockAxiosInstance.get.mockResolvedValue({
                data: { models: [{ name: "nomic-embed-text" }] },
            });
        });
        it("should generate embeddings for multiple texts", async () => {
            const mockEmbedding1 = new Array(768).fill(0.1);
            const mockEmbedding2 = new Array(768).fill(0.2);
            mockAxiosInstance.post
                .mockResolvedValueOnce({ data: { embedding: mockEmbedding1 } })
                .mockResolvedValueOnce({ data: { embedding: mockEmbedding2 } });
            const result = await service.embedBatch(["Hello", "World"]);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(mockEmbedding1);
            expect(result[1]).toEqual(mockEmbedding2);
        });
        it("should handle large batches efficiently", async () => {
            const texts = Array(150).fill("test");
            const mockEmbedding = new Array(768).fill(0.5);
            mockAxiosInstance.post.mockResolvedValue({
                data: { embedding: mockEmbedding },
            });
            const result = await service.embedBatch(texts);
            expect(result).toHaveLength(150);
            expect(result.every((emb) => emb.length === 768)).toBe(true);
        });
    });
    describe("cosineSimilarity", () => {
        it("should calculate similarity between identical vectors", async () => {
            const embedding1 = [1, 0, 0];
            const embedding2 = [1, 0, 0];
            const similarity = await service.cosineSimilarity(embedding1, embedding2);
            expect(similarity).toBeCloseTo(1.0, 5);
        });
        it("should calculate similarity between opposite vectors", async () => {
            const embedding1 = [1, 0];
            const embedding2 = [-1, 0];
            const similarity = await service.cosineSimilarity(embedding1, embedding2);
            expect(similarity).toBeCloseTo(-1.0, 5);
        });
        it("should handle embeddings of different lengths", async () => {
            const embedding1 = [1, 0, 0];
            const embedding2 = [1, 0];
            await expect(service.cosineSimilarity(embedding1, embedding2)).rejects.toThrow("Embeddings must have the same dimension");
        });
        it("should handle zero vectors", async () => {
            const embedding1 = [0, 0, 0];
            const embedding2 = [1, 0, 0];
            const similarity = await service.cosineSimilarity(embedding1, embedding2);
            expect(similarity).toBe(0);
        });
    });
    describe("findSimilar", () => {
        it("should find similar embeddings", async () => {
            const queryEmbedding = [1, 0, 0];
            const embeddings = [
                [1, 0, 0], // identical
                [0.8, 0.6, 0], // similar
                [0, 1, 0], // orthogonal
                [-1, 0, 0], // opposite
            ];
            const results = await service.findSimilar(queryEmbedding, embeddings, 3);
            expect(results).toHaveLength(3);
            expect(results[0].index).toBe(0); // most similar
            expect(results[0].score).toBeCloseTo(1.0, 5);
            expect(results[1].index).toBe(1); // second most similar
            expect(results[2].index).toBe(2); // third most similar
        });
        it("should respect topK parameter", async () => {
            const queryEmbedding = [1, 0, 0];
            const embeddings = [
                [1, 0, 0],
                [0.8, 0.6, 0],
                [0, 1, 0],
                [-1, 0, 0],
            ];
            const results = await service.findSimilar(queryEmbedding, embeddings, 2);
            expect(results).toHaveLength(2);
        });
        it("should return all results when topK exceeds available embeddings", async () => {
            const queryEmbedding = [1, 0, 0];
            const embeddings = [
                [1, 0, 0],
                [0, 1, 0],
            ];
            const results = await service.findSimilar(queryEmbedding, embeddings, 5);
            expect(results).toHaveLength(2);
        });
    });
    describe("utility methods", () => {
        it("should return correct dimensions", () => {
            expect(service.getDimensions()).toBe(768);
        });
        it("should return correct model name", () => {
            expect(service.getModel()).toBe("nomic-embed-text");
        });
    });
    describe("error handling", () => {
        it("should handle initialization before embed calls", async () => {
            const mockEmbedding = new Array(768).fill(0.1);
            // Mock initialization response
            mockAxiosInstance.get.mockResolvedValue({
                data: { models: [{ name: "nomic-embed-text" }] },
            });
            // Mock embed response
            mockAxiosInstance.post.mockResolvedValue({
                data: { embedding: mockEmbedding },
            });
            const result = await service.embed("test");
            expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/tags");
            expect(result).toEqual(mockEmbedding);
        });
    });
});
//# sourceMappingURL=EmbeddingService.test.js.map