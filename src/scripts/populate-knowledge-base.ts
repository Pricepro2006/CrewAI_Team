#!/usr/bin/env node
/**
 * Knowledge Base Population Script
 * 
 * This script processes markdown documents from the knowledge base directory
 * and indexes them in the ChromaDB vector store for semantic search.
 */

import { VectorStore } from '../core/rag/VectorStore';
import { DocumentProcessor } from '../core/rag/DocumentProcessor';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import appConfig from '../config/app.config';

interface ProcessingStats {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  errors: Array<{ file: string; error: string }>;
  processingTime: number;
}

class KnowledgeBasePopulator {
  private vectorStore: VectorStore;
  private documentProcessor: DocumentProcessor;
  private stats: ProcessingStats;

  constructor() {
    // Initialize vector store with production settings
    this.vectorStore = new VectorStore({
      path: 'http://localhost:8000',
      collectionName: 'crewai_knowledge',
      baseUrl: 'http://localhost:11434' // Ollama endpoint
    });

    this.documentProcessor = new DocumentProcessor({
      size: 1000,
      overlap: 200,
      method: 'character',
      separator: '\n\n',
      trimWhitespace: true,
      preserveFormatting: false
    });

    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      totalChunks: 0,
      errors: [],
      processingTime: 0
    };
  }

  async populateKnowledgeBase(): Promise<void> {
    const startTime = Date.now();
    
    console.log('🚀 Starting knowledge base population...');
    console.log('📍 Vector Store:', 'http://localhost:8000');
    console.log('📍 Collection:', 'crewai_knowledge');
    console.log('');

    try {
      // Initialize vector store
      console.log('🔗 Initializing vector store connection...');
      await this.vectorStore.initialize();
      console.log('✅ Vector store connected successfully');

      // Get knowledge base directory
      const knowledgeBaseDir = join(process.env.HOME || '/home/pricepro2006', 'master_knowledge_base/documents');
      console.log('📂 Knowledge base directory:', knowledgeBaseDir);

      // Process documents
      await this.processDirectory(knowledgeBaseDir);

      this.stats.processingTime = Date.now() - startTime;
      this.printSummary();

    } catch (error) {
      console.error('❌ Failed to populate knowledge base:', error);
      process.exit(1);
    }
  }

  private async processDirectory(dirPath: string): Promise<void> {
    try {
      const files = readdirSync(dirPath);
      this.stats.totalFiles = files.filter(f => extname(f) === '.md').length;
      
      console.log(`📋 Found ${this.stats.totalFiles} markdown files to process`);
      console.log('');

      for (const file of files) {
        const filePath = join(dirPath, file);
        const fileStat = statSync(filePath);

        if (fileStat.isFile() && extname(file) === '.md') {
          await this.processFile(filePath);
        }
      }
    } catch (error) {
      console.error('❌ Failed to read directory:', error);
      throw error;
    }
  }

  private async processFile(filePath: string): Promise<void> {
    const fileName = basename(filePath);
    
    try {
      console.log(`📄 Processing: ${fileName}`);
      
      // Read file content
      const content = readFileSync(filePath, 'utf-8');
      
      if (content.trim().length === 0) {
        console.log(`⚠️  Skipping empty file: ${fileName}`);
        return;
      }

      // Process document into chunks
      const metadata = {
        sourceId: fileName,
        source: fileName,
        type: 'documentation',
        category: this.categorizeDocument(fileName),
        wordCount: content.split(/\s+/).length,
        processedAt: new Date().toISOString()
      };
      
      const processedDoc = await this.documentProcessor.processDocument(content, metadata);

      // Check if document already exists and remove old version
      try {
        await this.vectorStore.deleteBySourceId(fileName);
        console.log(`🗑️  Removed existing version of ${fileName}`);
      } catch (deleteError) {
        // Document doesn't exist yet, which is fine
      }

      // Add new chunks to vector store
      await this.vectorStore.addDocuments(processedDoc);
      
      this.stats.processedFiles++;
      this.stats.totalChunks += processedDoc.length;
      
      console.log(`✅ ${fileName}: ${processedDoc.length} chunks indexed`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errors.push({ file: fileName, error: errorMessage });
      console.error(`❌ Failed to process ${fileName}:`, errorMessage);
    }
  }

  private categorizeDocument(fileName: string): string {
    const name = fileName.toLowerCase().replace('.md', '');
    
    if (name.includes('api') || name.includes('endpoint')) {
      return 'api-documentation';
    } else if (name.includes('agent')) {
      return 'agent-documentation';
    } else if (name.includes('architecture') || name.includes('system')) {
      return 'system-architecture';
    } else if (name.includes('dashboard') || name.includes('ui') || name.includes('guide')) {
      return 'user-guide';
    } else if (name.includes('troubleshoot') || name.includes('error') || name.includes('debug')) {
      return 'troubleshooting';
    } else {
      return 'general-documentation';
    }
  }

  private printSummary(): void {
    console.log('');
    console.log('📊 POPULATION SUMMARY');
    console.log('==========================================');
    console.log(`📁 Total files found:     ${this.stats.totalFiles}`);
    console.log(`✅ Files processed:       ${this.stats.processedFiles}`);
    console.log(`📝 Total chunks created:  ${this.stats.totalChunks}`);
    console.log(`⏱️  Processing time:      ${(this.stats.processingTime / 1000).toFixed(2)}s`);
    
    if (this.stats.errors.length > 0) {
      console.log(`❌ Errors encountered:   ${this.stats.errors.length}`);
      console.log('');
      console.log('ERROR DETAILS:');
      this.stats.errors.forEach(({ file, error }) => {
        console.log(`   ${file}: ${error}`);
      });
    } else {
      console.log(`❌ Errors encountered:   0`);
    }
    
    console.log('==========================================');

    if (this.stats.processedFiles === this.stats.totalFiles && this.stats.errors.length === 0) {
      console.log('🎉 Knowledge base population completed successfully!');
    } else if (this.stats.errors.length > 0) {
      console.log('⚠️  Knowledge base population completed with errors.');
    } else {
      console.log('⚠️  Some files were not processed.');
    }

    // Print vector store statistics
    this.printVectorStoreStats();
  }

  private async printVectorStoreStats(): Promise<void> {
    try {
      console.log('');
      console.log('📊 VECTOR STORE STATISTICS');
      console.log('==========================================');
      
      const documentCount = await this.vectorStore.getDocumentCount();
      const chunkCount = await this.vectorStore.getChunkCount();
      const collections = await this.vectorStore.getCollections();
      
      console.log(`📚 Collections:           ${collections.length}`);
      console.log(`📄 Unique documents:      ${documentCount}`);
      console.log(`🧩 Total chunks:          ${chunkCount}`);
      
      // Test a sample search
      console.log('');
      console.log('🔍 TESTING SEARCH FUNCTIONALITY');
      console.log('==========================================');
      
      const testQuery = "How do I troubleshoot database connection issues?";
      const searchResults = await this.vectorStore.search(testQuery, 3);
      
      console.log(`Query: "${testQuery}"`);
      console.log(`Results found: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        searchResults.forEach((result, index) => {
          console.log(`\n${index + 1}. Score: ${result.score.toFixed(3)}`);
          console.log(`   Source: ${result.metadata.source}`);
          console.log(`   Content: ${result.content.substring(0, 100)}...`);
        });
      }
      
      console.log('==========================================');
      
    } catch (error) {
      console.error('❌ Failed to retrieve vector store statistics:', error);
    }
  }
}

// CLI execution
async function main() {
  const populator = new KnowledgeBasePopulator();
  await populator.populateKnowledgeBase();
}

// Execute directly
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { KnowledgeBasePopulator };