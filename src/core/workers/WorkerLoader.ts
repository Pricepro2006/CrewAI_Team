/**
 * Enhanced Worker Loader for TypeScript Support
 *
 * Handles TypeScript worker threads using tsx loader with proper error handling,
 * fallback mechanisms, and production/development environment support.
 */

import { Worker } from "worker_threads";
import { existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { Logger } from "../../utils/logger.js";

const logger = new Logger("WorkerLoader");

// Get the current directory (ES modules compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface WorkerLoaderOptions {
  maxMemory?: number;
  timeout?: number;
  workerData?: any;
  resourceLimits?: {
    maxOldGenerationSizeMb?: number;
    maxYoungGenerationSizeMb?: number;
    codeRangeSizeMb?: number;
    stackSizeMb?: number;
  };
}

export class WorkerLoader {
  private static readonly TYPESCRIPT_LOADER_PATH = join(
    __dirname,
    "typescript-worker-loader.mjs",
  );

  /**
   * Create a worker with TypeScript support
   */
  static createWorker(
    scriptPath: string,
    options: WorkerLoaderOptions = {},
  ): Worker {
    const resolvedPath = this.resolveWorkerPath(scriptPath);

    logger.info(`Creating worker: scriptPath=${scriptPath}, resolvedPath=${resolvedPath}, nodeEnv=${process.env.NODE_ENV}, isTypeScript=${scriptPath.endsWith(".ts")}`);

    // Check if we need TypeScript support
    const isTypeScript = scriptPath.endsWith(".ts");
    const isDevelopment = process.env.NODE_ENV !== "production";

    try {
      if (isTypeScript && isDevelopment) {
        // Use TypeScript loader for .ts files in development
        return this.createTypeScriptWorker(resolvedPath, options);
      } else {
        // Use direct loading for JavaScript files or production
        return this.createJavaScriptWorker(resolvedPath, options);
      }
    } catch (error) {
      logger.error("Failed to create worker", "WorkerLoader", {
        error: error instanceof Error ? error.message : String(error),
        scriptPath: resolvedPath,
        isTypeScript,
        isDevelopment,
      });

      // Fallback: Try JavaScript version if TypeScript fails
      if (isTypeScript && isDevelopment) {
        logger.warn("TypeScript worker failed, trying JavaScript fallback", "WorkerLoader");
        const jsPath = this.getJavaScriptPath(scriptPath);
        if (existsSync(jsPath)) {
          return this.createJavaScriptWorker(jsPath, options);
        }
      }

      throw error;
    }
  }

  /**
   * Create a TypeScript worker using the tsx loader
   */
  private static createTypeScriptWorker(
    scriptPath: string,
    options: WorkerLoaderOptions,
  ): Worker {
    // Verify loader exists
    if (!existsSync(this.TYPESCRIPT_LOADER_PATH)) {
      throw new Error(
        `TypeScript loader not found at ${this.TYPESCRIPT_LOADER_PATH}`,
      );
    }

    // Pass the actual worker path through workerData
    const enhancedWorkerData = {
      actualWorkerPath: scriptPath,
      ...options.workerData,
    };

    logger.debug("Creating TypeScript worker with loader", "WorkerLoader", {
      loader: this.TYPESCRIPT_LOADER_PATH,
      actualWorker: scriptPath,
    });

    // Use the loader script with tsx support
    return new Worker(this.TYPESCRIPT_LOADER_PATH, {
      workerData: enhancedWorkerData,
      resourceLimits: {
        maxOldGenerationSizeMb: options.maxMemory || 512,
        ...options.resourceLimits,
      },
      execArgv: [
        "--import",
        "tsx",
        "--experimental-specifier-resolution=node",
        "--no-warnings",
      ],
    });
  }

  /**
   * Create a JavaScript worker directly
   */
  private static createJavaScriptWorker(
    scriptPath: string,
    options: WorkerLoaderOptions,
  ): Worker {
    return new Worker(scriptPath, {
      workerData: options.workerData,
      resourceLimits: {
        maxOldGenerationSizeMb: options.maxMemory || 512,
        ...options.resourceLimits,
      },
      execArgv: ["--experimental-specifier-resolution=node", "--no-warnings"],
    });
  }

  /**
   * Get JavaScript path from TypeScript path
   */
  private static getJavaScriptPath(scriptPath: string): string {
    if (!scriptPath.endsWith(".ts")) {
      return scriptPath;
    }

    // Try different JavaScript paths
    const paths = [
      // Same directory .js file
      scriptPath.replace(/\.ts$/, ".js"),
      // Dist directory
      scriptPath.replace(/^(?:\.\/)?src\//, "./dist/").replace(/\.ts$/, ".js"),
      // Build directory
      scriptPath.replace(/^(?:\.\/)?src\//, "./build/").replace(/\.ts$/, ".js"),
    ];

    for (const path of paths) {
      const resolvedPath = resolve(path);
      if (existsSync(resolvedPath)) {
        return resolvedPath;
      }
    }

    return scriptPath.replace(/\.ts$/, ".js");
  }

  /**
   * Resolve the worker script path
   */
  private static resolveWorkerPath(scriptPath: string): string {
    // First try the path as-is
    const directPath = resolve(scriptPath);
    if (existsSync(directPath)) {
      return directPath;
    }

    // Try converting .ts to .js for potential compiled versions
    if (scriptPath.endsWith(".ts")) {
      const jsPath = scriptPath.replace(/\.ts$/, ".js");
      const compiledPath = resolve(jsPath);
      if (existsSync(compiledPath)) {
        logger.info("Using compiled JavaScript version", "WorkerLoader", {
          original: scriptPath,
          compiled: compiledPath,
        });
        return compiledPath;
      }

      // Try dist/ version
      const distPath = scriptPath
        .replace(/^(?:\.\/)?src\//, "./dist/")
        .replace(/\.ts$/, ".js");
      const resolvedDistPath = resolve(distPath);
      if (existsSync(resolvedDistPath)) {
        logger.info("Using dist compiled version", "WorkerLoader", {
          original: scriptPath,
          dist: resolvedDistPath,
        });
        return resolvedDistPath;
      }
    }

    // If nothing else works, return the original path and let Worker handle it
    logger.warn("Could not resolve worker path, using original", "WorkerLoader", {
      scriptPath,
    });
    return resolve(scriptPath);
  }

  /**
   * Check if a worker script exists and is accessible
   */
  static validateWorkerScript(scriptPath: string): boolean {
    const resolvedPath = this.resolveWorkerPath(scriptPath);
    const exists = existsSync(resolvedPath);

    if (!exists) {
      logger.error("Worker script not found", "WorkerLoader", {
        originalPath: scriptPath,
        resolvedPath,
      });
    }

    return exists;
  }

  /**
   * Get the recommended worker script path for the current environment
   */
  static getWorkerScriptPath(baseScriptPath: string): string {
    return this.resolveWorkerPath(baseScriptPath);
  }
}

/**
 * Convenience function to create a worker
 */
export function createTSWorker(
  scriptPath: string,
  options: WorkerLoaderOptions = {},
): Worker {
  return WorkerLoader.createWorker(scriptPath, options);
}

/**
 * Get the appropriate worker script path for the current environment
 */
export function getWorkerPath(scriptPath: string): string {
  return WorkerLoader.getWorkerScriptPath(scriptPath);
}
