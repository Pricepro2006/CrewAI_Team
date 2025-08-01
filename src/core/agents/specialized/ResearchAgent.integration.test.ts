import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { ResearchAgent } from "./ResearchAgent.js";
import {
  setupOllamaForTesting,
  cleanupOllamaTests,
  isOllamaRunning,
  createTestOllamaConfig,
  ensureModelAvailable,
  getTestModel,
} from "../../../test/utils/ollama-test-helper.js";
import {
  withOllama,
  assertSuccessResponse,
  getTestConfiguration,
} from "../../../test/utils/integration-test-helpers.js";

describe("ResearchAgent Integration Tests", () => {
  let agent: ResearchAgent;
  let isOllamaAvailable = false;

  beforeAll(async () => {
    try {
      await setupOllamaForTesting();
      isOllamaAvailable = await isOllamaRunning();
      
      if (isOllamaAvailable) {
        const testModel = getTestModel();
        await ensureModelAvailable(testModel);
      }
    } catch (error) {
      console.error("Failed to setup Ollama for ResearchAgent tests:", error);
      isOllamaAvailable = false;
    }
  });

  afterAll(async () => {
    await cleanupOllamaTests();
  });

  beforeEach(async () => {
    if (!isOllamaAvailable) {
      console.log("Skipping test: Ollama not available");
      return;
    }

    const testConfig = createTestOllamaConfig();
    agent = new ResearchAgent();
    
    // Configure agent to use test Ollama instance
    if (agent['llm']) {
      agent['llm'].config = {
        ...agent['llm'].config,
        ...testConfig,
      };
    }
    
    await agent.initialize();
  });

  describe("Real Research Operations", () => {
    it("should perform actual web search", async () => {
      await withOllama(async () => {
        const testConfig = getTestConfiguration();
        
        const result = await agent.execute("TypeScript programming language", {
          task: "TypeScript programming language",
          ragDocuments: [],
        });

        assertSuccessResponse(result);
        expect(result.data?.synthesis).toBeDefined();
        expect(result.data.synthesis.length).toBeGreaterThan(testConfig.expectations.minResponseLength);
        expect(result.data?.sources).toBeInstanceOf(Array);

        // Real LLM should provide relevant information about TypeScript
        const summaryLower = result.data.synthesis.toLowerCase();
        const hasRelevantContent = [
          "typescript",
          "javascript", 
          "programming",
          "language",
          "microsoft"
        ].some(term => summaryLower.includes(term));
        
        expect(hasRelevantContent).toBe(true);
      });
    });

    it("should extract key findings from research", async () => {
      const task = {
        type: "research",
        input: {
          query: "Benefits of test-driven development",
          depth: "comprehensive",
        },
      };

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      expect(result.data?.findings).toBeDefined();
      expect(result.data.findings).toBeInstanceOf(Array);
      expect(result.data.findings.length).toBeGreaterThan(0);

      // Each finding should be a meaningful statement
      result.data.findings.forEach((finding: any) => {
        expect(finding).toBeDefined();
        expect(finding.content?.length || finding.length || 0).toBeGreaterThan(
          10,
        );
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

      const result = await agent.execute(task.input.claim, {
        task: task.input.claim,
        ragDocuments: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.synthesis).toBeDefined();
      expect(result.data.synthesis.length).toBeGreaterThan(10);
      expect(result.data?.sources).toBeInstanceOf(Array);
      expect(result.data.sources.length).toBeGreaterThan(0);
    });

    it("should analyze a real URL", async () => {
      const task = {
        type: "analyze-url",
        input: {
          url: "https://www.typescriptlang.org/",
          extractKey: true,
        },
      };

      const result = await agent.execute(task.input.url, {
        task: task.input.url,
        ragDocuments: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.synthesis).toBeDefined();
      expect(result.data.synthesis.length).toBeGreaterThan(100);
      expect(result.data?.findings).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();

      // Should extract TypeScript-related content
      const analysisLower = result.data.synthesis.toLowerCase();
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

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      expect(result.data?.synthesis).toBeDefined();

      // Should cover multiple perspectives
      const summaryLower = result.data.synthesis.toLowerCase();
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

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      // Should still return a result even if some operations timeout
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data?.synthesis || result.output).toBeDefined();
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

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      expect(result.data?.synthesis).toBeDefined();
      expect(result.data?.sources?.length || 0).toBeGreaterThanOrEqual(3);

      // Should identify differences
      const comparisonLower = result.data.synthesis.toLowerCase();
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

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      expect(result.data?.findings).toBeDefined();
      expect(Array.isArray(result.data.findings)).toBe(true);

      // Should extract method names from findings content
      const methods = result.data.findings
        .map((f: any) => f.content || f)
        .flat();
      const hasArrayMethods = methods.some((item: any) =>
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

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      expect(result.data?.synthesis).toBeDefined();

      // Should respect constraints
      const summaryLower = result.data.synthesis.toLowerCase();
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

      const result = await agent.execute(task.input.query, {
        task: task.input.query,
        ragDocuments: [],
      });

      expect(result.data?.sources).toBeDefined();
      expect(result.data.sources).toBeInstanceOf(Array);

      // Each source should have required fields
      result.data.sources?.forEach((source: any) => {
        expect(source).toHaveProperty("url");
        expect(source).toHaveProperty("title");
        expect(source.url).toBeDefined();
        expect(source.title).toBeDefined();
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

      const result = await agent.execute(task.input.url, {
        task: task.input.url,
        ragDocuments: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("failed");
    });

    it("should handle malformed queries", async () => {
      const task = {
        type: "research",
        input: {
          query: "", // Empty query
        },
      };

      await expect(
        agent.execute("", {
          task: "",
          ragDocuments: [],
        }),
      ).rejects.toThrow("Query is required");
    });
  });
});
