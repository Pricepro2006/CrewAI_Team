// WebSocket Server Instance
// This is a placeholder - the actual io instance is created during server initialization
// Import from server setup to get the actual instance
export let io = null;
export function setIoInstance(instance) {
    io = instance;
}
// Re-export setup functions
export * from "./setup.js";
