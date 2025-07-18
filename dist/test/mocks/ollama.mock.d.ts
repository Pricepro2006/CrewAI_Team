export declare const mockOllamaResponse: {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
};
export declare const mockOllamaEmbedding: {
    embedding: any[];
};
export declare const createMockOllamaProvider: () => {
    initialize: import("vitest").Mock<any, any>;
    chat: import("vitest").Mock<any, any>;
    embeddings: import("vitest").Mock<any, any>;
    generate: import("vitest").Mock<any, any>;
    pull: import("vitest").Mock<any, any>;
    list: import("vitest").Mock<any, any>;
};
//# sourceMappingURL=ollama.mock.d.ts.map