/**
 * {{ModuleName}} - {{ModuleDescription}}
 * 
 * @module {{moduleName}}
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

// Constants
const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 3,
  cacheTTL: 300000, // 5 minutes
};

/**
 * {{ModuleName}} class
 * 
 * @extends EventEmitter
 * @example
 * ```javascript
 * const {{moduleName}} = new {{ModuleName}}({
 *   timeout: 5000,
 *   retries: 5
 * });
 * 
 * {{moduleName}}.on('ready', () => {
 *   console.log('Module is ready');
 * });
 * 
 * await {{moduleName}}.initialize();
 * const result = await {{moduleName}}.process(data);
 * ```
 */
class {{ModuleName}} extends EventEmitter {
  /**
   * Create a new {{ModuleName}} instance
   * @param {Object} config - Configuration options
   * @param {number} [config.timeout=30000] - Operation timeout in milliseconds
   * @param {number} [config.retries=3] - Number of retry attempts
   * @param {number} [config.cacheTTL=300000] - Cache time-to-live in milliseconds
   */
  constructor(config = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.isInitialized = false;
    this._cleanupTimer = null;
    
    // Bind methods
    this.process = this.process.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }
  
  /**
   * Initialize the module
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    if (this.isInitialized) {
      throw new Error('Module already initialized');
    }
    
    try {
      this.emit('initializing');
      
      // Perform initialization tasks
      await this._validateConfig();
      await this._setupResources();
      
      // Start cache cleanup timer
      this._cleanupTimer = setInterval(() => {
        this._cleanupCache();
      }, this.config.cacheTTL);
      
      this.isInitialized = true;
      this.emit('ready');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Process data
   * @param {*} data - Data to process
   * @param {Object} [options={}] - Processing options
   * @returns {Promise<*>} Processed result
   */
  async process(data, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Module not initialized');
    }
    
    const cacheKey = this._getCacheKey(data, options);
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.emit('cache:hit', cacheKey);
        return cached.value;
      }
    }
    
    // Process with retry logic
    let lastError;
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this._processWithTimeout(data, options);
        
        // Cache result
        this.cache.set(cacheKey, {
          value: result,
          timestamp: Date.now()
        });
        
        this.emit('processed', { data, result });
        return result;
      } catch (error) {
        lastError = error;
        this.emit('retry', { attempt, error });
        
        if (attempt < this.config.retries) {
          await this._delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    
    this.cache.clear();
    this.isInitialized = false;
    
    this.emit('cleanup');
  }
  
  // Private methods
  
  async _validateConfig() {
    if (typeof this.config.timeout !== 'number' || this.config.timeout <= 0) {
      throw new Error('Invalid timeout configuration');
    }
    
    if (typeof this.config.retries !== 'number' || this.config.retries < 0) {
      throw new Error('Invalid retries configuration');
    }
  }
  
  async _setupResources() {
    // Setup any required resources
    // e.g., database connections, file handles, etc.
  }
  
  async _processWithTimeout(data, options) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Processing timeout'));
      }, this.config.timeout);
      
      this._doProcess(data, options)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  async _doProcess(data, options) {
    // Implement actual processing logic
    // This is a placeholder implementation
    return {
      processed: true,
      data: data,
      timestamp: new Date().toISOString(),
      options: options
    };
  }
  
  _getCacheKey(data, options) {
    return JSON.stringify({ data, options });
  }
  
  _cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.emit('cache:cleanup', { cleaned });
    }
  }
  
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get module statistics
   * @returns {Object} Module statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.cache.size,
      config: this.config
    };
  }
}

// Export factory function
function create{{ModuleName}}(config) {
  return new {{ModuleName}}(config);
}

// CommonJS exports
module.exports = {{ModuleName}};
module.exports.{{ModuleName}} = {{ModuleName}};
module.exports.create{{ModuleName}} = create{{ModuleName}};