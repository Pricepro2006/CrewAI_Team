import type { ChunkingConfig, ProcessedDocument, DocumentMetadata } from "./types";
export declare class DocumentProcessor {
    private config;
    constructor(config: ChunkingConfig);
    processDocument(content: string, metadata: DocumentMetadata): Promise<ProcessedDocument[]>;
    private cleanText;
    private chunkText;
    private chunkBySentence;
    private chunkByToken;
    private chunkByCharacter;
    private splitIntoSentences;
    processDocuments(documents: Array<{
        content: string;
        metadata: DocumentMetadata;
    }>): Promise<ProcessedDocument[]>;
    estimateChunks(content: string): number;
    validateChunkSize(_content: string): boolean;
}
//# sourceMappingURL=DocumentProcessor.d.ts.map