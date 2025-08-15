import { BaseTool } from "../base/BaseTool.js";
import type { ToolResult } from "../base/BaseTool.js";
import axios from "axios";
import * as cheerio from "cheerio";

export class WebScraperTool extends BaseTool {
  constructor() {
    super("web_scraper", "Extracts content from web pages", [
      {
        name: "url",
        type: "string",
        required: true,
        description: "URL to scrape",
        pattern: "^https?://.+",
      },
      {
        name: "selector",
        type: "string",
        required: false,
        description: "CSS selector to extract specific content",
        default: "body",
      },
      {
        name: "extractImages",
        type: "boolean",
        required: false,
        description: "Whether to extract image URLs",
        default: false,
      },
      {
        name: "extractLinks",
        type: "boolean",
        required: false,
        description: "Whether to extract link URLs",
        default: false,
      },
      {
        name: "cleanText",
        type: "boolean",
        required: false,
        description: "Whether to clean and format the text",
        default: true,
      },
    ]);
  }

  async execute(params: {
    url: string;
    selector?: string;
    extractImages?: boolean;
    extractLinks?: boolean;
    cleanText?: boolean;
  }): Promise<ToolResult> {
    const validation = this.validateParameters(params);
    if (!validation.valid) {
      return this.error(validation?.errors?.join(", "));
    }

    try {
      // Fetch the page
      const response = await axios.get(params.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
        },
        timeout: 30000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      const selector = params.selector || "body";

      // Extract main content
      const content = this.extractContent(
        $,
        selector,
        params.cleanText !== false,
      );

      // Extract additional data if requested
      const images = params.extractImages
        ? this.extractImages($, selector)
        : [];
      const links = params.extractLinks ? this.extractLinks($, selector) : [];

      // Extract metadata
      const metadata = this.extractMetadata($);

      return this.success({
        url: params.url,
        content,
        metadata,
        images,
        links,
        stats: {
          contentLength: content?.length || 0,
          imageCount: images?.length || 0,
          linkCount: links?.length || 0,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          return this.error(
            `HTTP ${error?.response?.status}: ${error?.response?.statusText}`,
          );
        } else if (error.request) {
          return this.error("No response received from server");
        }
      }
      return this.error(error as Error);
    }
  }

  private extractContent(
    $: cheerio.CheerioAPI,
    selector: string,
    clean: boolean,
  ): string {
    // Remove script and style elements
    $("script, style, noscript").remove();

    const element = $(selector);
    if (element?.length || 0 === 0) {
      return "";
    }

    let text = element.text();

    if (clean) {
      // Clean up the text
      text = text
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/\n{3,}/g, "\n\n") // Replace multiple newlines
        .trim();
    }

    return text;
  }

  private extractImages($: cheerio.CheerioAPI, selector: string): string[] {
    const images: string[] = [];
    const baseUrl = $("base").attr("href") || "";

    $(`${selector} img`).each((_, element) => {
      const src = $(element).attr("src");
      if (src) {
        const fullUrl = this.resolveUrl(src, baseUrl);
        if (fullUrl) {
          images.push(fullUrl);
        }
      }
    });

    return [...new Set(images)]; // Remove duplicates
  }

  private extractLinks($: cheerio.CheerioAPI, selector: string): string[] {
    const links: string[] = [];
    const baseUrl = $("base").attr("href") || "";

    $(`${selector} a`).each((_, element) => {
      const href = $(element).attr("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        const fullUrl = this.resolveUrl(href, baseUrl);
        if (fullUrl) {
          links.push(fullUrl);
        }
      }
    });

    return [...new Set(links)]; // Remove duplicates
  }

  private extractMetadata($: cheerio.CheerioAPI): Record<string, string> {
    const metadata: Record<string, string> = {};

    // Title
    metadata.title =
      $("title").text() ||
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      "";

    // Description
    metadata.description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      "";

    // Author
    metadata.author = $('meta[name="author"]').attr("content") || "";

    // Keywords
    metadata.keywords = $('meta[name="keywords"]').attr("content") || "";

    // Published date
    metadata.publishedDate =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="publish_date"]').attr("content") ||
      "";

    // Language
    metadata.language =
      $("html").attr("lang") ||
      $('meta[property="og:locale"]').attr("content") ||
      "";

    // Canonical URL
    metadata.canonical = $('link[rel="canonical"]').attr("href") || "";

    // Image
    metadata.image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      "";

    // Clean up empty values
    Object.keys(metadata).forEach((key: any) => {
      if (!metadata[key]) {
        delete metadata[key];
      }
    });

    return metadata;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
      if (url.startsWith("//")) {
        return "https:" + url;
      }
      if (baseUrl) {
        return new URL(url, baseUrl).href;
      }
      return url;
    } catch {
      return "";
    }
  }
}
