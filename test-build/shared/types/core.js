/**
 * Core type definitions for the CrewAI Team project
 *
 * This file contains fundamental types used across the application,
 * including the Result type pattern for error handling.
 */
/**
 * Sort order enumeration
 */
export var SortOrder;
(function (SortOrder) {
    SortOrder["ASC"] = "asc";
    SortOrder["DESC"] = "desc";
})(SortOrder || (SortOrder = {}));
/**
 * Health check status
 */
export var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "healthy";
    HealthStatus["DEGRADED"] = "degraded";
    HealthStatus["UNHEALTHY"] = "unhealthy";
})(HealthStatus || (HealthStatus = {}));
