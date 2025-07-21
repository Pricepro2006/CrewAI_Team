/**
 * ChromaDB Manager - Enhanced vector database management with proper collections and metadata
 * Provides production-ready ChromaDB operations with schema management
 */

import { ChromaClient } from 'chromadb';
import type { Collection } from 'chromadb';
import { logger } from '../../utils/logger';

export interface ChromaDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

export interface ChromaQueryResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  distance: number;
  similarity: number;
}

export interface CollectionConfig {
  name: string;
  description: string;
  metadataSchema?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    required?: boolean;
    description?: string;
  }>;
  embeddingFunction?: string;
}

export class ChromaDBManager {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();
  private isConnected: boolean = false;

  constructor(private config: {
    host?: string;
    port?: number;
    ssl?: boolean;
    headers?: Record<string, string>;
    tenant?: string;
    database?: string;
  } = {}) {
    const {
      host = 'localhost',
      port = 8000,
      ssl = false,
      headers = {},
      tenant = 'default_tenant',
      database = 'default_database'
    } = config;

    const path = `${ssl ? 'https' : 'http'}://${host}:${port}`;

    this.client = new ChromaClient({
      path,
      tenant,
      database,
      ...headers && { headers }
    });
  }

  /**
   * Initialize ChromaDB connection and verify it's working
   */
  async initialize(): Promise<void> {
    try {
      // Test connection by getting version
      const version = await this.client.version();
      logger.info(`ChromaDB connected successfully. Version: ${version}`, 'CHROMA_DB');
      
      // Test heartbeat
      const heartbeat = await this.client.heartbeat();
      logger.info(`ChromaDB heartbeat: ${heartbeat}`, 'CHROMA_DB');
      
      this.isConnected = true;
    } catch (error) {
      logger.error(`Failed to connect to ChromaDB: ${error}`, 'CHROMA_DB');
      throw new Error(`ChromaDB connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create or get a collection with proper schema
   */
  async createCollection(config: CollectionConfig): Promise<Collection> {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      let collection: Collection;

      // Try to get existing collection first
      try {
        collection = await this.client.getCollection({
          name: config.name
        });
        logger.info(`Using existing ChromaDB collection: ${config.name}`, 'CHROMA_DB');
      } catch (getError) {
        // Collection doesn't exist, create it
        collection = await this.client.createCollection({
          name: config.name,
          metadata: {
            description: config.description,
            created_at: new Date().toISOString(),
            schema_version: '1.0',
            metadata_schema: config.metadataSchema ? JSON.stringify(config.metadataSchema) : undefined,
            embedding_function: config.embeddingFunction || 'default'
          }
        });
        logger.info(`Created new ChromaDB collection: ${config.name}`, 'CHROMA_DB');
      }

      // Cache the collection
      this.collections.set(config.name, collection);
      return collection;

    } catch (error) {
      logger.error(`Failed to create/get collection ${config.name}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Get a collection by name
   */
  async getCollection(name: string): Promise<Collection | null> {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    try {
      const collection = await this.client.getCollection({ name });
      this.collections.set(name, collection);
      return collection;
    } catch (error) {
      logger.warn(`Collection ${name} not found: ${error}`, 'CHROMA_DB');
      return null;
    }
  }

  /**
   * Add documents to a collection with validation
   */
  async addDocuments(
    collectionName: string,
    documents: ChromaDocument[],
    embeddings?: number[][]
  ): Promise<void> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    if (documents.length === 0) {
      return;
    }

    try {
      // Validate documents
      this.validateDocuments(documents);

      // Prepare data for ChromaDB
      const ids = documents.map(doc => doc.id);
      const contents = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => ({
        ...doc.metadata,
        indexed_at: new Date().toISOString(),
        content_length: doc.content.length,
        content_hash: this.hashContent(doc.content)
      }));

      // Add to collection
      await collection.add({
        ids,
        documents: contents,
        metadatas: metadatas as any,
        ...(embeddings && { embeddings })
      });

      logger.info(`Added ${documents.length} documents to collection ${collectionName}`, 'CHROMA_DB');
    } catch (error) {
      logger.error(`Failed to add documents to ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Update documents in a collection
   */
  async updateDocuments(
    collectionName: string,
    documents: ChromaDocument[],
    embeddings?: number[][]
  ): Promise<void> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    try {
      // Validate documents
      this.validateDocuments(documents);

      const ids = documents.map(doc => doc.id);
      const contents = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => ({
        ...doc.metadata,
        updated_at: new Date().toISOString(),
        content_length: doc.content.length,
        content_hash: this.hashContent(doc.content)
      }));

      await collection.update({
        ids,
        documents: contents,
        metadatas: metadatas as any,
        ...(embeddings && { embeddings })
      });

      logger.info(`Updated ${documents.length} documents in collection ${collectionName}`, 'CHROMA_DB');
    } catch (error) {
      logger.error(`Failed to update documents in ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Query documents from a collection
   */
  async queryDocuments(
    collectionName: string,
    queryEmbedding: number[],
    options: {
      nResults?: number;
      where?: Record<string, any>;
      whereDocument?: Record<string, any>;
    } = {}
  ): Promise<ChromaQueryResult[]> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    try {
      const { nResults = 10, where, whereDocument } = options;

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
        where,
        whereDocument,
        include: ['metadatas', 'documents', 'distances'] as any
      });

      return this.formatQueryResults(results);
    } catch (error) {
      logger.error(`Failed to query collection ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Get documents by IDs
   */
  async getDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<ChromaDocument[]> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    try {
      const results = await collection.get({
        ids,
        include: ['metadatas', 'documents'] as any
      });

      const documents: ChromaDocument[] = [];
      for (let i = 0; i < results.ids.length; i++) {
        documents.push({
          id: results.ids[i],
          content: results.documents?.[i] || '',
          metadata: results.metadatas?.[i] || {}
        });
      }

      return documents;
    } catch (error) {
      logger.error(`Failed to get documents from ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Delete documents from a collection
   */
  async deleteDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<void> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    try {
      await collection.delete({ ids });
      logger.info(`Deleted ${ids.length} documents from collection ${collectionName}`, 'CHROMA_DB');
    } catch (error) {
      logger.error(`Failed to delete documents from ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Delete documents by metadata filter
   */
  async deleteDocumentsByFilter(
    collectionName: string,
    where: Record<string, any>
  ): Promise<void> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    try {
      await collection.delete({ where });
      logger.info(`Deleted documents from collection ${collectionName} with filter`, 'CHROMA_DB');
    } catch (error) {
      logger.error(`Failed to delete documents by filter from ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<{
    count: number;
    metadata: Record<string, any>;
  }> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    try {
      const count = await collection.count();
      const metadata = collection.metadata || {};

      return { count, metadata };
    } catch (error) {
      logger.error(`Failed to get stats for collection ${collectionName}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<Array<{ name: string; metadata: Record<string, any> }>> {
    try {
      const collections = await this.client.listCollections();
      return collections.map(col => ({
        name: col.name,
        metadata: col.metadata || {}
      }));
    } catch (error) {
      logger.error(`Failed to list collections: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name });
      this.collections.delete(name);
      logger.info(`Deleted collection: ${name}`, 'CHROMA_DB');
    } catch (error) {
      logger.error(`Failed to delete collection ${name}: ${error}`, 'CHROMA_DB');
      throw error;
    }
  }

  /**
   * Perform similarity search with text query
   */
  async similaritySearch(
    collectionName: string,
    queryText: string,
    options: {
      nResults?: number;
      where?: Record<string, any>;
      embeddingFunction?: (text: string) => Promise<number[]>;
    } = {}
  ): Promise<ChromaQueryResult[]> {
    const { embeddingFunction, ...queryOptions } = options;

    if (!embeddingFunction) {
      throw new Error('Embedding function is required for text-based similarity search');
    }

    const queryEmbedding = await embeddingFunction(queryText);
    return this.queryDocuments(collectionName, queryEmbedding, queryOptions);
  }

  /**
   * Create predefined collections for the CrewAI system
   */
  async createSystemCollections(): Promise<void> {
    const systemCollections: CollectionConfig[] = [
      {
        name: 'knowledge_base',
        description: 'Main knowledge base for document storage and retrieval',
        metadataSchema: {
          source_type: { type: 'string', required: true, description: 'Type of document source' },
          category: { type: 'string', required: false, description: 'Document category' },
          tags: { type: 'array', required: false, description: 'Document tags' },
          author: { type: 'string', required: false, description: 'Document author' },
          created_at: { type: 'string', required: true, description: 'Creation timestamp' },
          updated_at: { type: 'string', required: false, description: 'Last update timestamp' },
          access_level: { type: 'string', required: false, description: 'Access control level' }
        }
      },
      {
        name: 'email_content',
        description: 'Email content for semantic search and analysis',
        metadataSchema: {
          email_id: { type: 'string', required: true, description: 'Reference to email ID' },
          sender: { type: 'string', required: true, description: 'Email sender' },
          subject: { type: 'string', required: true, description: 'Email subject' },
          status: { type: 'string', required: false, description: 'Email status' },
          priority: { type: 'string', required: false, description: 'Email priority' },
          entities: { type: 'array', required: false, description: 'Extracted entities' },
          received_at: { type: 'string', required: true, description: 'Email received timestamp' }
        }
      },
      {
        name: 'deal_data',
        description: 'Deal and product information for intelligent querying',
        metadataSchema: {
          deal_id: { type: 'string', required: true, description: 'Deal identifier' },
          customer: { type: 'string', required: true, description: 'Customer name' },
          product_family: { type: 'string', required: false, description: 'Product family' },
          product_number: { type: 'string', required: false, description: 'Product SKU' },
          status: { type: 'string', required: false, description: 'Deal status' },
          end_date: { type: 'string', required: true, description: 'Deal end date' },
          value: { type: 'number', required: false, description: 'Deal value' }
        }
      },
      {
        name: 'conversation_history',
        description: 'Conversation and interaction history for context',
        metadataSchema: {
          conversation_id: { type: 'string', required: true, description: 'Conversation identifier' },
          user_id: { type: 'string', required: true, description: 'User identifier' },
          agent_type: { type: 'string', required: false, description: 'Agent type' },
          message_type: { type: 'string', required: true, description: 'Message type' },
          timestamp: { type: 'string', required: true, description: 'Message timestamp' },
          confidence: { type: 'number', required: false, description: 'Confidence score' }
        }
      },
      {
        name: 'code_repository',
        description: 'Code snippets and documentation for development assistance',
        metadataSchema: {
          file_path: { type: 'string', required: true, description: 'File path' },
          language: { type: 'string', required: true, description: 'Programming language' },
          function_name: { type: 'string', required: false, description: 'Function or method name' },
          class_name: { type: 'string', required: false, description: 'Class name' },
          tags: { type: 'array', required: false, description: 'Code tags' },
          complexity: { type: 'string', required: false, description: 'Code complexity level' }
        }
      }
    ];

    for (const collectionConfig of systemCollections) {
      try {
        await this.createCollection(collectionConfig);
        logger.info(`System collection '${collectionConfig.name}' ready`, 'CHROMA_DB');
      } catch (error) {
        logger.error(`Failed to create system collection '${collectionConfig.name}': ${error}`, 'CHROMA_DB');
      }
    }
  }

  /**
   * Health check for ChromaDB
   */
  async healthCheck(): Promise<{
    connected: boolean;
    version?: string;
    heartbeat?: number;
    collections: number;
    error?: string;
  }> {
    try {
      const version = await this.client.version();
      const heartbeat = await this.client.heartbeat();
      const collections = await this.client.listCollections();

      return {
        connected: true,
        version,
        heartbeat,
        collections: collections.length
      };
    } catch (error) {
      return {
        connected: false,
        collections: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Private helper methods
   */
  private validateDocuments(documents: ChromaDocument[]): void {
    for (const doc of documents) {
      if (!doc.id || typeof doc.id !== 'string') {
        throw new Error('Document ID is required and must be a string');
      }
      if (!doc.content || typeof doc.content !== 'string') {
        throw new Error('Document content is required and must be a string');
      }
      if (!doc.metadata || typeof doc.metadata !== 'object') {
        throw new Error('Document metadata is required and must be an object');
      }
    }
  }

  private hashContent(content: string): string {
    // Simple hash function for content fingerprinting
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private formatQueryResults(chromaResults: any): ChromaQueryResult[] {
    const results: ChromaQueryResult[] = [];

    if (!chromaResults.ids || chromaResults.ids.length === 0) {
      return results;
    }

    for (let i = 0; i < chromaResults.ids[0].length; i++) {
      const distance = chromaResults.distances?.[0]?.[i] || 0;
      const similarity = 1 - distance; // Convert distance to similarity

      results.push({
        id: chromaResults.ids[0][i],
        content: chromaResults.documents?.[0]?.[i] || '',
        metadata: chromaResults.metadatas?.[0]?.[i] || {},
        distance,
        similarity: Math.max(0, similarity) // Ensure similarity is not negative
      });
    }

    return results;
  }

  /**
   * Close ChromaDB connections
   */
  async close(): Promise<void> {
    this.collections.clear();
    this.isConnected = false;
    logger.info('ChromaDB connections closed', 'CHROMA_DB');
  }
}