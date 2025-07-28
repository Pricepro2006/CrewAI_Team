export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Business logic errors
  INVALID_OPERATION = 'INVALID_OPERATION',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Integration errors
  OLLAMA_CONNECTION_ERROR = 'OLLAMA_CONNECTION_ERROR',
  OLLAMA_MODEL_NOT_FOUND = 'OLLAMA_MODEL_NOT_FOUND',
  CHROMADB_CONNECTION_ERROR = 'CHROMADB_CONNECTION_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  DISK_FULL = 'DISK_FULL',
}

export interface AppErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  stack?: string;
  timestamp: string;
  requestId?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: string;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): AppErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

// Predefined error factory functions
export const BadRequestError = (message: string, details?: any) =>
  new AppError(ErrorCode.BAD_REQUEST, message, 400, details);

export const UnauthorizedError = (message: string = 'Unauthorized', details?: any) =>
  new AppError(ErrorCode.UNAUTHORIZED, message, 401, details);

export const ForbiddenError = (message: string = 'Forbidden', details?: any) =>
  new AppError(ErrorCode.FORBIDDEN, message, 403, details);

export const NotFoundError = (resource: string, details?: any) =>
  new AppError(ErrorCode.NOT_FOUND, `${resource} not found`, 404, details);

export const ValidationError = (message: string, details?: any) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);

export const ConflictError = (message: string, details?: any) =>
  new AppError(ErrorCode.CONFLICT, message, 409, details);

export const InternalServerError = (message: string = 'Internal server error', details?: any) =>
  new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details, false);

export const ServiceUnavailableError = (service: string, details?: any) =>
  new AppError(ErrorCode.SERVICE_UNAVAILABLE, `${service} is currently unavailable`, 503, details);

export const DatabaseError = (message: string, details?: any) =>
  new AppError(ErrorCode.DATABASE_ERROR, message, 500, details, false);

export const OllamaConnectionError = (details?: any) =>
  new AppError(ErrorCode.OLLAMA_CONNECTION_ERROR, 'Failed to connect to Ollama service', 503, details);

export const OllamaModelNotFoundError = (model: string, details?: any) =>
  new AppError(ErrorCode.OLLAMA_MODEL_NOT_FOUND, `Ollama model '${model}' not found`, 404, details);

export const ChromaDBConnectionError = (details?: any) =>
  new AppError(ErrorCode.CHROMADB_CONNECTION_ERROR, 'Failed to connect to ChromaDB', 503, details);

export const WebSocketError = (message: string, details?: any) =>
  new AppError(ErrorCode.WEBSOCKET_ERROR, message, 500, details);

export const FileNotFoundError = (path: string, details?: any) =>
  new AppError(ErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, 404, details);

export const FileAccessDeniedError = (path: string, details?: any) =>
  new AppError(ErrorCode.FILE_ACCESS_DENIED, `Access denied: ${path}`, 403, details);

export const RateLimitError = (details?: any) =>
  new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', 429, details);