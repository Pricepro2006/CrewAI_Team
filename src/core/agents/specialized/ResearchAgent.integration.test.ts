import { describe, it, expect, beforeEach } from "vitest";
import { ResearchAgent } from "./ResearchAgent";
import { skipIfNoOllama } from "../../../test/utils/ollama-test-helper";

describe("ResearchAgent Integration Tests", () => {
  let agent: ResearchAgent;

  beforeEach(async () => {
    const skip = await skipIfNoOllama().skip();
    if (skip) {
      console.log("Skipping integration tests:", skipIfNoOllama().reason);
      return;
    }

    agent = new ResearchAgent();
    await agent.initialize();
  });

  describe("Real Research Operations", () => {
    it("should perform actual web search", async () => {
      const task = {
        type: "research",
        input: {
          query: "TypeScript programming language",
          depth: "basic",
        },
      };

      const result = await agent.execute(task);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(50);
      expect(result.sources).toBeInstanceOf(Array);

      // Should contain relevant information
      const summaryLower = result.summary.toLowerCase();
      expect(
        summaryLower.includes("typescript") ||
          summaryLower.includes("javascript") ||
          summaryLower.includes("programming"),
      ).toBe(true);
    });

    it("should extract key findings from research", async () => {
      const task = {
        type: "research",
        input: {
          query: "Benefits of test-driven development",
          depth: "comprehensive",
        },
      };

      const result = await agent.execute(task);

      expect(result.keyFindings).toBeDefined();
      expect(result.keyFindings).toBeInstanceOf(Array);
      expect(result.keyFindings.length).toBeGreaterThan(0);

      // Each finding should be a meaningful statement
      result.keyFindings.forEach((finding) => {
        expect(finding).toBeDefined();
        expect(finding.length).toBeGreaterThan(10);
      });
    });

    it("should validate facts with real searches", async () => {
      const task = {
        type: "fact-check",
        input: {
          claim: "TypeScript was created by Microsoft",
          sources: 2,
        },
      };

      const result = await agent.execute(task);

      expect(result.factCheck).toBeDefined();
      expect(result.factCheck.isValid).toBe(true);
      expect(result.factCheck.confidence).toBeGreaterThan(0.7);
      expect(result.factCheck.evidence).toBeInstanceOf(Array);
      expect(result.factCheck.evidence.length).toBeGreaterThan(0);
    });

    it("should analyze a real URL", async () => {
      const task = {
        type: "analyze-url",
        input: {
          url: "https://www.typescriptlang.org/",
          extractKey: true,
        },
      };

      const result = await agent.execute(task);

      expect(result.analysis).toBeDefined();
      expect(result.analysis.length).toBeGreaterThan(100);
      expect(result.keyPoints).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();

      // Should extract TypeScript-related content
      const analysisLower = result.analysis.toLowerCase();
      expect(analysisLower.includes("typescript")).toBe(true);
    });

    it("should synthesize information from multiple perspectives", async () => {
      const task = {
        type: "research",
        input: {
          query: "Pros and cons of microservices architecture",
          depth: "comprehensive",
          perspectives: ["benefits", "challenges", "use cases"],
        },
      };

      const result = await agent.execute(task);

      expect(result.summary).toBeDefined();

      // Should cover multiple perspectives
      const summaryLower = result.summary.toLowerCase();
      expect(
        summaryLower.includes("benefit") ||
          summaryLower.includes("advantage") ||
          summaryLower.includes("pro"),
      ).toBe(true);

      expect(
        summaryLower.includes("challenge") ||
          summaryLower.includes("disadvantage") ||
          summaryLower.includes("con"),
      ).toBe(true);
    });

    it("should handle research timeouts gracefully", async () => {
      const task = {
        type: "research",
        input: {
          query: "Very obscure technical topic that might timeout",
          timeout: 5000, // 5 seconds
        },
      };

      const result = await agent.execute(task);

      // Should still return a result even if some operations timeout
      expect(result).toBeDefined();
      expect(result.summary || result.fallbackSummary).toBeDefined();
    });

    it("should compare multiple sources", async () => {
      const task = {
        type: "research",
        input: {
          query: "REST vs GraphQL APIs",
          compareResults: true,
          minSources: 3,
        },
      };

      const result = await agent.execute(task);

      expect(result.comparison).toBeDefined();
      expect(result.sources.length).toBeGreaterThanOrEqual(3);

      // Should identify differences
      const comparisonLower =
        result.comparison?.toLowerCase() || result.summary.toLowerCase();
      expect(
        comparisonLower.includes("rest") && comparisonLower.includes("graphql"),
      ).toBe(true);
    });

    it("should extract structured data from research", async () => {
      const task = {
        type: "research",
        input: {
          query: "JavaScript array methods",
          extractStructured: true,
          format: "list",
        },
      };

      const result = await agent.execute(task);

      expect(result.structuredData).toBeDefined();
      expect(Array.isArray(result.structuredData)).toBe(true);

      // Should extract method names
      const methods = result.structuredData.flat();
      const hasArrayMethods = methods.some((item) =>
        ["map", "filter", "reduce", "forEach", "find"].some((method) =>
          item.toLowerCase().includes(method),
        ),
      );
      expect(hasArrayMethods).toBe(true);
    });

    it("should handle research with specific constraints", async () => {
      const task = {
        type: "research",
        input: {
          query: "Python web frameworks",
          constraints: {
            yearRange: "2023-2024",
            mustInclude: ["performance", "scalability"],
            excludeTerms: ["deprecated", "legacy"],
          },
        },
      };

      const result = await agent.execute(task);

      expect(result.summary).toBeDefined();

      // Should respect constraints
      const summaryLower = result.summary.toLowerCase();
      expect(
        summaryLower.includes("performance") ||
          summaryLower.includes("scalability"),
      ).toBe(true);
    });

    it("should generate citations for research", async () => {
      const task = {
        type: "research",
        input: {
          query: "Machine learning best practices",
          includeCitations: true,
        },
      };

      const result = await agent.execute(task);

      expect(result.citations).toBeDefined();
      expect(result.citations).toBeInstanceOf(Array);

      // Each citation should have required fields
      result.citations?.forEach((citation) => {
        expect(citation).toHaveProperty("source");
        expect(citation).toHaveProperty("relevance");
        expect(citation.relevance).toBeGreaterThan(0);
        expect(citation.relevance).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("Error Handling in Production", () => {
    it("should handle network errors gracefully", async () => {
      const task = {
        type: "analyze-url",
        input: {
          url: "https://this-domain-definitely-does-not-exist-12345.com",
        },
      };

      const result = await agent.execute(task);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("failed");
      expect(result.fallbackAnalysis).toBeDefined();
    });

    it("should handle malformed queries", async () => {
      const task = {
        type: "research",
        input: {
          query: "", // Empty query
        },
      };

      await expect(agent.execute(task)).rejects.toThrow("Query is required");
    });
  });
});
