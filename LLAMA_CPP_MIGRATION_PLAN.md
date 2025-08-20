# Llama.cpp Migration Plan - Complete Removal of Ollama

## Current State Analysis

### Files with Ollama References (82 occurrences)
1. **Core LLM System**:
   - `/src/core/llm/LLMProviderFactory.ts` - Has fallback to Ollama
   - `/src/core/llm/OllamaProvider.ts` - Full Ollama implementation

2. **Configuration Files**:
   - `/src/config/ollama.config.ts` - Ollama configuration
   - `/src/config/app.config.ts` - References Ollama config
   - `/src/config/models.config.ts` - Has ollamaUrl setting

3. **Server & Health Checks**:
   - `/src/api/server.ts` - Health check for Ollama at line 140-144
   - `/src/utils/ollama-manager.ts` - Ollama startup manager

4. **Test Files**:
   - `/src/tests/performance/email-processing-benchmark.test.ts`
   - Multiple test utilities reference Ollama

5. **Type Definitions**:
   - `/src/types/email-pipeline-health.types.ts`
   - `/src/types/environment.d.ts`

## Migration Steps

### Phase 1: Create Secure Llama.cpp Provider ✅ PRIORITY
1. Create `/src/core/llm/SafeLlamaCppProvider.ts`:
   - Resource limits (max processes, memory limits)
   - Path validation (prevent traversal)
   - Process pooling
   - Secure configuration

### Phase 2: Update Factory & Configuration
1. Modify `LLMProviderFactory.ts`:
   - Remove Ollama fallback
   - Use only llama.cpp providers
   - Update auto-selection logic

2. Update configuration files:
   - Remove `ollama.config.ts`
   - Update `app.config.ts`
   - Clean `models.config.ts`

### Phase 3: Update Health Checks
1. Modify server health endpoint:
   - Replace Ollama check with llama.cpp check
   - Update health monitoring

### Phase 4: Clean Test Files
1. Update test utilities
2. Remove OllamaManager references
3. Update benchmark tests

### Phase 5: Remove Ollama Files
1. Delete `/src/core/llm/OllamaProvider.ts`
2. Delete `/src/utils/ollama-manager.ts`
3. Delete `/src/config/ollama.config.ts`

## Security Fixes Required

### 1. Resource Limits (CRITICAL)
```typescript
// Current vulnerability in LlamaCppProvider.ts:142-144
this.process = spawn(this.llamaCppPath, args, {
  stdio: ["pipe", "pipe", "pipe"],
});
// No limits on process spawning!
```

### 2. Path Traversal (CRITICAL)
```typescript
// Current vulnerability in LlamaCppProvider.ts:80-81
this.llamaCppPath = process.env.LLAMA_CPP_PATH || 
  path.join(process.cwd(), "llama.cpp", "build", "bin", "llama-cli");
// No validation of LLAMA_CPP_PATH!
```

## Implementation Priority
1. **IMMEDIATE**: Create SafeLlamaCppProvider with security fixes
2. **HIGH**: Update LLMProviderFactory to use safe provider
3. **MEDIUM**: Update health checks and monitoring
4. **LOW**: Clean up test files and remove Ollama references