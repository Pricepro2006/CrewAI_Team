/**
 * TypeScript Worker Loader
 * 
 * This loader script enables TypeScript workers by using Node.js
 * loader hooks with tsx support.
 */

import { workerData as originalWorkerData, parentPort } from 'worker_threads';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// Get the actual worker script path from worker data
const { actualWorkerPath, ...restWorkerData } = originalWorkerData;

if (!actualWorkerPath) {
  throw new Error('actualWorkerPath not provided in workerData');
}

// Make workerData available globally for the worker script
global.workerData = restWorkerData;

// Helper function to load the worker
async function loadWorker(path) {
  const resolvedPath = resolve(path);
  
  // Check if file exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`Worker file not found: ${resolvedPath}`);
  }
  
  // Import and run the actual worker
  try {
    // Convert to file URL for ES module import
    const fileUrl = pathToFileURL(resolvedPath).href;
    await import(fileUrl);
  } catch (error) {
    console.error(`Failed to load worker from ${resolvedPath}:`, error);
    throw error;
  }
}

// Main execution
try {
  await loadWorker(actualWorkerPath);
} catch (error) {
  console.error('Worker loader error:', error);
  
  // Send error to parent if possible
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
  
  process.exit(1);
}