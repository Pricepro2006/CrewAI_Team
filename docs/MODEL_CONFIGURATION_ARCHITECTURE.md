# Model Configuration Architecture

## Overview

This document describes the unified model configuration architecture for the CrewAI Team project, which implements a three-stage processing pipeline using local LLM models via Ollama.

## Three-Stage Pipeline Architecture

The system implements a three-stage email processing pipeline:

### Stage 1: Pattern Matching Triage
- **Model**: `pattern-script` (local pattern matching, not an LLM)
- **Purpose**: Fast initial triage of emails using pattern matching
- **Target**: 33,797 emails
- **Expected Time**: < 1 minute
- **Timeout**: 100ms per email

### Stage 2: Primary Analysis
- **Model**: `llama3.2:3b`
- **Purpose**: Main analysis for prioritized emails
- **Target**: 1,000 emails
- **Expected Time**: ~3.5 hours (45s per email on CPU)
- **Timeout**: 45,000ms per email
- **Quality Score**: 6.56/10

### Stage 3: Critical Analysis
- **Model**: `doomgrave/phi-4:14b-tools-Q3_K_S`
- **Fallback Model**: `llama3.2:3b`
- **Purpose**: Deep analysis for critical emails
- **Target**: 100 emails
- **Expected Time**: ~2 hours (180s per email on CPU)
- **Timeout**: 180,000ms per email
- **Quality Score**: 7.75/10

## Configuration Files

### 1. models.config.ts
**Location**: `/src/config/models.config.ts`

The primary configuration file that defines:
- Model names for each stage
- Timeout configurations optimized for CPU inference
- Batch sizes for efficient processing
- Memory management settings
- Pipeline stage configurations
- Quality thresholds

**Key exports**:
- `MODEL_CONFIG` - Main configuration object
- `getModelConfig()` - Get model name by type
- `getModelTimeout()` - Get timeout for a model
- `getModelBatchSize()` - Get batch size for a model
- `canRunModel()` - Check if system has enough memory

### 2. ollama.config.ts
**Location**: `/src/config/ollama.config.ts`

Defines Ollama-specific configuration:
- Base URL and connection settings
- Model registry with context windows and temperatures
- Default model (`llama3.2:3b`)
- Legacy model definitions for backward compatibility

**Environment variables**:
- `OLLAMA_BASE_URL` - Ollama server URL (default: http://localhost:11434)
- `OLLAMA_DEFAULT_MODEL` - Default model (default: llama3.2:3b)
- `OLLAMA_TIMEOUT` - Request timeout (default: 45000ms)
- `OLLAMA_MAX_RETRIES` - Max retry attempts (default: 3)

### 3. model-selection.config.ts
**Location**: `/src/config/model-selection.config.ts`

Provides dynamic model selection based on query complexity:
- Aligned with three-stage pipeline models
- Query complexity analysis
- Model performance metrics
- System load-based model switching

**Key functions**:
- `selectModel()` - Choose model based on query and context
- `getModelForStage()` - Get model for specific pipeline stage
- `getAgentModel()` - Select model for agent tasks
- `analyzeQueryComplexity()` - Analyze query complexity factors

### 4. .env.example
**Location**: `/.env.example`

Environment variable template including:
```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=45000
OLLAMA_DEFAULT_MODEL=llama3.2:3b
OLLAMA_MAX_RETRIES=3

# Three-Stage Pipeline Model Configuration
STAGE1_MODEL=pattern-script
STAGE2_MODEL=llama3.2:3b
STAGE3_MODEL=doomgrave/phi-4:14b-tools-Q3_K_S
STAGE3_FALLBACK_MODEL=llama3.2:3b
```

## Model Usage Patterns

### 1. Direct Model Access
```typescript
import { MODEL_CONFIG, getModelConfig } from './config/models.config';

// Get primary model
const primaryModel = getModelConfig('primary'); // "llama3.2:3b"

// Get critical model
const criticalModel = getModelConfig('critical'); // "doomgrave/phi-4:14b-tools-Q3_K_S"
```

### 2. Dynamic Model Selection
```typescript
import { selectModel } from './config/model-selection.config';

// Select model based on query complexity
const modelConfig = selectModel(query, {
  urgency: 'high',
  accuracy: 'normal',
  isToolSelection: false
});
```

### 3. Pipeline Stage Selection
```typescript
import { getModelForStage } from './config/model-selection.config';

// Get model for Stage 2
const stage2Model = getModelForStage(2); // Returns PRIMARY config
```

## Migration Notes

### Legacy Models
The following models are marked as deprecated but kept for backward compatibility:
- `phi3:mini` - Replaced by `llama3.2:3b`
- `qwen3:0.6b` - Replaced by `llama3.2:3b`
- `llama3.1:8b` - No longer used
- `granite3.3:2b` - Alternative model, not part of main pipeline
- `granite3.3:8b` - Alternative high-quality model

### Hardcoded References Updated
The following files had hardcoded model references that were updated:
1. `src/ui/components/Settings/Settings.tsx` - UI model selection
2. `src/api/routes/email-analysis.router.ts` - API status endpoint
3. `src/core/master-orchestrator/MasterOrchestrator.ts` - Default model
4. `src/core/master-orchestrator/MasterOrchestrator.basic.test.ts` - Test configuration

## Best Practices

1. **Always use configuration imports** - Never hardcode model names
2. **Consider CPU inference timeouts** - Set appropriate timeouts for CPU-based inference
3. **Use model selection logic** - Let the system choose appropriate models based on context
4. **Monitor memory usage** - Use `canRunModel()` before loading large models
5. **Fallback handling** - Always have fallback models configured

## Future Considerations

1. **Model versioning** - Consider adding version tracking for models
2. **Performance monitoring** - Track actual vs expected performance
3. **Auto-download** - Implement automatic model downloading if missing
4. **GPU detection** - Adjust timeouts based on GPU availability
5. **Model pruning** - Remove unused legacy models in future releases

## Troubleshooting

### Common Issues

1. **Model not found**
   - Ensure model is pulled: `ollama pull llama3.2:3b`
   - Check Ollama is running: `curl http://localhost:11434/api/tags`

2. **Timeout errors**
   - Increase timeouts for CPU inference
   - Consider using smaller batch sizes
   - Check system resource availability

3. **Memory errors**
   - Use `canRunModel()` to check before loading
   - Monitor system memory usage
   - Consider using smaller models or batch sizes

### Debug Commands

```bash
# Check available models
curl http://localhost:11434/api/tags

# Pull required models
ollama pull llama3.2:3b
ollama pull doomgrave/phi-4:14b-tools-Q3_K_S

# Test model
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "Hello, world!"
}'
```