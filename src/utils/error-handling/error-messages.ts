import { ErrorCode } from './error-types';

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  technical?: string;
}

const errorMessages: Record<ErrorCode, (details?: any) => UserFriendlyError> = {
  [ErrorCode.BAD_REQUEST]: (details) => ({
    title: 'Invalid Request',
    message: 'The request contains invalid data. Please check your input and try again.',
    action: 'Review the form fields and ensure all required information is provided correctly.',
    technical: details?.message,
  }),

  [ErrorCode.UNAUTHORIZED]: () => ({
    title: 'Authentication Required',
    message: 'You need to sign in to access this feature.',
    action: 'Please sign in with your credentials.',
  }),

  [ErrorCode.FORBIDDEN]: () => ({
    title: 'Access Denied',
    message: 'You don\'t have permission to perform this action.',
    action: 'Contact your administrator if you believe you should have access.',
  }),

  [ErrorCode.NOT_FOUND]: (details) => ({
    title: 'Not Found',
    message: details?.resource ? `The requested ${details.resource} could not be found.` : 'The requested resource could not be found.',
    action: 'Check the URL or try searching for what you need.',
  }),

  [ErrorCode.CONFLICT]: () => ({
    title: 'Conflict Detected',
    message: 'This action conflicts with the current state. The resource may have been modified.',
    action: 'Refresh the page and try again.',
  }),

  [ErrorCode.VALIDATION_ERROR]: (details) => ({
    title: 'Validation Error',
    message: details?.fields ? 'Some fields contain invalid values.' : 'The provided data is invalid.',
    action: 'Please correct the highlighted fields and try again.',
    technical: details?.fields,
  }),

  [ErrorCode.RATE_LIMIT_EXCEEDED]: (details) => ({
    title: 'Too Many Requests',
    message: 'You\'ve made too many requests. Please slow down.',
    action: details?.retryAfter ? `Try again in ${Math.ceil(details.retryAfter / 1000)} seconds.` : 'Wait a moment before trying again.',
  }),

  [ErrorCode.INTERNAL_SERVER_ERROR]: () => ({
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Our team has been notified.',
    action: 'Please try again later. If the problem persists, contact support.',
  }),

  [ErrorCode.SERVICE_UNAVAILABLE]: (details) => ({
    title: 'Service Temporarily Unavailable',
    message: details?.service ? `The ${details.service} service is temporarily unavailable.` : 'The service is temporarily unavailable.',
    action: 'Please try again in a few minutes.',
  }),

  [ErrorCode.DATABASE_ERROR]: () => ({
    title: 'Database Error',
    message: 'We\'re having trouble accessing our data.',
    action: 'Please try again. If the issue continues, contact support.',
  }),

  [ErrorCode.EXTERNAL_SERVICE_ERROR]: (details) => ({
    title: 'External Service Error',
    message: details?.service ? `We couldn't connect to ${details.service}.` : 'An external service is not responding.',
    action: 'This is usually temporary. Please try again in a few moments.',
  }),

  [ErrorCode.INVALID_OPERATION]: () => ({
    title: 'Invalid Operation',
    message: 'This operation cannot be performed in the current state.',
    action: 'Review your actions and ensure all prerequisites are met.',
  }),

  [ErrorCode.INSUFFICIENT_CREDITS]: () => ({
    title: 'Insufficient Credits',
    message: 'You don\'t have enough credits to perform this action.',
    action: 'Purchase more credits or upgrade your plan.',
  }),

  [ErrorCode.QUOTA_EXCEEDED]: (details) => ({
    title: 'Quota Exceeded',
    message: details?.quotaType ? `You\'ve exceeded your ${details.quotaType} quota.` : 'You\'ve exceeded your quota.',
    action: 'Upgrade your plan or wait for your quota to reset.',
  }),

  [ErrorCode.OLLAMA_CONNECTION_ERROR]: () => ({
    title: 'AI Service Unavailable',
    message: 'Cannot connect to the AI model service.',
    action: 'Ensure Ollama is running and accessible. Check your connection settings.',
  }),

  [ErrorCode.OLLAMA_MODEL_NOT_FOUND]: (details) => ({
    title: 'AI Model Not Found',
    message: details?.model ? `The AI model '${details.model}' is not available.` : 'The requested AI model is not available.',
    action: 'Install the model or select a different one from available models.',
  }),

  [ErrorCode.CHROMADB_CONNECTION_ERROR]: () => ({
    title: 'Vector Database Unavailable',
    message: 'Cannot connect to the vector database.',
    action: 'Check that ChromaDB is running and accessible.',
  }),

  [ErrorCode.WEBSOCKET_ERROR]: () => ({
    title: 'Real-time Connection Error',
    message: 'Lost connection to real-time updates.',
    action: 'Check your internet connection. The page will automatically reconnect.',
  }),

  [ErrorCode.FILE_NOT_FOUND]: (details) => ({
    title: 'File Not Found',
    message: details?.filename ? `The file '${details.filename}' could not be found.` : 'The requested file could not be found.',
    action: 'Check the file path and ensure the file exists.',
  }),

  [ErrorCode.FILE_ACCESS_DENIED]: (details) => ({
    title: 'File Access Denied',
    message: details?.filename ? `Cannot access '${details.filename}'.` : 'Cannot access the requested file.',
    action: 'Check file permissions or contact your administrator.',
  }),

  [ErrorCode.DISK_FULL]: () => ({
    title: 'Storage Full',
    message: 'There is not enough storage space to complete this operation.',
    action: 'Free up some space or contact your administrator.',
  }),
};

export function getUserFriendlyError(code: ErrorCode, details?: any): UserFriendlyError {
  const errorMessageFn = errorMessages[code];
  if (errorMessageFn) {
    return errorMessageFn(details);
  }

  // Fallback for unknown error codes
  return {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred.',
    action: 'Please try again. If the problem persists, contact support.',
  };
}

export function getErrorSeverity(code: ErrorCode): 'info' | 'warning' | 'error' | 'critical' {
  switch (code) {
    case ErrorCode.NOT_FOUND:
    case ErrorCode.VALIDATION_ERROR:
      return 'info';
    
    case ErrorCode.RATE_LIMIT_EXCEEDED:
    case ErrorCode.CONFLICT:
    case ErrorCode.INSUFFICIENT_CREDITS:
    case ErrorCode.QUOTA_EXCEEDED:
      return 'warning';
    
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.FORBIDDEN:
    case ErrorCode.BAD_REQUEST:
    case ErrorCode.INVALID_OPERATION:
    case ErrorCode.FILE_NOT_FOUND:
    case ErrorCode.FILE_ACCESS_DENIED:
      return 'error';
    
    case ErrorCode.INTERNAL_SERVER_ERROR:
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.SERVICE_UNAVAILABLE:
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
    case ErrorCode.OLLAMA_CONNECTION_ERROR:
    case ErrorCode.CHROMADB_CONNECTION_ERROR:
    case ErrorCode.DISK_FULL:
      return 'critical';
    
    default:
      return 'error';
  }
}