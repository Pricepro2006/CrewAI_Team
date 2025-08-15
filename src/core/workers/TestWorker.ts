/**
 * Simple Test Worker for TypeScript loading validation
 */

import { parentPort, workerData } from "worker_threads";

// Simple logger for testing
const log = (message: string, data?: any) => {
  console.log(`[TestWorker-${workerData?.workerId || 'unknown'}] ${message}`, data || '');
};

log("Test worker starting up...", { workerData });

// Set up message handlers
if (parentPort) {
  parentPort.on("message", (message: any) => {
    log("Received message", { type: message.type });
    
    switch (message.type) {
      case "ping":
        parentPort?.postMessage({ 
          type: "pong", 
          message: "TypeScript worker is working!" 
        });
        break;
        
      case "shutdown":
        log("Shutdown requested");
        parentPort?.postMessage({ 
          type: "shutdown_complete",
          message: "Worker shutting down gracefully"
        });
        process.exit(0);
        break;
        
      default:
        log("Unknown message type", { type: message.type });
    }
  });
  
  // Send ready signal
  parentPort.postMessage({ 
    type: "ready", 
    message: "TypeScript test worker ready!" 
  });
} else {
  log("No parent port available");
  process.exit(1);
}

// Send heartbeat
const heartbeat = setInterval(() => {
  if (parentPort) {
    parentPort.postMessage({ 
      type: "heartbeat", 
      timestamp: new Date().toISOString() 
    });
  }
}, 1000);

// Cleanup on exit
process.on('exit', () => {
  clearInterval(heartbeat);
  log("Worker process exiting");
});

log("Test worker setup complete");