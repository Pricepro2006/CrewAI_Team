/**
 * ConfidenceCalibrator - Temporary placeholder implementation
 * TODO: Implement full confidence calibration system
 */
export interface CalibrationOptions {
    method: 'temperature_scaling' | 'platt_scaling';
}
export interface CalibrationResult {
    calibratedScore: number;
    originalScore: number;
    method: string;
}
export interface CalibrationDataPoint {
    predictedConfidence: number;
    actualAccuracy: number;
}
export declare class ConfidenceCalibrator {
    private calibrationParameters;
    /**
     * Calibrate confidence score
     */
    calibrate(confidence: number, options: CalibrationOptions): CalibrationResult;
    /**
     * Train calibration parameters
     */
    trainCalibration(dataPoints: CalibrationDataPoint[], method: string): void;
    /**
     * Get calibration diagnostics
     */
    getDiagnostics(): Record<string, any>;
    /**
     * Export calibration parameters
     */
    exportParameters(): Record<string, any>;
}
//# sourceMappingURL=ConfidenceCalibrator.d.ts.map