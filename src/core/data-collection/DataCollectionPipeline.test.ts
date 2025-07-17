/**
 * Data Collection Pipeline Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataCollectionPipeline } from "./DataCollectionPipeline";
import type { DataSource, BrightDataCredentials } from "./types";

// Mock credentials for testing
const mockCredentials: BrightDataCredentials = {
  apiKey: "test-api-key",
  endpoint: "https://api.test.com",
  rateLimitPerMinute: 10,
};

describe("DataCollectionPipeline", () => {
  let pipeline: DataCollectionPipeline;

  beforeEach(async () => {
    pipeline = new DataCollectionPipeline(mockCredentials);
    await pipeline.initialize();
  });

  afterEach(async () => {
    await pipeline.shutdown();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      expect(pipeline).toBeDefined();
      const stats = await pipeline.getStats();
      expect(stats.totalSources).toBe(0);
      expect(stats.activeSources).toBe(0);
    });
  });

  describe("data source management", () => {
    it("should add a new data source", async () => {
      const source = {
        name: "Test Search Source",
        type: "search_engine" as const,
        config: {
          keywords: ["test", "search"],
          maxResults: 10,
          frequency: "daily" as const,
        },
        status: "active" as const,
      };

      const sourceId = await pipeline.addDataSource(source);
      expect(sourceId).toBeDefined();
      expect(typeof sourceId).toBe("string");

      const sources = pipeline.getDataSources();
      expect(sources.length).toBe(1);
      expect(sources[0].name).toBe(source.name);
      expect(sources[0].type).toBe(source.type);
    });

    it("should update an existing data source", async () => {
      const source = {
        name: "Test Source",
        type: "web_scraping" as const,
        config: {
          url: "https://example.com",
        },
        status: "active" as const,
      };

      const sourceId = await pipeline.addDataSource(source);

      await pipeline.updateDataSource(sourceId, {
        name: "Updated Test Source",
        status: "inactive",
      });

      const sources = pipeline.getDataSources();
      const updatedSource = sources.find((s) => s.id === sourceId);
      expect(updatedSource?.name).toBe("Updated Test Source");
      expect(updatedSource?.status).toBe("inactive");
    });

    it("should remove a data source", async () => {
      const source = {
        name: "Test Source",
        type: "ecommerce" as const,
        config: {
          url: "https://amazon.com/product/123",
        },
        status: "active" as const,
      };

      const sourceId = await pipeline.addDataSource(source);
      expect(pipeline.getDataSources().length).toBe(1);

      await pipeline.removeDataSource(sourceId);
      expect(pipeline.getDataSources().length).toBe(0);
    });

    it("should throw error when updating non-existent source", async () => {
      await expect(
        pipeline.updateDataSource("non-existent", { name: "Updated" }),
      ).rejects.toThrow("Data source not found");
    });

    it("should throw error when removing non-existent source", async () => {
      await expect(pipeline.removeDataSource("non-existent")).rejects.toThrow(
        "Data source not found",
      );
    });
  });

  describe("data collection", () => {
    it("should collect data from a search engine source", async () => {
      const source = {
        name: "Search Test",
        type: "search_engine" as const,
        config: {
          keywords: ["test"],
          maxResults: 5,
        },
        status: "active" as const,
      };

      const sourceId = await pipeline.addDataSource(source);

      // Mock the BrightDataService methods
      const collectSearchResultsSpy = vi.spyOn(
        (pipeline as any).brightDataService,
        "collectSearchResults",
      );
      collectSearchResultsSpy.mockResolvedValue([
        {
          id: "test-result-1",
          sourceId: "search_engine",
          jobId: "test-job",
          data: { query: "test", results: [] },
          extractedAt: new Date(),
          tags: ["search"],
          quality: "high",
        },
      ]);

      const jobId = await pipeline.collectFromSource(sourceId);
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe("string");

      const jobs = pipeline.getJobsForSource(sourceId);
      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe("completed");
      expect(jobs[0].recordsCollected).toBe(1);

      collectSearchResultsSpy.mockRestore();
    });

    it("should handle collection errors gracefully", async () => {
      const source = {
        name: "Failing Source",
        type: "web_scraping" as const,
        config: {
          url: "https://invalid-url.example",
        },
        status: "active" as const,
      };

      const sourceId = await pipeline.addDataSource(source);

      // Mock the BrightDataService to throw an error
      const collectWebScrapingDataSpy = vi.spyOn(
        (pipeline as any).brightDataService,
        "collectWebScrapingData",
      );
      collectWebScrapingDataSpy.mockRejectedValue(
        new Error("Collection failed"),
      );

      await expect(pipeline.collectFromSource(sourceId)).rejects.toThrow(
        "Collection failed",
      );

      const jobs = pipeline.getJobsForSource(sourceId);
      expect(jobs.length).toBe(1);
      expect(jobs[0].status).toBe("failed");
      expect(jobs[0].error).toBe("Collection failed");

      collectWebScrapingDataSpy.mockRestore();
    });

    it("should not collect from inactive sources", async () => {
      const source = {
        name: "Inactive Source",
        type: "social_media" as const,
        config: {
          keywords: ["test"],
        },
        status: "inactive" as const,
      };

      const sourceId = await pipeline.addDataSource(source);

      await expect(pipeline.collectFromSource(sourceId)).rejects.toThrow(
        "Data source is not active",
      );
    });
  });

  describe("statistics", () => {
    it("should return accurate pipeline statistics", async () => {
      // Add some sources
      await pipeline.addDataSource({
        name: "Active Source 1",
        type: "search_engine",
        config: {},
        status: "active",
      });

      await pipeline.addDataSource({
        name: "Active Source 2",
        type: "web_scraping",
        config: {},
        status: "active",
      });

      await pipeline.addDataSource({
        name: "Inactive Source",
        type: "ecommerce",
        config: {},
        status: "inactive",
      });

      const stats = await pipeline.getStats();
      expect(stats.totalSources).toBe(3);
      expect(stats.activeSources).toBe(2);
      expect(stats.totalJobs).toBe(0);
      expect(stats.successfulJobs).toBe(0);
      expect(stats.failedJobs).toBe(0);
    });
  });

  describe("scheduled collection", () => {
    it("should run scheduled collection for all active sources", async () => {
      // Add active sources
      const sourceId1 = await pipeline.addDataSource({
        name: "Active Source 1",
        type: "search_engine",
        config: { keywords: ["test1"] },
        status: "active",
      });

      const sourceId2 = await pipeline.addDataSource({
        name: "Active Source 2",
        type: "web_scraping",
        config: { url: "https://example.com" },
        status: "active",
      });

      // Add inactive source (should be skipped)
      await pipeline.addDataSource({
        name: "Inactive Source",
        type: "ecommerce",
        config: {},
        status: "inactive",
      });

      // Mock collection methods
      const collectSearchResultsSpy = vi.spyOn(
        (pipeline as any).brightDataService,
        "collectSearchResults",
      );
      const collectWebScrapingDataSpy = vi.spyOn(
        (pipeline as any).brightDataService,
        "collectWebScrapingData",
      );

      collectSearchResultsSpy.mockResolvedValue([
        {
          id: "result1",
          sourceId: sourceId1,
          jobId: "job1",
          data: {},
          extractedAt: new Date(),
          tags: [],
          quality: "high",
        },
      ]);

      collectWebScrapingDataSpy.mockResolvedValue([
        {
          id: "result2",
          sourceId: sourceId2,
          jobId: "job2",
          data: {},
          extractedAt: new Date(),
          tags: [],
          quality: "high",
        },
      ]);

      await pipeline.runScheduledCollection();

      // Should have created jobs for 2 active sources
      const stats = await pipeline.getStats();
      expect(stats.totalJobs).toBe(2);
      expect(stats.successfulJobs).toBe(2);

      collectSearchResultsSpy.mockRestore();
      collectWebScrapingDataSpy.mockRestore();
    });
  });

  describe("event emission", () => {
    it("should emit events for source operations", async () => {
      const sourceAddedEvents: any[] = [];
      const sourceUpdatedEvents: any[] = [];
      const sourceRemovedEvents: any[] = [];

      pipeline.on("source:added", (source) => sourceAddedEvents.push(source));
      pipeline.on("source:updated", (source) =>
        sourceUpdatedEvents.push(source),
      );
      pipeline.on("source:removed", (source) =>
        sourceRemovedEvents.push(source),
      );

      const source = {
        name: "Event Test Source",
        type: "search_engine" as const,
        config: {},
        status: "active" as const,
      };

      const sourceId = await pipeline.addDataSource(source);
      expect(sourceAddedEvents.length).toBe(1);
      expect(sourceAddedEvents[0].name).toBe(source.name);

      await pipeline.updateDataSource(sourceId, { name: "Updated Name" });
      expect(sourceUpdatedEvents.length).toBe(1);
      expect(sourceUpdatedEvents[0].name).toBe("Updated Name");

      await pipeline.removeDataSource(sourceId);
      expect(sourceRemovedEvents.length).toBe(1);
      expect(sourceRemovedEvents[0].name).toBe("Updated Name");
    });

    it("should emit events for job operations", async () => {
      const jobStartedEvents: any[] = [];
      const jobCompletedEvents: any[] = [];

      pipeline.on("job:started", (job) => jobStartedEvents.push(job));
      pipeline.on("job:completed", (job) => jobCompletedEvents.push(job));

      const sourceId = await pipeline.addDataSource({
        name: "Job Event Source",
        type: "search_engine",
        config: { keywords: ["test"] },
        status: "active",
      });

      // Mock successful collection
      const collectSearchResultsSpy = vi.spyOn(
        (pipeline as any).brightDataService,
        "collectSearchResults",
      );
      collectSearchResultsSpy.mockResolvedValue([]);

      await pipeline.collectFromSource(sourceId);

      expect(jobStartedEvents.length).toBe(1);
      expect(jobCompletedEvents.length).toBe(1);
      expect(jobStartedEvents[0].sourceId).toBe(sourceId);
      expect(jobCompletedEvents[0].sourceId).toBe(sourceId);

      collectSearchResultsSpy.mockRestore();
    });
  });
});
