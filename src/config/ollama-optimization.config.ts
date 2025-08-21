/**
 * Ollama Optimization Configuration
 * Production-ready settings for 60+ emails/minute throughput
 */

export interface OptimizationProfile {
  name: string;
  description: string;
  settings: {
    concurrency: {
      maxConcurrentInference: number;
      queueConcurrency: number;
      processingConcurrency: number;
    };
    batching: {
      enabled: boolean;
      maxBatchSize: number;
      batchTimeout: number;
    };
    models: {
      phase2Primary: string;
      phase2Fallback: string;
      phase3Model: string;
      skipPhase3: boolean;
    };
    timeouts: {
      phase1: number;
      phase2: number;
      phase3: number;
    };
    quality: {
      minConfidence: number;
      maxRetries: number;
      enableFallback: boolean;
    };
    caching: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
  };
}

export const OPTIMIZATION_PROFILES: Record<string, OptimizationProfile> = {
  speed: {
    name: "Speed Mode",
    description: "Maximum throughput with acceptable quality (80+ emails/minute)",
    settings: {
      concurrency: {
        maxConcurrentInference: 30,
        queueConcurrency: 25,
        processingConcurrency: 25
      },
      batching: {
        enabled: true,
        maxBatchSize: 20,
        batchTimeout: 200
      },
      models: {
        phase2Primary: "qwen3:0.6b",
        phase2Fallback: "phi3:mini",
        phase3Model: "llama3.2:3b", // Use smaller model for Phase 3
        skipPhase3: true // Skip Phase 3 for most emails
      },
      timeouts: {
        phase1: 300,
        phase2: 3000,
        phase3: 5000
      },
      quality: {
        minConfidence: 0.5,
        maxRetries: 0,
        enableFallback: true
      },
      caching: {
        enabled: true,
        ttl: 7200000, // 2 hours
        maxSize: 10000
      }
    }
  },

  balanced: {
    name: "Balanced Mode",
    description: "Good balance of speed and quality (60+ emails/minute)",
    settings: {
      concurrency: {
        maxConcurrentInference: 20,
        queueConcurrency: 15,
        processingConcurrency: 20
      },
      batching: {
        enabled: true,
        maxBatchSize: 10,
        batchTimeout: 100
      },
      models: {
        phase2Primary: "llama3.2:3b",
        phase2Fallback: "qwen3:0.6b",
        phase3Model: "doomgrave/phi-4:14b-tools-Q3_K_S",
        skipPhase3: false // Only for critical emails
      },
      timeouts: {
        phase1: 500,
        phase2: 5000,
        phase3: 10000
      },
      quality: {
        minConfidence: 0.6,
        maxRetries: 1,
        enableFallback: true
      },
      caching: {
        enabled: true,
        ttl: 3600000, // 1 hour
        maxSize: 5000
      }
    }
  },

  quality: {
    name: "Quality Mode",
    description: "Maximum analysis quality (40+ emails/minute)",
    settings: {
      concurrency: {
        maxConcurrentInference: 15,
        queueConcurrency: 10,
        processingConcurrency: 15
      },
      batching: {
        enabled: true,
        maxBatchSize: 5,
        batchTimeout: 50
      },
      models: {
        phase2Primary: "llama3.2:3b",
        phase2Fallback: "llama3.2:3b", // Use same model for consistency
        phase3Model: "doomgrave/phi-4:14b-tools-Q3_K_S",
        skipPhase3: false // Always run Phase 3
      },
      timeouts: {
        phase1: 1000,
        phase2: 10000,
        phase3: 20000
      },
      quality: {
        minConfidence: 0.8,
        maxRetries: 2,
        enableFallback: true
      },
      caching: {
        enabled: true,
        ttl: 1800000, // 30 minutes
        maxSize: 2000
      }
    }
  },

  development: {
    name: "Development Mode",
    description: "Debugging and testing configuration",
    settings: {
      concurrency: {
        maxConcurrentInference: 5,
        queueConcurrency: 5,
        processingConcurrency: 5
      },
      batching: {
        enabled: false,
        maxBatchSize: 1,
        batchTimeout: 0
      },
      models: {
        phase2Primary: "llama3.2:3b",
        phase2Fallback: "qwen3:0.6b",
        phase3Model: "doomgrave/phi-4:14b-tools-Q3_K_S",
        skipPhase3: false
      },
      timeouts: {
        phase1: 2000,
        phase2: 30000,
        phase3: 60000
      },
      quality: {
        minConfidence: 0.7,
        maxRetries: 3,
        enableFallback: true
      },
      caching: {
        enabled: false,
        ttl: 0,
        maxSize: 0
      }
    }
  }
};

// Model-specific optimizations
export const MODEL_OPTIMIZATIONS = {
  "llama3.2:3b": {
    num_ctx: 2048,
    num_batch: 512,
    num_gpu: 35,
    f16_kv: true,
    use_mlock: true,
    use_mmap: true,
    repeat_penalty: 1.1,
    num_thread: 8
  },
  "qwen3:0.6b": {
    num_ctx: 1024,
    num_batch: 256,
    num_gpu: 20,
    f16_kv: true,
    use_mlock: true,
    use_mmap: true,
    repeat_penalty: 1.05,
    num_thread: 4
  },
  "doomgrave/phi-4:14b-tools-Q3_K_S": {
    num_ctx: 4096,
    num_batch: 512,
    num_gpu: 35,
    f16_kv: true,
    use_mlock: true,
    use_mmap: true,
    repeat_penalty: 1.1,
    num_thread: 8
  },
  "phi3:mini": {
    num_ctx: 1024,
    num_batch: 256,
    num_gpu: 25,
    f16_kv: true,
    use_mlock: true,
    use_mmap: true,
    repeat_penalty: 1.05,
    num_thread: 4
  }
};

// System recommendations based on hardware
export const HARDWARE_RECOMMENDATIONS = {
  gpu: {
    available: {
      preferredProfile: "balanced",
      modelPreference: ["llama3.2:3b", "doomgrave/phi-4:14b-tools-Q3_K_S"],
      concurrencyBoost: 1.5
    },
    unavailable: {
      preferredProfile: "speed",
      modelPreference: ["qwen3:0.6b", "phi3:mini"],
      concurrencyBoost: 0.7
    }
  },
  memory: {
    low: { // < 16GB
      maxConcurrency: 10,
      preferSmallModels: true,
      cacheSize: 1000
    },
    medium: { // 16-32GB
      maxConcurrency: 20,
      preferSmallModels: false,
      cacheSize: 5000
    },
    high: { // > 32GB
      maxConcurrency: 30,
      preferSmallModels: false,
      cacheSize: 10000
    }
  }
};

// Export helper function to get optimal profile
export function getOptimalProfile(
  targetThroughput: number,
  hasGPU: boolean,
  memoryGB: number
): OptimizationProfile {
  // Determine memory tier
  const memoryTier = memoryGB < 16 ? "low" : memoryGB <= 32 ? "medium" : "high";
  
  // Select base profile based on target
  let profile: OptimizationProfile;
  if (targetThroughput >= 80) {
    profile = { ...OPTIMIZATION_PROFILES.speed } as OptimizationProfile;
  } else if (targetThroughput >= 60) {
    profile = { ...OPTIMIZATION_PROFILES.balanced } as OptimizationProfile;
  } else {
    profile = { ...OPTIMIZATION_PROFILES.quality } as OptimizationProfile;
  }

  // Adjust for hardware
  if (!hasGPU) {
    // Reduce concurrency without GPU
    profile.settings.concurrency.maxConcurrentInference = Math.floor(
      profile.settings.concurrency.maxConcurrentInference * 0.7
    );
    // Use smaller models
    profile.settings.models.phase2Primary = "qwen3:0.6b";
  }

  // Adjust for memory
  const memoryConfig = HARDWARE_RECOMMENDATIONS.memory[memoryTier];
  profile.settings.concurrency.maxConcurrentInference = Math.min(
    profile.settings.concurrency.maxConcurrentInference,
    memoryConfig.maxConcurrency
  );
  profile.settings.caching.maxSize = memoryConfig.cacheSize;

  return profile;
}