import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { EmailAnalyticsService } from "../EmailAnalyticsService.js";

// Mock better-sqlite3
vi.mock("better-sqlite3");

describe("EmailAnalyticsService", () => {
  let service: EmailAnalyticsService;
  let mockDb: unknown;
  let mockStmt: unknown;

  beforeEach(() => {
    // Setup mock statement
    mockStmt = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    };

    // Setup mock database
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
      close: vi.fn(),
    };

    // Mock Database constructor
    (Database as any).mockImplementation(() => mockDb);

    service = new EmailAnalyticsService(":memory:");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTotalEmailsCount", () => {
    it("should return total email count", () => {
      mockStmt.get.mockReturnValue({ total: 33797 });

      const result = service.getTotalEmailsCount();

      expect(result).toBe(33797);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "SELECT COUNT(*) as total FROM emails",
      );
    });

    it("should return 0 on error", () => {
      mockStmt.get.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = service.getTotalEmailsCount();

      expect(result).toBe(0);
    });
  });

  describe("getProcessedEmailsCount", () => {
    it("should return processed email count", () => {
      mockStmt.get.mockReturnValue({ total: 24990 });

      const result = service.getProcessedEmailsCount();

      expect(result).toBe(24990);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE workflow_state = 'COMPLETE'"),
      );
    });

    it("should return 0 on error", () => {
      mockStmt.get.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = service.getProcessedEmailsCount();

      expect(result).toBe(0);
    });
  });

  describe("getPendingEmailsCount", () => {
    it("should return pending email count", () => {
      mockStmt.get.mockReturnValue({ total: 8807 });

      const result = service.getPendingEmailsCount();

      expect(result).toBe(8807);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE ea.id IS NULL OR ea.workflow_state = 'PENDING'",
        ),
      );
    });

    it("should return 0 on error", () => {
      mockStmt.get.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = service.getPendingEmailsCount();

      expect(result).toBe(0);
    });
  });

  describe("getAverageProcessingTime", () => {
    it("should return average processing time", () => {
      mockStmt.get.mockReturnValue({ avg_time: 1234.56 });

      const result = service.getAverageProcessingTime();

      expect(result).toBe(1234.56);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("AVG(processing_time_ms)"),
      );
    });

    it("should return 0 when avg_time is null", () => {
      mockStmt.get.mockReturnValue({ avg_time: null });

      const result = service.getAverageProcessingTime();

      expect(result).toBe(0);
    });

    it("should return 0 on error", () => {
      mockStmt.get.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = service.getAverageProcessingTime();

      expect(result).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return aggregated statistics", async () => {
      // Mock each method call
      mockStmt.get
        .mockReturnValueOnce({ total: 33797 }) // getTotalEmailsCount
        .mockReturnValueOnce({ total: 24990 }) // getProcessedEmailsCount
        .mockReturnValueOnce({ total: 8807 }) // getPendingEmailsCount
        .mockReturnValueOnce({ avg_time: 1234.56 }); // getAverageProcessingTime

      const result = await service.getStats();

      expect(result).toMatchObject({
        totalEmails: 33797,
        processedEmails: 24990,
        pendingEmails: 8807,
        averageProcessingTime: 1234.56,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should return graceful fallback on error", async () => {
      mockStmt.get.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await service.getStats();

      expect(result).toMatchObject({
        totalEmails: 0,
        processedEmails: 0,
        pendingEmails: 0,
        averageProcessingTime: 0,
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("close", () => {
    it("should close database connection", () => {
      service.close();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it("should handle close error gracefully", () => {
      mockDb.close.mockImplementation(() => {
        throw new Error("Close error");
      });

      // Should not throw
      expect(() => service.close()).not.toThrow();
    });
  });

  describe("constructor", () => {
    it("should throw error if database connection fails", () => {
      (Database as any).mockImplementation(() => {
        throw new Error("Connection failed");
      });

      expect(() => new EmailAnalyticsService(":memory:")).toThrow(
        "Database connection failed",
      );
    });
  });
});
