/**
 * Confidence scoring profiles for different use cases
 * Allows users to select between conservative, balanced, or permissive settings
 */
import { ConfidenceConfig } from "../core/rag/confidence/types";
export const CONFIDENCE_PROFILES = {
    conservative: {
        name: "Conservative",
        description: "High confidence requirements, suitable for critical applications",
        config: {
            retrieval: {
                minimum: 0.7,
                preferred: 0.85,
            },
            generation: {
                acceptable: 0.75,
                review: 0.5,
            },
            overall: {
                high: 0.85,
                medium: 0.7,
                low: 0.5,
            },
        },
        complexityThresholds: {
            simple: 2,
            medium: 5,
        },
        deliveryOptions: {
            alwaysIncludeConfidence: true,
            alwaysIncludeEvidence: true,
            defaultWarnings: true,
        },
    },
    balanced: {
        name: "Balanced",
        description: "Balanced approach for general use cases",
        config: {
            retrieval: {
                minimum: 0.6,
                preferred: 0.75,
            },
            generation: {
                acceptable: 0.7,
                review: 0.4,
            },
            overall: {
                high: 0.8,
                medium: 0.6,
                low: 0.4,
            },
        },
        complexityThresholds: {
            simple: 3,
            medium: 7,
        },
        deliveryOptions: {
            alwaysIncludeConfidence: true,
            alwaysIncludeEvidence: false,
            defaultWarnings: true,
        },
    },
    permissive: {
        name: "Permissive",
        description: "Lower confidence requirements for exploratory use",
        config: {
            retrieval: {
                minimum: 0.5,
                preferred: 0.65,
            },
            generation: {
                acceptable: 0.6,
                review: 0.3,
            },
            overall: {
                high: 0.7,
                medium: 0.5,
                low: 0.3,
            },
        },
        complexityThresholds: {
            simple: 4,
            medium: 8,
        },
        deliveryOptions: {
            alwaysIncludeConfidence: false,
            alwaysIncludeEvidence: false,
            defaultWarnings: false,
        },
    },
    research: {
        name: "Research",
        description: "Optimized for research and exploration with detailed evidence",
        config: {
            retrieval: {
                minimum: 0.5,
                preferred: 0.7,
            },
            generation: {
                acceptable: 0.65,
                review: 0.35,
            },
            overall: {
                high: 0.75,
                medium: 0.55,
                low: 0.35,
            },
        },
        complexityThresholds: {
            simple: 2,
            medium: 6,
        },
        deliveryOptions: {
            alwaysIncludeConfidence: true,
            alwaysIncludeEvidence: true,
            defaultWarnings: false,
        },
    },
    production: {
        name: "Production",
        description: "Production-ready settings with user-friendly delivery",
        config: {
            retrieval: {
                minimum: 0.65,
                preferred: 0.8,
            },
            generation: {
                acceptable: 0.72,
                review: 0.45,
            },
            overall: {
                high: 0.82,
                medium: 0.65,
                low: 0.45,
            },
        },
        complexityThresholds: {
            simple: 3,
            medium: 6,
        },
        deliveryOptions: {
            alwaysIncludeConfidence: false,
            alwaysIncludeEvidence: false,
            defaultWarnings: true,
        },
    },
};
/**
 * Get confidence profile by name
 */
export function getConfidenceProfile(profileName = "balanced") {
    const profile = CONFIDENCE_PROFILES[profileName];
    if (!profile) {
        console.warn(`Unknown confidence profile: ${profileName}, using balanced`);
        return CONFIDENCE_PROFILES.balanced;
    }
    return profile;
}
/**
 * Get profile based on environment
 */
export function getEnvironmentProfile() {
    const env = process.env.NODE_ENV;
    const profileOverride = process.env.CONFIDENCE_PROFILE;
    if (profileOverride) {
        return getConfidenceProfile(profileOverride);
    }
    switch (env) {
        case "production":
            return CONFIDENCE_PROFILES.production;
        case "development":
            return CONFIDENCE_PROFILES.research;
        case "test":
            return CONFIDENCE_PROFILES.permissive;
        default:
            return CONFIDENCE_PROFILES.balanced;
    }
}
/**
 * Create custom profile
 */
export function createCustomProfile(name, baseProfile, overrides) {
    const base = getConfidenceProfile(baseProfile);
    return {
        ...base,
        name,
        ...overrides,
        config: {
            ...base.config,
            ...(overrides.config || {}),
        },
        complexityThresholds: {
            ...base.complexityThresholds,
            ...(overrides.complexityThresholds || {}),
        },
        deliveryOptions: {
            ...base.deliveryOptions,
            ...(overrides.deliveryOptions || {}),
        },
    };
}
/**
 * Profile recommendation based on use case
 */
export function recommendProfile(useCase) {
    const { domain, criticality, userExpertise, responseTime } = useCase;
    // High criticality always uses conservative
    if (criticality === "high") {
        return "conservative";
    }
    // Research domains prefer research profile
    if (domain === "research" || domain === "academic") {
        return "research";
    }
    // Production systems
    if (domain === "production" || domain === "enterprise") {
        return "production";
    }
    // Expert users can handle more permissive settings
    if (userExpertise === "expert" && criticality === "low") {
        return "permissive";
    }
    // Fast response time with low criticality
    if (responseTime === "fast" && criticality === "low") {
        return "permissive";
    }
    // Thorough response time
    if (responseTime === "thorough") {
        return "conservative";
    }
    // Default to balanced
    return "balanced";
}
//# sourceMappingURL=confidence-profiles.js.map