import React, { useState } from "react";
import { api } from "@/lib/trpc";
import "./VectorSearch.css";

interface SearchResult {
  id: string;
  content: string;
  metadata: {
    source?: string;
    title?: string;
    page?: number;
    timestamp?: string;
    [key: string]: any;
  };
  score: number;
}

export const VectorSearch: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topK, setTopK] = useState(10);

  // Create search query that we can trigger manually
  const searchQuery = api.rag.search.useQuery(
    {
      query: query.trim(),
      limit: topK,
    },
    {
      enabled: false, // Don't auto-run
    },
  );

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await searchQuery.refetch();

      if (response.data) {
        // Transform the RAG response to match our interface
        const transformedResults: SearchResult[] = response.data.map(
          (item: any, index: number) => ({
            id: item.metadata?.id || `result-${index}`,
            content: item.content || item.text || "No content available",
            metadata: {
              source:
                item.metadata?.title ||
                item.metadata?.source ||
                "Unknown source",
              title: item.metadata?.title,
              timestamp: item.metadata?.uploadedAt || item.metadata?.timestamp,
              ...item.metadata,
            },
            score: item.score || item.similarity || 0.5, // Fallback score if not provided
          }),
        );

        setResults(transformedResults);
      }
    } catch (err) {
      console.error("Vector search error:", err);
      setError(
        err instanceof Error ? err.message : "Search failed. Please try again.",
      );
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="vector-search-container">
      <div className="vector-search-header">
        <h1 className="vector-search-title">Vector Search</h1>
        <p className="vector-search-description">
          Semantic search powered by vector embeddings. Find relevant
          information using natural language queries.
        </p>
      </div>

      <div className="search-configuration">
        <h2>Search Configuration</h2>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="topk-input">Top K Results</label>
            <input
              id="topk-input"
              type="number"
              className="topk-input"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
              min="1"
              max="50"
            />
          </div>
        </div>
      </div>

      <div className="search-input-section">
        <h2>Semantic Search</h2>
        <div className="search-box">
          <textarea
            className="search-textarea"
            placeholder="Enter your search query in natural language..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
          >
            {isSearching ? (
              <>
                <span className="spinner"></span>
                Searching...
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
                Search
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="error-message"
          style={{
            backgroundColor: "#fee",
            border: "1px solid #f88",
            borderRadius: "4px",
            padding: "12px",
            margin: "16px 0",
            color: "#c33",
          }}
        >
          <strong>Search Error:</strong> {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results">
          <h2>Search Results ({results.length})</h2>
          <div className="results-list">
            {results.map((result) => (
              <div key={result.id} className="result-card">
                <div className="result-header">
                  <div className="result-metadata">
                    {result.metadata.source && (
                      <span className="metadata-item">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        {result.metadata.source}
                      </span>
                    )}
                    {result.metadata.page && (
                      <span className="metadata-item">
                        Page {result.metadata.page}
                      </span>
                    )}
                  </div>
                  <div className="result-score">
                    <span className="score-label">Relevance:</span>
                    <div className="score-bar">
                      <div
                        className="score-fill"
                        style={{ width: `${result.score * 100}%` }}
                      />
                    </div>
                    <span className="score-value">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="result-content">{result.content}</div>
                {result.metadata.timestamp && (
                  <div className="result-footer">
                    <span className="timestamp">
                      <svg
                        width="14"
                        height="14"
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
                      {new Date(result.metadata.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="info-section">
        <h2>How Vector Search Works</h2>
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="3"
                  width="7"
                  height="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="14"
                  y="3"
                  width="7"
                  height="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="3"
                  y="14"
                  width="7"
                  height="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="14"
                  y="14"
                  width="7"
                  height="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3>Embedding Generation</h3>
            <p>
              Documents are converted into high-dimensional vectors that capture
              semantic meaning.
            </p>
          </div>
          <div className="info-card">
            <div className="info-icon">
              <svg
                width="48"
                height="48"
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
            <h3>Similarity Search</h3>
            <p>
              Find documents with similar semantic meaning using cosine
              similarity.
            </p>
          </div>
          <div className="info-card">
            <div className="info-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3>Fast Retrieval</h3>
            <p>
              Optimized vector databases enable lightning-fast similarity
              searches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VectorSearch;
