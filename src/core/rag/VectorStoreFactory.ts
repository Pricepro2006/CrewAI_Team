import type { VectorStoreConfig } from "./types.js";
import type { IVectorStore } from "./IVectorStore.js";
import { VectorStore } from "./VectorStore.js";
import { MCPVectorizeStore } from "./MCPVectorizeStore.js";
import { PineconeVectorStore } from "./PineconeVectorStore.js";

export class VectorStoreFactory {
  static create(config: VectorStoreConfig): IVectorStore {
    console.log(`Creating vector store of type: ${config.type}`);

    switch (config.type) {
      case "chromadb":
        return new VectorStore(config);

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
        throw new Error(`Unknown vector store type: ${config.type}`);
    }
  }

  static async createMultiple(
    configs: VectorStoreConfig[],
  ): Promise<IVectorStore[]> {
    const stores = configs.map((config) => this.create(config));

    // Initialize all stores in parallel
    await Promise.all(
      stores.map((store) =>
        store.initialize().catch((error) => {
          console.error(
            `Failed to initialize ${store.constructor.name}:`,
            error,
          );
          return null;
        }),
      ),
    );

    // Filter out failed stores
    return stores.filter((store) => store !== null);
  }
}
