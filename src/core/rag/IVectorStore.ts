import type { ProcessedDocument, QueryResult, Document } from './types';

/**
 * Interface for vector store implementations
 * Defines the contract for different vector database adapters
 */
export interface IVectorStore {
  /**
   * Initialize the vector store connection
   */
  initialize(): Promise<void>;

  /**
   * Add documents to the vector store
   */
  addDocuments(documents: ProcessedDocument[]): Promise<void>;

  /**
   * Search for documents using a query string
   */
  search(query: string, limit?: number): Promise<QueryResult[]>;

  /**
   * Search for documents with additional filter criteria
   */
  searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit?: number
  ): Promise<QueryResult[]>;

  /**
   * Retrieve a single document by ID
   */
  getDocument(documentId: string): Promise<Document | null>;

  /**
   * Delete documents by source ID
   */
  deleteBySourceId(sourceId: string): Promise<void>;

  /**
   * Get all documents with pagination
   */
  getAllDocuments(limit?: number, offset?: number): Promise<Document[]>;
}