/**
 * Unit tests for ConfidenceCalibrator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceCalibrator } from './ConfidenceCalibrator';
import type { CalibrationMethod } from './types';

describe('ConfidenceCalibrator', () => {
  let calibrator: ConfidenceCalibrator;

  beforeEach(() => {
    calibrator = new ConfidenceCalibrator();
  });

  describe('calibrate', () => {
    it('should apply temperature scaling by default', () => {
      const confidence = 0.7;
      const result = calibrator.calibrate(confidence);
      
      expect(result.calibratedScore).not.toBe(confidence);
      expect(result.calibratedScore).toBeGreaterThanOrEqual(0);
      expect(result.calibratedScore).toBeLessThanOrEqual(1);
      expect(result.method).toBe('temperature_scaling');
    });

    it('should handle edge values', () => {
      const zero = calibrator.calibrate(0);
      const one = calibrator.calibrate(1);
      const half = calibrator.calibrate(0.5);
      
      expect(zero.calibratedScore).toBeCloseTo(0, 2);
      expect(one.calibratedScore).toBeCloseTo(1, 2);
      expect(half.calibratedScore).toBeCloseTo(0.5, 1);
    });

    it('should apply specified calibration method', () => {
      const confidence = 0.7;
      
      const tempScaled = calibrator.calibrate(confidence, { method: 'temperature_scaling' });
      const plattScaled = calibrator.calibrate(confidence, { method: 'platt_scaling' });
      const isotonic = calibrator.calibrate(confidence, { method: 'isotonic_regression' });
      
      // Different methods should produce different results
      expect(tempScaled.calibratedScore).not.toBe(plattScaled.calibratedScore);
      expect(tempScaled.calibratedScore).not.toBe(isotonic.calibratedScore);
    });

    it('should clamp values to [0, 1]', () => {
      // Test with extreme inputs
      const veryHigh = calibrator.calibrate(1.5);
      const veryLow = calibrator.calibrate(-0.5);
      
      expect(veryHigh.calibratedScore).toBeLessThanOrEqual(1);
      expect(veryLow.calibratedScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('temperatureScaling', () => {
    it('should scale confidence with temperature parameter', () => {
      const confidence = 0.8;
      
      // Lower temperature = more extreme (closer to 0 or 1)
      const lowTemp = calibrator.temperatureScaling(confidence, 0.5);
      // Higher temperature = more moderate (closer to 0.5)
      const highTemp = calibrator.temperatureScaling(confidence, 2.0);
      
      expect(lowTemp).toBeGreaterThan(confidence);
      expect(highTemp).toBeLessThan(confidence);
    });

    it('should not change 0.5 regardless of temperature', () => {
      const confidence = 0.5;
      
      expect(calibrator.temperatureScaling(confidence, 0.5)).toBeCloseTo(0.5, 5);
      expect(calibrator.temperatureScaling(confidence, 1.0)).toBeCloseTo(0.5, 5);
      expect(calibrator.temperatureScaling(confidence, 2.0)).toBeCloseTo(0.5, 5);
    });

    it('should handle temperature = 1 (no change)', () => {
      const confidence = 0.7;
      const scaled = calibrator.temperatureScaling(confidence, 1.0);
      
      expect(scaled).toBeCloseTo(confidence, 5);
    });
  });

  describe('plattScaling', () => {
    it('should apply sigmoid transformation', () => {
      const confidence = 0.7;
      const scaled = calibrator.plattScaling(confidence);
      
      expect(scaled).not.toBe(confidence);
      expect(scaled).toBeGreaterThan(0);
      expect(scaled).toBeLessThan(1);
    });

    it('should preserve ordering', () => {
      const low = 0.3;
      const mid = 0.5;
      const high = 0.8;
      
      const scaledLow = calibrator.plattScaling(low);
      const scaledMid = calibrator.plattScaling(mid);
      const scaledHigh = calibrator.plattScaling(high);
      
      expect(scaledLow).toBeLessThan(scaledMid);
      expect(scaledMid).toBeLessThan(scaledHigh);
    });

    it('should handle custom parameters', () => {
      const calibratorCustom = new ConfidenceCalibrator({
        plattA: 2.0,
        plattB: -1.0
      });
      
      const confidence = 0.6;
      const scaled = calibratorCustom.plattScaling(confidence);
      
      expect(scaled).toBeGreaterThanOrEqual(0);
      expect(scaled).toBeLessThanOrEqual(1);
    });
  });

  describe('isotonicRegression', () => {
    it('should map confidence using isotonic points', () => {
      const confidence = 0.75;
      const scaled = calibrator.isotonicRegression(confidence);
      
      expect(scaled).toBeGreaterThanOrEqual(0);
      expect(scaled).toBeLessThanOrEqual(1);
    });

    it('should interpolate between calibration points', () => {
      // Default points: [(0.2, 0.15), (0.5, 0.5), (0.8, 0.85)]
      const mid = calibrator.isotonicRegression(0.35); // Between 0.2 and 0.5
      
      expect(mid).toBeGreaterThan(0.15);
      expect(mid).toBeLessThan(0.5);
    });

    it('should handle values outside calibration range', () => {
      const veryLow = calibrator.isotonicRegression(0.1);
      const veryHigh = calibrator.isotonicRegression(0.95);
      
      expect(veryLow).toBeCloseTo(0.075, 2); // Extrapolated
      expect(veryHigh).toBeCloseTo(0.975, 2); // Extrapolated
    });

    it('should use custom calibration points', () => {
      const customCalibrator = new ConfidenceCalibrator({
        isotonicPoints: [
          [0.3, 0.2],
          [0.7, 0.8]
        ]
      });
      
      const scaled = customCalibrator.isotonicRegression(0.5);
      expect(scaled).toBeCloseTo(0.5, 1); // Linear interpolation
    });
  });

  describe('batchCalibrate', () => {
    it('should calibrate multiple values', () => {
      const confidences = [0.2, 0.5, 0.8, 0.95];
      const calibrated = calibrator.batchCalibrate(confidences);
      
      expect(calibrated).toHaveLength(4);
      calibrated.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
    });

    it('should preserve relative ordering', () => {
      const confidences = [0.1, 0.3, 0.5, 0.7, 0.9];
      const calibrated = calibrator.batchCalibrate(confidences);
      
      for (let i = 1; i < calibrated.length; i++) {
        expect(calibrated[i]).toBeGreaterThan(calibrated[i - 1]);
      }
    });

    it('should apply specified method to all values', () => {
      const confidences = [0.4, 0.6, 0.8];
      const plattCalibrated = calibrator.batchCalibrate(confidences, 'platt');
      
      confidences.forEach((conf, i) => {
        const individual = calibrator.calibrate(conf, 'platt');
        expect(plattCalibrated[i]).toBeCloseTo(individual, 5);
      });
    });
  });

  describe('getCalibrationStats', () => {
    it('should return calibration statistics', () => {
      const stats = calibrator.getCalibrationStats();
      
      expect(stats).toHaveProperty('method');
      expect(stats).toHaveProperty('parameters');
      expect(stats.method).toBe('temperature');
    });

    it('should include all parameters', () => {
      const customCalibrator = new ConfidenceCalibrator({
        temperature: 1.5,
        plattA: 2.0,
        plattB: -0.5
      });
      
      const stats = customCalibrator.getCalibrationStats();
      
      expect(stats.parameters.temperature).toBe(1.5);
      expect(stats.parameters.plattA).toBe(2.0);
      expect(stats.parameters.plattB).toBe(-0.5);
    });

    it('should include isotonic points', () => {
      const stats = calibrator.getCalibrationStats();
      
      expect(stats.parameters.isotonicPoints).toBeDefined();
      expect(Array.isArray(stats.parameters.isotonicPoints)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle NaN inputs', () => {
      const result = calibrator.calibrate(NaN);
      expect(result).toBe(0); // Should default to 0
    });

    it('should handle infinite values', () => {
      expect(calibrator.calibrate(Infinity)).toBe(1);
      expect(calibrator.calibrate(-Infinity)).toBe(0);
    });

    it('should handle very small temperature values', () => {
      const extremeCalibrator = new ConfidenceCalibrator({ temperature: 0.01 });
      
      const high = extremeCalibrator.calibrate(0.9);
      const low = extremeCalibrator.calibrate(0.1);
      
      expect(high).toBeCloseTo(1, 1);
      expect(low).toBeCloseTo(0, 1);
    });

    it('should handle empty batch', () => {
      const result = calibrator.batchCalibrate([]);
      expect(result).toEqual([]);
    });

    it('should validate isotonic points are monotonic', () => {
      // Points should be in increasing order
      const validCalibrator = new ConfidenceCalibrator({
        isotonicPoints: [[0.2, 0.1], [0.5, 0.5], [0.8, 0.9]]
      });
      
      // This should work fine
      const result = validCalibrator.isotonicRegression(0.6);
      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(0.9);
    });
  });

  describe('performance', () => {
    it('should handle large batches efficiently', () => {
      const largeConfidences = Array(10000).fill(0).map(() => Math.random());
      
      const startTime = Date.now();
      const calibrated = calibrator.batchCalibrate(largeConfidences);
      const endTime = Date.now();
      
      expect(calibrated).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});