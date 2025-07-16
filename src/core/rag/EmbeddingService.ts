import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { EmbeddingConfig } from './types';

export class EmbeddingService {
  private client: AxiosInstance;
  private config: EmbeddingConfig;
  private isInitialized: boolean = false;

  constructor(config: EmbeddingConfig) {
    this.config = {
      batchSize: 100,
      dimensions: 768, // Default for nomic-embed-text
      ...config
    };

    this.client = axios.create({
      baseURL: config.baseUrl || 'http://localhost:11434',
      timeout: 60000, // 1 minute timeout for embeddings
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connection
      await this.client.get('/api/tags');
      
      // Verify embedding model is available
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      const hasEmbeddingModel = models.some((m: any) => 
        m.name === this.config.model || m.name.includes('embed')
      );

      if (!hasEmbeddingModel) {
        console.warn(`Embedding model ${this.config.model} not found. Please pull it first.`);
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize embedding service: ${error}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.post('/api/embeddings', {
        model: this.config.model,
        prompt: text
      });

      return response.data.embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      // Return a zero vector as fallback
      return new Array(this.config.dimensions).fill(0);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const embeddings: number[][] = [];
    const batchSize = this.config.batchSize || 100;

    // Process in batches to avoid overwhelming the service
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Process batch in parallel with rate limiting
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.embedWithRetry(text))
      );
      
      embeddings.push(...batchEmbeddings);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await this.delay(100);
      }
    }

    return embeddings;
  }

  private async embedWithRetry(text: string, retries: number = 3): Promise<number[]> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.embed(text);
      } catch (error) {
        if (i === retries - 1) {
          console.error(`Failed to embed text after ${retries} attempts:`, error);
          // Return zero vector as fallback
          return new Array(this.config.dimensions).fill(0);
        }
        // Exponential backoff
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
    
    return new Array(this.config.dimensions).fill(0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cosineSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += (embedding1[i] || 0) * (embedding2[i] || 0);
      norm1 += (embedding1[i] || 0) * (embedding1[i] || 0);
      norm2 += (embedding2[i] || 0) * (embedding2[i] || 0);
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  async findSimilar(
    queryEmbedding: number[],
    embeddings: number[][],
    topK: number = 5
  ): Promise<Array<{ index: number; score: number }>> {
    const similarities = await Promise.all(
      embeddings.map(async (embedding, index) => ({
        index,
        score: await this.cosineSimilarity(queryEmbedding, embedding)
      }))
    );

    // Sort by similarity score (descending)
    similarities.sort((a, b) => b.score - a.score);

    return similarities.slice(0, topK);
  }

  getDimensions(): number {
    return this.config.dimensions || 768;
  }

  getModel(): string {
    return this.config.model;
  }
}
