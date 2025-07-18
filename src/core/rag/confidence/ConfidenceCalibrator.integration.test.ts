/**
 * Integration test for ConfidenceCalibrator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceCalibrator } from './ConfidenceCalibrator';

describe('ConfidenceCalibrator Integration', () => {
  let calibrator: ConfidenceCalibrator;

  beforeEach(() => {
    calibrator = new ConfidenceCalibrator();
  });

  describe('calibrate method', () => {
    it('should calibrate confidence scores', () => {
      const confidence = 0.7;
      const result = calibrator.calibrate(confidence);
      
      expect(result).toHaveProperty('calibratedScore');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('parameters');
      
      expect(result.calibratedScore).toBeGreaterThanOrEqual(0);
      expect(result.calibratedScore).toBeLessThanOrEqual(1);
      expect(result.method).toBe('temperature_scaling');
    });

    it('should support different calibration methods', () => {
      const confidence = 0.6;
      
      const tempResult = calibrator.calibrate(confidence, { method: 'temperature_scaling' });
      const plattResult = calibrator.calibrate(confidence, { method: 'platt_scaling' });
      const isotonicResult = calibrator.calibrate(confidence, { method: 'isotonic_regression' });
      
      expect(tempResult.method).toBe('temperature_scaling');
      expect(plattResult.method).toBe('platt_scaling');
      expect(isotonicResult.method).toBe('isotonic_regression');
      
      // Results should be different
      expect(tempResult.calibratedScore).not.toBe(plattResult.calibratedScore);
    });

    it('should handle edge values', () => {
      const zero = calibrator.calibrate(0);
      const one = calibrator.calibrate(1);
      const negative = calibrator.calibrate(-0.5);
      const tooHigh = calibrator.calibrate(1.5);
      
      expect(zero.calibratedScore).toBeGreaterThanOrEqual(0);
      expect(one.calibratedScore).toBeLessThanOrEqual(1);
      expect(negative.calibratedScore).toBe(0);
      expect(tooHigh.calibratedScore).toBe(1);
    });

    it('should accept custom parameters', () => {
      const result = calibrator.calibrate(0.7, {
        method: 'temperature_scaling',
        parameters: { temperature: 2.0 }
      });
      
      expect(result.parameters.temperature).toBe(2.0);
    });
  });

  describe('training methods', () => {
    it('should have trainTemperatureScaling method', () => {
      expect(calibrator).toHaveProperty('trainTemperatureScaling');
      expect(typeof calibrator.trainTemperatureScaling).toBe('function');
    });

    it('should have trainIsotonicRegression method', () => {
      expect(calibrator).toHaveProperty('trainIsotonicRegression');
      expect(typeof calibrator.trainIsotonicRegression).toBe('function');
    });

    it('should have trainPlattScaling method', () => {
      expect(calibrator).toHaveProperty('trainPlattScaling');
      expect(typeof calibrator.trainPlattScaling).toBe('function');
    });

    it('should train temperature scaling', () => {
      const trainingData = [
        { predictedConfidence: 0.8, actualAccuracy: 0.7 },
        { predictedConfidence: 0.6, actualAccuracy: 0.65 },
        { predictedConfidence: 0.9, actualAccuracy: 0.85 }
      ];
      
      calibrator.trainTemperatureScaling(trainingData);
      
      // After training, calibration should be adjusted
      const result = calibrator.calibrate(0.8);
      expect(result.calibratedScore).not.toBe(0.8);
    });
  });

  describe('history tracking', () => {
    it('should add calibration data to history', () => {
      calibrator.addCalibrationData(0.7, 0.65);
      calibrator.addCalibrationData(0.8, 0.75);
      
      const history = calibrator.getCalibrationHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ predictedConfidence: 0.7, actualAccuracy: 0.65 });
    });

    it('should clear history', () => {
      calibrator.addCalibrationData(0.7, 0.65);
      calibrator.clearHistory();
      
      const history = calibrator.getCalibrationHistory();
      expect(history).toHaveLength(0);
    });
  });
});