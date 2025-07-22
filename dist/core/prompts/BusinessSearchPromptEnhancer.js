/**
 * BusinessSearchPromptEnhancer - Transforms base prompts to explicitly instruct models to use WebSearch for business queries
 * Part of GROUP 2B WebSearch Enhancement
 */
import { logger } from '../../utils/logger';
export class BusinessSearchPromptEnhancer {
    static BUSINESS_SEARCH_MARKER = '[BUSINESS_SEARCH_ENHANCED]';
    static BUSINESS_SEARCH_INSTRUCTION_MARKER = '[BUSINESS_SEARCH_INSTRUCTIONS]';
    static DEFAULT_BUSINESS_EXAMPLES = [
        {
            good: "Joe's Plumbing - (555) 123-4567, 123 Main St, Open 24/7",
            bad: "Search online for plumbers in your area",
            explanation: "Provide specific, actionable business information with contact details"
        },
        {
            good: "TechCorp Solutions - support@techcorp.com, Live chat: techcorp.com/chat, Phone: (800) 555-TECH",
            bad: "Look up tech support companies",
            explanation: "Include multiple contact methods and clear business identification"
        },
        {
            good: "City Auto Repair - 456 Oak Ave, Hours: Mon-Fri 8AM-6PM, Sat 9AM-3PM, Walk-ins welcome",
            bad: "Find auto repair shops nearby",
            explanation: "Provide location, hours, and service availability details"
        }
    ];
    static ENHANCEMENT_TEMPLATES = {
        minimal: `
When responding to business-related queries, always use WebSearch to find current, accurate business information.
${BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER}`,
        standard: `
${BusinessSearchPromptEnhancer.BUSINESS_SEARCH_INSTRUCTION_MARKER}
IMPORTANT: For ANY business-related query, you MUST:
1. Use WebSearch to find current business information
2. Provide specific details including:
   - Business name and type
   - Phone number(s)
   - Physical address
   - Business hours
   - Website/email if available
   - Current status (open/closed)
3. Never suggest users "search online" - YOU do the searching
4. Verify information is current (check last updated dates)

${BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER}`,
        aggressive: `
${BusinessSearchPromptEnhancer.BUSINESS_SEARCH_INSTRUCTION_MARKER}
CRITICAL REQUIREMENT - BUSINESS INFORMATION PROTOCOL:

You are REQUIRED to use WebSearch for ALL business-related queries. This is NOT optional.

MANDATORY ACTIONS:
1. IMMEDIATELY use WebSearch when detecting business-related keywords
2. NEVER tell users to search themselves
3. ALWAYS provide complete business information:
   - Full business name
   - Primary phone number
   - Complete street address
   - Current operating hours
   - Website URL
   - Email contact
   - Service/product offerings
   - Current promotional offers (if any)
   - Customer ratings/reviews summary
   - Accessibility information
   - Payment methods accepted
   - Parking availability

BUSINESS QUERY TRIGGERS:
- "Where can I find..."
- "Looking for..."
- "Need a [service/product]..."
- "Best [business type] near..."
- Any mention of services, stores, restaurants, professionals, etc.

QUALITY STANDARDS:
- Information must be from the last 6 months
- Include at least 3 relevant business options when possible
- Prioritize businesses currently open/available
- Include distance/directions from user location if known

${BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER}`
    };
    /**
     * Enhances a prompt with business search instructions
     */
    enhance(prompt, options = {}) {
        try {
            // Input validation and sanitization
            const sanitizedPrompt = this.sanitizeInput(prompt);
            const { enhancementLevel = 'standard', includeExamples = true, preserveOriginalMarkers = true, customInstructions } = options;
            // Check if already enhanced
            if (this.isAlreadyEnhanced(sanitizedPrompt) && preserveOriginalMarkers) {
                logger.info('Prompt already contains business search enhancement markers');
                return sanitizedPrompt;
            }
            // Build enhanced prompt
            let enhancedPrompt = this.getEnhancementTemplate(enhancementLevel);
            // Add custom instructions if provided
            if (customInstructions) {
                enhancedPrompt = this.injectCustomInstructions(enhancedPrompt, customInstructions);
            }
            // Add examples if requested
            if (includeExamples) {
                enhancedPrompt = this.addExamples(enhancedPrompt);
            }
            // Combine with original prompt
            enhancedPrompt = this.combinePrompts(enhancedPrompt, sanitizedPrompt);
            // Add metadata
            enhancedPrompt = this.addMetadata(enhancedPrompt, enhancementLevel);
            logger.info(`Prompt enhanced with business search instructions (level: ${enhancementLevel})`);
            return enhancedPrompt;
        }
        catch (error) {
            logger.error('Error enhancing prompt:', error instanceof Error ? error.message : String(error));
            // Return original prompt or default on error
            return prompt || this.getDefaultBusinessPrompt();
        }
    }
    /**
     * Returns a default business search prompt if input is invalid
     */
    getDefaultBusinessPrompt() {
        return `${BusinessSearchPromptEnhancer.ENHANCEMENT_TEMPLATES.standard}

Please help me with my business-related query. Remember to use WebSearch to find current, accurate information.

${BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER}`;
    }
    /**
     * Checks if a prompt is already enhanced
     */
    isAlreadyEnhanced(prompt) {
        return prompt.includes(BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER);
    }
    /**
     * Extracts business search instructions from an enhanced prompt
     */
    extractInstructions(prompt) {
        const startMarker = BusinessSearchPromptEnhancer.BUSINESS_SEARCH_INSTRUCTION_MARKER;
        const endMarker = BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER;
        const startIndex = prompt.indexOf(startMarker);
        const endIndex = prompt.indexOf(endMarker);
        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
            return null;
        }
        return prompt.substring(startIndex + startMarker.length, endIndex).trim();
    }
    /**
     * Validates enhancement level
     */
    isValidEnhancementLevel(level) {
        return ['minimal', 'standard', 'aggressive'].includes(level);
    }
    // Private helper methods
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') {
            logger.warn('Invalid input provided to BusinessSearchPromptEnhancer');
            return '';
        }
        // Remove potential injection attempts
        return input
            .replace(/\[BUSINESS_SEARCH_.*?\]/g, '') // Remove existing markers
            .replace(/\{\{.*?\}\}/g, '') // Remove template injections
            .trim();
    }
    getEnhancementTemplate(level) {
        return BusinessSearchPromptEnhancer.ENHANCEMENT_TEMPLATES[level];
    }
    injectCustomInstructions(template, customInstructions) {
        const marker = BusinessSearchPromptEnhancer.BUSINESS_SEARCH_INSTRUCTION_MARKER;
        return template.replace(marker, `${marker}\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n`);
    }
    addExamples(template) {
        const examplesSection = this.generateExamplesSection();
        const marker = BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER;
        return template.replace(marker, `\n${examplesSection}\n${marker}`);
    }
    generateExamplesSection() {
        let section = 'EXAMPLES OF PROPER BUSINESS INFORMATION RESPONSES:\n\n';
        BusinessSearchPromptEnhancer.DEFAULT_BUSINESS_EXAMPLES.forEach((example, index) => {
            section += `Example ${index + 1}:\n`;
            section += `✓ GOOD: "${example.good}"\n`;
            section += `✗ BAD: "${example.bad}"\n`;
            section += `Reason: ${example.explanation}\n\n`;
        });
        return section;
    }
    combinePrompts(enhanced, original) {
        if (!original) {
            return enhanced;
        }
        // Check if original has system/user structure
        if (original.includes('System:') || original.includes('User:')) {
            // Inject enhancement at the beginning of system instructions
            return original.replace(/System:\s*/i, `System:\n${enhanced}\n\nOriginal Instructions:\n`);
        }
        // Otherwise, prepend enhancement
        return `${enhanced}\n\n--- Original Prompt ---\n${original}`;
    }
    addMetadata(prompt, level) {
        const metadata = `\n[Enhancement Metadata: Level=${level}, Timestamp=${new Date().toISOString()}]`;
        return prompt + metadata;
    }
    /**
     * Removes enhancement from a prompt
     */
    removeEnhancement(prompt) {
        // Remove all enhancement markers and content between instruction markers
        let cleaned = prompt;
        // Remove content between instruction markers
        const startMarker = BusinessSearchPromptEnhancer.BUSINESS_SEARCH_INSTRUCTION_MARKER;
        const endMarker = BusinessSearchPromptEnhancer.BUSINESS_SEARCH_MARKER;
        const startIndex = cleaned.indexOf(startMarker);
        const endIndex = cleaned.indexOf(endMarker);
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            cleaned = cleaned.substring(0, startIndex) + cleaned.substring(endIndex + endMarker.length);
        }
        // Remove any remaining markers
        cleaned = cleaned.replace(/\[BUSINESS_SEARCH_.*?\]/g, '');
        // Remove metadata
        cleaned = cleaned.replace(/\[Enhancement Metadata:.*?\]/g, '');
        // Remove example sections
        cleaned = cleaned.replace(/EXAMPLES OF PROPER BUSINESS INFORMATION RESPONSES:[\s\S]*?(?=\n---|\n\n[A-Z]|$)/g, '');
        // Remove section headers
        cleaned = cleaned.replace(/--- Original Prompt ---/g, '');
        return cleaned.trim();
    }
    /**
     * Analyzes a prompt to determine if it needs business search enhancement
     */
    needsEnhancement(prompt) {
        if (this.isAlreadyEnhanced(prompt)) {
            return false;
        }
        const businessKeywords = [
            'find', 'looking for', 'where', 'locate', 'search',
            'business', 'store', 'shop', 'restaurant', 'service',
            'company', 'provider', 'near me', 'nearby', 'local',
            'hours', 'open', 'closed', 'contact', 'phone',
            'address', 'location', 'directions'
        ];
        const lowerPrompt = prompt.toLowerCase();
        return businessKeywords.some(keyword => lowerPrompt.includes(keyword));
    }
}
// Export a singleton instance for convenience
export const businessSearchPromptEnhancer = new BusinessSearchPromptEnhancer();
//# sourceMappingURL=BusinessSearchPromptEnhancer.js.map