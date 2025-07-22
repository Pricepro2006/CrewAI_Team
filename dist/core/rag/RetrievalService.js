export class RetrievalService {
    config;
    constructor(config) {
        this.config = config;
    }
    async enhance(query, results) {
        let enhanced = [...results];
        // Apply minimum score filter
        enhanced = this.filterByScore(enhanced);
        // Apply reranking if enabled
        if (this.config.reranking) {
            enhanced = await this.rerank(query, enhanced);
        }
        // Apply diversity if configured
        if (this.config.diversityFactor && this.config.diversityFactor > 0) {
            enhanced = this.diversify(enhanced);
        }
        // Boost recent documents if enabled
        if (this.config.boostRecent) {
            enhanced = this.boostRecentDocuments(enhanced);
            // Re-sort after boosting to maintain score order
            enhanced = enhanced.sort((a, b) => b.score - a.score);
        }
        return enhanced;
    }
    filterByScore(results) {
        return results.filter((r) => r.score >= this.config.minScore);
    }
    async rerank(query, results) {
        // Simple reranking based on keyword matching
        // In production, you might use a more sophisticated reranking model
        const queryTerms = this.extractTerms(query);
        const reranked = results.map((result) => {
            let boost = 0;
            const contentTerms = this.extractTerms(result.content);
            // Calculate term overlap
            for (const term of queryTerms) {
                if (contentTerms.has(term)) {
                    boost += 0.1;
                }
            }
            // Boost if query terms appear in metadata
            if (result.metadata.title) {
                const titleTerms = this.extractTerms(result.metadata.title);
                for (const term of queryTerms) {
                    if (titleTerms.has(term)) {
                        boost += 0.2;
                    }
                }
            }
            return {
                ...result,
                score: Math.min(result.score + boost, 1.0),
            };
        });
        // Sort by new scores
        return reranked.sort((a, b) => b.score - a.score);
    }
    diversify(results) {
        if (results.length <= 1)
            return results;
        const diversified = [];
        const used = new Set();
        // Add the top result
        const firstResult = results[0];
        if (firstResult) {
            diversified.push(firstResult);
            used.add(0);
        }
        // Add diverse results
        while (diversified.length < results.length &&
            diversified.length < this.config.topK) {
            let bestIndex = -1;
            let bestDiversity = -1;
            for (let i = 1; i < results.length; i++) {
                if (used.has(i))
                    continue;
                const result = results[i];
                if (!result)
                    continue;
                const diversity = this.calculateDiversity(result, diversified);
                if (diversity > bestDiversity) {
                    bestDiversity = diversity;
                    bestIndex = i;
                }
            }
            if (bestIndex !== -1) {
                const bestResult = results[bestIndex];
                if (bestResult) {
                    diversified.push(bestResult);
                    used.add(bestIndex);
                }
            }
            else {
                break;
            }
        }
        return diversified;
    }
    calculateDiversity(candidate, selected) {
        // Simple diversity based on content difference
        const candidateTerms = this.extractTerms(candidate.content);
        let totalOverlap = 0;
        for (const doc of selected) {
            const docTerms = this.extractTerms(doc.content);
            const overlap = this.calculateOverlap(candidateTerms, docTerms);
            totalOverlap += overlap;
        }
        // Higher score means more diverse (less overlap)
        return 1 - totalOverlap / selected.length;
    }
    calculateOverlap(set1, set2) {
        if (set1.size === 0 || set2.size === 0)
            return 0;
        let overlap = 0;
        for (const term of set1) {
            if (set2.has(term)) {
                overlap++;
            }
        }
        return overlap / Math.max(set1.size, set2.size);
    }
    boostRecentDocuments(results) {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        return results.map((result) => {
            if (!result.metadata.createdAt && !result.metadata.updatedAt) {
                return result;
            }
            const dateStr = result.metadata.updatedAt || result.metadata.createdAt;
            if (!dateStr)
                return result;
            const docDate = new Date(dateStr).getTime();
            const ageInDays = (now - docDate) / dayInMs;
            // Decay function: newer documents get higher boost
            let boost = 0;
            if (ageInDays < 1) {
                boost = 0.2; // Very recent
            }
            else if (ageInDays < 7) {
                boost = 0.1; // Recent
            }
            else if (ageInDays < 30) {
                boost = 0.05; // Somewhat recent
            }
            return {
                ...result,
                score: Math.min(result.score + boost, 1.0),
            };
        });
    }
    extractTerms(text) {
        // Simple term extraction
        const terms = text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((term) => term.length > 2); // Filter out short words
        return new Set(terms);
    }
    async filterByMetadata(results, filters) {
        return results.filter((result) => {
            for (const [key, value] of Object.entries(filters)) {
                if (!(key in result.metadata)) {
                    return false;
                }
                if (Array.isArray(value)) {
                    // Check if metadata value is in the array
                    if (!value.includes(result.metadata[key])) {
                        return false;
                    }
                }
                else if (result.metadata[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }
    highlightMatches(query, results) {
        const queryTerms = this.extractTerms(query);
        return results.map((result) => {
            const highlights = [];
            const sentences = result.content.split(/[.!?]+/);
            for (const sentence of sentences) {
                const sentenceTerms = this.extractTerms(sentence);
                // Check if sentence contains query terms
                let hasMatch = false;
                for (const term of queryTerms) {
                    if (sentenceTerms.has(term)) {
                        hasMatch = true;
                        break;
                    }
                }
                if (hasMatch) {
                    highlights.push(sentence.trim());
                }
            }
            return {
                ...result,
                highlights: highlights.slice(0, 3), // Limit to 3 highlights
            };
        });
    }
}
//# sourceMappingURL=RetrievalService.js.map