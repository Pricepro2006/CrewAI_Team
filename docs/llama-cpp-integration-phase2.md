# LlamaCpp Integration - Phase 2: Backend Service Updates

## Summary

Successfully updated backend services to use LlamaCppHttpProvider instead of OllamaProvider. All production files now use llama.cpp on port 8081 instead of Ollama on port 11434.

## Files Updated

### 1. Core Worker Files
- **src/core/workers/EmailProcessingWorker.ts**
  - Removed Ollama imports and connection pool
  - Added dynamic import of LlamaCppHttpProvider
  - Updated to use llama.cpp on port 8081
  - Modified batch processing methods to use new provider interface
  - Updated cleanup methods

### 2. Service Layer
- **src/core/services/OptimizedEmailProcessor.ts**
  - Removed OllamaOptimizer dependency
  - Direct integration with LlamaCppHttpProvider
  - Updated generate methods to use llama.cpp API format
  - Modified metrics to use provider info instead of Ollama metrics

- **src/core/services/OllamaOptimizer.ts**
  - Renamed conceptually to LlamaCpp optimizer (kept class name for compatibility)
  - Updated default port from 11434 to 8081
  - Changed API endpoints from Ollama format to OpenAI-compatible format
  - Modified inference methods to use /v1/chat/completions endpoint
  - Updated model preloading logic

### 3. API Routes
- **src/api/routes/businessSearch.ts**
  - Replaced OllamaProvider with LlamaCppHttpProvider
  - Added provider initialization logic
  - Updated all endpoints to ensure provider is initialized

### 4. Resilience Layer
- **src/core/resilience/CircuitBreakerIntegration.ts**
  - Created CircuitBreakerLlamaCppProvider extending LlamaCppHttpProvider
  - Updated fallback mechanisms for llama.cpp
  - Modified response handling for new format
  - Updated singleton exports

### 5. Configuration
- **src/config/index.ts**
  - Updated default LLAMA_CPP_URL from port 11434 to 8081

## Key Changes

### Port Migration
- All references to port 11434 changed to 8081
- WebSocket remains on port 8080 (no conflict)

### API Format Changes
- Ollama `/api/generate` → OpenAI `/v1/chat/completions`
- Ollama `/api/pull` → Removed (models pre-loaded with llama.cpp)
- Response parsing updated for OpenAI format

### Provider Interface
- Generate methods now use `maxTokens` instead of `num_predict`
- Response handling checks for `response.response` or string directly
- Added initialization checks before provider usage

### Error Handling
- Added fallback for connection failures
- Provider initialization with retry logic
- Graceful degradation when llama-server is unavailable

## Benefits

1. **Single LLM Server**: One llama-server instance instead of Ollama
2. **Better Performance**: Direct C++ implementation
3. **Resource Efficiency**: Lower memory usage with GGUF models
4. **Compatibility**: OpenAI-compatible API for easier integration
5. **Flexibility**: Can switch models without restarting services

## Next Steps

1. **Testing**: Verify all services work with new provider
2. **Model Management**: Ensure GGUF models are available
3. **Performance Tuning**: Optimize llama.cpp server settings
4. **Monitoring**: Update health checks for new endpoint

## Migration Notes

- Test files intentionally kept with Ollama mocks for now
- OllamaOptimizer class name retained for backward compatibility
- Service will attempt to start llama-server if not running
- Fallback to error messages if server unavailable

## Configuration Required

Ensure llama-server is running:
```bash
./llama.cpp/build/bin/llama-server \
  -m ./models/llama-3.2-3b-instruct.Q4_K_M.gguf \
  --host 0.0.0.0 \
  --port 8081 \
  --ctx-size 8192 \
  --n-gpu-layers 35
```

Or use the automated service startup via LlamaCppService.