import { WebSocket } from "ws";
import { logger } from "../../utils/logger";
import {
  AppError,
  ErrorCode,
  WebSocketError,
} from "../../utils/error-handling/server";
import { getUserFriendlyError } from "../../utils/error-handling/error-messages";

export interface WebSocketErrorMessage {
  type: "error";
  error: {
    code: string;
    message: string;
    userMessage?: {
      title: string;
      message: string;
      action?: string;
    };
    timestamp: string;
    reconnect?: boolean;
  };
}

/**
 * Enhanced WebSocket with error handling capabilities
 */
export interface ErrorHandlingWebSocket extends WebSocket {
  clientId?: string;
  isAlive?: boolean;
  lastError?: Error;
  errorCount?: number;
  sendError?: (error: Error | AppError) => void;
}

/**
 * WebSocket error handler that sends formatted error messages
 */
export function handleWebSocketError(
  ws: ErrorHandlingWebSocket,
  error: Error | AppError,
  context?: any,
): void {
  // Increment error count
  ws.errorCount = (ws.errorCount || 0) + 1;
  ws.lastError = error;

  // Log the error
  logger.error("WebSocket error", "WEBSOCKET", {
    clientId: ws.clientId,
    error: error.message,
    stack: error.stack,
    errorCount: ws.errorCount,
    context,
  });

  // Format error message
  let errorMessage: WebSocketErrorMessage;

  if (error instanceof AppError) {
    const userFriendly = getUserFriendlyError(error.code, error.details);

    errorMessage = {
      type: "error",
      error: {
        code: error.code,
        message: error.message,
        userMessage: userFriendly,
        timestamp: error.timestamp,
        reconnect: shouldReconnect(error.code),
      },
    };
  } else {
    errorMessage = {
      type: "error",
      error: {
        code: "WEBSOCKET_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "An error occurred"
            : error.message,
        userMessage: {
          title: "Connection Error",
          message: "An error occurred with the real-time connection.",
          action: "The connection will attempt to reconnect automatically.",
        },
        timestamp: new Date().toISOString(),
        reconnect: true,
      },
    };
  }

  // Send error message if connection is open
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(errorMessage));
    } catch (sendError) {
      logger.error("Failed to send error message", "WEBSOCKET", {
        error:
          sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  }

  // Close connection if too many errors
  if (ws.errorCount >= 10) {
    logger.error("Too many errors, closing WebSocket connection", "WEBSOCKET", {
      clientId: ws.clientId,
      errorCount: ws.errorCount,
    });
    ws.close(1011, "Too many errors");
  }
}

/**
 * WebSocket error recovery middleware
 */
export function createWebSocketErrorRecovery() {
  return (ws: ErrorHandlingWebSocket) => {
    // Add error sending helper
    ws.sendError = (error: Error | AppError) => {
      handleWebSocketError(ws, error);
    };

    // Wrap send method with error handling
    const originalSend = ws.send.bind(ws);
    ws.send = function (
      data: Parameters<typeof originalSend>[0],
      ...args: any[]
    ) {
      try {
        const cb =
          typeof args[args.length - 1] === "function"
            ? args[args.length - 1]
            : undefined;
        originalSend(data, ...args);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        handleWebSocketError(ws, err, { action: "send" });
        throw err;
      }
    } as typeof ws.send;

    // Enhanced error event handling
    ws.on("error", (error) => {
      handleWebSocketError(ws, error, { event: "error" });
    });

    // Handle unexpected close
    ws.on("close", (code, reason) => {
      if (code !== 1000 && code !== 1001) {
        // Not normal closure
        logger.warn("WebSocket closed unexpectedly", "WEBSOCKET", {
          clientId: ws.clientId,
          code,
          reason: reason?.toString(),
          errorCount: ws.errorCount,
        });
      }
    });
  };
}

/**
 * Heartbeat mechanism for connection health
 */
export function setupWebSocketHeartbeat(
  ws: ErrorHandlingWebSocket,
  interval: number = 30000,
): NodeJS.Timeout {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
    ws.errorCount = 0; // Reset error count on successful pong
  });

  const heartbeatInterval = setInterval(() => {
    if (!ws.isAlive) {
      logger.warn("WebSocket heartbeat failed", "WEBSOCKET", {
        clientId: ws.clientId,
      });
      ws.terminate();
      return;
    }

    ws.isAlive = false;
    ws.ping((err: Error | undefined) => {
      if (err) {
        handleWebSocketError(ws, err, { action: "ping" });
      }
    });
  }, interval);

  ws.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return heartbeatInterval;
}

/**
 * Message validation with error handling
 */
export async function validateWebSocketMessage(
  ws: ErrorHandlingWebSocket,
  message: any,
  validator: (msg: any) => boolean | Promise<boolean>,
): Promise<boolean> {
  try {
    const isValid = await validator(message);

    if (!isValid) {
      throw WebSocketError("Invalid message format", {
        message,
        clientId: ws.clientId,
      });
    }

    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    handleWebSocketError(ws, err, { action: "validate", message });
    return false;
  }
}

/**
 * Rate limiting with error handling
 */
export class WebSocketRateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000,
  ) {}

  check(ws: ErrorHandlingWebSocket): boolean {
    const clientId = ws.clientId || "anonymous";
    const now = Date.now();
    const requests = this.requests.get(clientId) || [];

    // Remove old requests
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      const error = new AppError(
        "RATE_LIMIT_EXCEEDED" as ErrorCode,
        "WebSocket rate limit exceeded",
        429,
        {
          limit: this.maxRequests,
          window: this.windowMs,
          retryAfter:
            validRequests.length > 0 && validRequests[0] !== undefined
              ? this.windowMs - (now - validRequests[0])
              : this.windowMs,
        },
      );

      handleWebSocketError(ws, error);
      return false;
    }

    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }

  reset(clientId?: string): void {
    if (clientId) {
      this.requests.delete(clientId);
    } else {
      this.requests.clear();
    }
  }
}

/**
 * Determine if client should attempt reconnection
 */
function shouldReconnect(errorCode: string): boolean {
  const noReconnectCodes = [
    "UNAUTHORIZED",
    "FORBIDDEN",
    "RATE_LIMIT_EXCEEDED",
    "INVALID_OPERATION",
  ];

  return !noReconnectCodes.includes(errorCode);
}

/**
 * WebSocket connection manager with error recovery
 */
export class WebSocketConnectionManager {
  private connections = new Map<string, ErrorHandlingWebSocket>();
  private reconnectAttempts = new Map<string, number>();

  add(clientId: string, ws: ErrorHandlingWebSocket): void {
    this.connections.set(clientId, ws);
    this.reconnectAttempts.set(clientId, 0);

    ws.on("close", () => {
      this.connections.delete(clientId);
    });
  }

  remove(clientId: string): void {
    const ws = this.connections.get(clientId);
    if (ws) {
      ws.close(1000, "Connection closed by server");
      this.connections.delete(clientId);
      this.reconnectAttempts.delete(clientId);
    }
  }

  broadcast(
    message: any,
    filter?: (ws: ErrorHandlingWebSocket) => boolean,
  ): void {
    const data = JSON.stringify(message);

    this.connections.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN && (!filter || filter(ws))) {
        try {
          ws.send(data);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          handleWebSocketError(ws, err, { action: "broadcast" });
        }
      }
    });
  }

  getConnection(clientId: string): ErrorHandlingWebSocket | undefined {
    return this.connections.get(clientId);
  }

  getAllConnections(): ErrorHandlingWebSocket[] {
    return Array.from(this.connections.values());
  }
}
