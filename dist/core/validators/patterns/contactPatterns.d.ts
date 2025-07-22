/**
 * Contact Information Validation Patterns
 * Comprehensive regex patterns for extracting business contact information
 */
export declare const ContactPatterns: {
    phone: {
        usStandard: RegExp;
        international: RegExp;
        tollFree: RegExp;
        generic: RegExp;
        getConfidence: (match: string) => number;
    };
    address: {
        streetAddress: RegExp;
        poBox: RegExp;
        unit: RegExp;
        cityStateZip: RegExp;
        fullAddress: RegExp;
        international: RegExp;
    };
    hours: {
        standard: RegExp;
        dayRange: RegExp;
        twentyFourSeven: RegExp;
        closed: RegExp;
        fullHours: RegExp;
    };
    businessName: {
        entityTypes: RegExp;
        withEntity: RegExp;
        standalone: RegExp;
        withSpecialChars: RegExp;
    };
    email: {
        standard: RegExp;
        withName: RegExp;
    };
    website: {
        url: RegExp;
        domain: RegExp;
    };
};
export declare const PatternHelpers: {
    /**
     * Extract all matches for a pattern with confidence scores
     */
    extractMatches: (text: string, pattern: RegExp, confidenceFunc?: (match: string) => number) => {
        value: string;
        confidence: number;
        index: number;
    }[];
    /**
     * Clean and normalize phone numbers
     */
    normalizePhone: (phone: string) => string;
    /**
     * Clean and normalize addresses
     */
    normalizeAddress: (address: string) => string;
    /**
     * Validate and score business names
     */
    scoreBusinessName: (name: string) => number;
};
export declare const ValidationRules: {
    phone: {
        minLength: number;
        maxLength: number;
        requiredDigits: number;
    };
    address: {
        minLength: number;
        maxLength: number;
        requiredComponents: string[];
    };
    businessName: {
        minLength: number;
        maxLength: number;
        minWords: number;
    };
    hours: {
        minLength: number;
        maxLength: number;
    };
};
//# sourceMappingURL=contactPatterns.d.ts.map