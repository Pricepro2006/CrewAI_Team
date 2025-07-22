/**
 * Custom Error Classes for API
 */
export class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}
export class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409);
    }
}
export class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429);
    }
}
//# sourceMappingURL=errors.js.map