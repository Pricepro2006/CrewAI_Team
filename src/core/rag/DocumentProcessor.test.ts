import { describe, it, expect, beforeEach } from "vitest";
import { DocumentProcessor } from "./DocumentProcessor";
import type { ProcessedDocument, ChunkingConfig } from "./types";

describe("DocumentProcessor", () => {
  let processor: DocumentProcessor;

  beforeEach(() => {
    processor = new DocumentProcessor({
      size: 1000,
      overlap: 100,
      method: "sentence",
    });
  });

  describe("processDocument", () => {
    it("should process a simple text document", async () => {
      const content = "This is a test document. It has multiple sentences.";
      const result = await processor.processDocument(content, {
        sourceId: "test-doc-1",
        contentType: "text/plain",
      });

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain("test document");
      expect(result[0].metadata.sourceId).toBe("test-doc-1");
      expect(result[0].metadata.contentType).toBe("text/plain");
    });

    it("should handle markdown documents", async () => {
      const content = `# Title
      
This is a paragraph with **bold** text.

- Item 1
- Item 2

\`\`\`javascript
const x = 5;
\`\`\``;

      const result = await processor.processDocument(content, {
        sourceId: "test-md-1",
        contentType: "text/markdown",
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].metadata.contentType).toBe("text/markdown");
    });

    it("should chunk large documents", async () => {
      const longContent = "This is a sentence. ".repeat(100);
      const result = await processor.processDocument(longContent, {
        sourceId: "test-long-1",
        contentType: "text/plain",
      });

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk, index) => {
        expect(chunk.metadata.chunkIndex).toBe(index);
        expect(chunk.metadata.sourceId).toBe("test-long-1");
      });
    });
  });

  describe("cleanText (via processDocument)", () => {
    it("should remove extra whitespace", async () => {
      const result = await processor.processDocument("  Hello   World  ", {
        sourceId: "test-1",
      });
      expect(result[0].content).toBe("Hello World");
    });

    it("should remove control characters", async () => {
      const text = "Hello\x00World\x1F";
      const result = await processor.processDocument(text, {
        sourceId: "test-2",
      });
      expect(result[0].content).toBe("HelloWorld");
    });

    it("should normalize line breaks by default", async () => {
      const text = "Line1\r\nLine2\rLine3\nLine4";
      const result = await processor.processDocument(text, {
        sourceId: "test-3",
      });
      // Default behavior removes line breaks
      expect(result[0].content).toBe("Line1 Line2 Line3 Line4");
    });

    it("should preserve line breaks when preserveFormatting is true", async () => {
      const formattingProcessor = new DocumentProcessor({
        size: 1000,
        overlap: 100,
        method: "sentence",
        preserveFormatting: true,
      });
      const text = "Line1\nLine2\nLine3";
      const result = await formattingProcessor.processDocument(text, {
        sourceId: "test-4",
      });
      expect(result[0].content).toContain("Line1\nLine2\nLine3");
    });

    it("should handle empty strings", async () => {
      const result = await processor.processDocument("", {
        sourceId: "test-5",
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("chunkText (via processDocument)", () => {
    it("should create chunks with overlap", async () => {
      const smallChunkProcessor = new DocumentProcessor({
        size: 20,
        overlap: 5,
        method: "character",
      });
      const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const result = await smallChunkProcessor.processDocument(text, {
        sourceId: "test-chunk-1",
      });

      expect(result.length).toBeGreaterThan(1);
      // Verify metadata is correct
      result.forEach((chunk, i) => {
        expect(chunk.metadata.chunkIndex).toBe(i);
        expect(chunk.metadata.totalChunks).toBe(result.length);
      });
    });

    it("should handle sentence-based chunking", async () => {
      const text = "Sentence one. Sentence two. Sentence three.";
      const sentenceProcessor = new DocumentProcessor({
        size: 30,
        overlap: 0,
        method: "sentence",
      });
      const result = await sentenceProcessor.processDocument(text, {
        sourceId: "test-separator",
      });

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk) => {
        // Each chunk should contain sentences
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it("should handle text shorter than chunk size", async () => {
      const text = "Short text";
      const result = await processor.processDocument(text, {
        sourceId: "test-short",
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(text);
    });
  });

  describe("different chunking strategies", () => {
    it("should support fixed-size chunking", async () => {
      const fixedProcessor = new DocumentProcessor({
        method: "character",
        size: 50,
        overlap: 10,
      });

      const content = "A".repeat(200);
      const result = await fixedProcessor.processDocument(content, {
        sourceId: "test-fixed",
        contentType: "text/plain",
      });

      expect(result.length).toBeGreaterThan(3);
      result.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(50);
      });
    });

    it("should support sentence-based chunking", async () => {
      const sentenceProcessor = new DocumentProcessor({
        method: "sentence",
        size: 100,
        overlap: 0,
      });

      const content =
        "First sentence. Second sentence. Third sentence. Fourth sentence.";
      const result = await sentenceProcessor.processDocument(content, {
        sourceId: "test-sentence",
        contentType: "text/plain",
      });

      result.forEach((chunk) => {
        // Each chunk should contain text
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe("metadata extraction", () => {
    it("should extract basic metadata", async () => {
      const content = "Test document content";
      const result = await processor.processDocument(content, {
        sourceId: "test-metadata",
        contentType: "text/plain",
        author: "Test Author",
        createdAt: new Date("2025-01-01"),
      });

      expect(result[0].metadata.sourceId).toBe("test-metadata");
      expect(result[0].metadata.contentType).toBe("text/plain");
      expect(result[0].metadata.author).toBe("Test Author");
      expect(result[0].metadata.createdAt).toEqual(new Date("2025-01-01"));
      expect(result[0].metadata.totalChunks).toBe(1);
    });

    it("should add chunk metadata", async () => {
      const content = "Unique content for testing metadata";
      const result = await processor.processDocument(content, {
        sourceId: "test-hash",
        contentType: "text/plain",
      });

      expect(result[0].metadata.chunkIndex).toBe(0);
      expect(result[0].metadata.chunkSize).toBe(result[0].content.length);
    });
  });

  describe("edge cases", () => {
    it("should handle null content gracefully", async () => {
      const result = await processor.processDocument(null as any, {
        sourceId: "test-null",
        contentType: "text/plain",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle very long lines", async () => {
      const longLineProcessor = new DocumentProcessor({
        size: 100,
        overlap: 10,
        method: "character",
      });
      const longLine = "A".repeat(500);
      const result = await longLineProcessor.processDocument(longLine, {
        sourceId: "test-long-line",
        contentType: "text/plain",
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(1);
    });

    it("should handle special characters", async () => {
      const content = "Test with émojis 🎉 and special chars: €£¥";
      const result = await processor.processDocument(content, {
        sourceId: "test-special",
        contentType: "text/plain",
      });

      expect(result[0].content).toContain("émojis");
      expect(result[0].content).toContain("🎉");
    });
  });
});
