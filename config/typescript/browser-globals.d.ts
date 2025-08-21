/**
 * Minimal browser globals type declarations for server build compatibility
 * 
 * This file provides minimal type definitions for browser globals that are used
 * within proper runtime guards in shared utility files. This allows the server
 * build to compile while maintaining runtime environment detection.
 * 
 * These types are only used for compilation - the runtime guards ensure 
 * browser-specific code only runs in browser environments.
 */

// Window object with minimal required properties
declare global {
  interface Window {
    location: {
      protocol: string;
      hostname: string;
      port: string;
    };
    addEventListener(type: string, listener: EventListener): void;
  }

  // Browser error event types
  interface ErrorEvent extends Event {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    error?: Error;
  }

  interface PromiseRejectionEvent extends Event {
    reason: any;
  }

  // EventListener type
  interface EventListener {
    (evt: Event): void;
  }

  // Basic Event interface
  interface Event {
    type: string;
  }

  // Only declare window if it's not already declared
  var window: Window | undefined;
}

export {};