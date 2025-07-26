/**
 * Bright Data Service
 * Integrates with MCP Bright Data tools for comprehensive data collection
 */
import type { CollectedData, BrightDataCredentials, SearchEngineParams, WebScrapingParams, EcommerceScrapingParams, SocialMediaParams, DataPipelineStats } from "./types";
interface MCPBrightDataTool {
    searchEngine: (params: {
        query: string;
        engine?: string;
        cursor?: string;
    }) => Promise<any>;
    scrapeAsMarkdown: (params: {
        url: string;
    }) => Promise<{
        content: string;
    }>;
    scrapeAsHtml: (params: {
        url: string;
    }) => Promise<{
        content: string;
    }>;
    extract: (params: {
        url: string;
        extraction_prompt?: string;
    }) => Promise<any>;
    webDataAmazonProduct: (params: {
        url: string;
    }) => Promise<any>;
    webDataAmazonProductSearch: (params: {
        keyword: string;
        url: string;
        pages_to_search?: string;
    }) => Promise<any>;
    webDataWalmartProduct: (params: {
        url: string;
    }) => Promise<any>;
    webDataEbayProduct: (params: {
        url: string;
    }) => Promise<any>;
    webDataLinkedinPersonProfile: (params: {
        url: string;
    }) => Promise<any>;
    webDataInstagramProfiles: (params: {
        url: string;
    }) => Promise<any>;
    webDataTiktokProfiles: (params: {
        url: string;
    }) => Promise<any>;
}
export declare class BrightDataService {
    private credentials;
    private rateLimitTracker;
    private mcpTools;
    constructor(credentials: BrightDataCredentials, mcpTools?: MCPBrightDataTool);
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
export {};
//# sourceMappingURL=BrightDataService.d.ts.map