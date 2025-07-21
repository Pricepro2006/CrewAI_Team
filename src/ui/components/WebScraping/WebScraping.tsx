import React, { useState } from 'react';
import { trpcClient } from '../../App';
import './WebScraping.css';

export const WebScraping: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Using the dataCollection.scrapeWebsite endpoint
      const response = await trpcClient.dataCollection.scrapeWebsite.mutate({
        url: url.trim(),
        extractMetadata: true,
        extractLinks: true,
        extractImages: true
      });

      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to scrape website');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="web-scraping-container">
      <div className="web-scraping-header">
        <h1 className="web-scraping-title">Web Scraping</h1>
        <p className="web-scraping-description">
          Extract structured data from websites using our advanced scraping capabilities powered by Bright Data.
        </p>
      </div>

      <div className="scraping-input-section">
        <div className="input-group">
          <input
            type="url"
            className="url-input"
            placeholder="Enter website URL (e.g., https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleScrape()}
          />
          <button 
            className="scrape-button"
            onClick={handleScrape}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Scraping...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12C21 16.97 16.97 21 12 21S3 16.97 3 12S7.03 3 12 3S21 7.03 21 12Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M3.6 9H20.4M3.6 15H20.4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 3C10.5 5.5 10.5 8.5 12 12C13.5 15.5 13.5 18.5 12 21" stroke="currentColor" strokeWidth="2"/>
                </svg>
                Scrape Website
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="scraping-results">
          <h2>Scraping Results</h2>
          
          {result.metadata && (
            <div className="result-section">
              <h3>Metadata</h3>
              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="label">Title:</span>
                  <span className="value">{result.metadata.title || 'N/A'}</span>
                </div>
                <div className="metadata-item">
                  <span className="label">Description:</span>
                  <span className="value">{result.metadata.description || 'N/A'}</span>
                </div>
                <div className="metadata-item">
                  <span className="label">Keywords:</span>
                  <span className="value">{result.metadata.keywords?.join(', ') || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {result.content && (
            <div className="result-section">
              <h3>Content Preview</h3>
              <div className="content-preview">
                {result.content.substring(0, 500)}...
              </div>
            </div>
          )}

          {result.links && result.links.length > 0 && (
            <div className="result-section">
              <h3>Links Found ({result.links.length})</h3>
              <div className="links-list">
                {result.links.slice(0, 10).map((link: any, index: number) => (
                  <div key={index} className="link-item">
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.text || link.url}
                    </a>
                  </div>
                ))}
                {result.links.length > 10 && (
                  <div className="more-items">
                    ... and {result.links.length - 10} more links
                  </div>
                )}
              </div>
            </div>
          )}

          {result.images && result.images.length > 0 && (
            <div className="result-section">
              <h3>Images Found ({result.images.length})</h3>
              <div className="images-grid">
                {result.images.slice(0, 6).map((image: any, index: number) => (
                  <div key={index} className="image-item">
                    <img src={image.src} alt={image.alt || 'Image'} />
                  </div>
                ))}
                {result.images.length > 6 && (
                  <div className="more-items">
                    ... and {result.images.length - 6} more images
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="features-section">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7V12C2 16.5 4.23 20.68 7.62 21.94C9.17 22.55 10.5 22 12 22C13.5 22 14.83 22.55 16.38 21.94C19.77 20.68 22 16.5 22 12V7L12 2Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h3>Secure & Reliable</h3>
            <p>Powered by Bright Data&apos;s enterprise-grade infrastructure with built-in proxy rotation.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 2L12 7L8 2" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h3>Structured Data</h3>
            <p>Automatically extracts and structures content, metadata, links, and images.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 1V6M12 18V23M4.22 4.22L6.34 6.34M17.66 17.66L19.78 19.78M1 12H6M18 12H23M4.22 19.78L6.34 17.66M17.66 6.34L19.78 4.22" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h3>AI-Powered</h3>
            <p>Intelligent content extraction with automatic categorization and summarization.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Fast & Efficient</h3>
            <p>Optimized for speed with parallel processing and smart caching.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebScraping;
