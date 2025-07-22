/**
 * Unit tests for BusinessSearchPromptEnhancer
 * Part of GROUP 2B WebSearch Enhancement
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BusinessSearchPromptEnhancer } from "../BusinessSearchPromptEnhancer";
import { logger } from "../../../utils/logger";
// Mock logger
vi.mock("../../../utils/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));
describe("BusinessSearchPromptEnhancer", () => {
    let enhancer;
    beforeEach(() => {
        enhancer = new BusinessSearchPromptEnhancer();
        vi.clearAllMocks();
    });
    describe("enhance method", () => {
        it("should enhance a basic prompt with standard level by default", () => {
            const originalPrompt = "Find me a good pizza place";
            const enhanced = enhancer.enhance(originalPrompt);
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
            expect(enhanced).toContain("[BUSINESS_SEARCH_INSTRUCTIONS]");
            expect(enhanced).toContain("WebSearch");
            expect(enhanced).toContain(originalPrompt);
        });
        it("should handle null input gracefully", () => {
            const enhanced = enhancer.enhance(null);
            expect(enhanced).toBe(enhancer.getDefaultBusinessPrompt());
            expect(logger.warn).toHaveBeenCalled();
        });
        it("should handle undefined input gracefully", () => {
            const enhanced = enhancer.enhance(undefined);
            expect(enhanced).toBe(enhancer.getDefaultBusinessPrompt());
            expect(logger.warn).toHaveBeenCalled();
        });
        it("should handle empty string input", () => {
            const enhanced = enhancer.enhance("");
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
        });
        it("should apply minimal enhancement level", () => {
            const enhanced = enhancer.enhance("Find a store", {
                enhancementLevel: "minimal",
            });
            expect(enhanced).toContain("When responding to business-related queries");
            expect(enhanced).not.toContain("CRITICAL REQUIREMENT");
        });
        it("should apply aggressive enhancement level", () => {
            const enhanced = enhancer.enhance("Find a store", {
                enhancementLevel: "aggressive",
            });
            expect(enhanced).toContain("CRITICAL REQUIREMENT");
            expect(enhanced).toContain("MANDATORY ACTIONS");
            expect(enhanced).toContain("BUSINESS QUERY TRIGGERS");
        });
        it("should include examples when requested", () => {
            const enhanced = enhancer.enhance("Find a store", {
                includeExamples: true,
            });
            expect(enhanced).toContain("EXAMPLES OF PROPER BUSINESS INFORMATION RESPONSES");
            expect(enhanced).toContain("Joe's Plumbing");
            expect(enhanced).toContain("✓ GOOD:");
            expect(enhanced).toContain("✗ BAD:");
        });
        it("should not include examples when disabled", () => {
            const enhanced = enhancer.enhance("Find a store", {
                includeExamples: false,
            });
            expect(enhanced).not.toContain("EXAMPLES OF PROPER BUSINESS INFORMATION RESPONSES");
        });
        it("should preserve original markers when requested", () => {
            const alreadyEnhanced = "Some prompt [BUSINESS_SEARCH_ENHANCED]";
            const enhanced = enhancer.enhance(alreadyEnhanced, {
                preserveOriginalMarkers: true,
            });
            expect(enhanced).toBe(alreadyEnhanced);
            expect(logger.info).toHaveBeenCalledWith("Prompt already contains business search enhancement markers");
        });
        it("should replace markers when not preserving", () => {
            const alreadyEnhanced = "Some prompt [BUSINESS_SEARCH_ENHANCED]";
            const enhanced = enhancer.enhance(alreadyEnhanced, {
                preserveOriginalMarkers: false,
            });
            expect(enhanced).not.toBe(alreadyEnhanced);
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
        });
        it("should inject custom instructions", () => {
            const customInstructions = "Always prioritize local businesses";
            const enhanced = enhancer.enhance("Find a store", {
                customInstructions,
            });
            expect(enhanced).toContain("CUSTOM INSTRUCTIONS:");
            expect(enhanced).toContain(customInstructions);
        });
        it("should add metadata with enhancement level and timestamp", () => {
            const enhanced = enhancer.enhance("Find a store", {
                enhancementLevel: "minimal",
            });
            expect(enhanced).toMatch(/\[Enhancement Metadata: Level=minimal, Timestamp=.*\]/);
        });
        it("should handle prompts with System/User structure", () => {
            const structuredPrompt = "System: You are a helpful assistant\nUser: Find a pizza place";
            const enhanced = enhancer.enhance(structuredPrompt);
            expect(enhanced).toContain("System:\n");
            expect(enhanced).toContain("Original Instructions:");
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
        });
        it("should handle error during enhancement", () => {
            // Force an error by mocking console
            const originalError = console.error;
            console.error = vi.fn();
            // This would cause an error in real scenario
            const badOptions = { enhancementLevel: null };
            const enhanced = enhancer.enhance("Find a store", badOptions);
            expect(enhanced).toBe(enhancer.getDefaultBusinessPrompt());
            expect(logger.error).toHaveBeenCalled();
            console.error = originalError;
        });
    });
    describe("getDefaultBusinessPrompt method", () => {
        it("should return a valid default prompt", () => {
            const defaultPrompt = enhancer.getDefaultBusinessPrompt();
            expect(defaultPrompt).toContain("[BUSINESS_SEARCH_ENHANCED]");
            expect(defaultPrompt).toContain("[BUSINESS_SEARCH_INSTRUCTIONS]");
            expect(defaultPrompt).toContain("WebSearch");
        });
    });
    describe("isAlreadyEnhanced method", () => {
        it("should detect enhanced prompts", () => {
            const enhanced = "Some prompt [BUSINESS_SEARCH_ENHANCED]";
            expect(enhancer.isAlreadyEnhanced(enhanced)).toBe(true);
        });
        it("should detect non-enhanced prompts", () => {
            const regular = "Some regular prompt";
            expect(enhancer.isAlreadyEnhanced(regular)).toBe(false);
        });
    });
    describe("extractInstructions method", () => {
        it("should extract instructions from enhanced prompt", () => {
            const prompt = "[BUSINESS_SEARCH_INSTRUCTIONS]Use WebSearch always[BUSINESS_SEARCH_ENHANCED]";
            const instructions = enhancer.extractInstructions(prompt);
            expect(instructions).toBe("Use WebSearch always");
        });
        it("should return null when markers are missing", () => {
            const prompt = "Regular prompt without markers";
            expect(enhancer.extractInstructions(prompt)).toBeNull();
        });
        it("should return null when markers are in wrong order", () => {
            const prompt = "[BUSINESS_SEARCH_ENHANCED]Wrong order[BUSINESS_SEARCH_INSTRUCTIONS]";
            expect(enhancer.extractInstructions(prompt)).toBeNull();
        });
    });
    describe("isValidEnhancementLevel method", () => {
        it("should validate correct enhancement levels", () => {
            expect(enhancer.isValidEnhancementLevel("minimal")).toBe(true);
            expect(enhancer.isValidEnhancementLevel("standard")).toBe(true);
            expect(enhancer.isValidEnhancementLevel("aggressive")).toBe(true);
        });
        it("should reject invalid enhancement levels", () => {
            expect(enhancer.isValidEnhancementLevel("extreme")).toBe(false);
            expect(enhancer.isValidEnhancementLevel("")).toBe(false);
            expect(enhancer.isValidEnhancementLevel("STANDARD")).toBe(false);
        });
    });
    describe("removeEnhancement method", () => {
        it("should remove all enhancement markers and content", () => {
            const enhanced = enhancer.enhance("Find a pizza place");
            const cleaned = enhancer.removeEnhancement(enhanced);
            expect(cleaned).not.toContain("[BUSINESS_SEARCH_ENHANCED]");
            expect(cleaned).not.toContain("[BUSINESS_SEARCH_INSTRUCTIONS]");
            expect(cleaned).not.toContain("MANDATORY ACTIONS");
            expect(cleaned).toContain("Find a pizza place");
        });
        it("should handle prompts without enhancement", () => {
            const regular = "Just a regular prompt";
            const cleaned = enhancer.removeEnhancement(regular);
            expect(cleaned).toBe(regular);
        });
        it("should remove examples section", () => {
            const enhanced = enhancer.enhance("Find a store", {
                includeExamples: true,
            });
            const cleaned = enhancer.removeEnhancement(enhanced);
            expect(cleaned).not.toContain("EXAMPLES OF PROPER BUSINESS INFORMATION RESPONSES");
            expect(cleaned).not.toContain("Joe's Plumbing");
        });
        it("should remove metadata", () => {
            const enhanced = enhancer.enhance("Find a store");
            const cleaned = enhancer.removeEnhancement(enhanced);
            expect(cleaned).not.toMatch(/\[Enhancement Metadata:.*\]/);
        });
    });
    describe("needsEnhancement method", () => {
        it("should detect prompts that need enhancement", () => {
            const businessPrompts = [
                "Find a pizza place near me",
                "Looking for a plumber",
                "Where can I buy groceries?",
                "Show me local restaurants",
                "What are the store hours?",
                "I need a service provider",
            ];
            businessPrompts.forEach((prompt) => {
                expect(enhancer.needsEnhancement(prompt)).toBe(true);
            });
        });
        it("should not flag already enhanced prompts", () => {
            const enhanced = "Find a store [BUSINESS_SEARCH_ENHANCED]";
            expect(enhancer.needsEnhancement(enhanced)).toBe(false);
        });
        it("should not flag non-business prompts", () => {
            const nonBusinessPrompts = [
                "What is the weather today?",
                "Tell me a joke",
                "Explain quantum physics",
                "Write a poem about nature",
            ];
            nonBusinessPrompts.forEach((prompt) => {
                expect(enhancer.needsEnhancement(prompt)).toBe(false);
            });
        });
    });
    describe("Input sanitization", () => {
        it("should remove injection attempts", () => {
            const maliciousPrompt = "Find a store {{malicious}} [BUSINESS_SEARCH_ENHANCED]";
            const enhanced = enhancer.enhance(maliciousPrompt);
            expect(enhanced).not.toContain("{{malicious}}");
            expect(enhanced).not.toContain("[BUSINESS_SEARCH_ENHANCED]");
        });
        it("should handle various injection patterns", () => {
            const injectionPrompts = [
                "Find {{template}} injection",
                "Search [BUSINESS_SEARCH_MARKER] fake",
                "Query {{}} empty template",
                "Test [BUSINESS_SEARCH_INSTRUCTIONS] injection",
            ];
            injectionPrompts.forEach((prompt) => {
                const enhanced = enhancer.enhance(prompt);
                expect(enhanced).not.toContain("{{");
                expect(enhanced).not.toContain("}}");
                // Should only contain our legitimate markers
                const markerCount = (enhanced.match(/\[BUSINESS_SEARCH_ENHANCED\]/g) || []).length;
                expect(markerCount).toBe(1);
            });
        });
    });
    describe("Edge cases", () => {
        it("should handle very long prompts", () => {
            const longPrompt = "Find a store. ".repeat(1000);
            const enhanced = enhancer.enhance(longPrompt);
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
            expect(enhanced.length).toBeGreaterThan(longPrompt.length);
        });
        it("should handle prompts with special characters", () => {
            const specialPrompt = "Find café with résumé service & Co. <test@email.com>";
            const enhanced = enhancer.enhance(specialPrompt);
            expect(enhanced).toContain(specialPrompt);
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
        });
        it("should handle numeric-only input", () => {
            const enhanced = enhancer.enhance("12345");
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
            expect(enhanced).toContain("12345");
        });
        it("should handle prompts with newlines and tabs", () => {
            const multilinePrompt = "Find a store\n\tthat sells\n\t\tpizza";
            const enhanced = enhancer.enhance(multilinePrompt);
            expect(enhanced).toContain(multilinePrompt);
            expect(enhanced).toContain("[BUSINESS_SEARCH_ENHANCED]");
        });
    });
    describe("Performance and security", () => {
        it("should complete enhancement quickly for typical prompts", () => {
            const start = performance.now();
            enhancer.enhance("Find a pizza place near me");
            const duration = performance.now() - start;
            expect(duration).toBeLessThan(10); // Should complete in less than 10ms
        });
        it("should not expose internal state", () => {
            const enhanced = enhancer.enhance("Find a store");
            expect(enhanced).not.toContain("ENHANCEMENT_TEMPLATES");
            expect(enhanced).not.toContain("DEFAULT_BUSINESS_EXAMPLES");
        });
        it("should handle concurrent enhancement calls", () => {
            const promises = Array(10)
                .fill(null)
                .map((_, i) => enhancer.enhance(`Find store ${i}`));
            return Promise.all(promises).then((results) => {
                results.forEach((result, i) => {
                    expect(result).toContain(`Find store ${i}`);
                    expect(result).toContain("[BUSINESS_SEARCH_ENHANCED]");
                });
            });
        });
    });
});
//# sourceMappingURL=BusinessSearchPromptEnhancer.test.js.map