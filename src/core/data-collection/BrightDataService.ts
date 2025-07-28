/**
 * Bright Data Service
 * Integrates with MCP Bright Data tools for comprehensive data collection
 */

import { logger } from "../../utils/logger.js";
import type {
  DataSource,
  DataCollectionJob,
  CollectedData,
  BrightDataCredentials,
  SearchEngineParams,
  WebScrapingParams,
  EcommerceScrapingParams,
  SocialMediaParams,
  DataPipelineStats,
} from "./types.js";

// Import MCP Bright Data tool types
interface MCPBrightDataTool {
  searchEngine: (params: { query: string; engine?: string; cursor?: string }) => Promise<any>;
  scrapeAsMarkdown: (params: { url: string }) => Promise<{ content: string }>;
  scrapeAsHtml: (params: { url: string }) => Promise<{ content: string }>;
  extract: (params: { url: string; extraction_prompt?: string }) => Promise<any>;
  webDataAmazonProduct: (params: { url: string }) => Promise<any>;
  webDataAmazonProductSearch: (params: { keyword: string; url: string; pages_to_search?: string }) => Promise<any>;
  webDataWalmartProduct: (params: { url: string }) => Promise<any>;
  webDataEbayProduct: (params: { url: string }) => Promise<any>;
  webDataLinkedinPersonProfile: (params: { url: string }) => Promise<any>;
  webDataInstagramProfiles: (params: { url: string }) => Promise<any>;
  webDataTiktokProfiles: (params: { url: string }) => Promise<any>;
}

export class BrightDataService {
  private credentials: BrightDataCredentials;
  private rateLimitTracker = new Map<string, number[]>();
  private mcpTools: MCPBrightDataTool;

  constructor(credentials: BrightDataCredentials, mcpTools?: MCPBrightDataTool) {
    this.credentials = credentials;
    
    // If no MCP tools provided, create a mock implementation for development
    this.mcpTools = mcpTools || {
      searchEngine: async () => ({ results: [] }),
      scrapeAsMarkdown: async () => ({ content: "" }),
      scrapeAsHtml: async () => ({ content: "" }),
      extract: async () => ({}),
      webDataAmazonProduct: async () => ({}),
      webDataAmazonProductSearch: async () => ({ products: [] }),
      webDataWalmartProduct: async () => ({}),
      webDataEbayProduct: async () => ({}),
      webDataLinkedinPersonProfile: async () => ({}),
      webDataInstagramProfiles: async () => ({}),
      webDataTiktokProfiles: async () => ({}),
    };
  }

  /**
   * Search Engine Data Collection
   * Uses MCP Bright Data search engine tools
   */
  async collectSearchResults(
    params: SearchEngineParams,
  ): Promise<CollectedData[]> {
    try {
      logger.info("Starting search engine data collection", "BRIGHT_DATA", {
        params,
      });

      // Rate limiting check
      if (!this.checkRateLimit("search_engine")) {
        throw new Error("Rate limit exceeded for search engine requests");
      }

      // Call the actual MCP Bright Data search engine tool
      const searchResults = await this.mcpTools.searchEngine({
        query: params.query,
        engine: params.engine || "google",
        cursor: params.cursor,
      });

      const results: CollectedData[] = [
        {
          id: `search_${Date.now()}`,
          sourceId: "search_engine",
          jobId: `job_${Date.now()}`,
          data: {
            query: params.query,
            engine: params.engine || "google",
            results: searchResults.results || [],
            cursor: searchResults.cursor,
            timestamp: new Date(),
            metadata: {
              totalResults: searchResults.results?.length || 0,
              location: params.location,
              language: params.language,
              hasMore: !!searchResults.cursor,
            },
          },
          extractedAt: new Date(),
          tags: ["search", params.engine || "google"],
          quality: "high",
        },
      ];

      logger.info("Search engine data collection completed", "BRIGHT_DATA", {
        recordsCollected: results.length,
        actualResults: searchResults.results?.length || 0,
      });

      return results;
    } catch (error) {
      logger.error("Search engine data collection failed", "BRIGHT_DATA", {
        error,
      });
      throw error;
    }
  }

  /**
   * Web Scraping Data Collection
   * Uses MCP Bright Data scraping tools
   */
  async collectWebScrapingData(
    params: WebScrapingParams,
  ): Promise<CollectedData[]> {
    try {
      logger.info("Starting web scraping data collection", "BRIGHT_DATA", {
        params,
      });

      if (!this.checkRateLimit("web_scraping")) {
        throw new Error("Rate limit exceeded for web scraping requests");
      }

      // Call actual MCP Bright Data scraping tools
      const markdownResult = await this.mcpTools.scrapeAsMarkdown({ url: params.url });
      const htmlResult = await this.mcpTools.scrapeAsHtml({ url: params.url });
      
      let extractedData;
      if (params.extractionPrompt) {
        extractedData = await this.mcpTools.extract({ 
          url: params.url, 
          extraction_prompt: params.extractionPrompt 
        });
      }

      const results: CollectedData[] = [
        {
          id: `scrape_${Date.now()}`,
          sourceId: "web_scraping",
          jobId: `job_${Date.now()}`,
          data: {
            url: params.url,
            content: {
              markdown: markdownResult.content || "",
              html: htmlResult.content || "",
              extractedData: extractedData || undefined,
            },
            timestamp: new Date(),
            metadata: {
              followLinks: params.followLinks,
              maxDepth: params.maxDepth,
              respectRobots: params.respectRobots,
              contentLength: {
                markdown: markdownResult.content?.length || 0,
                html: htmlResult.content?.length || 0,
              },
            },
          },
          extractedAt: new Date(),
          tags: ["web_scraping", "html", "markdown"],
          quality: "high",
        },
      ];

      logger.info("Web scraping data collection completed", "BRIGHT_DATA", {
        recordsCollected: results.length,
        contentLengths: {
          markdown: markdownResult.content?.length || 0,
          html: htmlResult.content?.length || 0,
        },
      });

      return results;
    } catch (error) {
      logger.error("Web scraping data collection failed", "BRIGHT_DATA", {
        error,
      });
      throw error;
    }
  }

  /**
   * E-commerce Data Collection
   * Uses MCP Bright Data e-commerce tools
   */
  async collectEcommerceData(
    params: EcommerceScrapingParams,
  ): Promise<CollectedData[]> {
    try {
      logger.info("Starting e-commerce data collection", "BRIGHT_DATA", {
        params,
      });

      if (!this.checkRateLimit("ecommerce")) {
        throw new Error("Rate limit exceeded for e-commerce requests");
      }

      const results: CollectedData[] = [];

      // Platform-specific data collection using MCP tools
      switch (params.platform) {
        case "amazon":
          if (params.productUrl) {
            // Use mcp__Bright_Data__web_data_amazon_product
            results.push(await this.collectAmazonProduct(params.productUrl));
          }
          if (params.searchKeyword) {
            // Use mcp__Bright_Data__web_data_amazon_product_search
            results.push(
              ...(await this.collectAmazonSearch(
                params.searchKeyword,
                params.maxProducts,
              )),
            );
          }
          break;

        case "walmart":
          if (params.productUrl) {
            // Use mcp__Bright_Data__web_data_walmart_product
            results.push(await this.collectWalmartProduct(params.productUrl));
          }
          break;

        case "ebay":
          if (params.productUrl) {
            // Use mcp__Bright_Data__web_data_ebay_product
            results.push(await this.collectEbayProduct(params.productUrl));
          }
          break;

        default:
          throw new Error(
            `Unsupported e-commerce platform: ${params.platform}`,
          );
      }

      logger.info("E-commerce data collection completed", "BRIGHT_DATA", {
        platform: params.platform,
        recordsCollected: results.length,
      });

      return results;
    } catch (error) {
      logger.error("E-commerce data collection failed", "BRIGHT_DATA", {
        error,
      });
      throw error;
    }
  }

  /**
   * Social Media Data Collection
   * Uses MCP Bright Data social media tools
   */
  async collectSocialMediaData(
    params: SocialMediaParams,
  ): Promise<CollectedData[]> {
    try {
      logger.info("Starting social media data collection", "BRIGHT_DATA", {
        params,
      });

      if (!this.checkRateLimit("social_media")) {
        throw new Error("Rate limit exceeded for social media requests");
      }

      const results: CollectedData[] = [];

      // Platform-specific data collection
      switch (params.platform) {
        case "linkedin":
          if (params.profileUrl) {
            // Use mcp__Bright_Data__web_data_linkedin_person_profile
            results.push(await this.collectLinkedInProfile(params.profileUrl));
          }
          break;

        case "instagram":
          if (params.profileUrl) {
            // Use mcp__Bright_Data__web_data_instagram_profiles
            results.push(await this.collectInstagramProfile(params.profileUrl));
          }
          break;

        case "tiktok":
          if (params.profileUrl) {
            // Use mcp__Bright_Data__web_data_tiktok_profiles
            results.push(await this.collectTikTokProfile(params.profileUrl));
          }
          break;

        default:
          throw new Error(
            `Unsupported social media platform: ${params.platform}`,
          );
      }

      logger.info("Social media data collection completed", "BRIGHT_DATA", {
        platform: params.platform,
        recordsCollected: results.length,
      });

      return results;
    } catch (error) {
      logger.error("Social media data collection failed", "BRIGHT_DATA", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get Pipeline Statistics
   */
  async getPipelineStats(): Promise<DataPipelineStats> {
    try {
      // This would query the database for actual statistics
      // For now, return mock data structure
      return {
        totalSources: 0,
        activeSources: 0,
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        recordsCollected: 0,
        lastActivity: new Date(),
      };
    } catch (error) {
      logger.error("Failed to get pipeline stats", "BRIGHT_DATA", { error });
      throw error;
    }
  }

  // Private helper methods for specific platforms

  private async collectAmazonProduct(url: string): Promise<CollectedData> {
    const productData = await this.mcpTools.webDataAmazonProduct({ url });
    
    return {
      id: `amazon_${Date.now()}`,
      sourceId: "amazon_products",
      jobId: `job_${Date.now()}`,
      data: {
        platform: "amazon",
        url,
        product: productData,
        timestamp: new Date(),
      },
      extractedAt: new Date(),
      tags: ["ecommerce", "amazon", "product"],
      quality: "high",
    };
  }

  private async collectAmazonSearch(
    keyword: string,
    maxProducts?: number,
  ): Promise<CollectedData[]> {
    const searchData = await this.mcpTools.webDataAmazonProductSearch({
      keyword,
      url: "https://www.amazon.com",
      pages_to_search: maxProducts ? Math.ceil(maxProducts / 16).toString() : "1",
    });

    return [
      {
        id: `amazon_search_${Date.now()}`,
        sourceId: "amazon_search",
        jobId: `job_${Date.now()}`,
        data: {
          platform: "amazon",
          keyword,
          maxProducts,
          products: searchData.products || [],
          timestamp: new Date(),
        },
        extractedAt: new Date(),
        tags: ["ecommerce", "amazon", "search"],
        quality: "high",
      },
    ];
  }

  private async collectWalmartProduct(url: string): Promise<CollectedData> {
    const productData = await this.mcpTools.webDataWalmartProduct({ url });
    
    return {
      id: `walmart_${Date.now()}`,
      sourceId: "walmart_products",
      jobId: `job_${Date.now()}`,
      data: {
        platform: "walmart",
        url,
        product: productData,
        timestamp: new Date(),
      },
      extractedAt: new Date(),
      tags: ["ecommerce", "walmart", "product"],
      quality: "high",
    };
  }

  private async collectEbayProduct(url: string): Promise<CollectedData> {
    const productData = await this.mcpTools.webDataEbayProduct({ url });
    
    return {
      id: `ebay_${Date.now()}`,
      sourceId: "ebay_products",
      jobId: `job_${Date.now()}`,
      data: {
        platform: "ebay",
        url,
        product: productData,
        timestamp: new Date(),
      },
      extractedAt: new Date(),
      tags: ["ecommerce", "ebay", "product"],
      quality: "high",
    };
  }

  private async collectLinkedInProfile(url: string): Promise<CollectedData> {
    const profileData = await this.mcpTools.webDataLinkedinPersonProfile({ url });
    
    return {
      id: `linkedin_${Date.now()}`,
      sourceId: "linkedin_profiles",
      jobId: `job_${Date.now()}`,
      data: {
        platform: "linkedin",
        url,
        profile: profileData,
        timestamp: new Date(),
      },
      extractedAt: new Date(),
      tags: ["social_media", "linkedin", "profile"],
      quality: "high",
    };
  }

  private async collectInstagramProfile(url: string): Promise<CollectedData> {
    const profileData = await this.mcpTools.webDataInstagramProfiles({ url });
    
    return {
      id: `instagram_${Date.now()}`,
      sourceId: "instagram_profiles",
      jobId: `job_${Date.now()}`,
      data: {
        platform: "instagram",
        url,
        profile: profileData,
        timestamp: new Date(),
      },
      extractedAt: new Date(),
      tags: ["social_media", "instagram", "profile"],
      quality: "high",
    };
  }

  private async collectTikTokProfile(url: string): Promise<CollectedData> {
    const profileData = await this.mcpTools.webDataTiktokProfiles({ url });
    
    return {
      id: `tiktok_${Date.now()}`,
      sourceId: "tiktok_profiles",
      jobId: `job_${Date.now()}`,
      data: {
        platform: "tiktok",
        url,
        profile: profileData,
        timestamp: new Date(),
      },
      extractedAt: new Date(),
      tags: ["social_media", "tiktok", "profile"],
      quality: "high",
    };
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(operation: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = this.credentials.rateLimitPerMinute || 60;

    if (!this.rateLimitTracker.has(operation)) {
      this.rateLimitTracker.set(operation, []);
    }

    const requests = this.rateLimitTracker.get(operation)!;

    // Remove old requests outside the window
    while (requests.length > 0 && requests[0]! < now - windowMs) {
      requests.shift();
    }

    if (requests.length >= maxRequests) {
      return false;
    }

    requests.push(now);
    return true;
  }
}
