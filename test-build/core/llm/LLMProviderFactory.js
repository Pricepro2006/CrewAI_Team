import { SafeLlamaCppProvider } from './SafeLlamaCppProvider.js';
import { LlamaCppProvider } from './LlamaCppProvider.js';
import { KnowledgeBackedLLM } from './KnowledgeBackedLLM.js';
import { logger } from '../../utils/logger.js';
export class LLMProviderFactory {
    static instance = null;
    static config = null;
    /**
     * Create and initialize an LLM provider based on configuration
     */
    static async createProvider(config) {
        if (LLMProviderFactory.instance && LLMProviderFactory.config?.type === config.type) {
            return LLMProviderFactory.instance;
        }
        LLMProviderFactory.config = config;
        let provider;
        switch (config.type) {
            case 'safe-llamacpp':
                provider = await LLMProviderFactory.createSafeLlamaCppProvider(config.safeLlamacpp);
                break;
            case 'llamacpp':
                provider = await LLMProviderFactory.createLlamaCppProvider(config.llamacpp);
                break;
            case 'knowledge-backed':
                provider = await LLMProviderFactory.createKnowledgeBackedProvider(config.knowledgeBacked, config.ragSystem);
                break;
            case 'auto':
                provider = await LLMProviderFactory.autoSelectProvider(config);
                break;
            default:
                throw new Error(`Unsupported LLM provider type: ${config.type}`);
        }
        LLMProviderFactory.instance = provider;
        return provider;
    }
    /**
     * Get the current provider instance
     */
    static getInstance() {
        return LLMProviderFactory.instance;
    }
    /**
     * Create Safe Llama.cpp provider with security controls
     */
    static async createSafeLlamaCppProvider(config) {
        logger.info('Creating Safe Llama.cpp provider', 'LLM_FACTORY', { modelPath: config.modelPath });
        const provider = new SafeLlamaCppProvider({
            modelPath: config.modelPath,
            contextSize: config.contextSize || 8192,
            threads: config.threads || 8,
            temperature: config.temperature || 0.7,
            gpuLayers: config.gpuLayers || 0,
            maxProcesses: config.maxProcesses || 2,
            maxMemoryMB: config.maxMemoryMB || 8192,
            processTimeout: config.processTimeout || 300000,
            allowedModelPaths: config.allowedModelPaths || [
                "./models",
                "/home/pricepro2006/CrewAI_Team/models",
                "/opt/models",
            ],
        });
        try {
            await provider.initialize();
            logger.info('Safe Llama.cpp provider initialized successfully', 'LLM_FACTORY');
            return provider;
        }
        catch (error) {
            logger.error('Failed to initialize Safe Llama.cpp provider', 'LLM_FACTORY', { error });
            throw error;
        }
    }
    /**
     * Create Llama.cpp provider
     */
    static async createLlamaCppProvider(config) {
        logger.info('Creating Llama.cpp provider', 'LLM_FACTORY', { modelPath: config.modelPath });
        const provider = new LlamaCppProvider({
            modelPath: config.modelPath,
            contextSize: config.contextSize || 8192,
            threads: config.threads || 8,
            temperature: config.temperature || 0.7,
            gpuLayers: config.gpuLayers || 0,
        });
        try {
            // LlamaCppProvider initializes lazily, but we can check if model exists
            if (!provider.isReady()) {
                logger.info('Llama.cpp provider created, model will load on first use', 'LLM_FACTORY');
            }
            return provider;
        }
        catch (error) {
            logger.error('Failed to create Llama.cpp provider', 'LLM_FACTORY', { error });
            throw error;
        }
    }
    /**
     * Create Knowledge-Backed LLM provider
     */
    static async createKnowledgeBackedProvider(config, ragSystem) {
        logger.info('Creating Knowledge-Backed LLM provider', 'LLM_FACTORY', {
            modelPath: config.modelPath,
            ragEnabled: config.ragEnabled !== false,
        });
        const provider = new KnowledgeBackedLLM({
            modelPath: config.modelPath,
            fallbackModelPath: config.fallbackModelPath,
            contextSize: config.contextSize || 8192,
            threads: config.threads || 8,
            temperature: config.temperature || 0.7,
            gpuLayers: config.gpuLayers || 0,
            ragConfig: {
                enabled: config.ragEnabled !== false,
                topK: 5,
                minScore: 0.5,
                maxContextDocs: 3,
            },
        }, ragSystem);
        try {
            await provider.initialize();
            logger.info('Knowledge-Backed LLM provider initialized successfully', 'LLM_FACTORY');
            return provider;
        }
        catch (error) {
            logger.error('Failed to initialize Knowledge-Backed LLM provider', 'LLM_FACTORY', { error });
            throw error;
        }
    }
    /**
     * Auto-select the best available provider
     */
    static async autoSelectProvider(config) {
        logger.info('Auto-selecting LLM provider', 'LLM_FACTORY');
        // Try Knowledge-Backed LLM first if configured
        if (config.knowledgeBacked?.modelPath) {
            try {
                const provider = await LLMProviderFactory.createKnowledgeBackedProvider(config.knowledgeBacked, config.ragSystem);
                logger.info('Auto-selected Knowledge-Backed LLM provider', 'LLM_FACTORY');
                return provider;
            }
            catch (error) {
                logger.warn('Knowledge-Backed LLM provider failed, trying alternatives', 'LLM_FACTORY', {
                    error: error.message,
                });
            }
        }
        // Try Safe Llama.cpp if configured (preferred for security)
        if (config.safeLlamacpp?.modelPath) {
            try {
                const provider = await LLMProviderFactory.createSafeLlamaCppProvider(config.safeLlamacpp);
                logger.info('Auto-selected Safe Llama.cpp provider', 'LLM_FACTORY');
                return provider;
            }
            catch (error) {
                logger.warn('Safe Llama.cpp provider failed, trying regular Llama.cpp', 'LLM_FACTORY', { error: error.message });
            }
        }
        // Try regular Llama.cpp as fallback
        if (config.llamacpp?.modelPath) {
            try {
                const provider = await LLMProviderFactory.createLlamaCppProvider(config.llamacpp);
                logger.info('Auto-selected Llama.cpp provider', 'LLM_FACTORY');
                return provider;
            }
            catch (error) {
                logger.error('Llama.cpp provider also failed', 'LLM_FACTORY', { error: error.message });
                throw new Error('No LLM providers are available');
            }
        }
        throw new Error('No LLM provider configurations available');
    }
    /**
     * Get default configuration based on environment
     */
    static getDefaultConfig() {
        const mistralModelPath = process.env.MISTRAL_MODEL_PATH || '/home/pricepro2006/CrewAI_Team/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf';
        const llamaModelPath = process.env.LLAMA_MODEL_PATH || '/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf';
        return {
            type: 'auto',
            knowledgeBacked: {
                modelPath: mistralModelPath,
                fallbackModelPath: llamaModelPath,
                contextSize: parseInt(process.env.LLM_CONTEXT_SIZE || '8192'),
                threads: parseInt(process.env.LLM_THREADS || '8'),
                temperature: 0.7,
                gpuLayers: parseInt(process.env.LLM_GPU_LAYERS || '0'),
                ragEnabled: process.env.ENABLE_RAG !== 'false',
            },
            safeLlamacpp: {
                modelPath: llamaModelPath,
                contextSize: 8192,
                threads: parseInt(process.env.LLAMA_THREADS || '8'),
                temperature: 0.7,
                gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || '0'),
                maxProcesses: 2,
                maxMemoryMB: 8192,
                processTimeout: 300000,
                allowedModelPaths: [
                    "./models",
                    "/home/pricepro2006/CrewAI_Team/models",
                    "/opt/models",
                ],
            },
            llamacpp: {
                modelPath: llamaModelPath,
                contextSize: 8192,
                threads: parseInt(process.env.LLAMA_THREADS || '8'),
                temperature: 0.7,
                gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || '0'),
            },
        };
    }
    /**
     * Reset the factory instance
     */
    static reset() {
        LLMProviderFactory.instance = null;
        LLMProviderFactory.config = null;
    }
}
export default LLMProviderFactory;
