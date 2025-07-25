/**
 * Ollama Test Helper Functions
 */
export async function setupOllamaForTesting() {
    // Setup logic for Ollama testing
    // Add any necessary setup here
}
export async function cleanupOllamaTests() {
    // Cleanup logic for Ollama testing
    // Add any necessary cleanup here
}
export async function isOllamaRunning(url) {
    try {
        const ollamaUrl = url || 'http://localhost:11434';
        const response = await fetch(`${ollamaUrl}/api/tags`);
        return response.ok;
    }
    catch (error) {
        return false;
    }
}
export async function generateWithTimeout(promise, timeoutMs = 15000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs))
    ]);
}
export function skipIfNoOllama() {
    return {
        skip: async () => {
            // Check if Ollama is available
            try {
                return !(await isOllamaRunning());
            }
            catch (error) {
                return true;
            }
        },
        reason: 'Ollama service not available'
    };
}
//# sourceMappingURL=ollama-test-helper.js.map