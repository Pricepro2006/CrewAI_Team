/**
 * AdaptiveDeliveryManager - Temporary placeholder implementation
 * TODO: Implement full adaptive delivery system
 */
import type { ResponseEvaluationResult, DeliveredResponse as TypedDeliveredResponse } from './types';
export interface DeliveryOptions {
    includeConfidenceScore?: boolean;
    includeSourceAttribution?: boolean;
    includeUncertaintyWarnings?: boolean;
    includeEvidence?: boolean;
    confidenceFormat?: 'percentage' | 'detailed';
}
export type DeliveredResponse = TypedDeliveredResponse;
export declare class AdaptiveDeliveryManager {
    private deliveryHistory;
    /**
     * Deliver response with adaptive formatting
     */
    deliver(evaluation: ResponseEvaluationResult, options: DeliveryOptions): Promise<DeliveredResponse>;
    /**
     * Capture user feedback
     */
    captureFeedback(feedbackId: string, feedback: any): void;
    /**
     * Export delivery history
     */
    exportHistory(): any[];
    /**
     * Get delivery statistics
     */
    getDeliveryStats(): Record<string, any>;
    private getConfidenceCategory;
    private generateWarnings;
    private extractUncertaintyAreas;
}
//# sourceMappingURL=AdaptiveDeliveryManager.d.ts.map