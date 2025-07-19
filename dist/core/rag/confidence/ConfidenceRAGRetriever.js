/**
 * ConfidenceRAGRetriever - Retrieves documents with confidence scoring
 * Integrates with vector stores and applies confidence-based filtering
 */
import { VectorStore } from '../VectorStore';
import { RetrievalResult, RetrievalOptions, ScoredDocument } from './types.js';
export class ConfidenceRAGRetriever {
    vectorStore;
    retrievalCache = new Map();
    cacheSize = 500;
    defaultCacheTTL = 300000; // 5 minutes
    constructor(vectorStore) {
        this.vectorStore = vectorStore;
    }
    /**
     * Retrieve documents with confidence scoring
     */
    async retrieve(query, options) {
        const startTime = Date.now();
        const cacheKey = this.getCacheKey(query, options);
        // Check cache first
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            // Perform vector search
            const searchResults = await this.vectorStore.search(query, options.topK * 2);
            // Score documents with confidence
            const scoredDocs = await this.scoreDocuments(query, searchResults);
            // Apply confidence filtering
            const filteredDocs = this.applyConfidenceFiltering(scoredDocs, options);
            // Limit to requested number
            const finalDocs = filteredDocs.slice(0, options.topK);
            // Calculate average confidence
            const averageConfidence = finalDocs.length > 0
                ? finalDocs.reduce((sum, doc) => sum + doc.confidence, 0) / finalDocs.length
                : 0;
            const result = {
                documents: finalDocs,
                query,
                totalMatches: searchResults.length,
                averageConfidence,
                retrievalTime: Date.now() - startTime
            };
            // Cache the result
            this.cacheResult(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error('Retrieval error:', error);
            // Return empty result on error
            return {
                documents: [],
                query,
                totalMatches: 0,
                averageConfidence: 0,
                retrievalTime: Date.now() - startTime
            };
        }
    }
    /**
     * Score documents with confidence metrics
     */
    async scoreDocuments(query, documents) {
        const queryTerms = this.extractQueryTerms(query);
        return documents.map((doc, index) => {
            const baseScore = doc.score || 0;
            // Calculate additional confidence factors
            const termCoverage = this.calculateTermCoverage(queryTerms, doc.content);
            const contextRelevance = this.calculateContextRelevance(query, doc.content);
            const documentQuality = this.assessDocumentQuality(doc);
            // Combine scores
            const confidence = this.combineConfidenceScores({
                baseScore,
                termCoverage,
                contextRelevance,
                documentQuality
            });
            return {
                id: doc.id || `doc-${index}`,
                content: doc.content,
                metadata: doc.metadata || {},
                source: doc.metadata?.sourceId || doc.metadata?.source,
                timestamp: doc.metadata?.createdAt || doc.metadata?.timestamp,
                score: baseScore,
                confidence,
                relevanceScore: contextRelevance,
                chunkIndex: index
            };
        });
    }
    /**
     * Extract key terms from query
     */
    extractQueryTerms(query) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'can', 'what', 'how',
            'when', 'where', 'why', 'which', 'who'
        ]);
        return query
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length > 2 && !stopWords.has(term))
            .slice(0, 10); // Limit to top 10 terms
    }
    /**
     * Calculate term coverage score
     */
    calculateTermCoverage(queryTerms, content) {
        if (queryTerms.length === 0)
            return 0;
        const contentLower = content.toLowerCase();
        const coveredTerms = queryTerms.filter(term => contentLower.includes(term));
        return coveredTerms.length / queryTerms.length;
    }
    /**
     * Calculate context relevance score
     */
    calculateContextRelevance(query, content) {
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        const contentWords = new Set(content.toLowerCase().split(/\s+/));
        // Jaccard similarity
        const intersection = new Set(Array.from(queryWords).filter(x => contentWords.has(x)));
        const union = new Set([...Array.from(queryWords), ...Array.from(contentWords)]);
        const jaccardScore = intersection.size / union.size;
        // Boost for semantic indicators
        let semanticBoost = 0;
        if (content.toLowerCase().includes('definition') || content.toLowerCase().includes('explanation')) {
            semanticBoost += 0.1;
        }
        if (content.toLowerCase().includes('example') || content.toLowerCase().includes('instance')) {
            semanticBoost += 0.05;
        }
        return Math.min(1, jaccardScore + semanticBoost);
    }
    /**
     * Assess document quality
     */
    assessDocumentQuality(doc) {
        let quality = 0.5; // Base quality
        // Length factor (moderate length is better)
        const contentLength = doc.content.length;
        if (contentLength > 100 && contentLength < 2000) {
            quality += 0.2;
        }
        else if (contentLength > 2000 && contentLength < 5000) {
            quality += 0.1;
        }
        // Metadata presence
        if (doc.metadata && Object.keys(doc.metadata).length > 0) {
            quality += 0.1;
        }
        // Source quality
        if (doc.source) {
            quality += 0.1;
        }
        // Timestamp freshness (if available)
        if (doc.timestamp) {
            const age = Date.now() - new Date(doc.timestamp).getTime();
            const daysOld = age / (1000 * 60 * 60 * 24);
            if (daysOld < 30) {
                quality += 0.1;
            }
            else if (daysOld < 365) {
                quality += 0.05;
            }
        }
        return Math.min(1, quality);
    }
    /**
     * Combine confidence scores
     */
    combineConfidenceScores(scores) {
        const weights = {
            baseScore: 0.4,
            termCoverage: 0.25,
            contextRelevance: 0.25,
            documentQuality: 0.1
        };
        return (scores.baseScore * weights.baseScore +
            scores.termCoverage * weights.termCoverage +
            scores.contextRelevance * weights.contextRelevance +
            scores.documentQuality * weights.documentQuality);
    }
    /**
     * Apply confidence-based filtering
     */
    applyConfidenceFiltering(documents, options) {
        // Filter by minimum confidence
        const filtered = documents.filter(doc => doc.confidence >= options.minConfidence);
        // Sort by confidence score (descending)
        return filtered.sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * Generate cache key
     */
    getCacheKey(query, options) {
        const optionsStr = JSON.stringify({
            topK: options.topK,
            minConfidence: options.minConfidence,
            includeMetadata: options.includeMetadata || false
        });
        return `retrieval:${query.toLowerCase().replace(/\s+/g, ' ').trim()}:${optionsStr}`;
    }
    /**
     * Get cached result if valid
     */
    getCachedResult(key) {
        const cached = this.retrievalCache.get(key);
        if (!cached)
            return null;
        // Check if cache is still valid (simple TTL check)
        const now = Date.now();
        const cacheAge = now - cached.cachedAt;
        if (cacheAge > this.defaultCacheTTL) {
            this.retrievalCache.delete(key);
            return null;
        }
        return cached;
    }
    /**
     * Cache result with size limit
     */
    cacheResult(key, result) {
        if (this.retrievalCache.size >= this.cacheSize) {
            // Remove oldest entry
            const firstKey = this.retrievalCache.keys().next().value;
            this.retrievalCache.delete(firstKey);
        }
        // Add timestamp for TTL
        result.cachedAt = Date.now();
        this.retrievalCache.set(key, result);
    }
    /**
     * Retrieve with custom scoring function
     */
    async retrieveWithCustomScoring(query, options, scoringFunction) {
        const startTime = Date.now();
        try {
            const searchResults = await this.vectorStore.search(query, options.topK * 2);
            const scoredDocs = searchResults.map((doc, index) => {
                const customScore = scoringFunction(query, doc);
                const baseScore = doc.score || 0;
                // Combine custom score with base score
                const combinedScore = (customScore * 0.6) + (baseScore * 0.4);
                return {
                    id: doc.id || `doc-${index}`,
                    content: doc.content,
                    metadata: doc.metadata || {},
                    source: doc.metadata?.sourceId || doc.metadata?.source,
                    timestamp: doc.metadata?.createdAt || doc.metadata?.timestamp,
                    score: baseScore,
                    confidence: combinedScore,
                    relevanceScore: customScore,
                    chunkIndex: index
                };
            });
            // Filter and sort
            const filtered = scoredDocs
                .filter(doc => doc.confidence >= options.minConfidence)
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, options.topK);
            const averageConfidence = filtered.length > 0
                ? filtered.reduce((sum, doc) => sum + doc.confidence, 0) / filtered.length
                : 0;
            return {
                documents: filtered,
                query,
                totalMatches: searchResults.length,
                averageConfidence,
                retrievalTime: Date.now() - startTime
            };
        }
        catch (error) {
            console.error('Custom retrieval error:', error);
            return {
                documents: [],
                query,
                totalMatches: 0,
                averageConfidence: 0,
                retrievalTime: Date.now() - startTime
            };
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.retrievalCache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.retrievalCache.size,
            maxSize: this.cacheSize,
            hitRate: 0 // Would need tracking to implement
        };
    }
}
//# sourceMappingURL=ConfidenceRAGRetriever.js.map