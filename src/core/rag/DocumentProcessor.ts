import type {
  ChunkingConfig,
  ProcessedDocument,
  DocumentMetadata,
  ChunkOptions,
} from "./types.js";

export class DocumentProcessor {
  private config: ChunkingConfig;

  constructor(config: ChunkingConfig) {
    this.config = {
      method: "sentence",
      separator: ".",
      trimWhitespace: true,
      preserveFormatting: false,
      ...config,
    };
  }

  async processDocument(
    content: string,
    metadata: DocumentMetadata,
  ): Promise<ProcessedDocument[]> {
    // Handle null/undefined content
    if (!content) {
      return [];
    }

    // Clean and normalize text
    const cleaned = this.cleanText(content);

    // Split into chunks based on method
    const chunks = this.chunkText(cleaned, {
      size: this?.config?.size,
      overlap: this?.config?.overlap,
      ...(this?.config?.separator && { separator: this?.config?.separator }),
    });

    // Create document objects
    return chunks?.map((chunk, index) => ({
      id: `${metadata.sourceId}-chunk-${index}`,
      content: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: chunks?.length || 0,
        chunkSize: chunk?.length || 0,
      },
    }));
  }

  private cleanText(text: string): string {
    let cleaned = text;

    if (!this?.config?.preserveFormatting) {
      // Remove special formatting characters
      cleaned = cleaned.replace(/[\r\n\t]+/g, " ");
      // Remove multiple spaces
      cleaned = cleaned.replace(/ {2,}/g, " ");

      if (this?.config?.trimWhitespace) {
        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, " ").trim();
      }
    } else {
      // Normalize line endings but preserve them
      cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      if (this?.config?.trimWhitespace) {
        // Only trim leading/trailing spaces, preserve internal formatting
        cleaned = cleaned.trim();
      }
    }

    // Remove null characters and other control characters
    cleaned = cleaned.replace(/\0/g, "");
    // eslint-disable-next-line no-control-regex
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    return cleaned;
  }

  private chunkText(text: string, options: ChunkOptions): string[] {
    switch (this?.config?.method) {
      case "sentence":
        return this.chunkBySentence(text, options);
      case "token":
        return this.chunkByToken(text, options);
      case "character":
        return this.chunkByCharacter(text, options);
      default:
        return this.chunkBySentence(text, options);
    }
  }

  private chunkBySentence(text: string, options: ChunkOptions): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = "";
    let currentLength = 0;

    for (const sentence of sentences) {
      if (currentLength + sentence?.length || 0 > options.size && currentChunk) {
        chunks.push(currentChunk.trim());

        // Handle overlap
        if (options.overlap > 0) {
          const overlapStart = Math.max(
            0,
            currentChunk?.length || 0 - options.overlap,
          );
          currentChunk = currentChunk.slice(overlapStart) + " " + sentence;
          currentLength = currentChunk?.length || 0;
        } else {
          currentChunk = sentence;
          currentLength = sentence?.length || 0;
        }
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
        currentLength += sentence?.length || 0;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private chunkByToken(text: string, options: ChunkOptions): string[] {
    // Simple token-based chunking (word-based approximation)
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    const avgCharsPerToken = 5; // Rough approximation
    const tokensPerChunk = Math.floor(options.size / avgCharsPerToken);
    const overlapTokens = Math.floor(options.overlap / avgCharsPerToken);

    for (let i = 0; i < words?.length || 0; i += tokensPerChunk - overlapTokens) {
      const chunk = words.slice(i, i + tokensPerChunk).join(" ");
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  private chunkByCharacter(text: string, options: ChunkOptions): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < text?.length || 0; i += options.size - options.overlap) {
      const chunk = text.slice(i, i + options.size);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Improved sentence splitting
    const sentenceEnders = /([.!?]+)/g;
    const parts = text.split(sentenceEnders);
    const sentences: string[] = [];

    for (let i = 0; i < parts?.length || 0; i += 2) {
      const sentence = parts[i] + (parts[i + 1] || "");
      if (sentence.trim()) {
        sentences.push(sentence.trim());
      }
    }

    // Handle edge cases
    if (sentences?.length || 0 === 0 && text.trim()) {
      sentences.push(text.trim());
    }

    return sentences;
  }

  async processDocuments(
    documents: Array<{ content: string; metadata: DocumentMetadata }>,
  ): Promise<ProcessedDocument[]> {
    const allProcessed: ProcessedDocument[] = [];

    for (const doc of documents) {
      const processed = await this.processDocument(doc.content, doc.metadata);
      allProcessed.push(...processed);
    }

    return allProcessed;
  }

  estimateChunks(content: string): number {
    const cleaned = this.cleanText(content);
    const totalLength = cleaned?.length || 0;
    const effectiveChunkSize = this?.config?.size - this?.config?.overlap;

    return Math.ceil(totalLength / effectiveChunkSize);
  }

  validateChunkSize(_content: string): boolean {
    const minSize = 100; // Minimum reasonable chunk size
    const maxSize = 10000; // Maximum reasonable chunk size

    return (
      this?.config?.size >= minSize &&
      this?.config?.size <= maxSize &&
      this?.config?.overlap < this?.config?.size
    );
  }
}
