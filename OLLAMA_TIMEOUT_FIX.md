# Ollama Timeout Fix Documentation

## Problem Summary

The CrewAI_Team system was experiencing timeout errors when calling Ollama's API:
- Error: `AxiosError: timeout of 30000ms exceeded`
- Affected models: qwen3:14b (large model taking longer than 30 seconds)
- Root cause: Default 30-second timeout too short for large models

## Research Findings

Based on comprehensive research across Google, Bing, and Yandex (2025 solutions):

1. **Keep-Alive Parameter**: Critical for keeping models loaded in memory
2. **Timeout Configuration**: Need to increase from 30s to 5-10 minutes
3. **Ollama-JS Library**: Official library with better integration than axios
4. **Streaming Responses**: Improves user experience and prevents timeouts

## Solutions Implemented

### 1. Updated OllamaProvider.ts

Changes made:
- Increased axios timeout from 30s to 300s (5 minutes)
- Added `keep_alive: '15m'` parameter to all requests
- Updated timeouts for generate, stream, and embed endpoints

```typescript
// Before
timeout: 30000, // 30 seconds

// After
timeout: 300000, // 5 minutes
keep_alive: '15m', // Keep model loaded for 15 minutes
```

### 2. Created Ollama Environment Configuration

File: `.env.ollama`
```bash
OLLAMA_REQUEST_TIMEOUT=600s
OLLAMA_KEEP_ALIVE=30m
OLLAMA_MAX_LOADED_MODELS=3
OLLAMA_MAX_QUEUE=512
OLLAMA_NUM_PARALLEL=4
```

### 3. Created Optimized Startup Script

File: `scripts/start-ollama-optimized.sh`
- Sets environment variables
- Pre-loads models with extended keep_alive
- Ensures models stay in memory

### 4. Alternative Implementation: OllamaJSProvider

Created `OllamaJSProvider.ts` using the official ollama-js library:
- Better TypeScript support
- Native streaming support
- Built-in keep_alive handling
- More robust error handling

## Usage Instructions

### Method 1: Use Updated OllamaProvider (Quick Fix)

1. Restart Ollama with optimized settings:
   ```bash
   ./scripts/start-ollama-optimized.sh
   ```

2. The existing code will now use 5-minute timeouts and keep models loaded

### Method 2: Switch to OllamaJSProvider (Recommended)

1. Install the ollama package:
   ```bash
   pnpm install
   ```

2. Update imports to use OllamaJSProvider:
   ```typescript
   import { OllamaJSProvider } from './OllamaJSProvider';
   
   const provider = new OllamaJSProvider({
     model: 'qwen3:14b',
     keepAlive: '30m',
     host: 'http://localhost:11434'
   });
   ```

## Best Practices

1. **Model Selection**:
   - Use smaller models (qwen3:8b) for faster responses
   - Reserve large models (qwen3:14b) for complex tasks

2. **Keep-Alive Strategy**:
   - Development: 15-30 minutes
   - Production: 5-10 minutes (balance memory vs performance)
   - Use `-1` for infinite (not recommended)

3. **Timeout Configuration**:
   - Simple queries: 1-2 minutes
   - Complex queries: 5-10 minutes
   - Embeddings: 2-5 minutes

4. **Performance Optimization**:
   - Pre-load frequently used models
   - Use streaming for better UX
   - Monitor memory usage
   - Implement request queuing

## Testing the Fix

1. Start Ollama with optimized settings:
   ```bash
   ./scripts/start-ollama-optimized.sh
   ```

2. Test with a simple query:
   ```bash
   curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{
       "model": "qwen3:14b",
       "prompt": "Hello, how are you?",
       "keep_alive": "15m"
     }'
   ```

3. Run the application and verify chat works without timeouts

## Monitoring

Check Ollama status:
```bash
# View loaded models
curl http://localhost:11434/api/tags

# Check model status
curl http://localhost:11434/api/show -d '{"name": "qwen3:14b"}'
```

## Troubleshooting

If timeouts persist:

1. Check Ollama is running: `ps aux | grep ollama`
2. Verify environment variables: `env | grep OLLAMA`
3. Check system resources: `htop` or `nvidia-smi`
4. Review Ollama logs: `journalctl -u ollama -f`
5. Try smaller model: `qwen2.5:0.5b` for testing

## References

- [Ollama JavaScript Library](https://github.com/ollama/ollama-js)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Keep-Alive Parameter Guide](https://ollama.com/blog/streaming-tool)
- [Timeout Troubleshooting](https://markaicode.com/troubleshooting-ollama-tool-execution-timeouts/)

## Summary

The timeout issue has been resolved by:
1. Increasing timeouts from 30s to 5 minutes
2. Adding keep_alive parameter to keep models loaded
3. Creating optimized startup configuration
4. Providing alternative ollama-js implementation

The system should now handle large model queries without timeout errors.