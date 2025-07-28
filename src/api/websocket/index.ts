// WebSocket Server Instance
// This is a placeholder - the actual io instance is created during server initialization
// Import from server setup to get the actual instance

export let io: any = null;

export function setIoInstance(instance: any) {
  io = instance;
}

// Re-export setup functions
export * from "./setup.js";
