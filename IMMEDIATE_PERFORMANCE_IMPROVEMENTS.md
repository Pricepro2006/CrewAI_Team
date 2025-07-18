# Immediate Performance Improvements for CrewAI Team

**Quick wins you can implement RIGHT NOW with your existing models**

## 🚀 Step 1: Update Your Model Configuration (5 minutes)

You already have better models installed! Let's use them:

### Update src/config/model-selection.config.ts

```typescript
export const MODEL_CONFIGS = {
  // Based on test results, granite3.3:2b performed BEST
  COMPLEX: {
    model: "granite3.3:2b", // Keep this - it scored 100% in tests!
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 45000, // Increased from 30000
    description: "Best model for complex queries",
  } as ModelSelectionConfig,

  SIMPLE: {
    model: "qwen3:1.7b", // Better than qwen3:0.6b, still fast
    temperature: 0.3,
    maxTokens: 512,
    timeout: 20000, // Increased from 15000
    description: "Fast model for simple queries",
  } as ModelSelectionConfig,

  BALANCED: {
    model: "qwen3:4b", // You have this! Good middle ground
    temperature: 0.5,
    maxTokens: 1024,
    timeout: 30000,
    description: "Balanced model for medium complexity",
  } as ModelSelectionConfig,

  HIGH_QUALITY: {
    model: "qwen3:14b", // For critical tasks when quality matters most
    temperature: 0.6,
    maxTokens: 4096,
    timeout: 90000,
    description: "Highest quality for critical analysis",
  } as ModelSelectionConfig,
};
```

## 🚀 Step 2: Optimize Ollama Settings (2 minutes)

Add these to your `.bashrc` or `.env` file:

```bash
# Optimize for your AMD Ryzen 7 with 54GB RAM
export OLLAMA_NUM_THREADS=16  # Use all your threads
export OLLAMA_FLASH_ATTENTION=1  # Enable flash attention
export OLLAMA_KV_CACHE_TYPE="q8_0"  # Reduce memory usage
export OLLAMA_NUM_PARALLEL=3  # Allow 3 parallel requests
export OLLAMA_MAX_LOADED_MODELS=3  # Keep 3 models in memory
export OLLAMA_KEEP_ALIVE="10m"  # Keep models loaded longer
```

Then reload:

```bash
source ~/.bashrc
# or restart your terminal
```

## 🚀 Step 3: Fix Agent Routing to Use Better Models (10 minutes)

### Update src/core/master-orchestrator/AgentRouter.ts

```typescript
// Add this improved routing logic
const QUERY_TYPE_PATTERNS = {
  research: {
    pattern:
      /research|investigate|explore|find out|latest|developments|analyze|study/i,
    model: "qwen3:8b", // Use bigger model for research
    agent: "ResearchAgent",
  },
  code: {
    pattern:
      /code|function|implement|write.*program|python|javascript|typescript|fix bug|debug/i,
    model: "qwen3:8b", // Code needs good understanding
    agent: "CodeAgent",
  },
  data: {
    pattern: /analyze.*data|statistics|chart|graph|calculate|metrics|numbers/i,
    model: "qwen3:4b", // Medium model for data
    agent: "DataAnalysisAgent",
  },
  writing: {
    pattern: /write|draft|compose|create content|blog|article|document/i,
    model: "qwen3:4b", // Medium model for writing
    agent: "WriterAgent",
  },
  simple: {
    pattern: /what is|who is|when|where|how many|define|explain briefly/i,
    model: "qwen3:1.7b", // Fast model for simple Q&A
    agent: "WriterAgent",
  },
};

export function selectAgentAndModel(query: string): {
  agent: string;
  model: string;
} {
  // Check patterns in order of complexity
  for (const [type, config] of Object.entries(QUERY_TYPE_PATTERNS)) {
    if (config.pattern.test(query)) {
      return { agent: config.agent, model: config.model };
    }
  }

  // Default to balanced approach
  return { agent: "WriterAgent", model: "qwen3:4b" };
}
```

## 🚀 Step 4: Implement Simple Caching (15 minutes)

### Create src/core/llm/SimpleCache.ts

```typescript
interface CacheEntry {
  query: string;
  response: string;
  timestamp: number;
  model: string;
}

export class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private maxAge = 3600000; // 1 hour
  private maxSize = 100;

  get(query: string): string | null {
    const normalized = query.toLowerCase().trim();
    const entry = this.cache.get(normalized);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(normalized);
      return null;
    }

    return entry.response;
  }

  set(query: string, response: string, model: string) {
    const normalized = query.toLowerCase().trim();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldest = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      )[0];
      this.cache.delete(oldest[0]);
    }

    this.cache.set(normalized, {
      query,
      response,
      timestamp: Date.now(),
      model,
    });
  }
}
```

## 🚀 Step 5: Test Your Improvements (5 minutes)

Run these test queries to see the difference:

```bash
# Start Ollama with the new models
ollama run qwen3:8b "What is the current date?"  # Should be faster than granite

# Pre-load models for better performance
ollama run qwen3:8b ""
ollama run qwen3:4b ""
ollama run qwen3:1.7b ""
```

## 🎯 Expected Improvements

With these changes, you should see:

1. **Response Times**:
   - Simple queries: 10s → 3-5s (using qwen3:1.7b)
   - Complex queries: 26s → 10-15s (using qwen3:8b)
   - Cached queries: <100ms

2. **Quality**:
   - Much better responses from 8B model vs 2B
   - More accurate code generation
   - Better context understanding

3. **Stability**:
   - Proper agent routing
   - No more WriterAgent for everything
   - Clean responses without thinking tags

## 🔧 Troubleshooting

If models are slow to start:

```bash
# Pre-load your main models
ollama run qwen3:8b "test"
ollama run qwen3:4b "test"

# Check memory usage
free -h

# See which models are loaded
ollama ps
```

## 📊 Model Comparison for Your System

Based on your hardware (AMD Ryzen 7, 54GB RAM):

| Model         | Size  | Speed      | Quality    | Best For         |
| ------------- | ----- | ---------- | ---------- | ---------------- |
| qwen3:0.6b    | 522MB | ⚡⚡⚡⚡⚡ | ⭐⭐       | Simple lookups   |
| qwen3:1.7b    | 1.4GB | ⚡⚡⚡⚡   | ⭐⭐⭐     | Basic Q&A        |
| granite3.3:2b | 1.5GB | ⚡⚡⚡⚡   | ⭐⭐⭐     | General use      |
| qwen3:4b      | 2.6GB | ⚡⚡⚡     | ⭐⭐⭐⭐   | Balanced tasks   |
| qwen3:8b      | 5.2GB | ⚡⚡       | ⭐⭐⭐⭐⭐ | Complex analysis |
| qwen3:14b     | 9.3GB | ⚡         | ⭐⭐⭐⭐⭐ | Best quality     |

## 🚦 Next Steps

1. **Now**: Update model config and test
2. **Today**: Fix agent routing
3. **Tomorrow**: Add caching layer
4. **This Week**: Install llama.cpp for even better performance
5. **Next Week**: Implement hybrid architecture

## 💡 Pro Tips

1. **Keep models loaded**: Run `ollama run qwen3:8b ""` to pre-load
2. **Monitor usage**: Run `ollama ps` to see loaded models
3. **Adjust timeouts**: Increase timeouts in your config for larger models
4. **Use model aliases**: `ollama cp qwen3:8b myfast` for easy switching

Start with updating the model configuration - you'll see immediate improvements!
