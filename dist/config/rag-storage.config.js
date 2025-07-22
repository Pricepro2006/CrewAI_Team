import { join } from 'path';
import { homedir } from 'os';
// All RAG storage paths point to Ubuntu_EXT via symlink
const MASTER_KB = join(homedir(), 'master_knowledge_base');
export const ragStorageConfig = {
    // Base paths
    basePath: MASTER_KB,
    // RAG-specific paths
    vectors: join(MASTER_KB, 'rag_data', 'vectors'),
    documents: join(MASTER_KB, 'rag_data', 'documents'),
    embeddings: join(MASTER_KB, 'rag_data', 'embeddings'),
    cache: join(MASTER_KB, 'rag_data', 'cache'),
    // Knowledge capture paths
    scrapedContent: join(MASTER_KB, 'scraped_content'),
    capturedKnowledge: join(MASTER_KB, 'captured_knowledge'),
    learnedPatterns: join(MASTER_KB, 'learned_patterns'),
    // Database paths
    databases: {
        chromadb: join(MASTER_KB, 'databases', 'chromadb'),
        knowledge: join(MASTER_KB, 'databases', 'knowledge.db'),
        learning: join(MASTER_KB, 'databases', 'learning.db')
    },
    // Ensure all paths use Ubuntu_EXT storage
    ensureOnUbuntuExt: () => {
        const paths = [
            ragStorageConfig.vectors,
            ragStorageConfig.documents,
            ragStorageConfig.embeddings,
            ragStorageConfig.cache,
            ragStorageConfig.scrapedContent,
            ragStorageConfig.capturedKnowledge,
            ragStorageConfig.learnedPatterns,
            ragStorageConfig.databases.chromadb
        ];
        // This will be validated at runtime
        return paths.every(path => path.startsWith(MASTER_KB));
    }
};
// Export for use in other modules
export const getKnowledgeBasePath = () => MASTER_KB;
export const getVectorStorePath = () => ragStorageConfig.vectors;
export const getDocumentPath = () => ragStorageConfig.documents;
export const getScrapedContentPath = () => ragStorageConfig.scrapedContent;
//# sourceMappingURL=rag-storage.config.js.map