import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentProcessor } from './DocumentProcessor';
import type { ProcessedDocument, ChunkingStrategy } from './types';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;

  beforeEach(() => {
    processor = new DocumentProcessor();
  });

  describe('processDocument', () => {
    it('should process a simple text document', async () => {
      const content = 'This is a test document. It has multiple sentences.';
      const result = await processor.processDocument(content, {
        sourceId: 'test-doc-1',
        contentType: 'text/plain',
      });

      expect(result).toBeDefined();
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toContain('test document');
      expect(result.metadata.sourceId).toBe('test-doc-1');
      expect(result.metadata.contentType).toBe('text/plain');
    });

    it('should handle markdown documents', async () => {
      const content = `# Title
      
This is a paragraph with **bold** text.

- Item 1
- Item 2

\`\`\`javascript
const x = 5;
\`\`\``;

      const result = await processor.processDocument(content, {
        sourceId: 'test-md-1',
        contentType: 'text/markdown',
      });

      expect(result).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.metadata.contentType).toBe('text/markdown');
    });

    it('should chunk large documents', async () => {
      const longContent = 'This is a sentence. '.repeat(100);
      const result = await processor.processDocument(longContent, {
        sourceId: 'test-long-1',
        contentType: 'text/plain',
      });

      expect(result.chunks.length).toBeGreaterThan(1);
      result.chunks.forEach((chunk, index) => {
        expect(chunk.metadata.chunkIndex).toBe(index);
        expect(chunk.metadata.sourceId).toBe('test-long-1');
      });
    });
  });

  describe('cleanText', () => {
    it('should remove extra whitespace', () => {
      const cleaned = processor['cleanText']('  Hello   World  ', { removeExtraSpaces: true });
      expect(cleaned).toBe('Hello World');
    });

    it('should remove control characters', () => {
      const text = 'Hello\x00World\x1F';
      const cleaned = processor['cleanText'](text);
      expect(cleaned).toBe('HelloWorld');
    });

    it('should normalize line breaks', () => {
      const text = 'Line1\r\nLine2\rLine3\nLine4';
      const cleaned = processor['cleanText'](text);
      expect(cleaned).toBe('Line1\nLine2\nLine3\nLine4');
    });

    it('should handle empty strings', () => {
      const cleaned = processor['cleanText']('');
      expect(cleaned).toBe('');
    });
  });

  describe('chunkText', () => {
    it('should create chunks with overlap', () => {
      const text = 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z';
      const chunks = processor['chunkText'](text, {
        size: 10,
        overlap: 2,
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Check that chunks have the correct overlap
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];
        const prevEnd = prevChunk.substring(prevChunk.length - 2);
        const currentStart = currentChunk.substring(0, 2);
        expect(prevEnd).toBe(currentStart);
      }
    });

    it('should handle custom separators', () => {
      const text = 'Sentence one. Sentence two. Sentence three.';
      const chunks = processor['chunkText'](text, {
        size: 20,
        overlap: 0,
        separator: '. ',
      });

      chunks.forEach(chunk => {
        // Each chunk should end with a period or be the last chunk
        expect(chunk.endsWith('.') || chunk === chunks[chunks.length - 1]).toBe(true);
      });
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text';
      const chunks = processor['chunkText'](text, {
        size: 100,
        overlap: 10,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });
  });

  describe('different chunking strategies', () => {
    it('should support fixed-size chunking', async () => {
      processor = new DocumentProcessor({
        chunkingStrategy: 'fixed',
        chunkSize: 50,
        chunkOverlap: 10,
      });

      const content = 'A'.repeat(200);
      const result = await processor.processDocument(content, {
        sourceId: 'test-fixed',
        contentType: 'text/plain',
      });

      expect(result.chunks.length).toBeGreaterThan(3);
      result.chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(50);
      });
    });

    it('should support sentence-based chunking', async () => {
      processor = new DocumentProcessor({
        chunkingStrategy: 'sentence',
        chunkSize: 100,
      });

      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const result = await processor.processDocument(content, {
        sourceId: 'test-sentence',
        contentType: 'text/plain',
      });

      result.chunks.forEach(chunk => {
        // Each chunk should contain complete sentences
        expect(chunk.content.endsWith('.')).toBe(true);
      });
    });
  });

  describe('metadata extraction', () => {
    it('should extract basic metadata', async () => {
      const content = 'Test document content';
      const result = await processor.processDocument(content, {
        sourceId: 'test-metadata',
        contentType: 'text/plain',
        author: 'Test Author',
        createdAt: new Date('2025-01-01'),
      });

      expect(result.metadata.sourceId).toBe('test-metadata');
      expect(result.metadata.contentType).toBe('text/plain');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.createdAt).toEqual(new Date('2025-01-01'));
      expect(result.metadata.totalChunks).toBe(1);
      expect(result.metadata.processedAt).toBeInstanceOf(Date);
    });

    it('should calculate content hash', async () => {
      const content = 'Unique content';
      const result = await processor.processDocument(content, {
        sourceId: 'test-hash',
        contentType: 'text/plain',
      });

      expect(result.metadata.contentHash).toBeDefined();
      expect(result.metadata.contentHash).toHaveLength(64); // SHA-256 hash length
    });
  });

  describe('edge cases', () => {
    it('should handle null content gracefully', async () => {
      const result = await processor.processDocument(null as any, {
        sourceId: 'test-null',
        contentType: 'text/plain',
      });

      expect(result.chunks).toHaveLength(0);
      expect(result.metadata.totalChunks).toBe(0);
    });

    it('should handle very long lines', async () => {
      const longLine = 'A'.repeat(10000);
      const result = await processor.processDocument(longLine, {
        sourceId: 'test-long-line',
        contentType: 'text/plain',
      });

      expect(result).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(1);
    });

    it('should handle special characters', async () => {
      const content = 'Test with émojis 🎉 and special chars: €£¥';
      const result = await processor.processDocument(content, {
        sourceId: 'test-special',
        contentType: 'text/plain',
      });

      expect(result.chunks[0].content).toContain('émojis');
      expect(result.chunks[0].content).toContain('🎉');
    });
  });
});