# Worker Thread TypeScript Support

This directory contains the worker thread implementation for parallel email processing with full TypeScript support.

## Overview

The worker system uses a custom TypeScript loader to enable running `.ts` files directly in worker threads during development, with automatic fallback to compiled JavaScript files in production.

## Key Components

### WorkerLoader.ts

The main utility for creating worker threads with TypeScript support:

- Automatically detects TypeScript vs JavaScript files
- Uses `tsx` loader for TypeScript files in development
- Falls back to compiled JavaScript in production
- Provides proper error handling and logging

### typescript-worker-loader.mjs

The loader script that enables TypeScript execution in worker threads:

- Dynamically imports `tsx` for TypeScript support
- Handles module resolution for ES modules
- Provides proper error reporting to parent thread

### EmailProcessingWorker.ts

The main worker implementation for processing emails:

- Implements the 3-phase analysis system
- Manages Ollama connections for LLM processing
- Handles SQLite database operations
- Provides health checks and metrics reporting

### EmailProcessingWorkerPool.ts

Manages a pool of workers for parallel processing:

- Dynamic scaling based on workload
- Redis-backed job queue with BullMQ
- Automatic error recovery and worker replacement
- Real-time metrics and monitoring

## Usage

### Basic Worker Creation

```typescript
import { WorkerLoader } from "./WorkerLoader.js";

// Create a TypeScript worker
const worker = WorkerLoader.createWorker("./path/to/worker.ts", {
  workerData: {
    workerId: "worker-1",
    config: {
      /* worker config */
    },
  },
  maxMemory: 512, // MB
});

// Handle worker messages
worker.on("message", (msg) => {
  console.log("Worker message:", msg);
});

// Handle errors
worker.on("error", (error) => {
  console.error("Worker error:", error);
});
```

### Using the Worker Pool

```typescript
import { EmailProcessingWorkerPool } from "./EmailProcessingWorkerPool.js";
import Redis from "ioredis";

// Create Redis connection
const redis = new Redis();

// Create worker pool
const pool = new EmailProcessingWorkerPool({
  minWorkers: 2,
  maxWorkers: 10,
  workerScriptPath: "./src/core/workers/EmailProcessingWorker.ts",
  redisConnection: redis,
  enableAutoScaling: true,
  maxMemoryPerWorker: 512,
});

// Add jobs to process
await pool.addJobs([
  {
    id: "job-1",
    conversationId: "conv-1",
    emails: [
      /* email data */
    ],
    priority: "high",
    options: {},
  },
]);

// Monitor metrics
pool.on("metrics", (metrics) => {
  console.log("Pool metrics:", metrics);
});
```

## Environment Support

### Development Mode

- TypeScript files are loaded directly using `tsx`
- Full source map support for debugging
- Hot reload capabilities (restart workers on file changes)

### Production Mode

- Automatically uses compiled JavaScript files
- Falls back to dist/ or build/ directories
- Optimized for performance

## Testing

Run the test scripts to verify worker functionality:

```bash
# Test basic worker loading
tsx scripts/test-worker-loading.ts

# Test the full worker pool
tsx scripts/test-email-worker-pool.ts
```

## Troubleshooting

### Common Issues

1. **"Unknown file extension '.ts'" Error**
   - Ensure `tsx` is installed: `npm install tsx`
   - Check that NODE_ENV is not set to 'production' during development

2. **Worker fails to initialize**
   - Check database file exists at `./data/crewai_enhanced.db`
   - Ensure Ollama is running for LLM operations
   - Verify Redis is accessible for job queuing

3. **Memory issues**
   - Adjust `maxMemoryPerWorker` in pool configuration
   - Monitor worker metrics for memory usage
   - Consider reducing batch sizes

### Debug Mode

Enable debug logging by setting environment variables:

```bash
DEBUG=* tsx your-script.ts
```

## Performance Considerations

- Each worker maintains its own database connection
- Ollama connections are pooled within each worker (max 3)
- Workers process emails in batches for efficiency
- Automatic scaling based on queue depth
- Memory monitoring prevents OOM errors

## Best Practices

1. **Worker Design**
   - Keep workers stateless when possible
   - Use worker data for configuration
   - Implement proper error handling
   - Send regular heartbeats

2. **Resource Management**
   - Set appropriate memory limits
   - Monitor CPU and memory usage
   - Implement graceful shutdown
   - Clean up resources on exit

3. **Error Handling**
   - Always wrap initialization in try-catch
   - Send errors to parent thread
   - Implement retry logic for transient failures
   - Log errors with context

4. **Production Deployment**
   - Compile TypeScript before deployment
   - Use NODE_ENV=production
   - Monitor worker health
   - Implement proper logging
