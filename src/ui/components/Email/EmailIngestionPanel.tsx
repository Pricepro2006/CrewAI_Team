import React, { useState, useRef } from 'react';
import { Upload, Database, Cloud, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { api } from '../../../lib/trpc.js';
import './EmailIngestionPanel.css';

interface IngestionProgress {
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  queued: number;
}

export const EmailIngestionPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'json' | 'database' | 'api'>('json');
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const utils = api.useContext();
  const ingestMutation = api.emails.ingestEmails.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setProgress(result.data);
        // Invalidate email queries to refresh the dashboard
        utils.emails.getTableData.invalidate();
        utils.emails.getDashboardStats.invalidate();
        utils.emails.getAnalytics.invalidate();
      }
    },
    onError: (error) => {
      setError(error.message);
      setIsIngesting(false);
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsIngesting(true);
    setError(null);
    setProgress(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await ingestMutation.mutateAsync({
        source: 'json',
        data: data
      });
      
      setIsIngesting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON file');
      setIsIngesting(false);
    }
  };

  const handleDatabaseIngestion = async () => {
    setIsIngesting(true);
    setError(null);
    setProgress(null);

    try {
      await ingestMutation.mutateAsync({
        source: 'database',
        data: {
          // Add any database query parameters here
          limit: 1000,
          offset: 0
        }
      });
      
      setIsIngesting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest from database');
      setIsIngesting(false);
    }
  };

  const handleApiIngestion = async () => {
    setIsIngesting(true);
    setError(null);
    setProgress(null);

    try {
      await ingestMutation.mutateAsync({
        source: 'api',
        data: {
          // Add API configuration here (e.g., Microsoft Graph token, Gmail API credentials)
          provider: 'microsoft_graph',
          limit: 100
        }
      });
      
      setIsIngesting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest from API');
      setIsIngesting(false);
    }
  };

  return (
    <div className="email-ingestion-panel">
      <h3 className="panel-title">Email Data Ingestion</h3>
      
      <div className="ingestion-tabs">
        <button
          className={`tab ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
          disabled={isIngesting}
        >
          <Upload size={16} />
          JSON File
        </button>
        <button
          className={`tab ${activeTab === 'database' ? 'active' : ''}`}
          onClick={() => setActiveTab('database')}
          disabled={isIngesting}
        >
          <Database size={16} />
          Database
        </button>
        <button
          className={`tab ${activeTab === 'api' ? 'active' : ''}`}
          onClick={() => setActiveTab('api')}
          disabled={isIngesting}
        >
          <Cloud size={16} />
          API
        </button>
      </div>

      <div className="ingestion-content">
        {activeTab === 'json' && (
          <div className="json-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={isIngesting}
            />
            <button
              className="upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isIngesting}
            >
              {isIngesting ? (
                <>
                  <Loader size={20} className="spinning" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload JSON File
                </>
              )}
            </button>
            <p className="help-text">
              Upload a JSON file containing email data to process
            </p>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="database-ingestion">
            <button
              className="ingest-button"
              onClick={handleDatabaseIngestion}
              disabled={isIngesting}
            >
              {isIngesting ? (
                <>
                  <Loader size={20} className="spinning" />
                  Ingesting...
                </>
              ) : (
                <>
                  <Database size={20} />
                  Ingest from Database
                </>
              )}
            </button>
            <p className="help-text">
              Pull emails from the configured database
            </p>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="api-ingestion">
            <button
              className="ingest-button"
              onClick={handleApiIngestion}
              disabled={isIngesting}
            >
              {isIngesting ? (
                <>
                  <Loader size={20} className="spinning" />
                  Fetching...
                </>
              ) : (
                <>
                  <Cloud size={20} />
                  Fetch from API
                </>
              )}
            </button>
            <p className="help-text">
              Pull emails from Microsoft Graph or Gmail API
            </p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {progress && (
          <div className="progress-info">
            <CheckCircle size={16} className="success-icon" />
            <div className="progress-details">
              <p>Ingestion completed!</p>
              <div className="progress-stats">
                <span>Total: {progress.total}</span>
                <span>Processed: {progress.processed}</span>
                <span>Failed: {progress.failed}</span>
                <span>Queued: {progress.queued}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};