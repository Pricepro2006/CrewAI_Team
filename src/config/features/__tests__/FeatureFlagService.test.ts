/**
 * Tests for FeatureFlagService
 * GROUP 2B WebSearch Enhancement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FeatureFlagService } from "../FeatureFlagService";
import fs from "fs";
import path from "path";

// Mock modules
vi.mock("fs");
vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("FeatureFlagService", () => {
  let service: FeatureFlagService;
  const mockConfigPath = "/tmp/test-feature-flags.json";

  beforeEach(() => {
    // Clear singleton instance
    (FeatureFlagService as any).instance = undefined;

    // Mock environment variables
    process.env.FEATURE_FLAGS_PATH = mockConfigPath;
    process.env.FEATURE_FLAGS_REFRESH_MS = "0"; // Disable auto-refresh
    process.env.FEATURE_FLAG_TEST_FLAG = "true";
    process.env.FEATURE_FLAG_PERCENTAGE_FLAG = "75";
    process.env.BUSINESS_SEARCH_ROLLOUT_PERCENTAGE = "50";

    // Mock file system
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue("{}");
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    service = FeatureFlagService.getInstance();
  });

  afterEach(() => {
    service.destroy();
    vi.clearAllMocks();
    // Clean up environment
    delete process.env.FEATURE_FLAGS_PATH;
    delete process.env.FEATURE_FLAGS_REFRESH_MS;
    delete process.env.FEATURE_FLAG_TEST_FLAG;
    delete process.env.FEATURE_FLAG_PERCENTAGE_FLAG;
    delete process.env.BUSINESS_SEARCH_ROLLOUT_PERCENTAGE;
  });

  describe("Initialization", () => {
    it("should be a singleton", () => {
      const instance1 = FeatureFlagService.getInstance();
      const instance2 = FeatureFlagService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should load flags from environment variables", () => {
      const flag = service.getFlag("test-flag");

      expect(flag).toBeDefined();
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(100);
    });

    it("should parse percentage from environment variables", () => {
      const flag = service.getFlag("percentage-flag");

      expect(flag).toBeDefined();
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(75);
    });

    it("should initialize business search enhancement flag", () => {
      const flag = service.getFlag("business-search-enhancement");

      expect(flag).toBeDefined();
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(50);
      expect(flag?.metadata?.group).toBe("2B");
    });

    it("should load flags from file if exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          flags: [
            {
              name: "file-flag",
              enabled: true,
              description: "Loaded from file",
              rolloutPercentage: 80,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      );

      // Create new instance to trigger file load
      (FeatureFlagService as any).instance = undefined;
      const newService = FeatureFlagService.getInstance();

      const flag = newService.getFlag("file-flag");
      expect(flag).toBeDefined();
      expect(flag?.rolloutPercentage).toBe(80);

      newService.destroy();
    });
  });

  describe("Flag Checking", () => {
    it("should check if flag is enabled", () => {
      expect(service.isEnabled("test-flag")).toBe(true);
      expect(service.isEnabled("non-existent-flag")).toBe(false);
    });

    it("should check flag for specific user with consistent assignment", () => {
      // Create a flag with 50% rollout
      service.createFlag({
        name: "fifty-percent-flag",
        enabled: true,
        description: "Test flag",
        rolloutPercentage: 50,
      });

      // Check same user multiple times - should be consistent
      const userId = "user123";
      const firstCheck = service.isEnabledForUser("fifty-percent-flag", userId);
      const secondCheck = service.isEnabledForUser(
        "fifty-percent-flag",
        userId,
      );
      const thirdCheck = service.isEnabledForUser("fifty-percent-flag", userId);

      expect(firstCheck).toBe(secondCheck);
      expect(secondCheck).toBe(thirdCheck);
    });

    it("should distribute users roughly according to percentage", () => {
      service.createFlag({
        name: "distribution-test",
        enabled: true,
        description: "Test distribution",
        rolloutPercentage: 30,
      });

      let enabledCount = 0;
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        if (service.isEnabledForUser("distribution-test", `user${i}`)) {
          enabledCount++;
        }
      }

      // Should be roughly 30% (with some variance)
      expect(enabledCount).toBeGreaterThan(250); // 25%
      expect(enabledCount).toBeLessThan(350); // 35%
    });

    it("should return percentage for flag", () => {
      expect(service.getUserPercentage("percentage-flag")).toBe(75);
      expect(service.getUserPercentage("non-existent")).toBe(0);
    });
  });

  describe("Flag Management", () => {
    it("should create new flags", () => {
      const eventHandler = vi.fn();
      service.on("flag_created", eventHandler);

      service.createFlag({
        name: "new-flag",
        enabled: true,
        description: "Test new flag",
        rolloutPercentage: 100,
      });

      const flag = service.getFlag("new-flag");
      expect(flag).toBeDefined();
      expect(flag?.description).toBe("Test new flag");
      expect(eventHandler).toHaveBeenCalled();
    });

    it("should update existing flags", () => {
      const eventHandler = vi.fn();
      service.on("flag_updated", eventHandler);

      service.updateFlag("test-flag", {
        description: "Updated description",
        rolloutPercentage: 50,
      });

      const flag = service.getFlag("test-flag");
      expect(flag?.description).toBe("Updated description");
      expect(flag?.rolloutPercentage).toBe(50);
      expect(eventHandler).toHaveBeenCalled();
    });

    it("should delete flags", () => {
      const eventHandler = vi.fn();
      service.on("flag_deleted", eventHandler);

      service.deleteFlag("test-flag");

      expect(service.getFlag("test-flag")).toBeUndefined();
      expect(eventHandler).toHaveBeenCalled();
    });

    it("should enable flags with percentage", () => {
      service.createFlag({
        name: "disabled-flag",
        enabled: false,
        description: "Initially disabled",
        rolloutPercentage: 0,
      });

      service.enableFlag("disabled-flag", 80);

      const flag = service.getFlag("disabled-flag");
      expect(flag?.enabled).toBe(true);
      expect(flag?.rolloutPercentage).toBe(80);
    });

    it("should disable flags", () => {
      service.disableFlag("test-flag");

      const flag = service.getFlag("test-flag");
      expect(flag?.enabled).toBe(false);
      expect(flag?.rolloutPercentage).toBe(0);
    });

    it("should set rollout percentage", () => {
      service.setRolloutPercentage("test-flag", 25);

      const flag = service.getFlag("test-flag");
      expect(flag?.rolloutPercentage).toBe(25);
      expect(flag?.enabled).toBe(true);

      // Test boundary conditions
      service.setRolloutPercentage("test-flag", 150);
      expect(service.getFlag("test-flag")?.rolloutPercentage).toBe(100);

      service.setRolloutPercentage("test-flag", -10);
      expect(service.getFlag("test-flag")?.rolloutPercentage).toBe(0);
    });
  });

  describe("Persistence", () => {
    it("should save flags to file", () => {
      service.createFlag({
        name: "persist-flag",
        enabled: true,
        description: "Test persistence",
        rolloutPercentage: 60,
      });

      expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled();

      const mockCalls = vi.mocked(fs.writeFileSync).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const firstCall = mockCalls[0];
      expect(firstCall).toBeDefined();
      const savedData = firstCall![1] as string;
      expect(savedData).toBeDefined();
      const parsed = JSON.parse(savedData);

      expect(parsed.flags).toHaveLength(4); // env flags + new flag
      expect(
        parsed.flags.find((f: any) => f.name === "persist-flag"),
      ).toBeDefined();
    });
  });

  describe("Refresh and Events", () => {
    it("should refresh flags from sources", () => {
      const eventHandler = vi.fn();
      service.on("flag_changed", eventHandler);

      // Change env variable
      process.env.FEATURE_FLAG_TEST_FLAG = "50";

      service.refresh();

      const flag = service.getFlag("test-flag");
      expect(flag?.rolloutPercentage).toBe(50);
      expect(eventHandler).toHaveBeenCalled();
    });

    it("should start refresh interval if configured", () => {
      vi.useFakeTimers();

      // Create new instance with refresh interval
      (FeatureFlagService as any).instance = undefined;
      process.env.FEATURE_FLAGS_REFRESH_MS = "5000";

      const newService = FeatureFlagService.getInstance();
      const refreshSpy = vi.spyOn(newService, "refresh");

      // Advance time
      vi.advanceTimersByTime(5000);

      expect(refreshSpy).toHaveBeenCalled();

      newService.destroy();
      vi.useRealTimers();
    });
  });

  describe("State Export", () => {
    it("should export current state", () => {
      const state = service.exportState();

      expect(state.flags.length).toBeGreaterThan(0);
      expect(state.userAssignmentCount).toBe(0);
      expect(state.config).toBeDefined();
    });

    it("should track user assignments", () => {
      // Make some user checks
      service.isEnabledForUser("test-flag", "user1");
      service.isEnabledForUser("test-flag", "user2");

      const state = service.exportState();
      expect(state.userAssignmentCount).toBe(2);
    });

    it("should clear user assignments", () => {
      // Make some assignments
      service.isEnabledForUser("test-flag", "user1");
      service.isEnabledForUser("test-flag", "user2");

      service.clearUserAssignments();

      const state = service.exportState();
      expect(state.userAssignmentCount).toBe(0);
    });
  });

  describe("Business Search Enhancement Integration", () => {
    it("should properly configure business search flag", () => {
      const flag = service.getFlag("business-search-enhancement");

      expect(flag).toBeDefined();
      expect(flag?.metadata?.group).toBe("2B");
      expect(flag?.metadata?.component).toBe("WebSearch");
      expect(flag?.metadata?.impact).toBe("high");
      expect(flag?.metadata?.dependencies).toContain(
        "BusinessSearchPromptEnhancer",
      );
    });

    it("should allow dynamic adjustment of business search rollout", () => {
      // Start at 50%
      expect(service.getUserPercentage("business-search-enhancement")).toBe(50);

      // Increase to 75%
      service.setRolloutPercentage("business-search-enhancement", 75);
      expect(service.getUserPercentage("business-search-enhancement")).toBe(75);

      // Disable completely
      service.disableFlag("business-search-enhancement");
      expect(service.isEnabled("business-search-enhancement")).toBe(false);

      // Re-enable at 100%
      service.enableFlag("business-search-enhancement", 100);
      expect(service.getUserPercentage("business-search-enhancement")).toBe(
        100,
      );
    });
  });
});
