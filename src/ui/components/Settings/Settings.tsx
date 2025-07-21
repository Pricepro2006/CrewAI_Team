import React, { useState } from 'react';
import './Settings.css';

interface SettingsState {
  general: {
    theme: 'dark' | 'light';
    language: string;
    notifications: boolean;
  };
  llm: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    endpoint: string;
  };
  agents: {
    autoRoute: boolean;
    maxConcurrent: number;
    timeout: number;
  };
  rag: {
    chunkSize: number;
    chunkOverlap: number;
    embeddingModel: string;
    vectorStore: string;
  };
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>({
    general: {
      theme: 'dark',
      language: 'en',
      notifications: true
    },
    llm: {
      provider: 'ollama',
      model: 'granite3.3:2b',
      temperature: 0.7,
      maxTokens: 4096,
      endpoint: 'http://localhost:11434'
    },
    agents: {
      autoRoute: true,
      maxConcurrent: 3,
      timeout: 300
    },
    rag: {
      chunkSize: 1000,
      chunkOverlap: 200,
      embeddingModel: 'nomic-embed-text',
      vectorStore: 'chromadb'
    }
  });

  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      // TODO: Implement actual settings save
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveMessage('Settings saved successfully!');
      
      // Store in localStorage for now
      localStorage.setItem('crewai-settings', JSON.stringify(settings));
    } catch (error) {
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const updateSetting = (section: keyof SettingsState, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-description">
          Configure your CrewAI Team system preferences and integration settings.
        </p>
      </div>

      <div className="settings-content">
        <div className="settings-tabs">
          <button
            className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 1V8M12 16V23M4.22 4.22L7.64 7.64M16.36 16.36L19.78 19.78M1 12H8M16 12H23M4.22 19.78L7.64 16.36M16.36 7.64L19.78 4.22" stroke="currentColor" strokeWidth="2"/>
            </svg>
            General
          </button>
          <button
            className={`tab-button ${activeTab === 'llm' ? 'active' : ''}`}
            onClick={() => setActiveTab('llm')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7V12C2 16.5 4.23 20.68 12 22C19.77 20.68 22 16.5 22 12V7L12 2Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            LLM Config
          </button>
          <button
            className={`tab-button ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Agents
          </button>
          <button
            className={`tab-button ${activeTab === 'rag' ? 'active' : ''}`}
            onClick={() => setActiveTab('rag')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7H20" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 12H20" stroke="currentColor" strokeWidth="2"/>
              <path d="M4 17H20" stroke="currentColor" strokeWidth="2"/>
            </svg>
            RAG System
          </button>
        </div>

        <div className="settings-panel">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h2>General Settings</h2>
              
              <div className="setting-group">
                <label htmlFor="theme">Theme</label>
                <select
                  id="theme"
                  value={settings.general.theme}
                  onChange={(e) => updateSetting('general', 'theme', e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="setting-group">
                <label htmlFor="language">Language</label>
                <select
                  id="language"
                  value={settings.general.language}
                  onChange={(e) => updateSetting('general', 'language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div className="setting-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.general.notifications}
                    onChange={(e) => updateSetting('general', 'notifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  Enable Notifications
                </label>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="settings-section">
              <h2>LLM Configuration</h2>
              
              <div className="setting-group">
                <label htmlFor="provider">Provider</label>
                <select
                  id="provider"
                  value={settings.llm.provider}
                  onChange={(e) => updateSetting('llm', 'provider', e.target.value)}
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="huggingface">Hugging Face</option>
                </select>
              </div>

              {settings.llm.provider === 'ollama' && (
                <>
                  <div className="setting-group">
                    <label htmlFor="model">Model</label>
                    <select
                      id="model"
                      value={settings.llm.model}
                      onChange={(e) => updateSetting('llm', 'model', e.target.value)}
                    >
                      <option value="phi3:mini">Phi-3 Mini</option>
                      <option value="qwen3:0.6b">Qwen 3 (0.6B)</option>
                      <option value="llama3.1:8b">Llama 3.1 (8B)</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label htmlFor="endpoint">Endpoint URL</label>
                    <input
                      id="endpoint"
                      type="text"
                      value={settings.llm.endpoint}
                      onChange={(e) => updateSetting('llm', 'endpoint', e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                </>
              )}

              <div className="setting-group">
                <label htmlFor="temperature">
                  Temperature: {settings.llm.temperature}
                </label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.llm.temperature}
                  onChange={(e) => updateSetting('llm', 'temperature', parseFloat(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label htmlFor="maxTokens">Max Tokens</label>
                <input
                  id="maxTokens"
                  type="number"
                  min="100"
                  max="32000"
                  value={settings.llm.maxTokens}
                  onChange={(e) => updateSetting('llm', 'maxTokens', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="settings-section">
              <h2>Agent Configuration</h2>
              
              <div className="setting-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.agents.autoRoute}
                    onChange={(e) => updateSetting('agents', 'autoRoute', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  Auto-route queries to best agent
                </label>
              </div>

              <div className="setting-group">
                <label htmlFor="maxConcurrent">
                  Max Concurrent Agents: {settings.agents.maxConcurrent}
                </label>
                <input
                  id="maxConcurrent"
                  type="range"
                  min="1"
                  max="10"
                  value={settings.agents.maxConcurrent}
                  onChange={(e) => updateSetting('agents', 'maxConcurrent', parseInt(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label htmlFor="timeout">
                  Agent Timeout (seconds)
                </label>
                <input
                  id="timeout"
                  type="number"
                  min="30"
                  max="600"
                  value={settings.agents.timeout}
                  onChange={(e) => updateSetting('agents', 'timeout', parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="settings-section">
              <h2>RAG System Configuration</h2>
              
              <div className="setting-group">
                <label htmlFor="chunkSize">Chunk Size</label>
                <input
                  id="chunkSize"
                  type="number"
                  min="100"
                  max="4000"
                  value={settings.rag.chunkSize}
                  onChange={(e) => updateSetting('rag', 'chunkSize', parseInt(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label htmlFor="chunkOverlap">Chunk Overlap</label>
                <input
                  id="chunkOverlap"
                  type="number"
                  min="0"
                  max="500"
                  value={settings.rag.chunkOverlap}
                  onChange={(e) => updateSetting('rag', 'chunkOverlap', parseInt(e.target.value))}
                />
              </div>

              <div className="setting-group">
                <label htmlFor="embeddingModel">Embedding Model</label>
                <select
                  id="embeddingModel"
                  value={settings.rag.embeddingModel}
                  onChange={(e) => updateSetting('rag', 'embeddingModel', e.target.value)}
                >
                  <option value="nomic-embed-text">Nomic Embed Text</option>
                  <option value="all-minilm-l6-v2">All-MiniLM-L6-v2</option>
                  <option value="bge-large-en-v1.5">BGE Large EN v1.5</option>
                </select>
              </div>

              <div className="setting-group">
                <label htmlFor="vectorStore">Vector Store</label>
                <select
                  id="vectorStore"
                  value={settings.rag.vectorStore}
                  onChange={(e) => updateSetting('rag', 'vectorStore', e.target.value)}
                >
                  <option value="chromadb">ChromaDB</option>
                  <option value="pinecone">Pinecone</option>
                  <option value="weaviate">Weaviate</option>
                  <option value="qdrant">Qdrant</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="settings-actions">
        <button className="reset-button">
          Reset to Defaults
        </button>
        <button 
          className="save-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <span className="spinner"></span>
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>

      {saveMessage && (
        <div className={`save-message ${saveMessage.includes('success') ? 'success' : 'error'}`}>
          {saveMessage}
        </div>
      )}
    </div>
  );
};

export default Settings;