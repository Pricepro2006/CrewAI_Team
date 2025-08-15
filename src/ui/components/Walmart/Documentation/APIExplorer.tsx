/**
 * API Explorer Component
 * Interactive documentation and testing interface for Walmart Grocery Agent APIs
 * Provides real-time API testing, documentation, and code generation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Code,
  Play,
  Copy,
  Download,
  BookOpen,
  Settings,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Key,
  FileText
} from 'lucide-react';
import { api } from '../../../utils/trpc';
import './Documentation.css';

interface APIEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  category: string;
  parameters?: APIParameter[];
  requestBody?: APISchema;
  responses: Record<string, APIResponse>;
  examples: APIExample[];
  authentication?: boolean;
  deprecated?: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
}

interface APIParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
  example?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface APISchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, APIParameter>;
  required?: string[];
  example?: any;
}

interface APIResponse {
  description: string;
  schema: APISchema;
  example: any;
}

interface APIExample {
  name: string;
  description: string;
  request: {
    parameters?: Record<string, any>;
    body?: any;
  };
  response: {
    status: number;
    data: any;
  };
}

interface TestResult {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
  error?: string;
}

const API_ENDPOINTS: APIEndpoint[] = [
  {
    id: 'nlp-query',
    name: 'Process NLP Query',
    method: 'POST',
    path: '/api/walmart/nlp-query',
    description: 'Process natural language queries for product search and information extraction',
    category: 'NLP',
    authentication: true,
    parameters: [],
    requestBody: {
      type: 'object',
      properties: {
        text: {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Natural language query text',
          example: 'Find organic milk under $5'
        },
        context: {
          name: 'context',
          type: 'object',
          required: false,
          description: 'Optional context for query processing',
          example: { previousQueries: [], userPreferences: {} }
        }
      },
      required: ['text']
    },
    responses: {
      '200': {
        description: 'Successful NLP processing',
        schema: {
          type: 'object',
          properties: {
            intent: { name: 'intent', type: 'object', required: true, description: 'Detected intent' },
            entities: { name: 'entities', type: 'array', required: true, description: 'Extracted entities' },
            confidence: { name: 'confidence', type: 'number', required: true, description: 'Confidence score' }
          }
        },
        example: {
          intent: { type: 'search', confidence: 0.95 },
          entities: [{ type: 'product', value: 'organic milk', confidence: 0.9 }],
          confidence: 0.92
        }
      }
    },
    examples: [
      {
        name: 'Basic Product Search',
        description: 'Search for organic milk products',
        request: {
          body: {
            text: 'Find organic milk under $5',
            context: {
              userPreferences: {
                favoriteStores: ['Walmart Supercenter']
              }
            }
          }
        },
        response: {
          status: 200,
          data: {
            intent: { type: 'search', confidence: 0.95 },
            entities: [
              { type: 'product', value: 'organic milk', confidence: 0.9 },
              { type: 'price', value: '5', confidence: 0.85 }
            ],
            confidence: 0.92
          }
        }
      }
    ],
    rateLimit: {
      requests: 100,
      window: '1 minute'
    }
  },
  {
    id: 'product-search',
    name: 'Search Products',
    method: 'GET',
    path: '/api/walmart/search',
    description: 'Search for products with advanced filtering and sorting',
    category: 'Products',
    authentication: false,
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query term',
        example: 'organic milk'
      },
      {
        name: 'category',
        type: 'string',
        required: false,
        description: 'Product category filter',
        enum: ['dairy', 'produce', 'meat', 'bakery', 'frozen'],
        example: 'dairy'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Maximum number of results',
        default: 20,
        validation: { min: 1, max: 100 },
        example: 20
      },
      {
        name: 'sortBy',
        type: 'string',
        required: false,
        description: 'Sort field',
        enum: ['relevance', 'price', 'name', 'savings'],
        default: 'relevance',
        example: 'price'
      }
    ],
    responses: {
      '200': {
        description: 'Successful product search',
        schema: {
          type: 'object',
          properties: {
            products: { name: 'products', type: 'array', required: true, description: 'Array of products' },
            totalResults: { name: 'totalResults', type: 'number', required: true, description: 'Total number of results' },
            metadata: { name: 'metadata', type: 'object', required: false, description: 'Search metadata' }
          }
        },
        example: {
          products: [
            {
              id: 'prod-123',
              name: 'Organic Whole Milk',
              price: 4.99,
              category: 'dairy',
              inStock: true
            }
          ],
          totalResults: 42,
          metadata: {
            processingTime: 150,
            source: 'api'
          }
        }
      }
    },
    examples: [
      {
        name: 'Search Organic Products',
        description: 'Find organic dairy products sorted by price',
        request: {
          parameters: {
            query: 'organic',
            category: 'dairy',
            sortBy: 'price',
            limit: 10
          }
        },
        response: {
          status: 200,
          data: {
            products: [
              {
                id: 'prod-123',
                name: 'Organic Whole Milk',
                price: 4.99,
                category: 'dairy',
                inStock: true
              }
            ],
            totalResults: 8
          }
        }
      }
    ]
  }
];

export const APIExplorer: React.FC = () => {
  // State management
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testParameters, setTestParameters] = useState<Record<string, any>>({});
  const [testBody, setTestBody] = useState<string>('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['endpoints']));
  
  // Filter endpoints by category
  const filteredEndpoints = useMemo(() => {
    if (selectedCategory === 'all') {
      return API_ENDPOINTS;
    }
    return API_ENDPOINTS?.filter(endpoint => 
      endpoint?.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [selectedCategory]);
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(API_ENDPOINTS?.map(e => e.category)));
    return ['all', ...cats];
  }, []);
  
  /**
   * Toggle section expansion
   */
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);
  
  /**
   * Handle endpoint selection
   */
  const selectEndpoint = useCallback((endpoint: APIEndpoint) => {
    setSelectedEndpoint(endpoint);
    
    // Initialize test parameters with defaults
    const params: Record<string, any> = {};
    endpoint.parameters?.forEach(param => {
      if (param.default !== undefined) {
        params[param.name] = param.default;
      } else if (param.example !== undefined) {
        params[param.name] = param.example;
      }
    });
    setTestParameters(params);
    
    // Initialize request body with example
    if (endpoint.requestBody?.example) {
      setTestBody(JSON.stringify(endpoint?.requestBody?.example, null, 2));
    } else {
      setTestBody('');
    }
    
    setTestResult(null);
  }, []);
  
  /**
   * Update test parameter
   */
  const updateTestParameter = useCallback((name: string, value: any) => {
    setTestParameters(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);
  
  /**
   * Test API endpoint
   */
  const testAPIEndpoint = useCallback(async () => {
    if (!selectedEndpoint) return;
    
    setIsTestingAPI(true);
    const startTime = Date.now();
    
    try {
      // Build request URL
      let url = selectedEndpoint.path;
      if (selectedEndpoint.method === 'GET' && Object.keys(testParameters).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(testParameters).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            searchParams.append(key, String(value));
          }
        });
        url += `?${searchParams.toString()}`;
      }
      
      // Build request options
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      };
      
      // Add request body for non-GET requests
      if (selectedEndpoint.method !== 'GET' && testBody) {
        try {
          options.body = testBody;
        } catch (error) {
          throw new Error('Invalid JSON in request body');
        }
      }
      
      // Make the request
      const response = await fetch(url, options);
      const endTime = Date.now();
      
      // Parse response
      let responseData;
      const contentType = response?.headers?.get('content-type');
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      // Build headers object
      const headers: Record<string, string> = {};
      response?.headers?.forEach((value, key) => {
        headers[key] = value;
      });
      
      const result: TestResult = {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers,
        timing: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        }
      };
      
      setTestResult(result);
      
    } catch (error) {
      const endTime = Date.now();
      setTestResult({
        status: 0,
        statusText: 'Request Failed',
        data: null,
        headers: {},
        timing: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsTestingAPI(false);
    }
  }, [selectedEndpoint, testParameters, testBody, authToken]);
  
  /**
   * Generate code example
   */
  const generateCodeExample = useCallback((language: 'javascript' | 'curl' | 'python') => {
    if (!selectedEndpoint) return '';
    
    const url = `${window?.location?.origin}${selectedEndpoint.path}`;
    
    switch (language) {
      case 'javascript':
        return `// Fetch API example
const response = await fetch('${url}', {
  method: '${selectedEndpoint.method}',
  headers: {
    'Content-Type': 'application/json',
    ${authToken ? `'Authorization': 'Bearer ${authToken}',` : ''}
  }${selectedEndpoint.method !== 'GET' && testBody ? `,
  body: JSON.stringify(${testBody})` : ''}
});

const data = await response.json();
console.log(data);`;
      
      case 'curl':
        let curlCommand = `curl -X ${selectedEndpoint.method} \\
  '${url}' \\
  -H 'Content-Type: application/json'`;
        
        if (authToken) {
          curlCommand += ` \\
  -H 'Authorization: Bearer ${authToken}'`;
        }
        
        if (selectedEndpoint.method !== 'GET' && testBody) {
          curlCommand += ` \\
  -d '${testBody}'`;
        }
        
        return curlCommand;
      
      case 'python':
        return `import requests
import json

url = '${url}'
headers = {
    'Content-Type': 'application/json',
    ${authToken ? `'Authorization': 'Bearer ${authToken}',` : ''}
}

${selectedEndpoint.method !== 'GET' && testBody ? `data = json.dumps(${testBody})

` : ''}response = requests.${selectedEndpoint?.method?.toLowerCase()}(url, headers=headers${selectedEndpoint.method !== 'GET' && testBody ? ', data=data' : ''})
print(response.json())`;
      
      default:
        return '';
    }
  }, [selectedEndpoint, testBody, authToken]);
  
  /**
   * Copy to clipboard
   */
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator?.clipboard?.writeText(text);
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);
  
  return (
    <div className="api-explorer">
      {/* Header */}
      <div className="explorer-header">
        <div className="header-title">
          <Code size={24} />
          <h1>Walmart Grocery API Explorer</h1>
        </div>
        
        <div className="header-controls">
          <div className="auth-section">
            <Key size={16} />
            <input
              type="password"
              placeholder="API Token (optional)"
              value={authToken}
              onChange={(e: any) => setAuthToken(e?.target?.value)}
              className="auth-input"
            />
          </div>
        </div>
      </div>
      
      <div className="explorer-layout">
        {/* Sidebar */}
        <div className="explorer-sidebar">
          {/* Category Filter */}
          <div className="category-filter">
            <h3>Categories</h3>
            <div className="category-list">
              {categories?.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`category-button ${
                    selectedCategory === category ? 'active' : ''
                  }`}
                >
                  {category === 'all' ? 'All APIs' : category}
                </button>
              ))}
            </div>
          </div>
          
          {/* Endpoints List */}
          <div className="endpoints-section">
            <div className="section-header" onClick={() => toggleSection('endpoints')}>
              {expandedSections.has('endpoints') ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <h3>Endpoints ({filteredEndpoints?.length || 0})</h3>
            </div>
            
            {expandedSections.has('endpoints') && (
              <div className="endpoints-list">
                {filteredEndpoints?.map(endpoint => (
                  <div
                    key={endpoint.id}
                    onClick={() => selectEndpoint(endpoint)}
                    className={`endpoint-item ${
                      selectedEndpoint?.id === endpoint.id ? 'selected' : ''
                    } ${endpoint.deprecated ? 'deprecated' : ''}`}
                  >
                    <div className="endpoint-header">
                      <span className={`method-badge method-${endpoint?.method?.toLowerCase()}`}>
                        {endpoint.method}
                      </span>
                      <span className="endpoint-name">{endpoint.name}</span>
                    </div>
                    <div className="endpoint-path">{endpoint.path}</div>
                    {endpoint.deprecated && (
                      <div className="deprecated-badge">Deprecated</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="explorer-content">
          {selectedEndpoint ? (
            <>
              {/* Endpoint Details */}
              <div className="endpoint-details">
                <div className="endpoint-title">
                  <span className={`method-badge method-${selectedEndpoint?.method?.toLowerCase()}`}>
                    {selectedEndpoint.method}
                  </span>
                  <h2>{selectedEndpoint.name}</h2>
                  {selectedEndpoint.authentication && (
                    <span className="auth-required-badge">
                      <Key size={12} /> Auth Required
                    </span>
                  )}
                </div>
                
                <p className="endpoint-description">{selectedEndpoint.description}</p>
                
                <div className="endpoint-info">
                  <div className="info-item">
                    <strong>Path:</strong> <code>{selectedEndpoint.path}</code>
                  </div>
                  {selectedEndpoint.rateLimit && (
                    <div className="info-item">
                      <strong>Rate Limit:</strong> {selectedEndpoint?.rateLimit?.requests} requests per {selectedEndpoint?.rateLimit?.window}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Test Interface */}
              <div className="test-interface">
                <h3>Test This API</h3>
                
                {/* Parameters */}
                {selectedEndpoint.parameters && selectedEndpoint?.parameters?.length > 0 && (
                  <div className="parameters-section">
                    <h4>Parameters</h4>
                    <div className="parameters-grid">
                      {selectedEndpoint?.parameters?.map(param => (
                        <div key={param.name} className="parameter-item">
                          <label className="parameter-label">
                            {param.name}
                            {param.required && <span className="required">*</span>}
                          </label>
                          <p className="parameter-description">{param.description}</p>
                          
                          {param.enum ? (
                            <select
                              value={testParameters[param.name] || ''}
                              onChange={(e: any) => updateTestParameter(param.name, e?.target?.value)}
                              className="parameter-input"
                            >
                              <option value="">Select...</option>
                              {param?.enum?.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              value={testParameters[param.name] || ''}
                              onChange={(e: any) => updateTestParameter(
                                param.name,
                                param.type === 'number' ? Number(e?.target?.value) : e?.target?.value
                              )}
                              placeholder={param.example ? String(param.example) : ''}
                              className="parameter-input"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Request Body */}
                {selectedEndpoint.requestBody && (
                  <div className="request-body-section">
                    <h4>Request Body</h4>
                    <textarea
                      value={testBody}
                      onChange={(e: any) => setTestBody(e?.target?.value)}
                      placeholder="Enter JSON request body..."
                      className="request-body-input"
                      rows={8}
                    />
                  </div>
                )}
                
                {/* Test Button */}
                <button
                  onClick={testAPIEndpoint}
                  disabled={isTestingAPI}
                  className="test-button"
                >
                  {isTestingAPI ? (
                    <>
                      <div className="spinner" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Test API
                    </>
                  )}
                </button>
              </div>
              
              {/* Test Results */}
              {testResult && (
                <div className="test-results">
                  <h3>Response</h3>
                  
                  <div className="response-header">
                    <div className="response-status">
                      <span className={`status-badge status-${Math.floor(testResult.status / 100)}`}>
                        {testResult.status} {testResult.statusText}
                      </span>
                      <span className="response-timing">
                        <Clock size={12} />
                        {testResult?.timing?.duration}ms
                      </span>
                    </div>
                  </div>
                  
                  {testResult.error ? (
                    <div className="error-message">
                      <AlertCircle size={16} />
                      {testResult.error}
                    </div>
                  ) : (
                    <div className="response-data">
                      <div className="data-header">
                        <span>Response Data</span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(testResult.data, null, 2))}
                          className="copy-button"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                      </div>
                      <pre className="response-json">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              
              {/* Code Examples */}
              <div className="code-examples">
                <h3>Code Examples</h3>
                
                <div className="code-tabs">
                  {['javascript', 'curl', 'python'].map(lang => (
                    <div key={lang} className="code-tab">
                      <div className="tab-header">
                        <h4>{lang.charAt(0).toUpperCase() + lang.slice(1)}</h4>
                        <button
                          onClick={() => copyToClipboard(generateCodeExample(lang as any))}
                          className="copy-button"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                      </div>
                      <pre className="code-block">
                        <code>{generateCodeExample(lang as any)}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="no-endpoint-selected">
              <div className="placeholder-content">
                <div className="placeholder-icon">
                  <BookOpen size={64} />
                </div>
                <h2>Select an API endpoint</h2>
                <p>Choose an endpoint from the sidebar to view documentation and test the API</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}