/**
 * Ollama Test Helper Functions
 */
export declare function setupOllamaForTesting(): Promise<void>;
export declare function cleanupOllamaTests(): Promise<void>;
export declare function skipIfNoOllama(): {
    skip: () => Promise<boolean>;
};
//# sourceMappingURL=ollama-test-helper.d.ts.map