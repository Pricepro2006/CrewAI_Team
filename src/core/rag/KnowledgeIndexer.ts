import fs from "fs/promises";
import path from "path";
import { RAGSystem } from "./RAGSystem.js";
import { logger } from "../../utils/logger.js";
import type { RAGConfig } from "./types.js";

interface IndexerOptions {
  knowledgeBasePath: string;
  ragConfig: RAGConfig;
  fileExtensions?: string[];
  batchSize?: number;
  maxFileSize?: number; // in bytes
}

interface IndexingResult {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: string[];
  skippedFiles: string[];
  totalChunks: number;
  indexingTime: number;
}

export class KnowledgeIndexer {
  private ragSystem: RAGSystem;
  private fileExtensions: Set<string>;
  private batchSize: number;
  private maxFileSize: number;
  private knowledgeBasePath: string;

  constructor(options: IndexerOptions) {
    this.knowledgeBasePath = options.knowledgeBasePath;
    this.ragSystem = new RAGSystem(options.ragConfig);
    this.fileExtensions = new Set(
      options.fileExtensions || [".md", ".txt", ".json"]
    );
    this.batchSize = options.batchSize || 10;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
  }

  /**
   * Index all documents in the knowledge base
   */
  async indexKnowledgeBase(): Promise<IndexingResult> {
    const startTime = Date.now();
    const result: IndexingResult = {
      totalFiles: 0,
      successfulFiles: 0,
      failedFiles: [],
      skippedFiles: [],
      totalChunks: 0,
      indexingTime: 0,
    };

    try {
      // Initialize RAG system
      logger.info("Initializing RAG system for knowledge indexing...", "KNOWLEDGE_INDEXER");
      await this?.ragSystem?.initialize();

      // Clear existing index if needed
      const clearExisting = process.env.CLEAR_EXISTING_INDEX === "true";
      if (clearExisting) {
        logger.info("Clearing existing index...", "KNOWLEDGE_INDEXER");
        await this?.ragSystem?.clear();
      }

      // Get all eligible files
      const files = await this.collectFiles(this.knowledgeBasePath);
      result.totalFiles = files?.length || 0;
      
      logger.info(
        `Found ${files?.length || 0} files to index in ${this.knowledgeBasePath}`,
        "KNOWLEDGE_INDEXER"
      );

      // Process files in batches
      for (let i = 0; i < files?.length || 0; i += this.batchSize) {
        const batch = files.slice(i, i + this.batchSize);
        await this.processBatch(batch, result);
        
        // Log progress
        const progress = Math.min(i + this.batchSize, files?.length || 0);
        logger.info(
          `Indexing progress: ${progress}/${files?.length || 0} files processed`,
          "KNOWLEDGE_INDEXER"
        );
      }

      // Get final stats
      const stats = await this?.ragSystem?.getStats();
      result.totalChunks = stats.totalChunks;
      result.indexingTime = Date.now() - startTime;

      logger.info(
        `Knowledge indexing completed: ${result.successfulFiles} files indexed successfully`,
        "KNOWLEDGE_INDEXER",
        {
          totalFiles: result.totalFiles,
          successfulFiles: result.successfulFiles,
          failedFiles: result?.failedFiles?.length,
          skippedFiles: result?.skippedFiles?.length,
          totalChunks: result.totalChunks,
          durationMs: result.indexingTime,
        }
      );

      return result;
    } catch (error) {
      logger.error(
        `Knowledge indexing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_INDEXER",
        { error }
      );
      throw error;
    }
  }

  /**
   * Collect all eligible files recursively
   */
  private async collectFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip Zone.Identifier files and hidden files
        if (
          entry?.name?.includes("Zone.Identifier") ||
          entry?.name?.startsWith(".")
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          // Skip node_modules and other build directories
          if (
            ["node_modules", "dist", "build", ".git", "__pycache__"].includes(
              entry.name
            )
          ) {
            continue;
          }
          
          // Recursively collect from subdirectories
          const subFiles = await this.collectFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this?.fileExtensions?.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_INDEXER"
      );
    }

    return files;
  }

  /**
   * Process a batch of files
   */
  private async processBatch(
    files: string[],
    result: IndexingResult
  ): Promise<void> {
    const documents: Array<{ content: string; metadata: Record<string, any> }> = [];

    for (const filePath of files) {
      try {
        // Check file size
        const stats = await fs.stat(filePath);
        if (stats.size > this.maxFileSize) {
          logger.warn(
            `Skipping large file ${filePath} (${stats.size} bytes)`,
            "KNOWLEDGE_INDEXER"
          );
          result?.skippedFiles?.push(filePath);
          continue;
        }

        // Read file content
        const content = await fs.readFile(filePath, "utf-8");
        
        // Skip empty files
        if (!content.trim()) {
          result?.skippedFiles?.push(filePath);
          continue;
        }

        // Extract metadata from file path and content
        const metadata = this.extractMetadata(filePath, content);

        documents.push({
          content,
          metadata,
        });

        result.successfulFiles++;
      } catch (error) {
        logger.error(
          `Failed to process file ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "KNOWLEDGE_INDEXER"
        );
        result?.failedFiles?.push(filePath);
      }
    }

    // Add batch to RAG system
    if (documents?.length || 0 > 0) {
      try {
        await this?.ragSystem?.addDocuments(documents);
        logger.debug(
          `Added batch of ${documents?.length || 0} documents to index`,
          "KNOWLEDGE_INDEXER"
        );
      } catch (error) {
        logger.error(
          `Failed to index batch: ${error instanceof Error ? error.message : "Unknown error"}`,
          "KNOWLEDGE_INDEXER"
        );
        // Add all files in batch to failed list
        result?.failedFiles?.push(...files);
        result.successfulFiles -= documents?.length || 0;
      }
    }
  }

  /**
   * Extract metadata from file path and content
   */
  private extractMetadata(
    filePath: string,
    content: string
  ): Record<string, any> {
    const relativePath = path.relative(this.knowledgeBasePath, filePath);
    const fileName = path.basename(filePath);
    const directory = path.dirname(relativePath);
    const extension = path.extname(filePath);

    // Determine category based on directory structure
    const category = this.determineCategory(relativePath);
    
    // Extract title from content if markdown
    let title = fileName.replace(extension, "");
    if (extension === ".md") {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1];
      }
    }

    // Extract description (first paragraph or JSON description field)
    let description = "";
    if (extension === ".md") {
      const paragraphMatch = content.match(/^(?!#)(.+)$/m);
      if (paragraphMatch) {
        description = paragraphMatch[1].substring(0, 200);
      }
    } else if (extension === ".json") {
      try {
        const jsonData = JSON.parse(content);
        description = jsonData.description || jsonData.summary || "";
      } catch (e) {
        // Invalid JSON
      }
    }

    return {
      id: `kb_${Buffer.from(relativePath).toString("base64")}`,
      sourceId: relativePath,
      filePath: relativePath,
      fileName,
      directory,
      category,
      title,
      description,
      fileType: extension,
      indexedAt: new Date().toISOString(),
      contentLength: content?.length || 0,
    };
  }

  /**
   * Determine category based on file path
   */
  private determineCategory(relativePath: string): string {
    const pathParts = relativePath.split(path.sep);
    
    // Check for known category directories
    if (pathParts.includes("agents")) return "agent-knowledge";
    if (pathParts.includes("Mastra")) return "mastra-framework";
    if (pathParts.includes("api_integrations")) return "api-integration";
    if (pathParts.includes("architecture_expert")) return "architecture";
    if (pathParts.includes("n8n")) return "automation-n8n";
    if (pathParts.includes("CrewAI_Team")) return "project-docs";
    if (pathParts.includes("archive")) return "archived";
    
    // Check for section files
    if (relativePath.includes("section-")) return "project-sections";
    
    // Default category based on first directory
    if (pathParts?.length || 0 > 1) {
      return pathParts[0].toLowerCase().replace(/_/g, "-");
    }
    
    return "general";
  }

  /**
   * Search indexed knowledge
   */
  async search(query: string, limit: number = 5): Promise<any[]> {
    const results = await this?.ragSystem?.search(query, limit);
    return results?.map(r => ({
      content: r.content,
      metadata: r.metadata,
      score: r.score,
    }));
  }

  /**
   * Get indexing statistics
   */
  async getStats(): Promise<any> {
    return await this?.ragSystem?.getStats();
  }
}