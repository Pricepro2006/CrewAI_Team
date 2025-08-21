#!/usr/bin/env tsx

import fs from "fs/promises";
import path from "path";
import { logger } from "../src/utils/logger.js";
import { RAGSystem } from "../src/core/rag/RAGSystem.js";
import type { RAGConfig } from "../src/core/rag/types.js";
import { ChromaClient } from "chromadb";
import crypto from "crypto";

const KNOWLEDGE_BASE_PATH = "/home/pricepro2006/master_knowledge_base";
const BATCH_SIZE = 10; // Process files in batches to manage memory

// File extensions to index
const SUPPORTED_EXTENSIONS = [".md", ".txt", ".json"];
const EXCLUDED_PATTERNS = [":Zone.Identifier", ".git", "node_modules", ".env"];

interface IndexStats {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  totalChunks: number;
  errors: string[];
  startTime: number;
  endTime?: number;
}

class KnowledgeBaseIndexer {
  private ragSystem: RAGSystem;
  private stats: IndexStats;
  private chromaClient: ChromaClient | null = null;

  constructor() {
    // Configure RAG system with optimal settings
    const config: RAGConfig = {
      vectorStore: {
        type: "chromadb",
        baseUrl: "http://localhost:8000", // Default ChromaDB port
        collectionName: "master_knowledge_base",
        dimension: 768, // Standard dimension for most embedding models
      },
      chunking: {
        size: 1000, // Characters per chunk
        overlap: 200, // Overlap between chunks for context preservation
        method: "sentence", // Split by sentences for better semantic coherence
        trimWhitespace: true,
        preserveFormatting: true,
      },
      retrieval: {
        topK: 5,
        minScore: 0.7,
        reranking: true,
        diversityFactor: 0.3,
        boostRecent: true,
      },
    };

    this.ragSystem = new RAGSystem(config);
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      totalChunks: 0,
      errors: [],
      startTime: Date.now(),
    };
  }

  async initialize(): Promise<void> {
    logger.info("Initializing Knowledge Base Indexer...", "INDEXER");
    
    try {
      // Try to connect to ChromaDB directly
      this.chromaClient = new ChromaClient({
        path: "http://localhost:8000",
      });
      
      // Test connection
      await this.chromaClient.heartbeat();
      logger.info("ChromaDB connection successful", "INDEXER");
    } catch (error) {
      logger.warn(
        `ChromaDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}. Will use adaptive fallback.`,
        "INDEXER"
      );
      this.chromaClient = null;
    }

    // Initialize RAG system (will handle fallback automatically)
    await this.ragSystem.initialize();
    
    // Clear existing data for fresh indexing
    const shouldClear = await this.promptUser(
      "Do you want to clear existing indexed data? (y/n): "
    );
    
    if (shouldClear.toLowerCase() === 'y') {
      await this.ragSystem.clear();
      logger.info("Cleared existing index data", "INDEXER");
    }
  }

  private async promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(question);
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  private shouldIndexFile(filePath: string): boolean {
    // Check if file should be excluded
    for (const pattern of EXCLUDED_PATTERNS) {
      if (filePath.includes(pattern)) {
        return false;
      }
    }

    // Check if file has supported extension
    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function walk(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory() && !EXCLUDED_PATTERNS.some(p => entry.name.includes(p))) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }
    
    await walk(dir);
    return files;
  }

  private generateDocumentId(filePath: string): string {
    // Generate a deterministic ID based on file path
    return crypto
      .createHash('md5')
      .update(filePath)
      .digest('hex')
      .substring(0, 16);
  }

  private extractMetadata(filePath: string, content: string): Record<string, any> {
    const relativePath = path.relative(KNOWLEDGE_BASE_PATH, filePath);
    const stats = fs.statSync(filePath);
    
    // Extract category from directory structure
    const pathParts = relativePath.split(path.sep);
    const category = pathParts.length > 1 ? pathParts[0] : "general";
    const subcategory = pathParts.length > 2 ? pathParts[1] : undefined;
    
    // Attempt to extract title from markdown
    let title = path.basename(filePath, path.extname(filePath));
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }
    
    return {
      filePath: relativePath,
      fileName: path.basename(filePath),
      category,
      subcategory,
      title,
      fileType: path.extname(filePath).substring(1),
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      indexed: new Date().toISOString(),
    };
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Skip empty files
      if (!content.trim()) {
        this.stats.skippedFiles++;
        return;
      }
      
      // Generate document ID and metadata
      const documentId = this.generateDocumentId(filePath);
      const metadata = this.extractMetadata(filePath, content);
      
      // Add document to RAG system
      await this.ragSystem.addDocument(content, {
        id: documentId,
        ...metadata,
      });
      
      this.stats.processedFiles++;
      
      // Log progress every 10 files
      if (this.stats.processedFiles % 10 === 0) {
        logger.info(
          `Progress: ${this.stats.processedFiles}/${this.stats.totalFiles} files indexed`,
          "INDEXER"
        );
      }
    } catch (error) {
      const errorMsg = `Failed to process ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg, "INDEXER");
      this.stats.errors.push(errorMsg);
    }
  }

  private async processBatch(files: string[]): Promise<void> {
    const documents = [];
    
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (!content.trim()) {
          this.stats.skippedFiles++;
          continue;
        }
        
        const documentId = this.generateDocumentId(filePath);
        const metadata = this.extractMetadata(filePath, content);
        
        documents.push({
          content,
          metadata: {
            id: documentId,
            ...metadata,
          },
        });
        
        this.stats.processedFiles++;
      } catch (error) {
        const errorMsg = `Failed to read ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg, "INDEXER");
        this.stats.errors.push(errorMsg);
      }
    }
    
    if (documents.length > 0) {
      try {
        await this.ragSystem.addDocuments(documents);
        logger.info(
          `Batch processed: ${documents.length} documents indexed`,
          "INDEXER"
        );
      } catch (error) {
        const errorMsg = `Failed to index batch: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(errorMsg, "INDEXER");
        this.stats.errors.push(errorMsg);
      }
    }
  }

  async indexKnowledgeBase(): Promise<void> {
    logger.info(`Starting knowledge base indexing from: ${KNOWLEDGE_BASE_PATH}`, "INDEXER");
    
    try {
      // Get all files
      const allFiles = await this.getAllFiles(KNOWLEDGE_BASE_PATH);
      const filesToIndex = allFiles.filter(f => this.shouldIndexFile(f));
      
      this.stats.totalFiles = filesToIndex.length;
      this.stats.skippedFiles = allFiles.length - filesToIndex.length;
      
      logger.info(
        `Found ${this.stats.totalFiles} files to index (${this.stats.skippedFiles} skipped)`,
        "INDEXER"
      );
      
      // Process files in batches
      for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
        const batch = filesToIndex.slice(i, Math.min(i + BATCH_SIZE, filesToIndex.length));
        await this.processBatch(batch);
        
        // Log progress
        const progress = Math.min(i + BATCH_SIZE, filesToIndex.length);
        const percentage = Math.round((progress / filesToIndex.length) * 100);
        logger.info(
          `Progress: ${progress}/${filesToIndex.length} files (${percentage}%)`,
          "INDEXER"
        );
      }
      
      this.stats.endTime = Date.now();
      
      // Get final statistics from RAG system
      const ragStats = await this.ragSystem.getStats();
      this.stats.totalChunks = ragStats.totalChunks;
      
    } catch (error) {
      logger.error(
        `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "INDEXER"
      );
      throw error;
    }
  }

  async testRetrieval(): Promise<void> {
    logger.info("Testing retrieval with sample queries...", "INDEXER");
    
    const testQueries = [
      "CrewAI agent architecture",
      "ChromaDB integration",
      "TypeScript best practices",
      "LLM fine-tuning",
      "Email pipeline processing",
      "Walmart integration",
      "RAG system implementation",
      "WebSocket real-time updates",
    ];
    
    for (const query of testQueries) {
      try {
        logger.info(`Testing query: "${query}"`, "INDEXER");
        const results = await this.ragSystem.search(query, 3);
        
        if (results.length > 0) {
          logger.info(`Found ${results.length} results:`, "INDEXER");
          results.forEach((result, index) => {
            logger.info(
              `  ${index + 1}. Score: ${result.score.toFixed(3)} | ` +
              `File: ${result.metadata?.fileName || 'Unknown'} | ` +
              `Category: ${result.metadata?.category || 'Unknown'}`,
              "INDEXER"
            );
          });
        } else {
          logger.warn(`No results found for query: "${query}"`, "INDEXER");
        }
      } catch (error) {
        logger.error(
          `Query failed for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          "INDEXER"
        );
      }
    }
  }

  printStats(): void {
    const duration = this.stats.endTime 
      ? ((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2)
      : "N/A";
    
    console.log("\n" + "=".repeat(60));
    console.log("INDEXING COMPLETE - SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Files Found:     ${this.stats.totalFiles + this.stats.skippedFiles}`);
    console.log(`Files Indexed:         ${this.stats.processedFiles}`);
    console.log(`Files Skipped:         ${this.stats.skippedFiles}`);
    console.log(`Total Chunks Created:  ${this.stats.totalChunks}`);
    console.log(`Indexing Duration:     ${duration} seconds`);
    console.log(`Errors Encountered:    ${this.stats.errors.length}`);
    
    if (this.stats.errors.length > 0) {
      console.log("\nErrors:");
      this.stats.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      if (this.stats.errors.length > 5) {
        console.log(`  ... and ${this.stats.errors.length - 5} more errors`);
      }
    }
    
    console.log("=".repeat(60) + "\n");
  }

  async getHealthStatus(): Promise<void> {
    const health = await this.ragSystem.getHealthStatus();
    
    console.log("\n" + "=".repeat(60));
    console.log("RAG SYSTEM HEALTH STATUS");
    console.log("=".repeat(60));
    console.log(`Overall Status:        ${health.status.toUpperCase()}`);
    console.log(`Vector Store Type:     ${health.vectorStore.type}`);
    console.log(`Vector Store Status:   ${health.vectorStore.status}`);
    console.log(`Fallback Mode:         ${health.vectorStore.fallbackUsed ? 'YES' : 'NO'}`);
    console.log(`Embedding Service:     ${health.embeddingService.status}`);
    console.log("=".repeat(60) + "\n");
  }
}

// Main execution
async function main() {
  const indexer = new KnowledgeBaseIndexer();
  
  try {
    // Initialize
    await indexer.initialize();
    
    // Index knowledge base
    await indexer.indexKnowledgeBase();
    
    // Print statistics
    indexer.printStats();
    
    // Get health status
    await indexer.getHealthStatus();
    
    // Run test queries
    const shouldTest = await indexer['promptUser']("Run test queries? (y/n): ");
    if (shouldTest.toLowerCase() === 'y') {
      await indexer.testRetrieval();
    }
    
    logger.info("Knowledge base indexing completed successfully!", "INDEXER");
    process.exit(0);
  } catch (error) {
    logger.error(
      `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      "INDEXER"
    );
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info("Indexing interrupted by user", "INDEXER");
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, "INDEXER");
  process.exit(1);
});

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to run indexer:", error);
    process.exit(1);
  });
}

export { KnowledgeBaseIndexer };