#!/usr/bin/env node
/**
 * Master Knowledge Base Indexing Script
 * 
 * This script scans the master knowledge base directory and indexes all content
 * into ChromaDB for intelligent context-aware responses.
 * 
 * Features:
 * - Recursive directory scanning
 * - Multiple file format support (md, txt, json, log, etc.)
 * - Metadata extraction and tagging
 * - Progress tracking and logging
 * - Error handling and recovery
 * - Deduplication and freshness tracking
 */

import fs from 'fs';
import path from 'path';
import { RAGSystem } from '../src/core/rag/RAGSystem.js';
import { logger } from '../src/utils/logger.js';

// Configuration
const MASTER_KB_PATH = '/home/pricepro2006/master_knowledge_base';
const BATCH_SIZE = 10; // Process files in batches
const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.json', '.log', '.csv', '.yml', '.yaml', '.sh', '.py', '.js', '.ts'];
const EXCLUDE_PATTERNS = ['node_modules', '.git', 'Zone.Identifier'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max file size

interface FileMetadata {
  filePath: string;
  fileName: string;
  extension: string;
  size: number;
  lastModified: Date;
  category: string;
  subcategory?: string;
  content: string;
}

interface IndexingStats {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  totalSize: number;
  startTime: Date;
  endTime?: Date;
  errors: Array<{ file: string; error: string }>;
}

class MasterKBIndexer {
  private ragSystem: RAGSystem;
  private stats: IndexingStats;
  
  constructor() {
    // Initialize RAG system with production config
    this.ragSystem = new RAGSystem({
      vectorStore: {
        type: 'chromadb',
        path: './data/chroma-knowledge-base',
        collectionName: 'master-knowledge-base',
        dimension: 384,
        baseUrl: 'http://localhost:8000'
      },
      chunking: {
        size: 1000,
        overlap: 100,
        method: 'sentence'
      },
      retrieval: {
        topK: 10,
        minScore: 0.3,
        reranking: true
      }
    });
    
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errorFiles: 0,
      totalSize: 0,
      startTime: new Date(),
      errors: []
    };
  }
  
  async initialize(): Promise<void> {
    logger.info('Initializing Master Knowledge Base indexer', 'KB_INDEXER');
    
    try {
      await this.ragSystem.initialize();
      logger.info('RAG system initialized successfully', 'KB_INDEXER');
      
      // Clear existing knowledge base collection to ensure fresh data
      const shouldClearExisting = process.argv.includes('--clear');
      if (shouldClearExisting) {
        logger.info('Clearing existing knowledge base collection', 'KB_INDEXER');
        await this.ragSystem.clear();
      }
      
    } catch (error) {
      logger.error('Failed to initialize RAG system', 'KB_INDEXER', error as Error);
      throw error;
    }
  }
  
  async scanDirectory(directoryPath: string): Promise<FileMetadata[]> {
    const files: FileMetadata[] = [];
    
    const scanRecursive = async (currentPath: string, category: string = ''): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          // Skip excluded patterns
          if (EXCLUDE_PATTERNS.some(pattern => entry.name.includes(pattern))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Recursively scan subdirectories
            const subCategory = category ? `${category}/${entry.name}` : entry.name;
            await scanRecursive(fullPath, subCategory);
          } else if (entry.isFile()) {
            const extension = path.extname(entry.name).toLowerCase();
            
            // Skip unsupported file types
            if (!SUPPORTED_EXTENSIONS.includes(extension)) {
              this.stats.skippedFiles++;
              continue;
            }
            
            try {
              const stat = await fs.promises.stat(fullPath);
              
              // Skip files that are too large
              if (stat.size > MAX_FILE_SIZE) {
                logger.warn(`Skipping large file: ${fullPath} (${this.formatFileSize(stat.size)})`, 'KB_INDEXER');
                this.stats.skippedFiles++;
                continue;
              }
              
              // Read file content
              const content = await fs.promises.readFile(fullPath, 'utf-8');
              
              const metadata: FileMetadata = {
                filePath: fullPath,
                fileName: entry.name,
                extension,
                size: stat.size,
                lastModified: stat.mtime,
                category: category || 'root',
                content: content.trim()
              };
              
              // Skip empty files
              if (!metadata.content) {
                this.stats.skippedFiles++;
                continue;
              }
              
              files.push(metadata);
              this.stats.totalSize += stat.size;
              
            } catch (error) {
              logger.error(`Error reading file: ${fullPath}`, 'KB_INDEXER', error as Error);
              this.stats.errors.push({
                file: fullPath,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              this.stats.errorFiles++;
            }
          }
        }
      } catch (error) {
        logger.error(`Error scanning directory: ${currentPath}`, 'KB_INDEXER', error as Error);
        this.stats.errors.push({
          file: currentPath,
          error: error instanceof Error ? error.message : 'Directory scan failed'
        });
      }
    };
    
    await scanRecursive(directoryPath);
    this.stats.totalFiles = files.length;
    
    logger.info(`Discovered ${files.length} files for indexing`, 'KB_INDEXER', {
      totalSize: this.formatFileSize(this.stats.totalSize),
      categories: [...new Set(files.map(f => f.category))],
      extensions: [...new Set(files.map(f => f.extension))]
    });
    
    return files;
  }
  
  async indexFiles(files: FileMetadata[]): Promise<void> {
    logger.info(`Starting to index ${files.length} files`, 'KB_INDEXER');
    
    // Process files in batches to avoid overwhelming the system
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.ceil((i + 1) / BATCH_SIZE);
      const totalBatches = Math.ceil(files.length / BATCH_SIZE);
      
      logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)`, 'KB_INDEXER');
      
      await Promise.allSettled(
        batch.map(file => this.indexSingleFile(file))
      );
      
      // Progress update
      const progress = Math.round(((i + batch.length) / files.length) * 100);
      logger.info(`Indexing progress: ${progress}% (${this.stats.processedFiles}/${files.length} files processed)`, 'KB_INDEXER');
    }
  }
  
  async indexSingleFile(file: FileMetadata): Promise<void> {
    try {
      // Create comprehensive metadata for the document
      const documentMetadata = {
        id: this.generateDocumentId(file.filePath),
        title: file.fileName,
        filePath: file.filePath,
        category: file.category,
        extension: file.extension,
        size: file.size,
        lastModified: file.lastModified.toISOString(),
        indexedAt: new Date().toISOString(),
        contentType: this.getContentType(file.extension),
        tags: this.extractTags(file),
        summary: this.generateSummary(file.content)
      };
      
      // Add document to RAG system
      await this.ragSystem.addDocument(file.content, documentMetadata);
      
      this.stats.processedFiles++;
      
      logger.debug(`Successfully indexed: ${file.fileName}`, 'KB_INDEXER', {
        category: file.category,
        size: this.formatFileSize(file.size)
      });
      
    } catch (error) {
      logger.error(`Failed to index file: ${file.fileName}`, 'KB_INDEXER', error as Error);
      this.stats.errors.push({
        file: file.filePath,
        error: error instanceof Error ? error.message : 'Indexing failed'
      });
      this.stats.errorFiles++;
    }
  }
  
  private generateDocumentId(filePath: string): string {
    // Generate a consistent ID based on file path
    return Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '');
  }
  
  private getContentType(extension: string): string {
    const typeMap: Record<string, string> = {
      '.md': 'markdown',
      '.txt': 'text',
      '.json': 'json',
      '.log': 'log',
      '.csv': 'csv',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.sh': 'shell_script',
      '.py': 'python',
      '.js': 'javascript',
      '.ts': 'typescript'
    };
    
    return typeMap[extension] || 'text';
  }
  
  private extractTags(file: FileMetadata): string[] {
    const tags: string[] = [];
    
    // Add category-based tags
    if (file.category) {
      tags.push(...file.category.split('/'));
    }
    
    // Add content-based tags
    const content = file.content.toLowerCase();
    const keywordTagMap: Record<string, string> = {
      'agent': 'ai-agents',
      'llm': 'language-models',
      'rag': 'retrieval-augmented-generation',
      'chroma': 'vector-database',
      'embedding': 'embeddings',
      'typescript': 'typescript',
      'javascript': 'javascript',
      'python': 'python',
      'react': 'react',
      'nodejs': 'nodejs',
      'api': 'api',
      'database': 'database',
      'sql': 'sql',
      'security': 'security',
      'testing': 'testing',
      'deployment': 'deployment',
      'docker': 'docker',
      'git': 'version-control',
      'workflow': 'workflows',
      'automation': 'automation'
    };
    
    for (const [keyword, tag] of Object.entries(keywordTagMap)) {
      if (content.includes(keyword)) {
        tags.push(tag);
      }
    }
    
    // Add file type tags
    tags.push(`file-type-${file.extension.slice(1)}`);
    
    return [...new Set(tags)]; // Remove duplicates
  }
  
  private generateSummary(content: string): string {
    // Generate a simple summary from the first few lines
    const lines = content.split('\n').filter(line => line.trim());
    const firstLines = lines.slice(0, 3).join(' ');
    
    return firstLines.length > 200 
      ? firstLines.substring(0, 197) + '...'
      : firstLines;
  }
  
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  async generateReport(): Promise<void> {
    this.stats.endTime = new Date();
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    
    logger.info('Master Knowledge Base indexing completed!', 'KB_INDEXER', {
      totalFiles: this.stats.totalFiles,
      processedFiles: this.stats.processedFiles,
      skippedFiles: this.stats.skippedFiles,
      errorFiles: this.stats.errorFiles,
      totalSize: this.formatFileSize(this.stats.totalSize),
      duration: `${Math.round(duration / 1000)}s`,
      successRate: `${Math.round((this.stats.processedFiles / this.stats.totalFiles) * 100)}%`
    });
    
    if (this.stats.errors.length > 0) {
      logger.warn(`${this.stats.errors.length} errors occurred during indexing:`, 'KB_INDEXER');
      this.stats.errors.forEach(error => {
        logger.warn(`- ${error.file}: ${error.error}`, 'KB_INDEXER');
      });
    }
    
    // Get RAG system stats
    try {
      const ragStats = await this.ragSystem.getStats();
      logger.info('RAG System Statistics:', 'KB_INDEXER', {
        totalDocuments: ragStats.totalDocuments,
        totalChunks: ragStats.totalChunks,
        averageChunksPerDoc: ragStats.averageChunksPerDocument,
        vectorStoreType: ragStats.vectorStoreType,
        embeddingModel: ragStats.embeddingModel
      });
    } catch (error) {
      logger.warn('Could not retrieve RAG stats', 'KB_INDEXER', error as Error);
    }
  }
  
  async testSearch(): Promise<void> {
    logger.info('Testing knowledge base search functionality', 'KB_INDEXER');
    
    const testQueries = [
      'agent orchestration patterns',
      'RAG implementation',
      'typescript configuration',
      'security best practices',
      'database migration'
    ];
    
    for (const query of testQueries) {
      try {
        const results = await this.ragSystem.search(query, 3);
        logger.info(`Search test: "${query}" returned ${results.length} results`, 'KB_INDEXER', {
          topResult: results[0] ? {
            score: results[0].score,
            source: results[0].metadata?.title || 'Unknown'
          } : null
        });
      } catch (error) {
        logger.error(`Search test failed for query: "${query}"`, 'KB_INDEXER', error as Error);
      }
    }
  }
}

// Main execution
async function main() {
  const indexer = new MasterKBIndexer();
  
  try {
    // Initialize the indexer
    await indexer.initialize();
    
    // Check if master KB directory exists
    if (!fs.existsSync(MASTER_KB_PATH)) {
      throw new Error(`Master knowledge base directory not found: ${MASTER_KB_PATH}`);
    }
    
    // Scan the directory structure
    const files = await indexer.scanDirectory(MASTER_KB_PATH);
    
    if (files.length === 0) {
      logger.warn('No indexable files found in master knowledge base', 'KB_INDEXER');
      return;
    }
    
    // Index all discovered files
    await indexer.indexFiles(files);
    
    // Generate final report
    await indexer.generateReport();
    
    // Test search functionality
    await indexer.testSearch();
    
    logger.info('Master Knowledge Base indexing process completed successfully!', 'KB_INDEXER');
    
  } catch (error) {
    logger.error('Master Knowledge Base indexing failed', 'KB_INDEXER', error as Error);
    process.exit(1);
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { MasterKBIndexer };