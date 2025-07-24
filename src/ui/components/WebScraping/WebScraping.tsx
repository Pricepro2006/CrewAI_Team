import React, { useState } from "react";
import { trpc } from "../../App";
import "./WebScraping.css";

interface WebScrapingResult {
  success: boolean;
  data: Array<{
    id: string;
    sourceId: string;
    jobId: string;
    data: {
      url: string;
      content: {
        markdown: string;
        html: string;
        extractedData?: Record<string, unknown>;
      };
      timestamp: Date;
      metadata: {
        followLinks: boolean;
        maxDepth: number;
        respectRobots: boolean;
        contentLength: {
          markdown: number;
          html: number;
        };
      };
    };
    extractedAt: Date;
    tags: string[];
    quality: string;
  }>;
  metadata: {
    totalRecords: number;
    url: string;
    timestamp: string;
    requestId: string;
  };
}

export const WebScraping: React.FC = () => {
  const [url, setUrl] = useState("");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [followLinks, setFollowLinks] = useState(false);
  const [maxDepth, setMaxDepth] = useState(1);
  const [respectRobots, setRespectRobots] = useState(true);
  const [activeTab, setActiveTab] = useState<"markdown" | "html" | "extracted">(
    "markdown",
  );
  const [result, setResult] = useState<WebScrapingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use mutation from tRPC
  const scrapeMutation = trpc.dataCollection.webScraping.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (error) => {
      setError(error.message || "Failed to scrape website");
      setResult(null);
    },
  });

  const handleScrape = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    try {
      // Validate URL format
      new URL(url.trim());
    } catch {
      setError("Please enter a valid URL (including http:// or https://)");
      return;
    }

    setError(null);
    setResult(null);

    // Call the mutation
    scrapeMutation.mutate({
      url: url.trim(),
      extractionPrompt: extractionPrompt.trim() || undefined,
      followLinks,
      maxDepth,
      respectRobots,
    });
  };

  return (
    <div className="web-scraping-container">
      <div className="web-scraping-header">
        <h1 className="web-scraping-title">Web Scraping</h1>
        <p className="web-scraping-description">
          Extract structured data from websites using our advanced scraping
          capabilities powered by Bright Data.
        </p>
      </div>

      <div className="scraping-input-section">
        <h2>Configure Web Scraping</h2>
        <div className="scraping-form">
          <div className="form-group">
            <label htmlFor="url-input">Website URL</label>
            <input
              id="url-input"
              type="url"
              className="url-input"
              placeholder="Enter website URL (e.g., https://example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleScrape()}
            />
          </div>

          <div className="form-group">
            <label htmlFor="extraction-prompt">
              Extraction Prompt (Optional)
              <span className="help-text">
                Specify what data to extract from the page
              </span>
            </label>
            <textarea
              id="extraction-prompt"
              className="extraction-prompt"
              placeholder="e.g., Extract all product names and prices"
              value={extractionPrompt}
              onChange={(e) => setExtractionPrompt(e.target.value)}
              rows={3}
            />
          </div>

          <div className="advanced-options">
            <h3>Advanced Options</h3>
            <div className="options-grid">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={followLinks}
                  onChange={(e) => setFollowLinks(e.target.checked)}
                />
                <span>Follow Links</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={respectRobots}
                  onChange={(e) => setRespectRobots(e.target.checked)}
                />
                <span>Respect robots.txt</span>
              </label>

              <div className="form-group inline">
                <label htmlFor="max-depth">Max Depth</label>
                <input
                  id="max-depth"
                  type="number"
                  min="1"
                  max="5"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value) || 1)}
                  className="depth-input"
                />
              </div>
            </div>
          </div>

          <button
            className="scrape-button"
            onClick={handleScrape}
            disabled={scrapeMutation.isLoading}
          >
            {scrapeMutation.isLoading ? (
              <>
                <span className="spinner"></span>
                Scraping with BrightData...
              </>
            ) : (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M21 12C21 16.97 16.97 21 12 21S3 16.97 3 12S7.03 3 12 3S21 7.03 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M3.6 9H20.4M3.6 15H20.4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 3C10.5 5.5 10.5 8.5 12 12C13.5 15.5 13.5 18.5 12 21"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                Scrape Website
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 8V12M12 16H12.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {error}
          </div>
        )}
      </div>

      {result && result.success && result.data.length > 0 && (
        <div className="scraping-results">
          <div className="results-header">
            <h2>Scraping Results</h2>
            <div className="results-metadata">
              <span className="metadata-badge">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 6V12L16 14"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                {new Date(result.metadata.timestamp).toLocaleString()}
              </span>
              <span className="metadata-badge">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="2"
                    y="7"
                    width="20"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16 2L12 7L8 2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                {result.data[0].quality} quality
              </span>
              <span className="metadata-badge">
                Request ID: {result.metadata.requestId}
              </span>
            </div>
          </div>

          {result.data.map((item) => (
            <div key={item.id} className="result-item">
              <div className="result-tabs">
                <button
                  className={`tab-button ${activeTab === "markdown" ? "active" : ""}`}
                  onClick={() => setActiveTab("markdown")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M7 11L7 17M7 11L10 14M7 11L4 14"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M11 17V11L14 17V11"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  Markdown (
                  {(item.data.content.markdown.length / 1024).toFixed(1)} KB)
                </button>
                <button
                  className={`tab-button ${activeTab === "html" ? "active" : ""}`}
                  onClick={() => setActiveTab("html")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polyline
                      points="16 18 22 12 16 6"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <polyline
                      points="8 6 2 12 8 18"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  HTML ({(item.data.content.html.length / 1024).toFixed(1)} KB)
                </button>
                {item.data.content.extractedData && (
                  <button
                    className={`tab-button ${activeTab === "extracted" ? "active" : ""}`}
                    onClick={() => setActiveTab("extracted")}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="8"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M21 21L16.65 16.65"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    Extracted Data
                  </button>
                )}
              </div>

              <div className="tab-content">
                {activeTab === "markdown" && (
                  <div className="content-preview markdown-preview">
                    <pre>
                      {item.data.content.markdown.substring(0, 2000)}
                      {item.data.content.markdown.length > 2000 &&
                        "...\n\n[Content truncated for preview]"}
                    </pre>
                  </div>
                )}

                {activeTab === "html" && (
                  <div className="content-preview html-preview">
                    <pre>
                      {item.data.content.html.substring(0, 2000)}
                      {item.data.content.html.length > 2000 &&
                        "...\n\n[Content truncated for preview]"}
                    </pre>
                  </div>
                )}

                {activeTab === "extracted" &&
                  item.data.content.extractedData && (
                    <div className="content-preview extracted-preview">
                      <pre>
                        {JSON.stringify(
                          item.data.content.extractedData,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
              </div>

              <div className="result-footer">
                <div className="tags">
                  {item.tags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="scraping-info">
                  <span className="info-item">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2L2 7L12 12L22 7L12 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M2 17L12 22L22 17"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M2 12L12 17L22 12"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    Max Depth: {item.data.metadata.maxDepth}
                  </span>
                  <span className="info-item">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2C13.6569 2 15 3.34315 15 5V11C15 12.6569 13.6569 14 12 14C10.3431 14 9 12.6569 9 11V5C9 3.34315 10.3431 2 12 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M19 11C19 14.866 15.866 18 12 18M5 11C5 14.866 8.13401 18 12 18M12 18V22"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    Respects robots.txt:{" "}
                    {item.data.metadata.respectRobots ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="features-section">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7V12C2 16.5 4.23 20.68 7.62 21.94C9.17 22.55 10.5 22 12 22C13.5 22 14.83 22.55 16.38 21.94C19.77 20.68 22 16.5 22 12V7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3>Secure & Reliable</h3>
            <p>
              Powered by Bright Data&apos;s enterprise-grade infrastructure with
              built-in proxy rotation.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="2"
                  y="7"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16 2L12 7L8 2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3>Structured Data</h3>
            <p>
              Automatically extracts and structures content, metadata, links,
              and images.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 1V6M12 18V23M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M1 12H6M18 12H23M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3>AI-Powered</h3>
            <p>
              Intelligent content extraction with automatic categorization and
              summarization.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Fast & Efficient</h3>
            <p>
              Optimized for speed with parallel processing and smart caching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebScraping;
