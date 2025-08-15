import type { VectorStoreConfig } from "./types.js";
import type { IVectorStore } from "./IVectorStore.js";
import { AdaptiveVectorStore } from "./AdaptiveVectorStore.js";
import { ResilientVectorStore } from "./ResilientVectorStore.js";
import { MCPVectorizeStore } from "./MCPVectorizeStore.js";
import { PineconeVectorStore } from "./PineconeVectorStore.js";
import { logger } from "../../utils/logger.js";

export class VectorStoreFactory {
  static create(config: VectorStoreConfig): IVectorStore {
    logger.info(`Creating vector store of type: ${config.type}`, "VECTOR_STORE_FACTORY");

    switch (config.type) {
      case "chromadb":
        // Use ResilientVectorStore for ChromaDB with advanced retry and fallback
        return new ResilientVectorStore(config);
      
      case "resilient":
        // Explicitly use ResilientVectorStore
        return new ResilientVectorStore(config);
        
      case "adaptive":
        // Use AdaptiveVectorStore for simpler fallback mechanism
        return new AdaptiveVectorStore(config);

      case "pinecone":
        return new PineconeVectorStore(config);

      case "mcp-vectorize":
        return new MCPVectorizeStore(config);

      case "weaviate":
      case "qdrant":
        throw new Error(
          `Vector store type '${config.type}' is not yet implemented`,
        );

      default:
        logger.warn(`Unknown vector store type: ${config.type}. Using resilient ChromaDB with advanced fallback.`, "VECTOR_STORE_FACTORY");
        return new ResilientVectorStore(config);
    }
  }

  static async createMultiple(
    configs: VectorStoreConfig[],
  ): Promise<IVectorStore[]> {
    const stores = configs?.map((config: any) => this.create(config));

    // Initialize all stores in parallel with better error handling
    const initResults = await Promise.allSettled(
      stores?.map(async (store: any) => {
        try {
          await store.initialize();
          return store;
        } catch (error) {
          logger.error(
            `Failed to initialize ${store?.constructor?.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            "VECTOR_STORE_FACTORY"
          );
          return null;
        }
      })
    );

    // Filter out failed stores and log results
    const successfulStores = initResults
      .map((result: any) => result.status === "fulfilled" ? result.value : null)
      .filter((store: any): store is IVectorStore => store !== null);

    logger.info(
      `Initialized ${successfulStores?.length || 0}/${stores?.length || 0} vector stores successfully`,
      "VECTOR_STORE_FACTORY"
    );

    return successfulStores;
  }
}
