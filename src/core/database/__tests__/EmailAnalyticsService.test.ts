import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailAnalyticsService, ProcessingTimeData } from "../EmailAnalyticsService";
import { getDatabaseConnection } from "@/database/connection";
import type { Database } from "better-sqlite3";

// Mock dependencies
vi.mock("@/database/connection");
vi.mock("@/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe("EmailAnalyticsService", () => {
  let service: EmailAnalyticsService;
  let mockDb: any;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn()
      }),
      exec: vi.fn()
    };

    vi.mocked(getDatabaseConnection).mockReturnValue(mockDb as Database);
    
    // Get fresh instance
    // @ts-ignore - accessing private for testing
    EmailAnalyticsService.instance = undefined;
    service = EmailAnalyticsService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("validateProcessingTime", () => {
    it("should validate positive processing times", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        stage1Time: 100,
        stage2Time: 200,
        totalTime: 300
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.correctedData).toEqual(data);
    });

    it("should correct negative stage1Time", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        stage1Time: -100,
        stage2Time: 200,
        totalTime: 300
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Negative stage1Time detected: -100ms");
      expect(result.correctedData?.stage1Time).toBe(100);
    });

    it("should correct negative stage2Time", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        stage1Time: 100,
        stage2Time: -200,
        totalTime: 300
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Negative stage2Time detected: -200ms");
      expect(result.correctedData?.stage2Time).toBe(200);
    });

    it("should correct negative totalTime", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        stage1Time: 100,
        stage2Time: 200,
        totalTime: -300
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Negative totalTime detected: -300ms");
      expect(result.correctedData?.totalTime).toBe(300);
    });

    it("should correct excessive processing times", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        stage1Time: 400000, // > 5 minutes
        stage2Time: 700000, // > 10 minutes
        totalTime: 1000000  // > 15 minutes
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Excessive stage1Time detected: 400000ms");
      expect(result.errors).toContain("Excessive stage2Time detected: 700000ms");
      expect(result.errors).toContain("Excessive totalTime detected: 1000000ms");
      expect(result.correctedData?.stage1Time).toBe(300000);
      expect(result.correctedData?.stage2Time).toBe(600000);
      expect(result.correctedData?.totalTime).toBe(900000);
    });

    it("should ensure total time is at least sum of stages", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        stage1Time: 200,
        stage2Time: 300,
        totalTime: 400 // Less than 200 + 300
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Total time (400ms) is less than sum of stages (500ms)");
      expect(result.correctedData?.totalTime).toBe(500);
    });

    it("should handle missing stage times", () => {
      const data: ProcessingTimeData = {
        emailId: "test-123",
        totalTime: 300
      };

      const result = service.validateProcessingTime(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.correctedData?.totalTime).toBe(300);
    });
  });

  describe("calculateProcessingTime", () => {
    it("should calculate positive time difference", () => {
      const startTime = Date.now() - 1000;
      const endTime = Date.now();
      
      const result = EmailAnalyticsService.calculateProcessingTime(startTime, endTime);
      
      expect(result).toBeGreaterThanOrEqual(1000);
      expect(result).toBeLessThan(1100); // Allow some tolerance
    });

    it("should use current time if endTime not provided", () => {
      const startTime = Date.now() - 500;
      
      const result = EmailAnalyticsService.calculateProcessingTime(startTime);
      
      expect(result).toBeGreaterThanOrEqual(500);
      expect(result).toBeLessThan(600);
    });

    it("should return absolute value for negative duration", () => {
      const startTime = Date.now();
      const endTime = Date.now() - 1000; // End before start
      
      const result = EmailAnalyticsService.calculateProcessingTime(startTime, endTime);
      
      expect(result).toBeGreaterThanOrEqual(1000);
      expect(result).toBeLessThan(1100);
    });
  });

  describe("safeTimeCalculation", () => {
    it("should return result of operation", () => {
      const result = EmailAnalyticsService.safeTimeCalculation(() => 500);
      expect(result).toBe(500);
    });

    it("should return absolute value if operation returns negative", () => {
      const result = EmailAnalyticsService.safeTimeCalculation(() => -500);
      expect(result).toBe(500);
    });

    it("should return 0 if operation throws error", () => {
      const result = EmailAnalyticsService.safeTimeCalculation(() => {
        throw new Error("Test error");
      });
      expect(result).toBe(0);
    });
  });

  describe("recordEmailProcessed", () => {
    it("should update existing record with validated data", async () => {
      const mockGet = vi.fn().mockReturnValue({ email_id: "test-123" });
      const mockRun = vi.fn();
      
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("SELECT email_id")) {
          return { get: mockGet };
        }
        if (sql.includes("UPDATE email_analysis")) {
          return { run: mockRun };
        }
        return { run: vi.fn() };
      });

      await service.recordEmailProcessed({
        emailId: "test-123",
        stage1Time: 100,
        stage2Time: 200,
        totalTime: 300,
        stage1Model: "model1",
        stage2Model: "model2"
      });

      expect(mockGet).toHaveBeenCalledWith("test-123");
      expect(mockRun).toHaveBeenCalledWith(100, 200, 300, "model1", "model2", "test-123");
    });

    it("should correct negative values before updating", async () => {
      const mockGet = vi.fn().mockReturnValue({ email_id: "test-123" });
      const mockRun = vi.fn();
      
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("SELECT email_id")) {
          return { get: mockGet };
        }
        if (sql.includes("UPDATE email_analysis")) {
          return { run: mockRun };
        }
        return { run: vi.fn() };
      });

      await service.recordEmailProcessed({
        emailId: "test-123",
        stage1Time: -100,
        stage2Time: -200,
        totalTime: -300
      });

      expect(mockRun).toHaveBeenCalledWith(100, 200, 300, undefined, undefined, "test-123");
    });

    it("should log warning if record not found", async () => {
      const mockGet = vi.fn().mockReturnValue(null);
      
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("SELECT email_id")) {
          return { get: mockGet };
        }
        return { run: vi.fn() };
      });

      await service.recordEmailProcessed({
        emailId: "test-123",
        totalTime: 300
      });

      expect(mockGet).toHaveBeenCalledWith("test-123");
    });
  });

  describe("getProcessingStats", () => {
    it("should return processing statistics", async () => {
      const mockStats = {
        avg_stage1_time: 150.5,
        avg_stage2_time: 250.5,
        avg_total_time: 401.0,
        total_emails: 1000,
        emails_with_negative_times: 300
      };

      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(mockStats)
      });

      const stats = await service.getProcessingStats();

      expect(stats).toEqual({
        avgStage1Time: 150.5,
        avgStage2Time: 250.5,
        avgTotalTime: 401.0,
        totalEmails: 1000,
        emailsWithNegativeTimes: 300
      });
    });

    it("should handle null values in stats", async () => {
      const mockStats = {
        avg_stage1_time: null,
        avg_stage2_time: null,
        avg_total_time: null,
        total_emails: null,
        emails_with_negative_times: null
      };

      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(mockStats)
      });

      const stats = await service.getProcessingStats();

      expect(stats).toEqual({
        avgStage1Time: 0,
        avgStage2Time: 0,
        avgTotalTime: 0,
        totalEmails: 0,
        emailsWithNegativeTimes: 0
      });
    });
  });

  describe("fixNegativeProcessingTimes", () => {
    it("should fix negative processing times in database", async () => {
      const negativeRecords = [
        {
          email_id: "email1",
          quick_processing_time: -100,
          deep_processing_time: 200,
          total_processing_time: 100
        },
        {
          email_id: "email2",
          quick_processing_time: 150,
          deep_processing_time: -250,
          total_processing_time: -100
        }
      ];

      const mockAll = vi.fn().mockReturnValue(negativeRecords);
      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("SELECT") && sql.includes("WHERE")) {
          return { all: mockAll };
        }
        if (sql.includes("UPDATE email_analysis")) {
          return { run: mockRun };
        }
        return { run: vi.fn() };
      });

      const result = await service.fixNegativeProcessingTimes();

      expect(result.fixed).toBe(2);
      expect(result.errors).toBe(0);
      
      // Check first record fix
      expect(mockRun).toHaveBeenCalledWith(100, 200, 300, "email1");
      
      // Check second record fix
      expect(mockRun).toHaveBeenCalledWith(150, 250, 400, "email2");
    });

    it("should handle errors during fix", async () => {
      const negativeRecords = [
        {
          email_id: "email1",
          quick_processing_time: -100,
          deep_processing_time: 200,
          total_processing_time: 300
        }
      ];

      const mockAll = vi.fn().mockReturnValue(negativeRecords);
      const mockRun = vi.fn().mockImplementation(() => {
        throw new Error("Database error");
      });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("SELECT") && sql.includes("WHERE")) {
          return { all: mockAll };
        }
        if (sql.includes("UPDATE email_analysis")) {
          return { run: mockRun };
        }
        return { run: vi.fn() };
      });

      const result = await service.fixNegativeProcessingTimes();

      expect(result.fixed).toBe(0);
      expect(result.errors).toBe(1);
    });
  });
});