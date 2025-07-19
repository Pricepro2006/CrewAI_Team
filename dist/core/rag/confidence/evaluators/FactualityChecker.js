/**
 * FactualityChecker - Evaluates factual accuracy of responses
 * Checks response claims against source documents
 */
import { ScoredDocument } from '../types.js';
export class FactualityChecker {
    /**
     * Check factual accuracy of response against sources
     */
    checkFactuality(response, sources) {
        // Extract claims from response
        const claims = this.extractClaims(response);
        // Verify claims against sources
        const verifiableClaims = claims.filter(claim => this.isVerifiable(claim));
        const supportedClaims = [];
        const unsupportedClaims = [];
        const contradictedClaims = [];
        for (const claim of verifiableClaims) {
            const verification = this.verifyClaim(claim, sources);
            if (verification.isSupported) {
                supportedClaims.push(claim);
            }
            else if (verification.isContradicted) {
                contradictedClaims.push(claim);
            }
            else {
                unsupportedClaims.push(claim);
            }
        }
        // Calculate factuality score
        const score = this.calculateFactualityScore(verifiableClaims, supportedClaims, unsupportedClaims, contradictedClaims);
        // Calculate confidence in factuality assessment
        const confidence = this.calculateConfidence(sources, verifiableClaims);
        return {
            score,
            verifiableClaims,
            supportedClaims,
            unsupportedClaims,
            contradictedClaims,
            confidence
        };
    }
    /**
     * Extract factual claims from response
     */
    extractClaims(response) {
        const claims = [];
        // Split response into sentences
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            // Skip non-factual sentences
            if (this.isFactualSentence(trimmed)) {
                claims.push(trimmed);
            }
        }
        return claims;
    }
    /**
     * Check if sentence contains factual claims
     */
    isFactualSentence(sentence) {
        const lowerSentence = sentence.toLowerCase();
        // Skip opinion markers
        const opinionMarkers = [
            'i think', 'i believe', 'in my opinion', 'it seems', 'appears to be',
            'might be', 'could be', 'may be', 'perhaps', 'possibly', 'likely'
        ];
        if (opinionMarkers.some(marker => lowerSentence.includes(marker))) {
            return false;
        }
        // Skip questions
        if (sentence.includes('?')) {
            return false;
        }
        // Skip commands
        if (sentence.match(/^(please|try|consider|remember)/i)) {
            return false;
        }
        // Must have substantive content
        if (sentence.length < 10) {
            return false;
        }
        return true;
    }
    /**
     * Check if claim is verifiable
     */
    isVerifiable(claim) {
        const lowerClaim = claim.toLowerCase();
        // Look for verifiable elements
        const verifiableIndicators = [
            // Specific facts
            /\b\d+\b/, // Numbers
            /\b(is|are|was|were|has|have|had|will|would|can|could|should|must)\b/, // Factual verbs
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/, // Dates
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, // Days
            /\b(company|corporation|organization|university|government|department)\b/, // Institutions
            /\b(study|research|report|survey|analysis|data|statistics)\b/, // Data sources
            /\b(according to|based on|research shows|studies indicate|data suggests)\b/ // Attribution
        ];
        return verifiableIndicators.some(indicator => indicator.test(lowerClaim));
    }
    /**
     * Verify claim against sources
     */
    verifyClaim(claim, sources) {
        const supportingEvidence = [];
        const contradictingEvidence = [];
        const claimKeywords = this.extractKeywords(claim);
        for (const source of sources) {
            const sourceText = source.content.toLowerCase();
            const claimText = claim.toLowerCase();
            // Check for direct support
            if (this.supportsClaimDirectly(claimText, sourceText)) {
                supportingEvidence.push(source.content);
                continue;
            }
            // Check for contradiction
            if (this.contradictsClaimDirectly(claimText, sourceText)) {
                contradictingEvidence.push(source.content);
                continue;
            }
            // Check for partial support through keywords
            const keywordMatches = claimKeywords.filter(keyword => sourceText.includes(keyword.toLowerCase()));
            if (keywordMatches.length > claimKeywords.length * 0.7) {
                // High keyword overlap suggests support
                supportingEvidence.push(source.content);
            }
        }
        return {
            isSupported: supportingEvidence.length > 0,
            isContradicted: contradictingEvidence.length > 0,
            supportingEvidence,
            contradictingEvidence
        };
    }
    /**
     * Check if source directly supports claim
     */
    supportsClaimDirectly(claim, sourceText) {
        // Remove common words and focus on key terms
        const claimWords = claim.split(/\s+/).filter(word => word.length > 3 && !this.isStopWord(word));
        // Check if most key terms appear in source
        const matchingWords = claimWords.filter(word => sourceText.includes(word.toLowerCase()));
        return matchingWords.length >= Math.min(3, claimWords.length * 0.6);
    }
    /**
     * Check if source contradicts claim
     */
    contradictsClaimDirectly(claim, sourceText) {
        // Look for explicit contradiction patterns
        const contradictionPatterns = [
            // Numerical contradictions
            /\b(\d+)\b/g,
            // Negation patterns
            /\b(not|never|no|none|nothing|neither)\b/g,
            // Opposite terms
            /\b(always|never|all|none|true|false|correct|incorrect)\b/g
        ];
        // Simple contradiction detection
        if (claim.includes('is') && sourceText.includes('is not')) {
            return true;
        }
        if (claim.includes('are') && sourceText.includes('are not')) {
            return true;
        }
        if (claim.includes('has') && sourceText.includes('has not')) {
            return true;
        }
        return false;
    }
    /**
     * Extract keywords from claim
     */
    extractKeywords(claim) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        ]);
        return claim
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }
    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
            'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        ]);
        return stopWords.has(word.toLowerCase());
    }
    /**
     * Calculate factuality score
     */
    calculateFactualityScore(verifiableClaims, supportedClaims, unsupportedClaims, contradictedClaims) {
        if (verifiableClaims.length === 0) {
            return 0.7; // Neutral score for non-factual content
        }
        const totalClaims = verifiableClaims.length;
        const supportedRatio = supportedClaims.length / totalClaims;
        const contradictedRatio = contradictedClaims.length / totalClaims;
        const unsupportedRatio = unsupportedClaims.length / totalClaims;
        // Calculate weighted score
        let score = supportedRatio * 1.0; // Full points for supported claims
        score += unsupportedRatio * 0.5; // Neutral for unsupported claims
        score += contradictedRatio * 0.0; // No points for contradicted claims
        // Penalize heavily for contradictions
        if (contradictedRatio > 0.1) {
            score -= contradictedRatio * 0.5;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate confidence in factuality assessment
     */
    calculateConfidence(sources, claims) {
        if (sources.length === 0)
            return 0.3;
        if (claims.length === 0)
            return 0.5;
        // Base confidence on source quality
        const averageSourceConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length;
        // Adjust based on number of sources
        const sourceCountFactor = Math.min(1, sources.length / 3);
        // Adjust based on claim complexity
        const claimComplexityFactor = Math.min(1, claims.length / 5);
        return averageSourceConfidence * 0.6 + sourceCountFactor * 0.2 + claimComplexityFactor * 0.2;
    }
    /**
     * Check specific fact types
     */
    checkSpecificFactTypes(response, sources) {
        const numbers = this.extractAndVerifyNumbers(response, sources);
        const dates = this.extractAndVerifyDates(response, sources);
        const names = this.extractAndVerifyNames(response, sources);
        const locations = this.extractAndVerifyLocations(response, sources);
        return { numbers, dates, names, locations };
    }
    /**
     * Extract and verify numbers
     */
    extractAndVerifyNumbers(response, sources) {
        const numberPattern = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;
        const numbers = response.match(numberPattern) || [];
        return numbers.map(num => ({
            claim: num,
            verified: sources.some(source => source.content.includes(num))
        }));
    }
    /**
     * Extract and verify dates
     */
    extractAndVerifyDates(response, sources) {
        const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g;
        const dates = response.match(datePattern) || [];
        return dates.map(date => ({
            claim: date,
            verified: sources.some(source => source.content.includes(date))
        }));
    }
    /**
     * Extract and verify names
     */
    extractAndVerifyNames(response, sources) {
        // Simple name extraction (proper nouns)
        const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
        const names = response.match(namePattern) || [];
        return names.map(name => ({
            claim: name,
            verified: sources.some(source => source.content.includes(name))
        }));
    }
    /**
     * Extract and verify locations
     */
    extractAndVerifyLocations(response, sources) {
        // Simple location extraction
        const locationPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|State|Country|Province|Region))?\b/g;
        const locations = response.match(locationPattern) || [];
        return locations.map(location => ({
            claim: location,
            verified: sources.some(source => source.content.toLowerCase().includes(location.toLowerCase()))
        }));
    }
}
//# sourceMappingURL=FactualityChecker.js.map