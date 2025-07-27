/**
 * ConfidenceCalibrator - Calibrates confidence scores using various methods
 * Implements temperature scaling, isotonic regression, and Platt scaling
 */

import * as ss from "simple-statistics";
import type { CalibrationOptions } from "./types";

export interface CalibrationData {
  predictedConfidence: number;
  actualAccuracy: number;
}

export interface CalibrationResult {
  calibratedScore: number;
  method: string;
  parameters?: Record<string, any>;
}

export class ConfidenceCalibrator {
  private temperatureScalingParams?: { temperature: number };
  private isotonicRegressionModel?: { x: number[]; y: number[] };
  private plattScalingParams?: { a: number; b: number };
  private calibrationHistory: CalibrationData[] = [];

  /**
   * Calibrate a confidence score using the specified method
   * @param rawConfidence Raw confidence score (0-1)
   * @param options Calibration options
   * @returns Calibrated result
   */
  calibrate(
    rawConfidence: number,
    options: CalibrationOptions = { method: "temperature_scaling" },
  ): CalibrationResult {
    // Ensure confidence is in valid range
    rawConfidence = Math.max(0, Math.min(1, rawConfidence));

    switch (options.method) {
      case "temperature_scaling":
        return this.temperatureScaling(rawConfidence, options.parameters);

      case "isotonic_regression":
        return this.isotonicRegression(rawConfidence, options.parameters);

      case "platt_scaling":
        return this.plattScaling(rawConfidence, options.parameters);

      default:
        return {
          calibratedScore: rawConfidence,
          method: "none",
        };
    }
  }

  /**
   * Temperature scaling calibration
   * Divides logits by a learned temperature parameter
   */
  private temperatureScaling(
    confidence: number,
    parameters?: Record<string, any>,
  ): CalibrationResult {
    // Use provided temperature or default
    const temperature =
      parameters?.temperature ||
      this.temperatureScalingParams?.temperature ||
      1.5; // Default temperature

    // Convert confidence to logit space
    const logit = this.confidenceToLogit(confidence);

    // Apply temperature scaling
    const scaledLogit = logit / temperature;

    // Convert back to probability
    const calibratedScore = this.logitToConfidence(scaledLogit);

    return {
      calibratedScore,
      method: "temperature_scaling",
      parameters: { temperature },
    };
  }

  /**
   * Isotonic regression calibration
   * Fits a monotonic function to calibration data
   */
  private isotonicRegression(
    confidence: number,
    parameters?: Record<string, any>,
  ): CalibrationResult {
    // Use provided model or trained model
    const model = parameters?.model || this.isotonicRegressionModel;

    if (!model || !model.x || !model.y) {
      // Fallback to simple linear adjustment
      return {
        calibratedScore: confidence * 0.9, // Conservative adjustment
        method: "isotonic_regression",
        parameters: { fallback: true },
      };
    }

    // Find calibrated value using linear interpolation
    const calibratedScore = this.interpolateIsotonic(
      confidence,
      model.x,
      model.y,
    );

    return {
      calibratedScore,
      method: "isotonic_regression",
      parameters: { modelSize: model.x.length },
    };
  }

  /**
   * Platt scaling calibration
   * Fits a sigmoid function to calibration data
   */
  private plattScaling(
    confidence: number,
    parameters?: Record<string, any>,
  ): CalibrationResult {
    // Use provided parameters or trained parameters
    const a = parameters?.a || this.plattScalingParams?.a || 1.0;
    const b = parameters?.b || this.plattScalingParams?.b || 0.0;

    // Apply Platt scaling: 1 / (1 + exp(a * confidence + b))
    const calibratedScore = 1 / (1 + Math.exp(a * confidence + b));

    return {
      calibratedScore,
      method: "platt_scaling",
      parameters: { a, b },
    };
  }

  /**
   * Train calibration parameters from historical data
   * @param data Array of calibration data points
   * @param method Calibration method to train
   */
  trainCalibration(
    data: CalibrationData[],
    method: "temperature_scaling" | "isotonic_regression" | "platt_scaling",
  ): void {
    if (data.length < 10) {
      console.warn("Insufficient calibration data. Need at least 10 samples.");
      return;
    }

    this.calibrationHistory = [...this.calibrationHistory, ...data];

    switch (method) {
      case "temperature_scaling":
        this.trainTemperatureScaling(data);
        break;

      case "isotonic_regression":
        this.trainIsotonicRegression(data);
        break;

      case "platt_scaling":
        this.trainPlattScaling(data);
        break;
    }
  }

  /**
   * Train temperature scaling parameter
   */
  private trainTemperatureScaling(data: CalibrationData[]): void {
    // Find temperature that minimizes calibration error
    let bestTemperature = 1.0;
    let bestError = Infinity;

    // Grid search for optimal temperature
    for (let temp = 0.5; temp <= 3.0; temp += 0.1) {
      let error = 0;

      for (const point of data) {
        const calibrated = this.temperatureScaling(point.predictedConfidence, {
          temperature: temp,
        }).calibratedScore;

        error += Math.pow(calibrated - point.actualAccuracy, 2);
      }

      if (error < bestError) {
        bestError = error;
        bestTemperature = temp;
      }
    }

    this.temperatureScalingParams = { temperature: bestTemperature };
  }

  /**
   * Train isotonic regression model
   */
  private trainIsotonicRegression(data: CalibrationData[]): void {
    // Sort data by predicted confidence
    const sorted = [...data].sort(
      (a, b) => a.predictedConfidence - b.predictedConfidence,
    );

    // Pool adjacent violators algorithm for isotonic regression
    const x: number[] = [];
    const y: number[] = [];

    let i = 0;
    while (i < sorted.length) {
      let sumX = sorted[i].predictedConfidence;
      let sumY = sorted[i].actualAccuracy;
      let count = 1;

      // Pool violators
      let j = i + 1;
      while (j < sorted.length && sorted[j].actualAccuracy < sumY / count) {
        sumX += sorted[j].predictedConfidence;
        sumY += sorted[j].actualAccuracy;
        count++;
        j++;
      }

      // Add pooled point
      x.push(sumX / count);
      y.push(sumY / count);
      i = j;
    }

    this.isotonicRegressionModel = { x, y };
  }

  /**
   * Train Platt scaling parameters
   */
  private trainPlattScaling(data: CalibrationData[]): void {
    // Use simple linear regression in log space
    // This is a simplified version - in production use proper optimization

    const logitPairs = data
      .map((point) => ({
        x: this.confidenceToLogit(point.predictedConfidence),
        y: this.confidenceToLogit(point.actualAccuracy),
      }))
      .filter((pair) => isFinite(pair.x) && isFinite(pair.y));

    if (logitPairs.length < 5) {
      console.warn("Insufficient valid data for Platt scaling");
      return;
    }

    // Linear regression
    const regression = ss.linearRegression(logitPairs);

    this.plattScalingParams = {
      a: regression.m || 1.0,
      b: regression.b || 0.0,
    };
  }

  /**
   * Convert confidence to logit
   */
  private confidenceToLogit(p: number): number {
    // Clip to avoid infinities
    p = Math.max(0.001, Math.min(0.999, p));
    return Math.log(p / (1 - p));
  }

  /**
   * Convert logit to confidence
   */
  private logitToConfidence(logit: number): number {
    return 1 / (1 + Math.exp(-logit));
  }

  /**
   * Interpolate isotonic regression model
   */
  private interpolateIsotonic(value: number, x: number[], y: number[]): number {
    if (x.length === 0) return value;

    // Handle edge cases
    if (value <= x[0]) return y[0];
    if (value >= x[x.length - 1]) return y[y.length - 1];

    // Find interpolation points
    for (let i = 0; i < x.length - 1; i++) {
      if (value >= x[i] && value <= x[i + 1]) {
        // Linear interpolation
        const t = (value - x[i]) / (x[i + 1] - x[i]);
        return y[i] + t * (y[i + 1] - y[i]);
      }
    }

    return value; // Fallback
  }

  /**
   * Evaluate calibration quality
   * @param data Test data
   * @returns Calibration metrics
   */
  evaluateCalibration(data: CalibrationData[]): {
    ece: number; // Expected Calibration Error
    mce: number; // Maximum Calibration Error
    brier: number; // Brier score
  } {
    if (data.length === 0) {
      return { ece: 0, mce: 0, brier: 0 };
    }

    // Bin data for ECE calculation
    const numBins = 10;
    const bins: Array<{ sum: number; count: number; accuracy: number }> =
      new Array(numBins)
        .fill(null)
        .map(() => ({ sum: 0, count: 0, accuracy: 0 }));

    let brierSum = 0;

    // Assign data to bins
    for (const point of data) {
      const binIndex = Math.min(
        Math.floor(point.predictedConfidence * numBins),
        numBins - 1,
      );

      bins[binIndex].sum += point.predictedConfidence;
      bins[binIndex].count += 1;
      bins[binIndex].accuracy += point.actualAccuracy;

      // Brier score component
      brierSum += Math.pow(point.predictedConfidence - point.actualAccuracy, 2);
    }

    // Calculate ECE and MCE
    let ece = 0;
    let mce = 0;

    for (const bin of bins) {
      if (bin.count > 0) {
        const avgConfidence = bin.sum / bin.count;
        const avgAccuracy = bin.accuracy / bin.count;
        const binError = Math.abs(avgConfidence - avgAccuracy);

        ece += (bin.count / data.length) * binError;
        mce = Math.max(mce, binError);
      }
    }

    const brier = brierSum / data.length;

    return { ece, mce, brier };
  }

  /**
   * Get calibration diagnostics
   */
  getDiagnostics(): {
    method: string;
    parameters: any;
    dataPoints: number;
    metrics?: { ece: number; mce: number; brier: number };
  } {
    let method = "none";
    let parameters: any = {};

    if (this.temperatureScalingParams) {
      method = "temperature_scaling";
      parameters = this.temperatureScalingParams;
    } else if (this.isotonicRegressionModel) {
      method = "isotonic_regression";
      parameters = { modelSize: this.isotonicRegressionModel.x.length };
    } else if (this.plattScalingParams) {
      method = "platt_scaling";
      parameters = this.plattScalingParams;
    }

    const diagnostics: any = {
      method,
      parameters,
      dataPoints: this.calibrationHistory.length,
    };

    if (this.calibrationHistory.length > 0) {
      diagnostics.metrics = this.evaluateCalibration(this.calibrationHistory);
    }

    return diagnostics;
  }

  /**
   * Reset calibration parameters
   */
  reset(): void {
    this.temperatureScalingParams = undefined;
    this.isotonicRegressionModel = undefined;
    this.plattScalingParams = undefined;
    this.calibrationHistory = [];
  }

  /**
   * Export calibration parameters
   */
  exportParameters(): {
    temperatureScaling?: { temperature: number };
    isotonicRegression?: { x: number[]; y: number[] };
    plattScaling?: { a: number; b: number };
  } {
    return {
      temperatureScaling: this.temperatureScalingParams,
      isotonicRegression: this.isotonicRegressionModel,
      plattScaling: this.plattScalingParams,
    };
  }

  /**
   * Import calibration parameters
   */
  importParameters(params: {
    temperatureScaling?: { temperature: number };
    isotonicRegression?: { x: number[]; y: number[] };
    plattScaling?: { a: number; b: number };
  }): void {
    if (params.temperatureScaling) {
      this.temperatureScalingParams = params.temperatureScaling;
    }
    if (params.isotonicRegression) {
      this.isotonicRegressionModel = params.isotonicRegression;
    }
    if (params.plattScaling) {
      this.plattScalingParams = params.plattScaling;
    }
  }
}
