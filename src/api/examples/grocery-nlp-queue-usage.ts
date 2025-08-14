/**
 * Grocery NLP Queue API Usage Examples
 * Demonstrates how to use the queue system for different scenarios
 */

import { getGroceryNLPQueue } from "../services/GroceryNLPQueue.js";
import type { 
  ProcessNLPRequest, 
  BatchProcessRequest,
  QueueConfiguration 
} from "../types/grocery-nlp.types.js";

// Mock NLP processing function for examples
const mockNLPProcessor = async (query: string, metadata?: Record<string, any>) => {
  // Simulate varying processing times
  const delay = Math.random() * 1000 + 200;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  return {
    query,
    entities: ["grocery", "food"],
    confidence: 0.85,
    result: `Processed: ${query}`,
    metadata
  };
};

/**
 * Example 1: Basic single query processing
 */
export async function basicQueryExample() {
  console.log("Example 1: Basic Query Processing");
  
  const queue = getGroceryNLPQueue();
  
  try {
    const result = await queue.enqueue(
      () => mockNLPProcessor("Find apples in store"),
      "normal", // priority
      10000,    // timeout (10 seconds)
      "Find apples in store", // query for deduplication
      { userId: "user123", source: "example" } // metadata
    );
    
    console.log("Query result:", result);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

/**
 * Example 2: High priority query processing
 */
export async function highPriorityQueryExample() {
  console.log("Example 2: High Priority Query");
  
  const queue = getGroceryNLPQueue();
  
  try {
    const result = await queue.enqueue(
      () => mockNLPProcessor("Emergency: Check milk availability"),
      "high", // high priority - processed first
      5000,   // shorter timeout for urgent requests
      "Emergency: Check milk availability",
      { userId: "admin", priority: "urgent" }
    );
    
    console.log("High priority result:", result);
  } catch (error) {
    console.error("High priority query failed:", error);
  }
}

/**
 * Example 3: Batch processing multiple queries
 */
export async function batchProcessingExample() {
  console.log("Example 3: Batch Processing");
  
  const queue = getGroceryNLPQueue();
  
  const queries = [
    "Find bread prices",
    "Check vegetable availability",
    "Compare cereal brands",
    "Locate organic produce",
    "Search for dairy products"
  ];
  
  const operations = queries.map(query => 
    () => mockNLPProcessor(query, { batchItem: true })
  );
  
  try {
    const results = await queue.enqueueBatch(
      operations,
      "normal",
      {
        batchId: "grocery-search-batch-1",
        timeout: 15000,
        failFast: false, // continue processing even if some fail
        maxConcurrency: 3
      }
    );
    
    console.log(`Batch processing completed. Processed ${results.length} queries.`);
    results.forEach((result, index) => {
      console.log(`Query ${index + 1}:`, result);
    });
    
  } catch (error) {
    console.error("Batch processing failed:", error);
  }
}

/**
 * Example 4: Queue monitoring and metrics
 */
export async function monitoringExample() {
  console.log("Example 4: Queue Monitoring");
  
  const queue = getGroceryNLPQueue();
  
  // Get current status
  const status = queue.getStatus();
  console.log("Queue Status:", {
    healthy: status.healthy,
    queueSize: status.queueSize,
    activeRequests: status.activeRequests,
    estimatedWaitTime: status.estimatedWaitTime
  });
  
  // Get detailed metrics
  const metrics = queue.getMetrics();
  console.log("Queue Metrics:", {
    totalRequests: metrics.totalRequests,
    successRate: metrics.successRate,
    averageProcessingTime: metrics.averageProcessingTime,
    averageWaitTime: metrics.averageWaitTime,
    throughput: metrics.throughput
  });
  
  // Get configuration
  const config = queue.getConfiguration();
  console.log("Queue Configuration:", {
    maxConcurrent: config.maxConcurrent,
    defaultTimeout: config.defaultTimeout,
    deduplicationEnabled: config.deduplicationEnabled
  });
}

/**
 * Example 5: Queue event handling
 */
export function eventHandlingExample() {
  console.log("Example 5: Event Handling");
  
  const queue = getGroceryNLPQueue();
  
  // Listen for queue updates
  queue.on('queueUpdate', (event) => {
    console.log("Queue updated:", event.data);
  });
  
  // Listen for request status changes
  queue.on('requestStatus', (event) => {
    console.log(`Request ${event.data.requestId} status: ${event.data.status}`);
  });
  
  // Listen for metrics updates
  queue.on('metricsUpdate', (event) => {
    console.log("Metrics updated:", {
      successRate: event.data.successRate,
      averageProcessingTime: event.data.averageProcessingTime
    });
  });
  
  // Listen for batch completion
  queue.on('batchCompleted', (event) => {
    console.log(`Batch ${event.batchId} completed:`, {
      completed: event.completedCount,
      failed: event.failedCount
    });
  });
}

/**
 * Example 6: Request cancellation
 */
export async function cancellationExample() {
  console.log("Example 6: Request Cancellation");
  
  const queue = getGroceryNLPQueue();
  
  // Start a long-running query
  const queryPromise = queue.enqueue(
    async () => {
      // Simulate a long operation
      await new Promise(resolve => setTimeout(resolve, 5000));
      return mockNLPProcessor("Long running query");
    },
    "normal",
    10000,
    "Long running query"
  );
  
  // Cancel after 1 second
  setTimeout(() => {
    // Find the request in the queue
    const items = queue.getQueueItems();
    const pendingItem = items.find(item => 
      item.status === "pending" && item.query === "Long running query"
    );
    
    if (pendingItem) {
      const cancelled = queue.cancelRequest(pendingItem.id);
      console.log(`Cancellation ${cancelled ? 'successful' : 'failed'}`);
    }
  }, 1000);
  
  try {
    const result = await queryPromise;
    console.log("Query completed:", result);
  } catch (error) {
    console.log("Query was cancelled:", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Example 7: Configuration updates
 */
export async function configurationExample() {
  console.log("Example 7: Configuration Updates");
  
  const queue = getGroceryNLPQueue();
  
  // Get current configuration
  const currentConfig = queue.getConfiguration();
  console.log("Current config:", currentConfig);
  
  // Update configuration
  queue.updateConfiguration({
    maxConcurrent: 4, // increase concurrency
    deduplicationTTL: 10 * 60 * 1000, // 10 minutes
    healthCheck: {
      maxQueueSize: 100,
      maxErrorRate: 0.05, // 5% error rate threshold
      maxProcessingTime: 3000
    }
  });
  
  const updatedConfig = queue.getConfiguration();
  console.log("Updated config:", updatedConfig);
}

/**
 * Example 8: WebSocket client simulation
 */
export function websocketClientExample() {
  console.log("Example 8: WebSocket Client Simulation");
  
  // This would be used on the client side
  const mockWebSocketClient = {
    connect: () => {
      console.log("Connecting to ws://localhost:3000/api/grocery/nlp/subscribe");
      
      // Mock WebSocket connection
      const mockWs = {
        send: (data: string) => {
          const message = JSON.parse(data);
          console.log("Sending:", message);
          
          // Simulate responses
          setTimeout(() => {
            if (message.type === 'subscribe') {
              console.log("Received subscription confirmation");
            } else if (message.type === 'ping') {
              console.log("Received pong");
            }
          }, 100);
        },
        
        onmessage: (event: any) => {
          const data = JSON.parse(event.data);
          console.log("Received:", data);
        },
        
        onerror: (error: any) => {
          console.error("WebSocket error:", error);
        },
        
        onclose: () => {
          console.log("WebSocket connection closed");
        }
      };
      
      // Subscribe to queue updates
      mockWs.send(JSON.stringify({
        type: 'subscribe',
        subscriptions: ['queue_updates', 'request_status', 'metrics_updates']
      }));
      
      // Send periodic pings
      setInterval(() => {
        mockWs.send(JSON.stringify({ type: 'ping' }));
      }, 30000);
      
      return mockWs;
    }
  };
  
  const client = mockWebSocketClient.connect();
  return client;
}

/**
 * Example 9: tRPC client usage (would be used from frontend)
 */
export const tRPCClientExample = {
  // This shows how the tRPC client would be used
  usageExample: `
    // Frontend TypeScript code using tRPC client
    
    import { trpc } from './trpc-client';
    
    // Process single query
    const result = await trpc.groceryNLPQueue.process.mutate({
      query: "Find organic vegetables",
      priority: "normal",
      metadata: { userId: "user123" }
    });
    
    // Process batch
    const batchResult = await trpc.groceryNLPQueue.processBatch.mutate({
      queries: [
        { query: "Find milk" },
        { query: "Check bread prices" },
        { query: "Locate fruits" }
      ],
      priority: "normal"
    });
    
    // Get queue status
    const status = await trpc.groceryNLPQueue.getStatus.query();
    
    // Get metrics
    const metrics = await trpc.groceryNLPQueue.getMetrics.query();
    
    // Cancel request
    await trpc.groceryNLPQueue.cancelRequest.mutate({
      requestId: "req-123"
    });
  `
};

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("=".repeat(50));
  console.log("GROCERY NLP QUEUE API EXAMPLES");
  console.log("=".repeat(50));
  
  try {
    await basicQueryExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    await highPriorityQueryExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    await batchProcessingExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    await monitoringExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    eventHandlingExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    await cancellationExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    await configurationExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    websocketClientExample();
    console.log("\n" + "-".repeat(30) + "\n");
    
    console.log("tRPC Client Example:");
    console.log(tRPCClientExample.usageExample);
    
  } catch (error) {
    console.error("Example execution error:", error);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("EXAMPLES COMPLETED");
  console.log("=".repeat(50));
}

// Export for direct usage
export default {
  basicQueryExample,
  highPriorityQueryExample,
  batchProcessingExample,
  monitoringExample,
  eventHandlingExample,
  cancellationExample,
  configurationExample,
  websocketClientExample,
  tRPCClientExample,
  runAllExamples
};