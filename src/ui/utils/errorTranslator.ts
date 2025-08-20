/**
 * Error message translator - converts technical errors to user-friendly messages
 */

interface ErrorMapping {
  pattern: RegExp | string;
  message: string;
  category: "network" | "auth" | "validation" | "server" | "client" | "unknown";
}

const ERROR_MAPPINGS: ErrorMapping[] = [
  // Network errors
  {
    pattern: /network|fetch|ERR_NETWORK|ERR_INTERNET_DISCONNECTED/i,
    message: "Connection lost. Please check your internet connection.",
    category: "network",
  },
  {
    pattern: /timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i,
    message: "Request timed out. The server might be slow or unavailable.",
    category: "network",
  },
  {
    pattern: /ECONNREFUSED|ECONNRESET/i,
    message: "Unable to connect to the server. Please try again later.",
    category: "network",
  },
  {
    pattern: /CORS|cross-origin/i,
    message: "Access denied due to security restrictions.",
    category: "network",
  },

  // Authentication errors
  {
    pattern: /401|unauthorized|authentication failed/i,
    message: "Your session has expired. Please log in again.",
    category: "auth",
  },
  {
    pattern: /403|forbidden|access denied/i,
    message: "You don't have permission to perform this action.",
    category: "auth",
  },
  {
    pattern: /csrf|CSRF/i,
    message: "Security validation failed. Please refresh the page and try again.",
    category: "auth",
  },
  {
    pattern: /token|jwt|bearer/i,
    message: "Authentication error. Please log in again.",
    category: "auth",
  },

  // Validation errors
  {
    pattern: /validation|invalid|required field/i,
    message: "Please check your input and try again.",
    category: "validation",
  },
  {
    pattern: /duplicate|already exists/i,
    message: "This item already exists. Please use a different name.",
    category: "validation",
  },
  {
    pattern: /maximum|exceeded|too large|too many/i,
    message: "The request exceeds the allowed limit.",
    category: "validation",
  },
  {
    pattern: /minimum|too small|insufficient/i,
    message: "The value is below the minimum requirement.",
    category: "validation",
  },

  // Server errors
  {
    pattern: /500|internal server error/i,
    message: "Something went wrong on our end. Please try again later.",
    category: "server",
  },
  {
    pattern: /502|bad gateway/i,
    message: "Server communication error. Please wait a moment and try again.",
    category: "server",
  },
  {
    pattern: /503|service unavailable/i,
    message: "Service temporarily unavailable. Please try again in a few minutes.",
    category: "server",
  },
  {
    pattern: /504|gateway timeout/i,
    message: "Server is taking too long to respond. Please try again.",
    category: "server",
  },
  {
    pattern: /database|sqlite|postgres|mysql|mongodb/i,
    message: "Database connection issue. Please try again later.",
    category: "server",
  },

  // Client errors
  {
    pattern: /404|not found/i,
    message: "The requested resource was not found.",
    category: "client",
  },
  {
    pattern: /429|rate limit|too many requests/i,
    message: "Too many requests. Please slow down and try again.",
    category: "client",
  },
  {
    pattern: /chunk load error|loading chunk/i,
    message: "Application loading error. Please refresh the page.",
    category: "client",
  },
  {
    pattern: /syntax error|parse error|JSON/i,
    message: "Data processing error. Please contact support if this persists.",
    category: "client",
  },

  // Specific service errors
  {
    pattern: /ollama|llm|model/i,
    message: "AI service is currently unavailable. Some features may be limited.",
    category: "server",
  },
  {
    pattern: /websocket|ws:|wss:/i,
    message: "Real-time connection lost. Attempting to reconnect...",
    category: "network",
  },
  {
    pattern: /redis|cache/i,
    message: "Cache service issue. Performance may be affected.",
    category: "server",
  },
  {
    pattern: /email|smtp|mail/i,
    message: "Email service error. Notifications may be delayed.",
    category: "server",
  },
];

export function translateError(error: Error | string): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorString = String(errorMessage).toLowerCase();

  // Find matching error pattern
  for (const mapping of ERROR_MAPPINGS) {
    if (typeof mapping.pattern === "string") {
      if (errorString.includes(mapping?.pattern?.toLowerCase())) {
        return mapping.message;
      }
    } else if (mapping?.pattern?.test(errorMessage)) {
      return mapping.message;
    }
  }

  // Default messages based on error type
  if (error instanceof TypeError) {
    return "An unexpected error occurred. Please refresh the page.";
  }
  if (error instanceof RangeError) {
    return "Invalid value provided. Please check your input.";
  }
  if (error instanceof SyntaxError) {
    return "Data format error. Please contact support.";
  }

  // Generic fallback
  return "An unexpected error occurred. Please try again.";
}

export function getErrorCategory(error: Error | string): ErrorMapping["category"] {
  const errorMessage = error instanceof Error ? error.message : error;

  for (const mapping of ERROR_MAPPINGS) {
    if (typeof mapping.pattern === "string") {
      if (errorMessage.toLowerCase().includes(mapping?.pattern?.toLowerCase())) {
        return mapping.category;
      }
    } else if (mapping?.pattern?.test(errorMessage)) {
      return mapping.category;
    }
  }

  return "unknown";
}

export function getErrorSeverity(error: Error | string): "low" | "medium" | "high" | "critical" {
  const category = getErrorCategory(error);
  const errorMessage = error instanceof Error ? error.message : error;

  // Critical errors
  if (
    category === "auth" ||
    /critical|fatal|emergency/i.test(errorMessage)
  ) {
    return "critical";
  }

  // High severity
  if (
    category === "server" ||
    /500|502|503|database/i.test(errorMessage)
  ) {
    return "high";
  }

  // Low severity
  if (
    category === "validation" ||
    /warning|info/i.test(errorMessage)
  ) {
    return "low";
  }

  // Default to medium
  return "medium";
}

export function isRecoverableError(error: Error | string): boolean {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Non-recoverable errors
  const nonRecoverable = [
    /401|403|authentication|forbidden/i,
    /critical|fatal/i,
    /syntax error|parse error/i,
  ];

  for (const pattern of nonRecoverable) {
    if (pattern.test(errorMessage)) {
      return false;
    }
  }

  // Recoverable errors
  const recoverable = [
    /network|timeout|connection/i,
    /429|rate limit/i,
    /503|unavailable/i,
    /websocket/i,
  ];

  for (const pattern of recoverable) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }

  return false; // Default to non-recoverable
}