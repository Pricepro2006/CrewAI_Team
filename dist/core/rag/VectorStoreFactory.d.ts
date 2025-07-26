import type { VectorStoreConfig } from './types';
import type { IVectorStore } from './IVectorStore';
export declare class VectorStoreFactory {
    static create(config: VectorStoreConfig): IVectorStore;
    static createMultiple(configs: VectorStoreConfig[]): Promise<IVectorStore[]>;
}
//# sourceMappingURL=VectorStoreFactory.d.ts.map