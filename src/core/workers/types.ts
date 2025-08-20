/**
 * Type definitions for worker thread communication
 */

// Worker message types
export type WorkerMessageType = 
  | "processJob"
  | "jobComplete"
  | "jobFailed"
  | "metrics"
  | "heartbeat"
  | "shutdown"
  | "ready"
  | "error";

// Messages from main thread to worker
export interface ProcessJobMessage {
  type: "processJob";
  job: any;
  jobId: string;
}

export interface ShutdownMessage {
  type: "shutdown";
}

export type MainToWorkerMessage = ProcessJobMessage | ShutdownMessage;

// Messages from worker to main thread
export interface JobCompleteMessage {
  type: "jobComplete";
  jobId: string;
  data: any;
}

export interface JobFailedMessage {
  type: "jobFailed";
  jobId: string;
  error: string;
}

export interface MetricsMessage {
  type: "metrics";
  data: {
    currentMemoryUsage: number;
    cpuUsage: number;
    processedJobs?: number;
    failedJobs?: number;
  };
}

export interface HeartbeatMessage {
  type: "heartbeat";
  timestamp?: string;
}

export interface ReadyMessage {
  type: "ready";
  message: string;
}

export interface ErrorMessage {
  type: "error";
  error: string;
  details?: any;
}

export type WorkerToMainMessage = 
  | JobCompleteMessage
  | JobFailedMessage
  | MetricsMessage
  | HeartbeatMessage
  | ReadyMessage
  | ErrorMessage;

// Worker data passed on initialization
export interface WorkerInitData {
  workerId: string;
  maxMemory?: number;
  config?: any;
}

// Type guard functions
export function isProcessJobMessage(msg: any): msg is ProcessJobMessage {
  return msg?.type === "processJob" && msg?.job && msg?.jobId;
}

export function isJobCompleteMessage(msg: any): msg is JobCompleteMessage {
  return msg?.type === "jobComplete" && msg?.jobId && msg?.data;
}

export function isJobFailedMessage(msg: any): msg is JobFailedMessage {
  return msg?.type === "jobFailed" && msg?.jobId && msg?.error;
}

export function isMetricsMessage(msg: any): msg is MetricsMessage {
  return msg?.type === "metrics" && msg?.data;
}

export function isHeartbeatMessage(msg: any): msg is HeartbeatMessage {
  return msg?.type === "heartbeat";
}

export function isShutdownMessage(msg: any): msg is ShutdownMessage {
  return msg?.type === "shutdown";
}