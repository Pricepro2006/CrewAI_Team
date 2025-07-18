/**
 * Bright Data Service
 * Integrates with MCP Bright Data tools for comprehensive data collection
 */
import type { CollectedData, BrightDataCredentials, SearchEngineParams, WebScrapingParams, EcommerceScrapingParams, SocialMediaParams, DataPipelineStats } from "./types";
export declare class BrightDataService {
    private credentials;
    private rateLimitTracker;
    constructor(credentials: BrightDataCredentials);
    /**
     * Search Engine Data Collection
     * Uses MCP Bright Data search engine tools
     */
    collectSearchResults(params: SearchEngineParams): Promise<CollectedData[]>;
    /**
     * Web Scraping Data Collection
     * Uses MCP Bright Data scraping tools
     */
    collectWebScrapingData(params: WebScrapingParams): Promise<CollectedData[]>;
    /**
     * E-commerce Data Collection
     * Uses MCP Bright Data e-commerce tools
     */
    collectEcommerceData(params: EcommerceScrapingParams): Promise<CollectedData[]>;
    /**
     * Social Media Data Collection
     * Uses MCP Bright Data social media tools
     */
    collectSocialMediaData(params: SocialMediaParams): Promise<CollectedData[]>;
    /**
     * Get Pipeline Statistics
     */
    getPipelineStats(): Promise<DataPipelineStats>;
    private collectAmazonProduct;
    private collectAmazonSearch;
    private collectWalmartProduct;
    private collectEbayProduct;
    private collectLinkedInProfile;
    private collectInstagramProfile;
    private collectTikTokProfile;
    /**
     * Rate limiting check
     */
    private checkRateLimit;
}
//# sourceMappingURL=BrightDataService.d.ts.map