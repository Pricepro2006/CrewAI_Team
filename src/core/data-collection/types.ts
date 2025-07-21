/**
 * Data Collection Pipeline Types
 * Defines interfaces for Bright Data integration and data processing
 */

export interface DataSource {
  id: string;
  name: string;
  type:
    | "web_scraping"
    | "search_engine"
    | "social_media"
    | "ecommerce"
    | "news";
  config: DataSourceConfig;
  status: "active" | "inactive" | "error";
  lastRun?: Date;
  createdAt: Date;
}

export interface DataSourceConfig {
  url?: string;
  keywords?: string[];
  maxResults?: number;
  frequency?: "hourly" | "daily" | "weekly" | "monthly";
  filters?: Record<string, any>;
  outputFormat?: "json" | "csv" | "markdown";
}

export interface DataCollectionJob {
  id: string;
  sourceId: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: Date;
  endTime?: Date;
  recordsCollected?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface CollectedData {
  id: string;
  sourceId: string;
  jobId: string;
  data: any;
  extractedAt: Date;
  processedAt?: Date;
  tags?: string[];
  quality?: "high" | "medium" | "low";
}

export interface DataProcessingRule {
  id: string;
  name: string;
  sourceTypes: string[];
  processor:
    | "text_extraction"
    | "data_cleaning"
    | "entity_extraction"
    | "sentiment_analysis";
  config: Record<string, any>;
  enabled: boolean;
}

export interface DataPipelineStats {
  totalSources: number;
  activeSources: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  recordsCollected: number;
  lastActivity?: Date;
}

export interface BrightDataCredentials {
  apiKey?: string;
  endpoint?: string;
  rateLimitPerMinute?: number;
}

export interface SearchEngineParams {
  query: string;
  engine?: "google" | "bing" | "yandex";
  maxResults?: number;
  location?: string;
  language?: string;
  cursor?: string;
}

export interface WebScrapingParams {
  url: string;
  extractionPrompt?: string;
  followLinks?: boolean;
  maxDepth?: number;
  respectRobots?: boolean;
}

export interface EcommerceScrapingParams {
  platform: "amazon" | "walmart" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
  productUrl?: string;
  searchKeyword?: string;
  maxProducts?: number;
}

export interface SocialMediaParams {
  platform: "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube";
  profileUrl?: string;
  searchTerm?: string;
  maxPosts?: number;
  includeComments?: boolean;
  includeMedia?: boolean;
}
