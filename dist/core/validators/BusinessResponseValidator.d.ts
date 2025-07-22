export interface ContactInfo {
    phones: PhoneInfo[];
    addresses: AddressInfo[];
    businessNames: BusinessNameInfo[];
    hours: HoursInfo[];
    emails: EmailInfo[];
    websites: WebsiteInfo[];
}
export interface PhoneInfo {
    value: string;
    normalized: string;
    type: 'us' | 'international' | 'tollFree' | 'unknown';
    confidence: number;
    index: number;
}
export interface AddressInfo {
    value: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    type: 'street' | 'poBox' | 'international';
    confidence: number;
    index: number;
}
export interface BusinessNameInfo {
    value: string;
    hasEntityType: boolean;
    confidence: number;
    index: number;
}
export interface HoursInfo {
    value: string;
    type: 'standard' | 'dayRange' | '24/7' | 'closed';
    days?: string[];
    times?: {
        open: string;
        close: string;
    };
    confidence: number;
    index: number;
}
export interface EmailInfo {
    value: string;
    domain: string;
    confidence: number;
    index: number;
}
export interface WebsiteInfo {
    value: string;
    domain: string;
    protocol: string;
    confidence: number;
    index: number;
}
export interface ValidationResult {
    isValid: boolean;
    hasActionableInfo: boolean;
    contactInfo: ContactInfo;
    confidence: number;
    missingInfo: string[];
    suggestions: string[];
}
export declare class BusinessResponseValidator {
    private privacyMode;
    private minConfidenceThreshold;
    constructor(options?: {
        privacyMode?: boolean;
        minConfidenceThreshold?: number;
    });
    /**
     * Validate a response and extract contact information
     */
    validateResponse(text: string): ValidationResult;
    /**
     * Extract all contact information from text
     */
    private extractContactInfo;
    /**
     * Extract phone numbers with type detection
     */
    private extractPhones;
    /**
     * Extract addresses with component parsing
     */
    private extractAddresses;
    /**
     * Extract business names with scoring
     */
    private extractBusinessNames;
    /**
     * Extract business hours
     */
    private extractHours;
    /**
     * Extract emails
     */
    private extractEmails;
    /**
     * Extract websites
     */
    private extractWebsites;
    /**
     * Helper methods
     */
    private maskPhone;
    private parseAddressComponents;
    private parseHours;
    private parseDayRange;
    private calculateOverallConfidence;
    private hasActionableContactInfo;
    private identifyMissingInfo;
    private generateSuggestions;
}
//# sourceMappingURL=BusinessResponseValidator.d.ts.map