import { VectorStore } from './VectorStore';
import { MCPVectorizeStore } from './MCPVectorizeStore';
import { PineconeVectorStore } from './PineconeVectorStore';
export class VectorStoreFactory {
    static create(config) {
        console.log(`Creating vector store of type: ${config.type}`);
        switch (config.type) {
            case 'chromadb':
                return new VectorStore(config);
            case 'pinecone':
                return new PineconeVectorStore(config);
            case 'mcp-vectorize':
                return new MCPVectorizeStore(config);
            case 'weaviate':
            case 'qdrant':
                throw new Error(`Vector store type '${config.type}' is not yet implemented`);
            default:
                throw new Error(`Unknown vector store type: ${config.type}`);
        }
    }
    static async createMultiple(configs) {
        const stores = configs.map(config => this.create(config));
        // Initialize all stores in parallel
        await Promise.all(stores.map(store => store.initialize().catch(error => {
            console.error(`Failed to initialize ${store.constructor.name}:`, error);
            return null;
        })));
        // Filter out failed stores
        return stores.filter(store => store !== null);
    }
}
//# sourceMappingURL=VectorStoreFactory.js.map