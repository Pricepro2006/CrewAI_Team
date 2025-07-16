import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResearchAgent } from "./ResearchAgent";
import { WebSearchTool } from "../../tools/WebSearchTool";
import { WebScraperTool } from "../../tools/WebScraperTool";
import { createMockOllamaProvider } from "../../../test/mocks/ollama.mock";

vi.mock("../../llm/OllamaProvider", () => ({
  OllamaProvider: vi.fn().mockImplementation(() => createMockOllamaProvider()),
}));

vi.mock("../../tools/WebSearchTool");
vi.mock("../../tools/WebScraperTool");

describe("ResearchAgent", () => {
  let agent: ResearchAgent;
  let mockWebSearch: WebSearchTool;
  let mockWebScraper: WebScraperTool;

  beforeEach(async () => {
    agent = new ResearchAgent();
    await agent.initialize();

    // Get mocked tools
    mockWebSearch = agent["tools"].get("web-search") as WebSearchTool;
    mockWebScraper = agent["tools"].get("web-scraper") as WebScraperTool;
  });

  describe("initialization", () => {
    it("should initialize with correct configuration", () => {
      expect(agent.name).toBe("ResearchAgent");
      expect(agent.description).toContain("research");
      expect(agent.model).toBe("qwen3:8b");
    });

    it("should register required tools", () => {
      expect(agent["tools"].has("web-search")).toBe(true);
      expect(agent["tools"].has("web-scraper")).toBe(true);
    });
  });

  describe("execute", () => {
    it("should perform basic research", async () => {
      const task = {
        type: "research",
        input: {
          query: "Latest AI developments",
          depth: "basic",
        },
      };

      vi.spyOn(mockWebSearch, "execute").mockResolvedValue({
        results: [
          {
            title: "AI Breakthrough",
            url: "https://example.com/ai-news",
            snippet: "Major AI advancement announced",
          },
        ],
      });

      vi.spyOn(mockWebScraper, "execute").mockResolvedValue({
        content: "Full article about AI breakthrough...",
        metadata: { title: "AI Breakthrough" },
      });

      const result = await agent.execute(task);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.sources).toBeInstanceOf(Array);
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it("should perform comprehensive research", async () => {
      const task = {
        type: "research",
        input: {
          query: "Quantum computing applications",
          depth: "comprehensive",
        },
      };

      vi.spyOn(mockWebSearch, "execute").mockResolvedValue({
        results: [
          {
            title: "Quantum Computing Guide",
            url: "https://example.com/quantum",
            snippet: "Complete guide to quantum computing",
          },
          {
            title: "Quantum Applications",
            url: "https://example.com/apps",
            snippet: "Real-world quantum applications",
          },
        ],
      });

      const result = await agent.execute(task);

      expect(result.summary).toBeDefined();
      expect(result.keyFindings).toBeDefined();
      expect(result.keyFindings).toBeInstanceOf(Array);
    });

    it("should validate facts when required", async () => {
      const task = {
        type: "fact-check",
        input: {
          claim: "The Earth is flat",
          sources: 3,
        },
      };

      vi.spyOn(mockWebSearch, "execute").mockResolvedValue({
        results: [
          {
            title: "Earth Shape Scientific Evidence",
            url: "https://science.com/earth",
            snippet: "Scientific proof Earth is spherical",
          },
        ],
      });

      const result = await agent.execute(task);

      expect(result.factCheck).toBeDefined();
      expect(result.factCheck.isValid).toBe(false);
      expect(result.factCheck.evidence).toBeInstanceOf(Array);
    });

    it("should analyze specific URLs", async () => {
      const task = {
        type: "analyze-url",
        input: {
          url: "https://example.com/article",
          extractKey: true,
        },
      };

      vi.spyOn(mockWebScraper, "execute").mockResolvedValue({
        content: "Article content with important information...",
        metadata: {
          title: "Important Article",
          author: "John Doe",
          date: "2024-01-01",
        },
      });

      const result = await agent.execute(task);

      expect(result.analysis).toBeDefined();
      expect(result.keyPoints).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
    });

    it("should handle research errors gracefully", async () => {
      const task = {
        type: "research",
        input: {
          query: "Error test",
        },
      };

      vi.spyOn(mockWebSearch, "execute").mockRejectedValue(
        new Error("Search failed"),
      );

      const result = await agent.execute(task);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("research failed");
      expect(result.fallbackSummary).toBeDefined();
    });

    it("should synthesize information from multiple sources", async () => {
      const task = {
        type: "synthesize",
        input: {
          sources: [
            { content: "Source 1 information", url: "https://source1.com" },
            { content: "Source 2 information", url: "https://source2.com" },
          ],
          focusAreas: ["commonalities", "differences"],
        },
      };

      const result = await agent.execute(task);

      expect(result.synthesis).toBeDefined();
      expect(result.commonalities).toBeDefined();
      expect(result.differences).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid task types", async () => {
      const task = {
        type: "invalid-type",
        input: {},
      };

      await expect(agent.execute(task)).rejects.toThrow(
        "Unsupported task type",
      );
    });

    it("should handle missing required inputs", async () => {
      const task = {
        type: "research",
        input: {}, // Missing query
      };

      await expect(agent.execute(task)).rejects.toThrow("Query is required");
    });

    it("should handle tool failures", async () => {
      const task = {
        type: "research",
        input: {
          query: "Tool failure test",
        },
      };

      vi.spyOn(mockWebSearch, "execute").mockRejectedValue(
        new Error("Network error"),
      );
      vi.spyOn(mockWebScraper, "execute").mockRejectedValue(
        new Error("Scraping failed"),
      );

      const result = await agent.execute(task);

      expect(result.error).toBeDefined();
      expect(result.fallbackSummary).toBeDefined();
    });
  });
});
