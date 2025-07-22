/**
 * Location Database for GROUP 2B WebSearch Enhancement
 * Contains common misspellings, abbreviations, and regional variations
 */
export interface LocationCorrection {
    correct: string;
    variations: string[];
    type: 'city' | 'state' | 'region';
    metadata?: {
        state?: string;
        population?: number;
        zipCodes?: string[];
    };
}
export interface StateInfo {
    name: string;
    abbreviation: string;
    variations: string[];
    majorCities: string[];
    regionalTerms: string[];
}
export interface ServiceTerminology {
    region: string;
    terms: {
        [service: string]: string[];
    };
}
export declare class LocationDatabase {
    private static readonly CITY_CORRECTIONS;
    private static readonly STATE_INFO;
    private static readonly SERVICE_TERMINOLOGY;
    /**
     * Correct location spelling
     */
    static correctLocation(input: string): {
        corrected: string;
        confidence: number;
    };
    /**
     * Get state abbreviation
     */
    static getStateAbbreviation(state: string): string | null;
    /**
     * Get major cities for a state
     */
    static getMajorCities(state: string): string[];
    /**
     * Get regional service terminology
     */
    static getRegionalTerms(region: string, service: string): string[];
    /**
     * Determine region from state
     */
    static getRegionFromState(state: string): string;
    /**
     * Simple fuzzy matching algorithm
     */
    private static fuzzyMatch;
    /**
     * Get city metadata
     */
    static getCityMetadata(city: string): any;
    /**
     * Validate zip code format
     */
    static validateZipCode(zip: string): boolean;
}
//# sourceMappingURL=locationDatabase.d.ts.map