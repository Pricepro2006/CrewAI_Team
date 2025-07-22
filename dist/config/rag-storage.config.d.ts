export declare const ragStorageConfig: {
    basePath: string;
    vectors: string;
    documents: string;
    embeddings: string;
    cache: string;
    scrapedContent: string;
    capturedKnowledge: string;
    learnedPatterns: string;
    databases: {
        chromadb: string;
        knowledge: string;
        learning: string;
    };
    ensureOnUbuntuExt: () => boolean;
};
export declare const getKnowledgeBasePath: () => string;
export declare const getVectorStorePath: () => string;
export declare const getDocumentPath: () => string;
export declare const getScrapedContentPath: () => string;
//# sourceMappingURL=rag-storage.config.d.ts.map