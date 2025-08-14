/**
 * JSON Serialization Optimization Utilities for tRPC API
 * High-performance JSON processing with streaming and compression
 */

import { logger } from "./logger.js";
import { Transform, Readable } from "stream";
import { promisify } from "util";
import { pipeline } from "stream";

const pipelineAsync = promisify(pipeline);

/**
 * JSON serialization performance configuration
 */
export interface JSONOptimizationConfig {
  enableStreaming: boolean;
  streamThreshold: number; // Size threshold for streaming (bytes)
  chunkSize: number; // Chunk size for streaming
  enableCompression: boolean;
  maxDepth: number;
  maxArrayLength: number;
  enableCircularDetection: boolean;
  customReplacer?: (key: string, value: any) => any;
  prettyPrint: boolean;
}

const defaultConfig: JSONOptimizationConfig = {
  enableStreaming: true,
  streamThreshold: 10 * 1024, // 10KB
  chunkSize: 1024, // 1KB chunks
  enableCompression: true,
  maxDepth: 10,
  maxArrayLength: 10000,
  enableCircularDetection: true,
  prettyPrint: false,
};

/**
 * High-performance JSON serializer with optimization features
 */
export class OptimizedJSONSerializer {
  private config: JSONOptimizationConfig;
  private circularRefs = new WeakSet();

  constructor(config: Partial<JSONOptimizationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Serialize data with optimizations based on size and complexity
   */
  async serialize(data: any): Promise<string | Readable> {
    const startTime = Date.now();
    
    try {
      // Quick size estimation
      const estimatedSize = this.estimateSize(data);
      
      if (this.config.enableStreaming && estimatedSize > this.config.streamThreshold) {
        logger.debug("Using streaming serialization", "JSON_OPTIMIZATION", {
          estimatedSize,
          threshold: this.config.streamThreshold,
        });
        return this.streamingSerialize(data);
      } else {
        const result = this.synchronousSerialize(data);
        const serializationTime = Date.now() - startTime;
        
        logger.debug("Synchronous serialization completed", "JSON_OPTIMIZATION", {
          dataSize: result.length,
          serializationTime,
        });
        
        return result;
      }
    } catch (error) {
      const serializationTime = Date.now() - startTime;
      logger.error("JSON serialization failed", "JSON_OPTIMIZATION", {
        error,
        serializationTime,
      });
      throw error;
    }
  }

  /**
   * Synchronous serialization with optimizations
   */
  private synchronousSerialize(data: any): string {
    if (this.config.enableCircularDetection) {
      this.circularRefs = new WeakSet();
    }

    const replacer = this.createOptimizedReplacer();
    
    if (this.config.prettyPrint) {
      return JSON.stringify(data, replacer, 2);
    } else {
      return JSON.stringify(data, replacer);
    }
  }

  /**
   * Streaming serialization for large datasets
   */
  private streamingSerialize(data: any): Readable {
    const stream = new JSONStream(this.config);
    
    // Start serialization asynchronously
    process.nextTick(() => {
      try {
        stream.writeData(data);
        stream.push(null); // Signal end of stream
      } catch (error) {
        stream.destroy(error as Error);
      }
    });
    
    return stream;
  }

  /**
   * Create optimized JSON replacer function
   */
  private createOptimizedReplacer(): (key: string, value: any) => any {
    let depth = 0;
    
    return (key: string, value: any) => {
      // Handle depth limiting
      if (depth > this.config.maxDepth) {
        return '[Maximum depth exceeded]';
      }
      
      // Handle circular references
      if (this.config.enableCircularDetection && 
          value !== null && 
          typeof value === 'object') {
        if (this.circularRefs.has(value)) {
          return '[Circular Reference]';
        }
        this.circularRefs.add(value);
      }
      
      // Handle large arrays
      if (Array.isArray(value) && value.length > this.config.maxArrayLength) {
        const truncated = value.slice(0, this.config.maxArrayLength);
        truncated.push(`[... ${value.length - this.config.maxArrayLength} more items]`);
        return truncated;
      }
      
      // Apply custom replacer if provided
      if (this.config.customReplacer) {
        value = this.config.customReplacer(key, value);
      }
      
      // Optimize common patterns
      value = this.optimizeValue(key, value);
      
      if (key === '') {
        depth++;
      }
      
      return value;
    };
  }

  /**
   * Optimize individual values during serialization
   */
  private optimizeValue(key: string, value: any): any {
    // Remove null/undefined from objects to reduce size
    if (value === null || value === undefined) {
      return undefined; // Will be excluded from JSON
    }
    
    // Optimize numbers
    if (typeof value === 'number') {
      // Round floating point numbers to avoid precision issues
      if (!Number.isInteger(value) && Math.abs(value) < 1e10) {
        return Math.round(value * 1e6) / 1e6;
      }
    }
    
    // Optimize strings
    if (typeof value === 'string') {
      // Trim whitespace
      value = value.trim();
      
      // Convert empty strings to undefined for exclusion
      if (value === '') {
        return undefined;
      }
    }
    
    // Optimize dates
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    return value;
  }

  /**
   * Estimate serialized size without full serialization
   */
  private estimateSize(data: any, depth: number = 0): number {
    if (depth > 5) return 100; // Prevent deep recursion in estimation
    
    if (data === null || data === undefined) return 4; // "null"
    
    if (typeof data === 'boolean') return data ? 4 : 5; // "true" or "false"
    
    if (typeof data === 'number') return String(data).length;
    
    if (typeof data === 'string') return data.length + 2; // Add quotes
    
    if (Array.isArray(data)) {
      let size = 2; // []
      for (let i = 0; i < Math.min(data.length, 100); i++) { // Sample first 100 items
        size += this.estimateSize(data[i], depth + 1);
        if (i > 0) size += 1; // comma
      }
      return size * (data.length / Math.min(data.length, 100)); // Extrapolate
    }
    
    if (typeof data === 'object') {
      let size = 2; // {}
      let count = 0;
      
      for (const [key, value] of Object.entries(data)) {
        if (count >= 50) break; // Sample first 50 properties
        
        size += key.length + 3; // "key":
        size += this.estimateSize(value, depth + 1);
        if (count > 0) size += 1; // comma
        count++;
      }
      
      const totalKeys = Object.keys(data).length;
      return size * (totalKeys / Math.min(totalKeys, 50)); // Extrapolate
    }
    
    return 10; // Default estimate
  }
}

/**
 * Streaming JSON writer for large datasets
 */
class JSONStream extends Readable {
  private config: JSONOptimizationConfig;
  private buffer: string = '';
  private isObjectStarted: boolean = false;
  private isArrayStarted: boolean = false;
  private itemCount: number = 0;

  constructor(config: JSONOptimizationConfig) {
    super({ objectMode: false });
    this.config = config;
  }

  override _read(): void {
    // Readable stream interface implementation
  }

  writeData(data: any): void {
    try {
      if (Array.isArray(data)) {
        this.writeArray(data);
      } else if (typeof data === 'object' && data !== null) {
        this.writeObject(data);
      } else {
        this.writeValue(data);
      }
    } catch (error) {
      this.destroy(error as Error);
    }
  }

  private writeArray(array: any[]): void {
    this.push('[');
    this.isArrayStarted = true;
    
    for (let i = 0; i < array.length; i++) {
      if (i > 0) {
        this.push(',');
      }
      
      this.writeValue(array[i]);
      
      // Flush buffer periodically
      if (this.buffer.length > this.config.chunkSize) {
        this.flushBuffer();
      }
    }
    
    this.push(']');
    this.flushBuffer();
  }

  private writeObject(obj: Record<string, any>): void {
    this.push('{');
    this.isObjectStarted = true;
    
    const entries = Object.entries(obj);
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      
      const [key, value] = entry;
      
      if (i > 0) {
        this.push(',');
      }
      
      this.push(`"${this.escapeString(key)}":`);
      this.writeValue(value);
      
      // Flush buffer periodically
      if (this.buffer.length > this.config.chunkSize) {
        this.flushBuffer();
      }
    }
    
    this.push('}');
    this.flushBuffer();
  }

  private writeValue(value: any): void {
    if (value === null) {
      this.push('null');
    } else if (typeof value === 'boolean') {
      this.push(value ? 'true' : 'false');
    } else if (typeof value === 'number') {
      this.push(String(value));
    } else if (typeof value === 'string') {
      this.push(`"${this.escapeString(value)}"`);
    } else if (Array.isArray(value)) {
      this.writeArray(value);
    } else if (typeof value === 'object') {
      this.writeObject(value);
    } else {
      this.push('null');
    }
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  private flushBuffer(): void {
    if (this.buffer.length > 0) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  override push(chunk: string | null): boolean {
    if (chunk === null) {
      // End of stream
      if (this.buffer.length > 0) {
        super.push(this.buffer);
        this.buffer = '';
      }
      return super.push(null);
    }
    
    this.buffer += chunk;
    
    if (this.buffer.length >= this.config.chunkSize) {
      const result = super.push(this.buffer);
      this.buffer = '';
      return result;
    }
    
    return true;
  }
}

/**
 * JSON parsing optimizations
 */
export class OptimizedJSONParser {
  private config: JSONOptimizationConfig;

  constructor(config: Partial<JSONOptimizationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Parse JSON with optimizations and error handling
   */
  parse<T = any>(jsonString: string): T {
    const startTime = Date.now();
    
    try {
      // Basic validation
      if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Invalid JSON input');
      }
      
      // Size validation
      if (jsonString.length > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('JSON input too large');
      }
      
      const result = JSON.parse(jsonString, this.createReviver());
      const parseTime = Date.now() - startTime;
      
      logger.debug("JSON parsing completed", "JSON_OPTIMIZATION", {
        inputSize: jsonString.length,
        parseTime,
      });
      
      return result;
    } catch (error) {
      const parseTime = Date.now() - startTime;
      logger.error("JSON parsing failed", "JSON_OPTIMIZATION", {
        error,
        parseTime,
        inputLength: jsonString.length,
      });
      throw error;
    }
  }

  /**
   * Create JSON reviver function for parsing optimizations
   */
  private createReviver(): (key: string, value: any) => any {
    return (key: string, value: any) => {
      // Parse ISO date strings
      if (typeof value === 'string' && 
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Handle special values
      if (value === '[Circular Reference]') {
        return null;
      }
      
      if (typeof value === 'string' && value.startsWith('[Maximum depth exceeded]')) {
        return null;
      }
      
      return value;
    };
  }

  /**
   * Stream parse large JSON data
   */
  async streamParse<T = any>(stream: Readable): Promise<T> {
    let jsonString = '';
    
    for await (const chunk of stream) {
      jsonString += chunk.toString();
    }
    
    return this.parse<T>(jsonString);
  }
}

/**
 * JSON optimization utilities
 */
export const JSONOptimization = {
  /**
   * Minify JSON by removing unnecessary whitespace and null values
   */
  minify(obj: any): any {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (value === null || value === undefined || value === '') {
        return undefined;
      }
      return value;
    }));
  },

  /**
   * Compress large arrays by sampling
   */
  compressArray<T>(arr: T[], maxLength: number = 1000): T[] | { sample: T[]; total: number } {
    if (arr.length <= maxLength) {
      return arr;
    }
    
    // Sample evenly distributed items
    const step = arr.length / maxLength;
    const sample: T[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      const index = Math.floor(i * step);
      const item = arr[index];
      if (item !== undefined) {
        sample.push(item);
      }
    }
    
    return {
      sample,
      total: arr.length,
    };
  },

  /**
   * Optimize object by removing empty nested objects
   */
  removeEmptyObjects(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(this.removeEmptyObjects).filter(item => item !== null);
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = this.removeEmptyObjects(value);
        
        if (cleanedValue !== null && 
            !(typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0)) {
          cleaned[key] = cleanedValue;
        }
      }
      
      return Object.keys(cleaned).length > 0 ? cleaned : null;
    }
    
    return obj;
  },

  /**
   * Calculate JSON payload size
   */
  calculateSize(obj: any): { bytes: number; compressed: number } {
    const jsonString = JSON.stringify(obj);
    const bytes = Buffer.byteLength(jsonString, 'utf8');
    
    // Simulate compression ratio (actual compression would require zlib)
    const compressed = Math.floor(bytes * 0.3); // Estimated 70% compression
    
    return { bytes, compressed };
  },

  /**
   * Performance benchmark for different serialization strategies
   */
  benchmark(data: any, iterations: number = 100): {
    standard: number;
    optimized: number;
    streaming: number;
  } {
    const results = {
      standard: 0,
      optimized: 0,
      streaming: 0,
    };

    // Standard JSON.stringify
    const start1 = Date.now();
    for (let i = 0; i < iterations; i++) {
      JSON.stringify(data);
    }
    results.standard = Date.now() - start1;

    // Optimized serializer
    const serializer = new OptimizedJSONSerializer();
    const start2 = Date.now();
    for (let i = 0; i < iterations; i++) {
      serializer.serialize(data);
    }
    results.optimized = Date.now() - start2;

    // Streaming (just time estimation)
    const estimator = new OptimizedJSONSerializer({ enableStreaming: true });
    const start3 = Date.now();
    for (let i = 0; i < iterations; i++) {
      estimator['estimateSize'](data);
    }
    results.streaming = Date.now() - start3;

    return results;
  },
};

/**
 * JSON middleware for tRPC with optimization
 */
export function createJSONOptimizationMiddleware(config?: Partial<JSONOptimizationConfig>) {
  const serializer = new OptimizedJSONSerializer(config);
  const parser = new OptimizedJSONParser(config);

  return async ({ next, input }: { next: () => Promise<any>; input: any }) => {
    // Optimize input if it's a large object
    if (input && typeof input === 'object') {
      input = JSONOptimization.removeEmptyObjects(input);
    }

    const result = await next();

    // Optimize output for large responses
    if (result && typeof result === 'object') {
      const size = JSONOptimization.calculateSize(result);
      
      if (size.bytes > (config?.streamThreshold || defaultConfig.streamThreshold)) {
        logger.debug("Large response detected, applying optimizations", "JSON_OPTIMIZATION", {
          originalSize: size.bytes,
          estimatedCompressed: size.compressed,
        });
        
        return JSONOptimization.removeEmptyObjects(result);
      }
    }

    return result;
  };
}

// Export singleton instances
export const optimizedJSONSerializer = new OptimizedJSONSerializer();
export const optimizedJSONParser = new OptimizedJSONParser();