import axios from "axios";
import type { AxiosInstance } from "axios";
import type { EmbeddingConfig } from "./types.js";
import { MODEL_CONFIG } from "../../config/models.config.js";

export class EmbeddingService {
  private client: AxiosInstance;
  private config: EmbeddingConfig;
  private isInitialized: boolean = false;

  constructor(config: EmbeddingConfig) {
    // Override to use Llama 3.2:3b for embeddings
    this.config = {
      batchSize: MODEL_CONFIG?.batchSizes?.embedding,
      dimensions: 4096, // Llama 3.2:3b embedding dimensions
      ...config,
      model: config.model || MODEL_CONFIG?.models?.embedding, // Use llama3.2:3b as fallback
    };

    this.client = axios.create({
      baseURL: config.baseUrl || MODEL_CONFIG?.api?.ollamaUrl,
      timeout: MODEL_CONFIG?.timeouts?.embedding,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connection using OpenAI-compatible endpoint
      await this?.client?.get("/v1/models");

      // Verify embedding model is available using OpenAI-compatible endpoint
      const response = await this.client.get("/v1/models");
      const models = response?.data?.data || [];
      const hasEmbeddingModel = models.some(
        (m: any) => m.id === this.config.model || m?.id?.includes("embed"),
      );

      if (!hasEmbeddingModel) {
        console.warn(
          `Embedding model ${this.config.model} not found. Using main model for embeddings.`,
        );
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
      // Try llama-server native endpoint first (without /v1 prefix)
      const response = await this.client.post("/embeddings", {
        content: text,  // llama-server uses 'content' not 'input'
      });

      // llama-server returns embedding directly, not nested in data structure
      return response?.data?.embedding || response?.data || [];
    } catch (error) {
      // If native endpoint fails, try OpenAI-compatible format
      try {
        const response = await this.client.post("/v1/embeddings", {
          model: this.config.model,
          input: text,
        });
        return response?.data?.data?.[0]?.embedding || [];
      } catch (innerError) {
        console.warn("Embedding generation not available - using fallback hash-based embeddings");
        // Return a deterministic hash-based vector as fallback for development
        return this.generateFallbackEmbedding(text);
      }
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    // Generate a deterministic embedding based on text hash
    // This is a temporary fallback for development - not suitable for production
    const hash = this.simpleHash(text);
    const dimensions = this.config.dimensions || 768;
    const embedding = new Array(dimensions).fill(0);
    
    // Use hash to seed the vector with some variation
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1;
    }
    
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];
    const batchSize = this.config.batchSize || 20; // Reduced for CPU inference stability
    const totalBatches = Math.ceil(texts.length / batchSize);

    console.log(`Processing ${texts.length} texts in ${totalBatches} batches (batch size: ${batchSize})`);

    // Process in batches to avoid overwhelming the service
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} texts)`);

      try {
        // Process batch in parallel with rate limiting
        const batchEmbeddings = await Promise.all(
          batch.map((text: any) => this.embedWithRetry(text, 2)) // Reduced retries for batch operations
        );

        embeddings.push(...batchEmbeddings);

        // Longer delay between batches for CPU inference (especially for large datasets like 143,221 emails)
        if (i + batchSize < texts.length) {
          await this.delay(500); // Increased delay for CPU stability
        }

        // Progress logging for large batches
        if (batchNumber % 10 === 0 || batchNumber === totalBatches) {
          console.log(`Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} texts`);
        }
      } catch (error) {
        console.error(`Batch ${batchNumber} failed:`, error);
        // Add zero vectors for failed batch to maintain array length consistency
        const zeroVector = new Array(this.config.dimensions || 768).fill(0);
        embeddings.push(...batch.map(() => zeroVector));
      }
    }

    console.log(`Batch embedding completed: ${embeddings.length} embeddings generated`);
    return embeddings;
  }

  private async embedWithRetry(
    text: string,
    retries: number = 3,
  ): Promise<number[]> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.embed(text);
      } catch (error) {
        if (i === retries - 1) {
          console.error(
            `Failed to embed text after ${retries} attempts:`,
            error,
          );
          // Return zero vector as fallback
          return new Array(this.config.dimensions || 768).fill(0);
        }
        // Exponential backoff
        await this.delay(Math.pow(2, i) * 1000);
      }
    }

    return new Array(this.config.dimensions || 768).fill(0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve: any) => setTimeout(resolve, ms));
  }

  async cosineSimilarity(
    embedding1: number[],
    embedding2: number[],
  ): Promise<number> {
    const embedding1Length = embedding1?.length ?? 0;
    const embedding2Length = embedding2?.length ?? 0;
    
    if (embedding1Length !== embedding2Length) {
      throw new Error("Embeddings must have the same dimension");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1Length; i++) {
      const val1 = embedding1[i] ?? 0;
      const val2 = embedding2[i] ?? 0;
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
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
    topK: number = 5,
  ): Promise<Array<{ index: number; score: number }>> {
    const similarities = await Promise.all(
      embeddings?.map(async (embedding, index) => ({
        index,
        score: await this.cosineSimilarity(queryEmbedding, embedding),
      })),
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
