/**
 * Shared Types System - Integration Coordinator
 * Comprehensive TypeScript interfaces for all system components
 * This is the single source of truth for all data models across the system
 */
// Core System Types
export * from "./core.js";
export * from "./api.js";
export * from "./database.js";
// Export websocket types except conflicting ones
export * from "./websocket.js";
export * from "./agents.js";
export * from "./monitoring.js";
export * from "./validation.js";
export * from "./email.js";
export * from "./orchestration.js";
export * from "./rag.js";
export * from "./auth.js";
export * from "./events.js";
// Type guards and validation utilities
export function isString(value) {
    return typeof value === "string";
}
export function isNumber(value) {
    return typeof value === "number" && !isNaN(value);
}
export function isBoolean(value) {
    return typeof value === "boolean";
}
export function isArray(value) {
    return Array.isArray(value);
}
export function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isDefined(value) {
    return value !== undefined && value !== null;
}
