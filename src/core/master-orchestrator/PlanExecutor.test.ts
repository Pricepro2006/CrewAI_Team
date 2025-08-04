/**
 * Unit tests for PlanExecutor
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanExecutor } from "./PlanExecutor.js";

describe("PlanExecutor", () => {
  let planExecutor: PlanExecutor;

  beforeEach(() => {
    planExecutor = new PlanExecutor();
  });

  describe("Basic Functionality", () => {
    it("should initialize successfully", () => {
      expect(planExecutor).toBeDefined();
      expect(planExecutor).toBeInstanceOf(PlanExecutor);
    });

    it("should handle empty plans", async () => {
      const emptyPlan = { steps: [] };
      const result = await planExecutor.execute(emptyPlan);
      expect(result).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should throw error for null plans", async () => {
      await expect(planExecutor.execute(null as any)).rejects.toThrow();
    });

    it("should throw error for undefined plans", async () => {
      await expect(planExecutor.execute(undefined as any)).rejects.toThrow();
    });
  });
});