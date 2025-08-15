import React, { useState, useEffect } from "react";
import { api } from "../../../lib/trpc.js";
import "./KnowledgeBase.css";

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  status: "processing" | "indexed" | "error";
  chunks?: number;
  metadata?: any;
}

export const KnowledgeBase: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load real documents from the backend
  const documentsQuery = (api.rag as any).list.useQuery({
    limit: 100,
    offset: 0,
  });
  const statsQuery = (api.rag as any).stats.useQuery();

  useEffect(() => {
    if (documentsQuery.data) {
      const transformedDocs = documentsQuery?.data?.map((doc: any) => ({
        id: doc.id || doc.metadata?.id || "unknown",
        name: doc.metadata?.title || doc.title || "Untitled Document",
        type: doc.metadata?.mimeType || "text/plain",
        size: doc.metadata?.size || doc.content?.length || 0,
        uploadedAt: new Date(
          doc.metadata?.uploadedAt || doc.createdAt || Date.now(),
        ),
        status: "indexed" as const,
        chunks: doc.metadata?.chunks || 1,
        metadata: doc.metadata,
      }));
      setDocuments(transformedDocs);
    }
  }, [documentsQuery.data]);

  const uploadFileMutation = (api.rag as any).uploadFile.useMutation({
    onSuccess: () => {
      documentsQuery.refetch();
      setError(null);
    },
    onError: (error: any) => {
      setError(`Upload failed: ${error.message}`);
    },
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event?.target?.files;
    if (!files || files?.length || 0 === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        // Convert file to base64 for tRPC compatibility
        const base64 = await fileToBase64(file);

        await uploadFileMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          data: base64,
          metadata: {
            size: file.size,
            lastModified: new Date(file.lastModified).toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      // Clear the input
      event?.target?.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:text/plain;base64,")
        const base64 = result.split(",")[1];
        if (base64) {
          resolve(base64);
        } else {
          reject(new Error("Failed to extract base64 data from file"));
        }
      };
      reader.onerror = (error: any) => reject(error);
    });
  };

  const deleteDocumentMutation = (api.rag as any).delete.useMutation({
    onSuccess: () => {
      documentsQuery.refetch();
      setError(null);
    },
    onError: (error: any) => {
      setError(`Delete failed: ${error.message}`);
    },
  });

  // Create search mutation to handle search properly
  const searchMutation = (api.rag as any).search.useQuery(
    {
      query: searchQuery.trim(),
      limit: 5,
    },
    {
      enabled: false, // Don't auto-run, we'll trigger manually
    },
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await searchMutation.refetch();

      if (response.data) {
        const transformedResults = response?.data?.map(
          (item: any, index: number) => ({
            id: item.metadata?.id || `result-${index}`,
            documentName:
              item.metadata?.title ||
              item.metadata?.source ||
              "Unknown Document",
            chunk: item.content || item.text || "No content available",
            score: item.score || item.similarity || 0.5,
          }),
        );

        setSearchResults(transformedResults);
        setError(null);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults([]);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      await deleteDocumentMutation.mutateAsync({ documentId });
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const getStatusColor = (status: Document["status"]): string => {
    switch (status) {
      case "indexed":
        return "#10b981";
      case "processing":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="knowledge-base-container">
      <div className="knowledge-base-header">
        <h1 className="knowledge-base-title">Knowledge Base</h1>
        <p className="knowledge-base-description">
          Manage your documents and embeddings for RAG (Retrieval-Augmented
          Generation). Upload documents to build your knowledge base.
        </p>
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
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="upload-section">
        <h2>Upload Documents</h2>
        <div className="upload-area">
          <input
            type="file"
            id="file-upload"
            className="file-input"
            onChange={handleFileUpload}
            multiple
            accept=".pdf,.txt,.md,.docx,.html"
          />
          <label htmlFor="file-upload" className="upload-label">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www?.w3?.org/2000/svg"
            >
              <path
                d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="17 8 12 3 7 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="12"
                y1="3"
                x2="12"
                y2="15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isUploading ? (
              <span>Uploading...</span>
            ) : (
              <>
                <span>Drop files here or click to browse</span>
                <span className="file-types">
                  Supported: PDF, TXT, MD, DOCX, HTML
                </span>
              </>
            )}
          </label>
        </div>
      </div>

      <div className="search-section">
        <h2>Search Knowledge Base</h2>
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search your documents..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e?.target?.value)}
            onKeyPress={(e: any) => e.key === "Enter" && handleSearch()}
          />
          <button className="search-button" onClick={handleSearch}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www?.w3?.org/2000/svg"
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
          </button>
        </div>

        {searchResults?.length || 0 > 0 && (
          <div className="search-results">
            <h3>Search Results</h3>
            {searchResults?.map((result: any) => (
              <div key={result.id} className="search-result-item">
                <div className="result-header">
                  <span className="document-name">{result.documentName}</span>
                  <span className="relevance-score">Score: {result.score}</span>
                </div>
                <p className="result-content">{result.chunk}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="documents-section">
        <h2>Indexed Documents ({documents?.length || 0})</h2>
        <div className="documents-table">
          <div className="table-header">
            <div className="th-name">Name</div>
            <div className="th-size">Size</div>
            <div className="th-chunks">Chunks</div>
            <div className="th-status">Status</div>
            <div className="th-date">Uploaded</div>
            <div className="th-actions">Actions</div>
          </div>
          {documents?.map((doc: any) => (
            <div key={doc.id} className="table-row">
              <div className="td-name">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www?.w3?.org/2000/svg"
                >
                  <path
                    d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="14 2 14 8 20 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {doc.name}
              </div>
              <div className="td-size">{formatFileSize(doc.size)}</div>
              <div className="td-chunks">{doc.chunks || "-"}</div>
              <div className="td-status">
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(doc.status) }}
                >
                  {doc.status}
                </span>
              </div>
              <div className="td-date">
                {doc?.uploadedAt?.toLocaleDateString()}
              </div>
              <div className="td-actions">
                <button
                  className="action-button"
                  title="Delete"
                  onClick={() => handleDeleteDocument(doc.id)}
                  disabled={deleteDocumentMutation.isLoading}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www?.w3?.org/2000/svg"
                  >
                    <polyline
                      points="3 6 5 6 21 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <h3>Total Documents</h3>
          <div className="stat-value">
            {documentsQuery.isLoading ? "..." : documents?.length || 0}
          </div>
        </div>
        <div className="stat-card">
          <h3>Total Chunks</h3>
          <div className="stat-value">
            {documentsQuery.isLoading
              ? "..."
              : documents.reduce((sum: any, doc: any) => sum + (doc.chunks || 0), 0)}
          </div>
        </div>
        <div className="stat-card">
          <h3>Storage Used</h3>
          <div className="stat-value">
            {documentsQuery.isLoading
              ? "..."
              : formatFileSize(
                  documents.reduce((sum: any, doc: any) => sum + doc.size, 0),
                )}
          </div>
        </div>
        <div className="stat-card">
          <h3>Processing</h3>
          <div className="stat-value">
            {documentsQuery.isLoading
              ? "..."
              : documents?.filter((doc: any) => doc.status === "processing").length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
