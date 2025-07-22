/**
 * Ollama Test Helper Functions
 */
export declare function setupOllamaForTesting(): Promise<void>;
export declare function cleanupOllamaTests(): Promise<void>;
export declare function isOllamaRunning(url?: string): Promise<boolean>;
export declare function generateWithTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T>;
export declare function skipIfNoOllama(): {
    skip: () => Promise<boolean>;
    reason: string;
};
//# sourceMappingURL=ollama-test-helper.d.ts.map