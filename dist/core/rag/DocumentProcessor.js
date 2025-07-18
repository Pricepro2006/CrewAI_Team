export class DocumentProcessor {
    config;
    constructor(config) {
        this.config = {
            method: "sentence",
            separator: ".",
            trimWhitespace: true,
            preserveFormatting: false,
            ...config,
        };
    }
    async processDocument(content, metadata) {
        // Handle null/undefined content
        if (!content) {
            return [];
        }
        // Clean and normalize text
        const cleaned = this.cleanText(content);
        // Split into chunks based on method
        const chunks = this.chunkText(cleaned, {
            size: this.config.size,
            overlap: this.config.overlap,
            ...(this.config.separator && { separator: this.config.separator }),
        });
        // Create document objects
        return chunks.map((chunk, index) => ({
            id: `${metadata.sourceId}-chunk-${index}`,
            content: chunk,
            metadata: {
                ...metadata,
                chunkIndex: index,
                totalChunks: chunks.length,
                chunkSize: chunk.length,
            },
        }));
    }
    cleanText(text) {
        let cleaned = text;
        if (!this.config.preserveFormatting) {
            // Remove special formatting characters
            cleaned = cleaned.replace(/[\r\n\t]+/g, " ");
            // Remove multiple spaces
            cleaned = cleaned.replace(/ {2,}/g, " ");
            if (this.config.trimWhitespace) {
                // Remove extra whitespace
                cleaned = cleaned.replace(/\s+/g, " ").trim();
            }
        }
        else {
            // Normalize line endings but preserve them
            cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            if (this.config.trimWhitespace) {
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
    chunkText(text, options) {
        switch (this.config.method) {
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
    chunkBySentence(text, options) {
        const chunks = [];
        const sentences = this.splitIntoSentences(text);
        let currentChunk = "";
        let currentLength = 0;
        for (const sentence of sentences) {
            if (currentLength + sentence.length > options.size && currentChunk) {
                chunks.push(currentChunk.trim());
                // Handle overlap
                if (options.overlap > 0) {
                    const overlapStart = Math.max(0, currentChunk.length - options.overlap);
                    currentChunk = currentChunk.slice(overlapStart) + " " + sentence;
                    currentLength = currentChunk.length;
                }
                else {
                    currentChunk = sentence;
                    currentLength = sentence.length;
                }
            }
            else {
                currentChunk += (currentChunk ? " " : "") + sentence;
                currentLength += sentence.length;
            }
        }
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
    chunkByToken(text, options) {
        // Simple token-based chunking (word-based approximation)
        const chunks = [];
        const words = text.split(/\s+/);
        const avgCharsPerToken = 5; // Rough approximation
        const tokensPerChunk = Math.floor(options.size / avgCharsPerToken);
        const overlapTokens = Math.floor(options.overlap / avgCharsPerToken);
        for (let i = 0; i < words.length; i += tokensPerChunk - overlapTokens) {
            const chunk = words.slice(i, i + tokensPerChunk).join(" ");
            if (chunk.trim()) {
                chunks.push(chunk.trim());
            }
        }
        return chunks;
    }
    chunkByCharacter(text, options) {
        const chunks = [];
        for (let i = 0; i < text.length; i += options.size - options.overlap) {
            const chunk = text.slice(i, i + options.size);
            if (chunk.trim()) {
                chunks.push(chunk.trim());
            }
        }
        return chunks;
    }
    splitIntoSentences(text) {
        // Improved sentence splitting
        const sentenceEnders = /([.!?]+)/g;
        const parts = text.split(sentenceEnders);
        const sentences = [];
        for (let i = 0; i < parts.length; i += 2) {
            const sentence = parts[i] + (parts[i + 1] || "");
            if (sentence.trim()) {
                sentences.push(sentence.trim());
            }
        }
        // Handle edge cases
        if (sentences.length === 0 && text.trim()) {
            sentences.push(text.trim());
        }
        return sentences;
    }
    async processDocuments(documents) {
        const allProcessed = [];
        for (const doc of documents) {
            const processed = await this.processDocument(doc.content, doc.metadata);
            allProcessed.push(...processed);
        }
        return allProcessed;
    }
    estimateChunks(content) {
        const cleaned = this.cleanText(content);
        const totalLength = cleaned.length;
        const effectiveChunkSize = this.config.size - this.config.overlap;
        return Math.ceil(totalLength / effectiveChunkSize);
    }
    validateChunkSize(_content) {
        const minSize = 100; // Minimum reasonable chunk size
        const maxSize = 10000; // Maximum reasonable chunk size
        return (this.config.size >= minSize &&
            this.config.size <= maxSize &&
            this.config.overlap < this.config.size);
    }
}
//# sourceMappingURL=DocumentProcessor.js.map